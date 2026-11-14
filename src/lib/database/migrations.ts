import { readdir, readFile } from "fs/promises";
import path from "path";
import type { Sql } from "postgres";
import type { MigrationProgress } from "./migration-progress";
export class MigrationExecutionError extends Error {
  constructor(
    public filename: string,
    cause: unknown,
  ) {
    super(`Migration ${filename} failed.`, { cause });
  }
}

const migrationDirectory = path.join(process.cwd(), "supabase", "migrations");
// Transaction-scoped: safe with connection pooling, shared by web and CLI runners.
const migrationLock = 714093821;
export type MigrationScope = "all" | "customer";
// Explicit server-owned manifest: the public setup endpoint must never install
// the legacy Studio CRM schema into the existing business database.
const customerMigrations = [
  "20261112000000_customer_portal.sql",
  "20261114000001_customer_accounts.sql",
  "20261114000002_customer_demo_requests.sql",
  "20261114000003_customer_observability.sql",
  "20261114000004_customer_gift_brief.sql",
  "20261114000005_customer_dashboard.sql",
] as const;
export type MigrationStatus = { id: string; appliedAt: string | null };
export class MigrationBusyError extends Error {
  constructor() {
    super(
      "Another migration run is in progress. Refresh and try again shortly.",
    );
  }
}
export async function migrationFiles(scope: MigrationScope = "all") {
  const files = (await readdir(migrationDirectory))
    .filter((file) => /^\d+_[a-zA-Z0-9_-]+\.sql$/.test(file))
    .sort();
  if (scope === "all") return files;
  for (const required of customerMigrations) {
    if (!files.includes(required))
      throw new Error(`Packaged customer migration missing: ${required}`);
  }
  return files.filter((file) =>
    customerMigrations.some((required) => required === file),
  );
}
export async function listMigrations(
  sql: Sql,
  scope: MigrationScope = "all",
): Promise<MigrationStatus[]> {
  const files = await migrationFiles(scope);
  const [table] = await sql<
    { name: string | null }[]
  >`SELECT to_regclass('public.schema_migrations')::text AS name`;
  let applied: { id: string; applied_at: string }[] = [];
  if (table?.name) {
    const [format] = await sql<{ uses_filename: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'schema_migrations' AND column_name = 'filename'
      ) AS uses_filename`;
    applied = format?.uses_filename
      ? await sql<
          { id: string; applied_at: string }[]
        >`SELECT filename AS id, applied_at FROM public.schema_migrations`
      : await sql<
          { id: string; applied_at: string }[]
        >`SELECT id, applied_at FROM public.schema_migrations`;
  }
  const byId = new Map(
    applied.map((row) => [row.id, new Date(row.applied_at).toISOString()]),
  );
  return files.map((id) => ({ id, appliedAt: byId.get(id) ?? null }));
}
export async function runPendingMigrations(
  sql: Sql,
  onProgress?: (event: MigrationProgress) => void,
  scope: MigrationScope = "all",
): Promise<string[]> {
  onProgress?.({ phase: "checking", total: 0, completed: 0 });
  // Only SQL bundled with this deployment is ever executed. No request input.
  const files = await migrationFiles(scope);
  const migrations = await Promise.all(
    files.map(async (id) => ({
      id,
      contents: await readFile(path.join(migrationDirectory, id), "utf8"),
    })),
  );
  const applied: string[] = [];
  await sql.begin(async (tx) => {
    await tx`SET LOCAL statement_timeout = '45s'`;
    await tx`SET LOCAL lock_timeout = '5s'`;
    const [lock] = await tx<
      { acquired: boolean }[]
    >`SELECT pg_try_advisory_xact_lock(${migrationLock}) AS acquired`;
    if (!lock?.acquired) throw new MigrationBusyError();
    await tx`CREATE TABLE IF NOT EXISTS public.schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const [format] = await tx<{ uses_filename: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'schema_migrations' AND column_name = 'filename'
      ) AS uses_filename`;
    const usesFilename = format?.uses_filename === true;
    const recorded = usesFilename
      ? await tx<
          { id: string }[]
        >`SELECT filename AS id FROM public.schema_migrations`
      : await tx<{ id: string }[]>`SELECT id FROM public.schema_migrations`;
    const seen = new Set(recorded.map((row) => row.id));
    const pending = migrations.filter((m) => !seen.has(m.id));
    for (const migration of pending) {
      onProgress?.({
        phase: "applying",
        total: pending.length,
        completed: applied.length,
        filename: migration.id,
      });
      try {
        await tx.unsafe(migration.contents);
        if (usesFilename)
          await tx`INSERT INTO public.schema_migrations (filename) VALUES (${migration.id})`;
        else
          await tx`INSERT INTO public.schema_migrations (id) VALUES (${migration.id})`;
      } catch (error) {
        throw new MigrationExecutionError(migration.id, error);
      }
      applied.push(migration.id);
    }
    onProgress?.({
      phase: "committing",
      total: pending.length,
      completed: applied.length,
    });
  });
  return applied;
}
