import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSql } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  hasSupabasePublishableConfig,
} from "@/lib/supabase/keys";
import type { Profile, UserRole } from "@/types/domain";

export async function createSupabaseServerClient() {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();
  if (!hasSupabasePublishableConfig() || !url || !publishableKey) {
    throw new AppError("INTERNAL_ERROR", "Supabase is not configured", { expose: false });
  }
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only.
        }
      },
    },
  });
}

export async function getSessionUserId(): Promise<string | null> {
  if (!hasSupabasePublishableConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const sql = getSql();
  const rows = await sql<Profile[]>`
    SELECT id, email, full_name, role, is_active, last_login_at, created_at, updated_at, deleted_at
    FROM profiles
    WHERE id = ${userId}::uuid
      AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function requireStudioUser(options?: {
  roles?: UserRole[];
}): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new AppError("UNAUTHORIZED", "Authentication required");
  }
  if (!profile.is_active) {
    throw new AppError("FORBIDDEN", "Account is inactive");
  }
  if (options?.roles && !options.roles.includes(profile.role)) {
    throw new AppError("FORBIDDEN", "You do not have permission to perform this action");
  }
  return profile;
}
