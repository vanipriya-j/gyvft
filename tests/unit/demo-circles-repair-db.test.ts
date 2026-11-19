import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import postgres, { type Sql } from "postgres";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
let sql: Sql;
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
import { completeDemoCircles } from "@/lib/customer/circle-demo";
import {
  demoKey as key,
  demoScenarios as scenarios,
  demoOccasionContexts,
} from "@/lib/customer/demo-fixtures";
import { demoAccounts } from "@/lib/customer/demo-accounts";
import { circlesForAccount, changeCircle } from "@/lib/customer/circles";
import { hashCustomerPassword } from "@/lib/customer/password";
const url = process.env.GYVFT_DEMO_CIRCLES_TEST_DB;
describe.skipIf(!url)(
  "repair an old demo with occasions but zero circle memberships",
  () => {
    let before: { id: string; password_hash: string }[] = [];
    const realId = randomUUID(),
      realOccasion = randomUUID();
    beforeAll(async () => {
      const u = new URL(url!);
      if (
        u.hostname !== "127.0.0.1" ||
        u.port !== "55434" ||
        u.pathname !== "/gyvft_demo_circles_repair"
      )
        throw Error("Dedicated local fixture required.");
      sql = postgres(url!, { prepare: false, max: 5 });
    });
    afterAll(async () => {
      await sql?.end();
    });
    it("refuses to create or overwrite accounts when the four fixtures are missing", async () => {
      await expect(completeDemoCircles()).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(
        (await sql`SELECT count(*)::int AS n FROM gyvft_customer_accounts`)[0]
          .n,
      ).toBe(0);
    });
    it("completes the exact old state without changing accounts, dates, or real customer records", async () => {
      const password = readFileSync(
        "work/customer-demo-test-password.txt",
        "utf8",
      );
      for (const a of demoAccounts) {
        await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${a.id},${a.email},${await hashCustomerPassword(password)})`;
        await sql`INSERT INTO gyvft_customer_profiles(account_id,name,about) VALUES(${a.id},${a.shortName},'GYVFT-DEMO-v1. Original sample profile.')`;
        const scenario = scenarios[a.kind];
        for (const [i, p] of scenario.people.entries())
          await sql`INSERT INTO gyvft_customer_people(id,account_id,name,relationship) VALUES(${key(`${a.kind}:person:${i}`)},${a.id},${p[0]},${p[1]})`;
        for (const [i, title] of scenario.occasions.entries()) {
          const person = i % scenario.people.length;
          await sql`INSERT INTO gyvft_customer_occasions(id,account_id,title,occasion_date,repeats_annually,person_id,relationship,notes) VALUES(${key(`${a.kind}:occasion:${i}`)},${a.id},${title},${`2026-12-${String(i + 1).padStart(2, "0")}`},true,${key(`${a.kind}:person:${person}`)},${scenario.people[person][1]},'A fictional upcoming occasion. Allow two days between requested delivery and the occasion.')`;
        }
      }
      await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${realId},${`real-${realId}@example.test`},'preserve-real-hash')`;
      await sql`INSERT INTO gyvft_customer_occasions(id,account_id,title,occasion_date,relationship,notes) VALUES(${realOccasion},${realId},'Book club anniversary','2026-12-10','Alumni network','My own private notes')`;
      const dates =
        await sql`SELECT id,occasion_date::text,title,notes FROM gyvft_customer_occasions ORDER BY id`;
      before =
        await sql`SELECT id,password_hash FROM gyvft_customer_accounts ORDER BY id`;
      expect(await circlesForAccount(demoAccounts[2].id)).toHaveLength(0);
      const result = await completeDemoCircles();
      expect(result.inserted).toBe(5);
      expect(result.corrected).toBe(14);
      expect(result.accounts.map((a) => a.circles)).toEqual([2, 2, 5, 2]);
      expect(
        await sql`SELECT id,password_hash FROM gyvft_customer_accounts ORDER BY id`,
      ).toEqual(before);
      expect(
        await sql`SELECT id,occasion_date::text,title,notes FROM gyvft_customer_occasions ORDER BY id`,
      ).toEqual(dates);
      for (const [i, expected] of demoOccasionContexts.communities.entries()) {
        const [o] =
          await sql`SELECT relationship,person_id FROM gyvft_customer_occasions WHERE id=${key(`communities:occasion:${i}`)}`;
        expect(o.relationship).toBe(expected.relationship);
        expect(o.person_id).toBe(key(`communities:person:${expected.person}`));
      }
      expect(
        (
          await sql`SELECT relationship,notes FROM gyvft_customer_occasions WHERE id=${realOccasion}`
        )[0],
      ).toMatchObject({
        relationship: "Alumni network",
        notes: "My own private notes",
      });
    });
    it("preserves edited notes, membership choices, ownership and passwords on repeat", async () => {
      const meera = demoAccounts[2],
        c = (await circlesForAccount(meera.id)).find(
          (c) => c.category === "alumni",
        )!;
      await changeCircle(meera, c.id, {
        op: "profile",
        display_name: "Meera",
        share_profile: true,
      });
      const editable = key("family:occasion:3");
      await sql`UPDATE gyvft_customer_occasions SET notes='I edited this sample myself.',relationship='Family · Brother',person_id=${key("family:person:3")} WHERE id=${editable}`;
      const result = await completeDemoCircles();
      expect(result.inserted).toBe(0);
      expect(result.corrected).toBe(0);
      expect(
        (await circlesForAccount(meera.id)).find((x) => x.id === c.id)
          ?.share_profile,
      ).toBe(true);
      expect(
        (
          await sql`SELECT notes,relationship FROM gyvft_customer_occasions WHERE id=${editable}`
        )[0],
      ).toMatchObject({
        notes: "I edited this sample myself.",
        relationship: "Family · Brother",
      });
      expect(
        await sql`SELECT id,password_hash FROM gyvft_customer_accounts ORDER BY id`,
      ).toEqual(before);
    });
  },
);
