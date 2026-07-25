import { readFile } from "fs/promises";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SIGNED_URL_EXPIRES_SECONDS } from "@/config/constants";
import { getSql } from "@/lib/database/client";
import { createSignedBriefUrl } from "@/services/storage/briefs";
import { migrateTestDatabase, resetDatabase } from "./db";

const storageState = vi.hoisted(() => ({
  expiresIn: 0,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async (_path: string, expiresIn: number) => {
          storageState.expiresIn = expiresIn;
          return { data: { signedUrl: "https://storage.example.test/signed" }, error: null };
        }),
      })),
    },
  })),
}));

beforeAll(() => {
  migrateTestDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  storageState.expiresIn = 0;
});

describe("security boundaries", () => {
  it("keeps opportunity reads on server-only repository paths and denies anon in RLS", async () => {
    const [repositorySource, rlsSource] = await Promise.all([
      readFile("src/repositories/opportunities.ts", "utf8"),
      readFile("supabase/migrations/20260725000002_rls.sql", "utf8"),
    ]);

    expect(repositorySource).toContain('import "server-only";');
    expect(repositorySource).not.toMatch(/public.*Opportunity/i);
    expect(rlsSource).toContain("CREATE POLICY opportunities_deny_anon");
    expect(rlsSource).toContain("USING (FALSE)");
  });

  it("uses the short signed URL expiry constant for brief URLs", async () => {
    const file = await getSql()<{ id: string }[]>`
      INSERT INTO files (original_filename, storage_path, mime_type, byte_size)
      VALUES ('brief.pdf', 'opportunity/brief.pdf', 'application/pdf', 1024)
      RETURNING id
    `;

    const signed = await createSignedBriefUrl(file[0]!.id);

    expect(signed).toEqual({
      url: "https://storage.example.test/signed",
      expiresIn: SIGNED_URL_EXPIRES_SECONDS,
    });
    expect(storageState.expiresIn).toBe(SIGNED_URL_EXPIRES_SECONDS);
    expect(Number.isFinite(SIGNED_URL_EXPIRES_SECONDS)).toBe(true);
    expect(SIGNED_URL_EXPIRES_SECONDS).toBeGreaterThan(0);
    expect(SIGNED_URL_EXPIRES_SECONDS).toBeLessThanOrEqual(5 * 60);
  });
});
