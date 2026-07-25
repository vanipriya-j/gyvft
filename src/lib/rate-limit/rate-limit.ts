import "server-only";
import { getSql } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";

export async function assertRateLimit(options: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  const sql = getSql();
  const windowStart = new Date(
    Math.floor(Date.now() / (options.windowSeconds * 1000)) * options.windowSeconds * 1000,
  );
  const rows = await sql<{ hit_count: number }[]>`
    INSERT INTO rate_limit_buckets (bucket_key, window_started_at, hit_count)
    VALUES (${options.key}, ${windowStart.toISOString()}, 1)
    ON CONFLICT (bucket_key, window_started_at)
    DO UPDATE SET hit_count = rate_limit_buckets.hit_count + 1
    RETURNING hit_count
  `;
  const count = rows[0]?.hit_count ?? 1;
  if (count > options.limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please try again later.");
  }
}
