import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres, { type Sql } from "postgres";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  migrationFiles,
  runPendingMigrations,
  listMigrations,
} from "@/lib/database/migrations";
const url = process.env.SHIPPING_ACTIVATION_TEST_DATABASE_URL;
let sql: Sql;
const filename = "20261120000001_shipping.sql";
describe.skipIf(!url)(
  "shipping-only activation on disposable PostgreSQL",
  () => {
    beforeAll(async () => {
      const u = new URL(url!);
      if (
        u.hostname !== "127.0.0.1" ||
        !u.pathname.startsWith("/gyvft_shipping_activation_")
      )
        throw Error("Dedicated local database required");
      sql = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
      await sql`CREATE TABLE schema_migrations(id text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())`;
      for (const f of (await migrationFiles("customer")).filter(
        (f) => f < filename,
      )) {
        await sql.unsafe(await readFile("supabase/migrations/" + f, "utf8"));
        await sql`INSERT INTO schema_migrations(id) VALUES(${f})`;
      }
    }, 30000);
    afterAll(async () => {
      if (sql) await sql.end();
    });
    it("adds only shipping schema and history while preserving existing accounts and requests", async () => {
      const id = randomUUID();
      await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${id},${id + "@example.test"},'unchanged-test-hash')`;
      await sql`INSERT INTO customer_projects(customer_account_id,customer_email,title,kind,stage) VALUES(${id},${id + "@example.test"},'Keep this request','enquiry',0)`;
      const read = async () =>
        JSON.stringify({
          accounts:
            await sql`SELECT * FROM gyvft_customer_accounts ORDER BY id`,
          projects: await sql`SELECT * FROM customer_projects ORDER BY id`,
          history:
            await sql`SELECT * FROM schema_migrations WHERE id<>${filename} ORDER BY id`,
        });
      const before = await read();
      expect(
        (await listMigrations(sql, "customer")).find((m) => m.id === filename)
          ?.appliedAt,
      ).toBeNull();
      expect(await runPendingMigrations(sql, undefined, "shipping")).toEqual([
        filename,
      ]);
      expect(await read()).toBe(before);
      expect(await runPendingMigrations(sql, undefined, "shipping")).toEqual(
        [],
      );
      expect(await read()).toBe(before);
      const tables =
        await sql`SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('gyvft_shipping_settings','gyvft_shipping_plans','gyvft_shipments','gyvft_shipping_events')`;
      expect(tables).toHaveLength(4);
      expect(tables.every((t) => t.rowsecurity)).toBe(true);
      expect(
        (await listMigrations(sql, "customer")).find((m) => m.id === filename)
          ?.appliedAt,
      ).toBeTruthy();
    });
  },
);
