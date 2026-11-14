import "server-only";
import { randomUUID } from "crypto";
import type { Instrumentation } from "next";
import { logger } from "@/lib/logging/logger";
import { recordCustomerEvent } from "@/lib/customer/observability";
export const recordRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const requestId = randomUUID();
  const rawCode =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  const code =
    typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode)
      ? rawCode
      : "UNHANDLED_REQUEST_ERROR";
  const digest =
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof error.digest === "string" &&
    /^[A-Za-z0-9_-]{1,100}$/.test(error.digest)
      ? error.digest
      : undefined;
  logger.error("Unhandled application request error", {
    requestId,
    code,
    digest,
    route: context.routePath,
    method: request.method,
  });
  await recordCustomerEvent("app.error", {
    requestId,
    metadata: { code, status: 500 },
  });
};
