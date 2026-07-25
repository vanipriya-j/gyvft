import { spawnSync } from "child_process";
import { getSql } from "@/lib/database/client";

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://gyvft:gyvft_dev@127.0.0.1:5432/gyvft_test";

let migrated = false;

export function migrateTestDatabase(): void {
  if (migrated) return;
  const result = spawnSync("npx", ["tsx", "scripts/migrate.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      NODE_ENV: "test",
    },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Test database migration failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
  migrated = true;
}

export async function resetDatabase(): Promise<void> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const sql = getSql();
  await sql.unsafe(`
    TRUNCATE
      webhook_deliveries,
      webhook_endpoint_secrets,
      webhook_endpoints,
      integration_secrets,
      integration_logs,
      email_deliveries,
      activities,
      notes,
      tasks,
      files,
      opportunity_submissions,
      opportunity_summaries,
      opportunity_audiences,
      opportunity_formats,
      analytics_events,
      opportunities,
      attribution_touches,
      visitor_sessions,
      visitor_identities,
      contacts,
      organisations,
      campaigns,
      profiles,
      landing_page_blocks,
      landing_pages,
      consent_records,
      audit_logs,
      auth_attempt_logs,
      user_invitations,
      idempotency_keys,
      rate_limit_buckets
    RESTART IDENTITY CASCADE
  `);

  await sql`
    UPDATE workspace_settings
    SET default_opportunity_owner_id = NULL,
        production_mode = FALSE,
        bot_protection_enabled = TRUE,
        updated_at = NOW()
  `;

  await sql`
    UPDATE integration_definitions
    SET enabled = FALSE,
        status = 'not_configured',
        config = '{}'::jsonb,
        last_error = NULL,
        updated_at = NOW()
  `;
}

export async function createProfile(input: {
  id?: string;
  email?: string;
  fullName?: string;
  role?: "owner" | "admin" | "contributor";
  isActive?: boolean;
} = {}): Promise<{ id: string; email: string; role: "owner" | "admin" | "contributor"; is_active: boolean }> {
  const sql = getSql();
  const rows = await sql<{
    id: string;
    email: string;
    role: "owner" | "admin" | "contributor";
    is_active: boolean;
  }[]>`
    INSERT INTO profiles (id, email, full_name, role, is_active)
    VALUES (
      ${input.id ?? crypto.randomUUID()}::uuid,
      ${input.email ?? `user-${crypto.randomUUID()}@example.test`},
      ${input.fullName ?? "Test User"},
      ${input.role ?? "owner"},
      ${input.isActive ?? true}
    )
    RETURNING id, email, role, is_active
  `;
  return rows[0]!;
}
