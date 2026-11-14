"use client";

import { createBrowserClient } from "@supabase/ssr";

function getBrowserPublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getBrowserPublishableKey();
  if (!url || !key) {
    throw Object.assign(
      new Error("Customer authentication is not configured."),
      {
        code: "AUTH_CONFIGURATION_MISSING",
      },
    );
  }
  return createBrowserClient(url, key);
}
