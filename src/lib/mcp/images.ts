import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import sharp from "sharp";
import { z } from "zod";
import { MAX_OPTION_PREVIEW_BYTES } from "@/lib/customer/option-image-model";
import { validImage } from "@/lib/customer/images";
export const openAiFileSchema = z
  .object({
    download_url: z.string().url().max(12000),
    file_id: z.string().min(5).max(256),
    mime_type: z.string().max(100).optional(),
    file_name: z.string().max(300).optional(),
  })
  .strict();
export type OpenAiFile = z.infer<typeof openAiFileSchema>;
export class McpImageError extends Error {}
export function openAiDownloadUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hash ||
    !(
      url.hostname === "files.oaiusercontent.com" ||
      url.hostname.endsWith(".oaiusercontent.com") ||
      url.hostname.endsWith(".openaiusercontent.com") ||
      url.hostname.endsWith(".blob.core.windows.net")
    )
  )
    throw new McpImageError(
      "Use an image attached to this GPT conversation. External or private-network URLs are not accepted.",
    );
  return url;
}
export function publicIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false;
  const [a, b, c] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
async function download(
  value: string,
  signal: AbortSignal,
  redirects = 0,
): Promise<Buffer> {
  if (redirects > 3)
    throw new McpImageError(
      "The attached image redirected too many times. Attach it again.",
    );
  const url = openAiDownloadUrl(value),
    addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((item) => !publicIpv4(item.address)))
    throw new McpImageError("The image host could not be verified.");
  const result = await new Promise<{ bytes?: Buffer; location?: string }>(
    (resolve, reject) => {
      // Connect to the checked IP while preserving SNI and Host; DNS cannot rebind the request.
      const req = request(
        {
          hostname: addresses[0].address,
          servername: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: "GET",
          headers: {
            Host: url.host,
            Accept: "image/png,image/jpeg,image/webp",
          },
          signal,
        },
        (response) => {
          if (
            response.statusCode &&
            [301, 302, 303, 307, 308].includes(response.statusCode)
          ) {
            response.resume();
            try {
              if (response.headers.location)
                return resolve({
                  location: new URL(response.headers.location, url).href,
                });
            } catch {
              /* Malformed remote redirects are not followed. */
            }
            return reject(
              new McpImageError(
                "The image link is unavailable. Attach it again.",
              ),
            );
          }
          if (response.statusCode !== 200) {
            response.resume();
            return reject(
              new McpImageError(
                "The image link has expired or is unavailable. Attach it again.",
              ),
            );
          }
          const limit = 10 * 1024 * 1024;
          if (Number(response.headers["content-length"] || 0) > limit) {
            response.destroy();
            return reject(new McpImageError("Use images under 10 MB each."));
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > limit) {
              response.destroy();
              reject(new McpImageError("Use images under 10 MB each."));
            } else chunks.push(chunk);
          });
          response.on("end", () => resolve({ bytes: Buffer.concat(chunks) }));
          response.on("error", () =>
            reject(
              new McpImageError(
                "The image could not be downloaded. Attach it again.",
              ),
            ),
          );
        },
      );
      req.on("error", () =>
        reject(
          new McpImageError(
            "The image could not be downloaded. Attach it again.",
          ),
        ),
      );
      req.end();
    },
  );
  return result.location
    ? download(result.location, signal, redirects + 1)
    : result.bytes!;
}
export async function optimiseMcpImage(bytes: Buffer) {
  try {
    if (
      !["image/png", "image/jpeg", "image/webp"].some((mime) =>
        validImage(bytes.subarray(0, 24), mime),
      )
    )
      throw Error("format");
    const metadata = await sharp(bytes, {
      limitInputPixels: 24000000,
    }).metadata();
    if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format))
      throw Error("format");
    for (const size of [1600, 1280, 1024, 800])
      for (const quality of [88, 74, 60]) {
        const data = await sharp(bytes, { limitInputPixels: 24000000 })
          .rotate()
          .flatten({ background: "#fff" })
          .resize(size, size, { fit: "inside", withoutEnlargement: true })
          .webp({ quality })
          .toBuffer();
        if (data.length <= MAX_OPTION_PREVIEW_BYTES)
          return { mime: "image/webp", data: data.toString("base64") };
      }
  } catch {
    /* Never return provider errors or signed file URLs. */
  }
  throw new McpImageError(
    "This image could not be prepared. Use a smaller PNG, JPEG or WebP image.",
  );
}
export async function prepareMcpImages(raw: unknown, signal?: AbortSignal) {
  const files = z
    .array(openAiFileSchema)
    .max(6)
    .parse(raw ?? []);
  const output = new Array<{ mime: string; data: string }>(files.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(2, files.length) }, async () => {
      while (cursor < files.length) {
        const index = cursor++,
          file = files[index];
        openAiDownloadUrl(file.download_url);
        const timeout = AbortSignal.timeout(12000);
        const bytes = await download(
          file.download_url,
          signal ? AbortSignal.any([signal, timeout]) : timeout,
        );
        output[index] = await optimiseMcpImage(bytes);
      }
    }),
  );
  return output;
}
