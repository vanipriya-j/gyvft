import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import postgres, { type Sql } from "postgres";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { runPendingMigrations } from "@/lib/database/migrations";
let sql: Sql;
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
// Reproduce a full pre-Circles workspace; calls inside completeDemoCircles retain
// their real lexical implementations, rather than these importer-only stubs.
vi.mock("@/lib/customer/circle-demo", async (original) => ({
  ...(await original<typeof import("@/lib/customer/circle-demo")>()),
  seedDemoCircles: async () => 0,
  repairDemoOccasionContexts: async () => 0,
}));
import { seedCustomerDemos } from "@/lib/customer/demo-seed";
import { completeDemoCircles } from "@/lib/customer/circle-demo";
import { demoKey as key, demoScenarios } from "@/lib/customer/demo-fixtures";
import { demoAccounts } from "@/lib/customer/demo-accounts";
const url = process.env.GYVFT_DEMO_DIAGNOSTIC_DB;
describe.skipIf(!url)(
  "full older gift fixtures and rollback-only diagnostics",
  () => {
    let snapshot: unknown;
    beforeAll(async () => {
      const u = new URL(url!);
      if (
        u.hostname !== "127.0.0.1" ||
        u.port !== "55434" ||
        u.pathname !== "/gyvft_demo_circle_diagnostics"
      )
        throw Error("Dedicated empty local diagnostic fixture required.");
      const control = postgres(url!, { prepare: false, max: 1 });
      const databaseName = "gyvft_diag_" + randomUUID().replaceAll("-", "");
      await control.unsafe("CREATE DATABASE " + databaseName);
      await control.end();
      u.pathname = "/" + databaseName;
      sql = postgres(u.toString(), { prepare: false, max: 5 });
      await runPendingMigrations(sql, undefined, "customer");
      await seedCustomerDemos(
        readFileSync("work/customer-demo-test-password.txt", "utf8"),
      );
      for (const a of demoAccounts) {
        const scenario = demoScenarios[a.kind];
        for (const [i] of scenario.occasions.entries()) {
          const n = i % scenario.people.length;
          await sql`UPDATE gyvft_customer_occasions SET relationship=${scenario.people[n][1]},person_id=${key(`${a.kind}:person:${n}`)} WHERE id=${key(`${a.kind}:occasion:${i}`)}`;
        }
      }
      snapshot =
        await sql`SELECT id,password_hash FROM gyvft_customer_accounts ORDER BY id`;
    });
    afterAll(async () => {
      await sql?.end();
    });
    it("reproduces the original complete workspace with actual gifts and no circles", async () => {
      expect(
        (
          await sql`SELECT count(*)::int AS n FROM customer_projects WHERE customer_account_id IN ${sql(demoAccounts.map((a) => a.id))} AND submission_key LIKE 'gyvft-demo-v1-%'`
        )[0].n,
      ).toBe(28);
      expect(
        (await sql`SELECT count(*)::int AS n FROM gyvft_circles`)[0].n,
      ).toBe(0);
    });
    it("reports the actual failing stage/SQLSTATE and rolls every new record back", async () => {
      await sql`ALTER TABLE gyvft_circle_members ADD CONSTRAINT diagnostic_test_reject_members CHECK(false)`;
      try {
        await expect(
          completeDemoCircles({ checkOnly: true }),
        ).rejects.toMatchObject({
          diagnostic: {
            code: "23514",
            step: "members",
            table: "gyvft_circle_members",
            constraint: "diagnostic_test_reject_members",
          },
        });
        expect(
          (await sql`SELECT count(*)::int AS n FROM gyvft_circles`)[0].n,
        ).toBe(0);
      } finally {
        await sql`ALTER TABLE gyvft_circle_members DROP CONSTRAINT diagnostic_test_reject_members`;
      }
    });
    it("checks all real fixture writes including gift linking, and saves nothing", async () => {
      const result = await completeDemoCircles({ checkOnly: true });
      expect(result.checkOnly).toBe(true);
      expect(result.inserted).toBe(5);
      expect(result.corrected).toBe(14);
      expect(result.accounts.map((a) => a.circles)).toEqual([2, 2, 5, 2]);
      expect(
        (await sql`SELECT count(*)::int AS n FROM gyvft_circles`)[0].n,
      ).toBe(0);
      expect(
        (
          await sql`SELECT count(*)::int AS n FROM customer_projects WHERE circle_id IS NOT NULL`
        )[0].n,
      ).toBe(0);
      expect(
        await sql`SELECT id,password_hash FROM gyvft_customer_accounts ORDER BY id`,
      ).toEqual(snapshot);
    });
    it("commits the same checked writes only when explicitly completing", async () => {
      const result = await completeDemoCircles();
      expect(result.checkOnly).toBe(false);
      expect(result.inserted).toBe(5);
      expect(
        (
          await sql`SELECT count(*)::int AS n FROM customer_projects WHERE circle_id IS NOT NULL`
        )[0].n,
      ).toBe(23);
      expect(
        await sql`SELECT id,password_hash FROM gyvft_customer_accounts ORDER BY id`,
      ).toEqual(snapshot);
    });
  },
);
