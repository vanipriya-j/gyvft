import "server-only";
import { createHash, timingSafeEqual } from "crypto";
export function setupReadiness() {
  const hasSetupSecret = (process.env.SETUP_SECRET?.trim().length ?? 0) >= 32;
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  return {
    hasSetupSecret,
    hasDatabaseUrl,
    ready: hasSetupSecret && hasDatabaseUrl,
  };
}
export function validSetupSecret(provided: unknown) {
  const expected = process.env.SETUP_SECRET?.trim();
  if (
    !expected ||
    expected.length < 32 ||
    typeof provided !== "string" ||
    provided.length > 1024
  )
    return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided.trim()), digest(expected));
}
