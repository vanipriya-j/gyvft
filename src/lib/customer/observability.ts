import "server-only";
import { randomUUID } from "crypto";
import { getSql } from "@/lib/database/client";
import { logger } from "@/lib/logging/logger";
import { uuidPattern } from "@/lib/customer/model";

export const customerEventTypes = [
  "account.created",
  "session.started",
  "session.failed",
  "enquiry.created",
  "message.sent",
  "app.error",
  "setup.completed",
  "setup.failed",
] as const;
const operations = new Set([
  "register",
  "login",
  "logout",
  "reset",
  "reset-request",
  "reset-use",
  "message",
  "enquiry",
  "setup",
  "capture-enquiry",
  "send-message",
  "migrate",
  "status",
]);
const routes = new Set([
  "/account",
  "/account/login",
  "/api/setup",
  "/api/health",
  "/api/operations",
  "/tell-your-story",
  "/upload-a-brief",
  "/book-a-discovery",
  "/become-a-merch-partner",
]);
export type SafeCustomerMetadata = {
  route?: string;
  operation?: string;
  code?: string;
  status?: number;
  durationMs?: number;
};
/** Keep this allowlist small. Never persist arbitrary request/provider payloads. */
export function sanitizeCustomerEventMetadata(
  input: unknown,
): SafeCustomerMetadata {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const safe: SafeCustomerMetadata = {};
  if (typeof source.route === "string" && routes.has(source.route))
    safe.route = source.route;
  if (typeof source.operation === "string" && operations.has(source.operation))
    safe.operation = source.operation;
  if (typeof source.code === "string" && /^[A-Z0-9_]{1,40}$/.test(source.code))
    safe.code = source.code;
  if (
    typeof source.status === "number" &&
    Number.isInteger(source.status) &&
    source.status >= 100 &&
    source.status <= 599
  )
    safe.status = source.status;
  if (
    typeof source.durationMs === "number" &&
    Number.isFinite(source.durationMs) &&
    source.durationMs >= 0 &&
    source.durationMs <= 600000
  )
    safe.durationMs = Math.round(source.durationMs);
  return safe;
}
export async function recordCustomerEvent(
  type: string,
  options: {
    accountId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  if (
    !process.env.DATABASE_URL ||
    !customerEventTypes.some((known) => known === type)
  )
    return;
  try {
    const sql = getSql();
    const accountId =
      options.accountId && uuidPattern.test(options.accountId)
        ? options.accountId
        : null;
    const requestId =
      options.requestId && uuidPattern.test(options.requestId)
        ? options.requestId
        : randomUUID();
    const metadata = sanitizeCustomerEventMetadata(options.metadata);
    await sql`INSERT INTO gyvft_customer_events (event_type, account_id, request_id, metadata)
      VALUES (${type}, ${accountId}::uuid, ${requestId}::uuid, ${sql.json(metadata)})`;
  } catch {
    // Observability is secondary: losing an event must never reject a customer action.
    logger.warn("Customer operational event could not be recorded", {
      eventType: type,
    });
  }
}
