import { getEnv } from "@/config/env";

/**
 * Supabase API key resolution.
 *
 * Preferred (current):
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...)
 * - SUPABASE_SECRET_KEY (sb_secret_...)
 *
 * Legacy fallback (deprecated by Supabase; planned removal by end of 2026):
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Never expose SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function getSupabaseUrl(): string | undefined {
  return getEnv().NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabasePublishableKey(): string | undefined {
  const env = getEnv();
  return env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabaseSecretKey(): string | undefined {
  const env = getEnv();
  return env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasSupabasePublishableConfig(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function hasSupabaseSecretConfig(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseSecretKey());
}
