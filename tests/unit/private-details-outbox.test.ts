// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  queueDetails,
  pendingDetails,
  syncDetails,
  clearPrivateDetails,
} from "@/lib/customer/private-details-outbox";
const account = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = {
  accountId: account,
  kind: "profile" as const,
  id: account,
  version: null,
  document: { name: "Fictional tester" },
  href: "/account/profile",
};
describe("private detail browser outbox", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    clearPrivateDetails();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("coalesces submitted edits offline and keeps other accounts separate", () => {
    queueDetails(input);
    queueDetails({ ...input, document: { name: "Newer local edit" } });
    expect(pendingDetails(account)).toHaveLength(1);
    expect(pendingDetails(account)[0].document.name).toBe("Newer local edit");
    expect(pendingDetails("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    clearPrivateDetails();
    expect(pendingDetails(account)).toEqual([]);
  });
  it("keeps an uncertain result, backs off, then safely replays the same document", async () => {
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    queueDetails(input);
    vi.stubGlobal("navigator", { onLine: true });
    vi.mocked(fetch).mockRejectedValueOnce(Error("lost response"));
    await syncDetails(account);
    expect(pendingDetails(account)[0].attempts).toBe(1);
    await syncDetails(account);
    expect(fetch).toHaveBeenCalledTimes(1);
    now += 5000;
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ ok: true, version: "a".repeat(64) }),
    );
    await syncDetails(account);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string),
    ).toEqual(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string));
    expect(pendingDetails(account)).toEqual([]);
  });
  it("honours backpressure and stops automatic retries for conflict or account changes", async () => {
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    queueDetails(input);
    vi.stubGlobal("navigator", { onLine: true });
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        { ok: false },
        { status: 503, headers: { "Retry-After": "20" } },
      ),
    );
    await syncDetails(account);
    expect(pendingDetails(account)[0].nextAt).toBeGreaterThanOrEqual(
      now + 20000,
    );
    now += 21000;
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        { ok: false, error: { message: "Record changed elsewhere" } },
        { status: 409 },
      ),
    );
    await syncDetails(account);
    expect(pendingDetails(account)[0].blocked).toBe(true);
    now += 60000;
    await syncDetails(account);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(pendingDetails(account)[0].document).toEqual(input.document);
  });
  it("does not claim a local save when browser storage rejects it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("storage denied");
    });
    expect(() => queueDetails(input)).toThrow("storage denied");
    expect(fetch).not.toHaveBeenCalled();
  });
});
