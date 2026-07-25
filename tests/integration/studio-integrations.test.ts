import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { getIntegration } from "@/repositories/studio";
import { saveIntegrationAction } from "@/actions/studio-integrations";
import type { Profile, UserRole } from "@/types/domain";
import { migrateTestDatabase, resetDatabase, createProfile } from "./db";

const sessionState = vi.hoisted(() => ({
  profile: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "owner@example.test",
    full_name: "Owner User",
    role: "owner" as UserRole,
    is_active: true,
    last_login_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    deleted_at: null,
  } satisfies Profile,
}));

vi.mock("@/lib/auth/session", () => ({
  requireStudioUser: vi.fn(async () => sessionState.profile),
}));

function setSessionProfile(input: { id: string; role: UserRole; email?: string }): void {
  sessionState.profile = {
    ...sessionState.profile,
    id: input.id,
    email: input.email ?? `${input.role}@example.test`,
    role: input.role,
  };
}

function integrationForm(input: {
  provider: string;
  displayName?: string;
  enabled?: boolean;
  status?: string;
  config?: Record<string, string>;
  secrets?: Record<string, string>;
}): FormData {
  const formData = new FormData();
  formData.set("provider", input.provider);
  formData.set("displayName", input.displayName ?? input.provider);
  formData.set("status", input.status ?? "configured");
  if (input.enabled ?? true) formData.set("enabled", "on");
  for (const [key, value] of Object.entries(input.config ?? {})) {
    formData.set(`config.${key}`, value);
  }
  for (const [key, value] of Object.entries(input.secrets ?? {})) {
    formData.set(`secret.${key}`, value);
  }
  return formData;
}

beforeAll(() => {
  migrateTestDatabase();
});

beforeEach(async () => {
  await resetDatabase();
});

describe("studio integration secrets and permissions", () => {
  it("lets owners save encrypted integration secrets and returns only summary fields", async () => {
    const owner = await createProfile({ id: sessionState.profile.id, role: "owner" });
    setSessionProfile({ id: owner.id, role: "owner", email: owner.email });
    const plaintext = "meta_access_token_plain_1234";

    await saveIntegrationAction(
      integrationForm({
        provider: "meta_capi",
        displayName: "Meta CAPI",
        config: { dataset_id: "dataset-123" },
        secrets: { access_token: plaintext },
      }),
    );

    const sql = getSql();
    const stored = await sql<{
      ciphertext: Buffer;
      last_four: string | null;
    }[]>`
      SELECT ciphertext, last_four FROM integration_secrets
      WHERE provider = 'meta_capi' AND secret_name = 'access_token'
    `;
    const integration = await getIntegration("meta_capi");
    const publicSecret = await sql<{
      provider: string;
      secret_name: string;
      last_four: string | null;
      configured: boolean;
    }[]>`
      SELECT provider, secret_name, last_four, configured
      FROM integration_secrets_public
      WHERE provider = 'meta_capi' AND secret_name = 'access_token'
    `;

    expect(stored[0]?.last_four).toBe("1234");
    expect(stored[0]?.ciphertext.toString("utf8")).not.toContain(plaintext);
    expect(integration?.secrets).toEqual([
      expect.objectContaining({ provider: "meta_capi", secret_name: "access_token", last_four: "1234" }),
    ]);
    expect(JSON.stringify(integration)).not.toContain(plaintext);
    expect(publicSecret[0]).toEqual({
      provider: "meta_capi",
      secret_name: "access_token",
      last_four: "1234",
      configured: true,
    });
  });

  it("does not expose stored plaintext through admin-readable integration summaries", async () => {
    const owner = await createProfile({ id: sessionState.profile.id, role: "owner" });
    setSessionProfile({ id: owner.id, role: "owner", email: owner.email });
    const plaintext = "resend_secret_value_9876";
    await saveIntegrationAction(
      integrationForm({
        provider: "resend",
        displayName: "Resend",
        secrets: { api_key: plaintext },
      }),
    );

    const admin = await createProfile({ role: "admin" });
    setSessionProfile({ id: admin.id, role: "admin", email: admin.email });
    const integration = await getIntegration("resend");

    expect(JSON.stringify(integration)).not.toContain(plaintext);
    expect(integration?.secrets[0]).toMatchObject({ secret_name: "api_key", last_four: "9876" });
    expect(integration?.secrets[0]).not.toHaveProperty("ciphertext");
    expect(integration?.secrets[0]).not.toHaveProperty("auth_tag");
  });

  it("throws FORBIDDEN when contributors try to manage integrations", async () => {
    const contributor = await createProfile({ role: "contributor" });
    setSessionProfile({ id: contributor.id, role: "contributor", email: contributor.email });

    await expect(
      saveIntegrationAction(integrationForm({ provider: "gtm", displayName: "GTM" })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AppError>);
  });
});
