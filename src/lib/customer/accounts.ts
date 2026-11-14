import "server-only";
import { headers } from "next/headers";
import { getSql } from "@/lib/database/client";
import { hashOpaqueToken } from "./password";
export class CustomerRateLimitError extends Error {}
export async function limitCustomerAuth(operation: string, email = "") {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const limit = operation === "login" ? 10 : 5;
  const buckets = [
    {
      key: hashOpaqueToken(`gyvft:${operation}:${ip}:*`),
      limit: operation === "login" ? 50 : 20,
    },
    { key: hashOpaqueToken(`gyvft:${operation}:${ip}:${email}`), limit },
  ];
  for (const bucket of buckets) {
    const rows = await getSql()<
      { attempts: number }[]
    >`INSERT INTO gyvft_customer_auth_limits (key_hash) VALUES (${bucket.key}) ON CONFLICT (key_hash) DO UPDATE SET attempts = CASE WHEN gyvft_customer_auth_limits.window_start < now() - interval '15 minutes' THEN 1 ELSE gyvft_customer_auth_limits.attempts + 1 END, window_start = CASE WHEN gyvft_customer_auth_limits.window_start < now() - interval '15 minutes' THEN now() ELSE gyvft_customer_auth_limits.window_start END RETURNING attempts`;
    if (rows[0].attempts > bucket.limit)
      throw new CustomerRateLimitError(
        "Too many attempts. Please wait 15 minutes before trying again.",
      );
  }
}
export function customerAccountError(error: unknown) {
  if (error instanceof CustomerRateLimitError) return error.message;
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  if (code === "42P01" || code === "42703")
    return "Customer accounts need the latest database update. Please ask GYVFT to finish setup, then try again.";
  return "We couldn’t complete that request. Please try again shortly.";
}
