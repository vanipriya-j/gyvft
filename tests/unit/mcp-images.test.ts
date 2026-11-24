import { beforeEach, describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import { EventEmitter } from "node:events";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
import {
  openAiDownloadUrl,
  publicIpv4,
  prepareMcpImages,
  prepareMcpRequirementFiles,
  optimiseMcpImage,
} from "@/lib/mcp/images";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);
});
describe("GPT image inputs", () => {
  it("pins the verified address and keeps TLS/Host bound to the OpenAI file host", async () => {
    const bytes = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#62713f" },
    })
      .png()
      .toBuffer();
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    mocks.request.mockImplementation(
      (_options: unknown, callback: (response: unknown) => void) => {
        const req = Object.assign(new EventEmitter(), {
          end: () => {
            queueMicrotask(() => {
              const response = Object.assign(new EventEmitter(), {
                statusCode: 200,
                headers: { "content-length": String(bytes.length) },
                resume: vi.fn(),
                destroy: vi.fn(),
              });
              callback(response);
              queueMicrotask(() => {
                response.emit("data", bytes);
                response.emit("end");
              });
            });
          },
        });
        return req;
      },
    );
    const [image] = await prepareMcpImages([
      {
        download_url:
          "https://files.oaiusercontent.com/fixture-image?signature=not-forwarded",
        file_id: "file_fixture_image",
      },
    ]);
    expect(image.mime).toBe("image/webp");
    expect(mocks.request.mock.calls[0][0]).toMatchObject({
      hostname: "93.184.216.34",
      servername: "files.oaiusercontent.com",
      headers: { Host: "files.oaiusercontent.com" },
    });
    expect(JSON.stringify(mocks.request.mock.calls[0][0])).not.toContain(
      "Authorization",
    );
  });
  it("downloads requirement PDFs through the same pinned transport and sanitises filenames", async () => {
    const bytes = Buffer.from("%PDF-1.4\nFictional fixture\n%%EOF");
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    mocks.request.mockImplementation(
      (_options: unknown, callback: (response: unknown) => void) =>
        Object.assign(new EventEmitter(), {
          end() {
            queueMicrotask(() => {
              const response = Object.assign(new EventEmitter(), {
                statusCode: 200,
                headers: { "content-length": String(bytes.length) },
                resume: vi.fn(),
                destroy: vi.fn(),
              });
              callback(response);
              queueMicrotask(() => {
                response.emit("data", bytes);
                response.emit("end");
              });
            });
          },
          destroy: vi.fn(),
        }),
    );
    const [file] = await prepareMcpRequirementFiles([
      {
        file_id: "file_pdf",
        download_url: "https://files.oaiusercontent.com/requirement",
        file_name: "folder/" + "x".repeat(160),
      },
    ]);
    expect(file.mime).toBe("application/pdf");
    expect(file.filename).not.toContain("/");
    expect(file.filename).toHaveLength(160);
    expect(file.filename.endsWith(".pdf")).toBe(true);
    expect(Buffer.from(file.data, "base64")).toEqual(bytes);
    expect(mocks.request.mock.calls[0][0]).toMatchObject({
      hostname: "93.184.216.34",
      servername: "files.oaiusercontent.com",
    });
  });
  it("revalidates redirected hosts and rejects malformed redirects", async () => {
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    for (const location of ["https://127.0.0.1/private", "http://[bad-host"]) {
      mocks.request.mockClear();
      mocks.request.mockImplementation(
        (_options: unknown, callback: (response: unknown) => void) =>
          Object.assign(new EventEmitter(), {
            end: () =>
              queueMicrotask(() =>
                callback(
                  Object.assign(new EventEmitter(), {
                    statusCode: 302,
                    headers: { location },
                    resume: vi.fn(),
                    destroy: vi.fn(),
                  }),
                ),
              ),
          }),
      );
      await expect(
        prepareMcpImages([
          {
            download_url: "https://files.oaiusercontent.com/fixture-image",
            file_id: "file_fixture_image",
          },
        ]),
      ).rejects.toThrow();
      expect(mocks.request).toHaveBeenCalledTimes(1);
    }
  });
  it("accepts host-provided image URLs and rejects private, forged-host and credential URLs", () => {
    expect(
      openAiDownloadUrl(
        "https://files.oaiusercontent.com/file-test?token=fixture",
      ).hostname,
    ).toBe("files.oaiusercontent.com");
    for (const value of [
      "http://files.oaiusercontent.com/file",
      "https://127.0.0.1/file",
      "https://files.oaiusercontent.com.attacker.example/file",
      "https://user:pass@files.oaiusercontent.com/file",
      "https://files.oaiusercontent.com:8443/file",
      "file:///etc/passwd",
      "data:image/png;base64,test",
    ]) {
      expect(() => openAiDownloadUrl(value)).toThrow();
    }
    for (const ip of [
      "0.0.0.0",
      "10.1.2.3",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "192.168.0.1",
      "192.0.2.1",
      "198.18.0.1",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
      "::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(publicIpv4(ip), ip).toBe(false);
    }
    expect(publicIpv4("93.184.216.34")).toBe(true);
  });
  it("rejects a host resolving to private IPs before making an HTTP request", async () => {
    await expect(
      prepareMcpImages([
        {
          file_id: "file_fixture",
          download_url: "https://files.oaiusercontent.com/file-fixture",
        },
      ]),
    ).rejects.toThrow("host could not be verified");
    expect(mocks.request).not.toHaveBeenCalled();
    mocks.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]);
    await expect(
      prepareMcpImages([
        {
          file_id: "file_fixture",
          download_url: "https://files.oaiusercontent.com/file-fixture",
        },
      ]),
    ).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("normalises real image bytes into bounded WebP previews and rejects other files", async () => {
    const bytes = await sharp({
      create: { width: 2200, height: 1200, channels: 3, background: "#8a974a" },
    })
      .png()
      .toBuffer();
    const output = await optimiseMcpImage(bytes),
      preview = Buffer.from(output.data, "base64"),
      metadata = await sharp(preview).metadata();
    expect(output.mime).toBe("image/webp");
    expect(preview.length).toBeLessThanOrEqual(320 * 1024);
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.exif).toBeUndefined();
    await expect(optimiseMcpImage(Buffer.from("not an image"))).rejects.toThrow(
      "could not be prepared",
    );
  });
});
