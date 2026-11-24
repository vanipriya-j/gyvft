import { z } from "zod";
import { customerJson } from "@/lib/customer/api";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { AppError } from "@/lib/errors/app-error";
import { McpAuthError } from "./auth";
import { mcpOrigin } from "./config";
export const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
export function rateLimitMcp(request: Request, operation: string, limit = 30) {
  assertPublicFormRateLimit({
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown",
    formKey: "mcp-" + operation,
    limit,
    windowMs: 60000,
  });
}
export function sameMcpOrigin(request: Request) {
  return (
    request.headers.get("origin") === mcpOrigin() &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export async function oauthForm(request: Request) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/x-www-form-urlencoded")
  )
    throw new McpAuthError("invalid_request");
  const reader = request.body?.getReader();
  if (!reader) throw new McpAuthError("invalid_request");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16000) {
      await reader.cancel();
      throw new McpAuthError("invalid_request");
    }
    chunks.push(value);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}
export { customerJson };
export function oauthFailure(error: unknown) {
  if (error instanceof AppError && error.code === "RATE_LIMITED")
    return Response.json(
      { error: "temporarily_unavailable" },
      { status: 429, headers: { ...noStore, "Retry-After": "60" } },
    );
  const code =
    error instanceof McpAuthError
      ? error.code
      : error instanceof z.ZodError
        ? "invalid_request"
        : "temporarily_unavailable";
  return Response.json(
    { error: code },
    {
      status: code === "temporarily_unavailable" ? 503 : 400,
      headers: noStore,
    },
  );
}
