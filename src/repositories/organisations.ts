import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { normaliseOrganisationName } from "@/lib/utils/normalise";
import type { Organisation } from "@/types/domain";

export async function createOrMatchOrganisation(
  input: {
    name: string;
    primaryCity?: string | null;
    type?: string | null;
  },
  db: Sql = getSql(),
): Promise<{ organisation: Organisation; created: boolean }> {
  const normalised = normaliseOrganisationName(input.name);
  const existing = await db<Organisation[]>`
    SELECT * FROM organisations
    WHERE deleted_at IS NULL AND normalised_name = ${normalised}
    LIMIT 1
  `;
  if (existing[0]) {
    const rows = await db<Organisation[]>`
      UPDATE organisations
      SET
        primary_city = COALESCE(${input.primaryCity ?? null}, primary_city),
        last_activity_at = NOW(),
        updated_at = NOW()
      WHERE id = ${existing[0].id}::uuid
      RETURNING *
    `;
    return { organisation: rows[0]!, created: false };
  }

  const rows = await db<Organisation[]>`
    INSERT INTO organisations (name, normalised_name, primary_city, type, last_activity_at)
    VALUES (
      ${input.name.trim()},
      ${normalised},
      ${input.primaryCity ?? null},
      ${input.type ?? null},
      NOW()
    )
    RETURNING *
  `;
  return { organisation: rows[0]!, created: true };
}

export async function getOrganisationById(
  id: string,
  db: Sql = getSql(),
): Promise<Organisation | null> {
  const rows = await db<Organisation[]>`
    SELECT * FROM organisations WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listOrganisations(options: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: Organisation[]; total: number }> {
  const sql = getSql();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const q = options.query?.trim();
  const rows = q
    ? await sql<Organisation[]>`
        SELECT * FROM organisations
        WHERE deleted_at IS NULL AND name ILIKE ${"%" + q + "%"}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    : await sql<Organisation[]>`
        SELECT * FROM organisations
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
  const totalRows = q
    ? await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM organisations
        WHERE deleted_at IS NULL AND name ILIKE ${"%" + q + "%"}
      `
    : await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM organisations WHERE deleted_at IS NULL
      `;
  return { rows, total: Number(totalRows[0]?.count ?? 0) };
}
