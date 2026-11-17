import "server-only";
import { getCustomerAccount, type CustomerAccount } from "./session";
import { AppError } from "@/lib/errors/app-error";
import { z } from "zod";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { recordCustomerEvent } from "./observability";
export const customerReply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      ...(status === 429 ? { "Retry-After": "60" } : {}),
    },
  });
export async function customerJson(request: Request) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new AppError("VALIDATION_ERROR", "Send application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("VALIDATION_ERROR", "Missing request body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 2048) {
      await reader.cancel();
      throw new AppError("VALIDATION_ERROR", "Request is too large.", {
        status: 413,
      });
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON.");
  }
}
/** Cookie-authenticated writes must originate from this app, unlike operator APIs. */
export async function customerApi(
  request: Request,
  mutation: boolean,
  handler: (account: CustomerAccount) => Promise<Response>,
) {
  try {
    if (mutation) {
      const origin = request.headers.get("origin");
      if (
        !origin ||
        origin !== new URL(request.url).origin ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        throw new AppError("FORBIDDEN", "This request must come from GYVFT.");
    }
    assertPublicFormRateLimit({
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown",
      formKey: "customer-api-entry",
      limit: 180,
      windowMs: 60000,
    });
    const account = await getCustomerAccount();
    if (!account)
      throw new AppError("UNAUTHORIZED", "Please sign in to GYVFT.");
    assertPublicFormRateLimit({
      ip: account.id,
      formKey: mutation ? "customer-api-write" : "customer-api-read",
      limit: mutation ? 30 : 120,
      windowMs: 60000,
    });
    return await handler(account);
  } catch (error) {
    if (error instanceof AppError)
      return customerReply(
        { ok: false, error: { code: error.code, message: error.message } },
        error.status,
      );
    if (error instanceof z.ZodError)
      return customerReply(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Check the required fields.",
          },
        },
        400,
      );
    const code =
      error && typeof error === "object" && "code" in error ? error.code : null;
    const setup = code === "42P01" || code === "42703";
    await recordCustomerEvent("app.error", {
      metadata: {
        route: new URL(request.url).pathname,
        operation: "home",
        code: setup ? "HOME_SETUP_REQUIRED" : "HOME_API_FAILED",
        status: 503,
      },
    });
    return customerReply(
      {
        ok: false,
        error: {
          code: setup ? "SETUP_REQUIRED" : "UNAVAILABLE",
          message: setup
            ? "Please ask GYVFT to finish the latest database setup."
            : "This request could not complete. Please try again shortly.",
        },
      },
      503,
    );
  }
}
