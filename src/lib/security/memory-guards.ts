import "server-only";
import { AppError } from "@/lib/errors/app-error";

type Bucket = { count: number; resetAt: number };
type IdempotencyEntry = { submissionId: string; expiresAt: number };

const rateBuckets = new Map<string, Bucket>();
const idempotencyStore = new Map<string, IdempotencyEntry>();

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function pruneRateBuckets(now: number) {
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}

function pruneIdempotency(now: number) {
  for (const [key, entry] of idempotencyStore) {
    if (entry.expiresAt <= now) idempotencyStore.delete(key);
  }
}

/** Basic in-memory rate limit for public form submissions (per IP + form). */
export function assertPublicFormRateLimit(options: {
  ip: string;
  formKey: string;
  limit?: number;
  windowMs?: number;
}): void {
  const now = Date.now();
  pruneRateBuckets(now);
  const limit = options.limit ?? RATE_LIMIT;
  const windowMs = options.windowMs ?? RATE_WINDOW_MS;
  const key = `${options.formKey}:${options.ip || "unknown"}`;
  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please try again later.", {
      expose: true,
    });
  }
}

/** Returns a previous successful submission id when the same idempotency key is replayed. */
export function findIdempotentSubmission(idempotencyKey: string): string | null {
  const now = Date.now();
  pruneIdempotency(now);
  const existing = idempotencyStore.get(idempotencyKey);
  if (!existing) return null;
  if (existing.expiresAt <= now) {
    idempotencyStore.delete(idempotencyKey);
    return null;
  }
  return existing.submissionId;
}

export function rememberIdempotentSubmission(idempotencyKey: string, submissionId: string): void {
  const now = Date.now();
  pruneIdempotency(now);
  idempotencyStore.set(idempotencyKey, {
    submissionId,
    expiresAt: now + IDEMPOTENCY_TTL_MS,
  });
}

/** Test helpers */
export function resetMemoryGuardsForTests() {
  rateBuckets.clear();
  idempotencyStore.clear();
}
