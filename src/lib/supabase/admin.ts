import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv, hasSupabaseConfig } from "@/config/env";
import { AppError } from "@/lib/errors/app-error";

export function createSupabaseAdminClient() {
  const env = getEnv();
  if (!hasSupabaseConfig() || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError("INTERNAL_ERROR", "Supabase service role is not configured", {
      expose: false,
    });
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
