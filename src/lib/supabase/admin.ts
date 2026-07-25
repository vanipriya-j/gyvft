import "server-only";
import { createClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors/app-error";
import {
  getSupabaseSecretKey,
  getSupabaseUrl,
  hasSupabaseSecretConfig,
} from "@/lib/supabase/keys";

export function createSupabaseAdminClient() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!hasSupabaseSecretConfig() || !url || !secretKey) {
    throw new AppError("INTERNAL_ERROR", "Supabase secret key is not configured", {
      expose: false,
    });
  }
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
