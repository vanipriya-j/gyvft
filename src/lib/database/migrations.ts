import { createHash } from "crypto";
import { readdir, readFile } from "fs/promises";
import path from "path";
import type { Sql } from "postgres";
import type { MigrationProgress } from "./migration-progress";
import {
  operationsIntakeFile,
  operationsIntakeChecksum,
  operationsIntakePrerequisites,
} from "./operations-intake-activation";
import {
  optionImagesFile,
  optionImagesChecksum,
  optionImagesPrerequisites,
  agentProposalsFile,
  agentProposalsChecksum,
} from "./option-images-activation";
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
export type MigrationScope =
  | "all"
  | "customer"
  | "shipping"
  | "option-images"
  | "agent-proposals"
  | "operations-intake";
const shippingFile = "20261120000001_shipping.sql";
// Exact SQL approved on 20 November. A changed file needs a fresh review.
const shippingChecksum =
  "8cb367a2a2d1f440aac5f04d0bcf38161094a33d3e44b3000d15dbfd6733a07c";
export class MigrationPreconditionError extends Error {}
// Explicit server-owned manifest: the public setup endpoint must never install
// the legacy Studio CRM schema into the existing business database.
const customerMigrations = [
  "20261112000000_customer_portal.sql",
  "20261114000001_customer_accounts.sql",
  "20261114000002_customer_demo_requests.sql",
  "20261114000003_customer_observability.sql",
  "20261114000004_customer_gift_brief.sql",
  "20261114000005_customer_dashboard.sql",
  "20261115000001_b2c_pilot.sql",
  "20261116000001_gift_workspace.sql",
  "20261117000001_customer_home.sql",
  "20261119000001_gifting_journeys.sql",
  "20261119000002_circles.sql",
  "20261120000001_shipping.sql",
  optionImagesFile,
  agentProposalsFile,
  operationsIntakeFile,
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
  if (scope === "shipping") return [shippingFile];
  if (scope === "option-images") return [optionImagesFile];
  if (scope === "operations-intake") return [operationsIntakeFile];
  if (scope === "agent-proposals")
    return [optionImagesFile, agentProposalsFile];
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
  const prerequisites =
    scope === "shipping"
      ? (await migrationFiles("customer")).filter((id) => id < shippingFile)
      : scope === "option-images" || scope === "agent-proposals"
        ? [...optionImagesPrerequisites]
        : scope === "operations-intake"
          ? [...operationsIntakePrerequisites]
          : [];
  if (
    scope === "operations-intake" &&
    createHash("sha256").update(migrations[0].contents).digest("hex") !==
      operationsIntakeChecksum
  )
    throw new MigrationPreconditionError(
      "The Operations intake SQL differs from the reviewed version. Nothing was applied; review the changed SQL first.",
    );
  if (
    scope === "shipping" &&
    createHash("sha256").update(migrations[0].contents).digest("hex") !==
      shippingChecksum
  )
    throw new MigrationPreconditionError(
      "The shipping SQL differs from the approved version. Nothing was applied; ask for a new review.",
    );
  if (
    (scope === "option-images" || scope === "agent-proposals") &&
    createHash("sha256").update(migrations[0].contents).digest("hex") !==
      optionImagesChecksum
  )
    throw new MigrationPreconditionError(
      "The option-image SQL differs from the reviewed version. Nothing was applied; review the changed SQL first.",
    );
  if (
    scope === "agent-proposals" &&
    createHash("sha256").update(migrations[1].contents).digest("hex") !==
      agentProposalsChecksum
  )
    throw new MigrationPreconditionError(
      "The agent workspace SQL differs from the reviewed version. Nothing was applied; review the changed SQL first.",
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
    const missing = prerequisites.filter((id) => !seen.has(id));
    if (missing.length)
      throw new MigrationPreconditionError(
        `${scope === "shipping" ? "Shipping" : scope === "operations-intake" ? "Operations intake" : "Option images"} was not applied. Earlier updates need separate review: ` +
          missing.join(", "),
      );
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
