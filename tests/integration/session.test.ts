import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrateTestDatabase, resetDatabase, createProfile } from "./db";

const authState = vi.hoisted(() => ({
  userId: "",
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: authState.userId } },
        error: null,
      })),
    },
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => undefined,
  })),
}));

beforeAll(() => {
  migrateTestDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_key";
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

describe("studio session requirements", () => {
  it("blocks inactive users based on profile.is_active", async () => {
    const inactive = await createProfile({ role: "admin", isActive: false });
    authState.userId = inactive.id;
    vi.resetModules();

    const { requireStudioUser } = await import("@/lib/auth/session");

    await expect(requireStudioUser()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Account is inactive",
    });
  });
});
