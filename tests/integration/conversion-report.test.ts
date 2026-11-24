import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conversionReport } from "@/lib/customer/conversion-report";
import { demoAccountIds } from "@/lib/customer/demo-accounts";

const url = process.env.TEST_CONVERSIONS_DB_URL;
describe.skipIf(!url)(
  "conversion queries against an isolated PostgreSQL fixture",
  () => {
    let sql: Sql;
    const now = new Date("2026-11-24T06:00:00Z"),
      schema = "analytics_" + randomUUID().replaceAll("-", "");
    const account = randomUUID(),
      emptyAccount = randomUUID();
    const paid = randomUUID(),
      unanswered = randomUUID(),
      pending = randomUUID();
    beforeAll(async () => {
      const parsed = new URL(url!);
      if (
        parsed.hostname !== "127.0.0.1" ||
        parsed.port !== "55437" ||
        parsed.pathname !== "/gyvft_analytics_test"
      )
        throw Error(
          "Analytics tests require their dedicated localhost:55437/gyvft_analytics_test database.",
        );
      sql = postgres(url!, { max: 2, connection: { search_path: schema } });
      await sql.unsafe(`CREATE SCHEMA ${schema};
      CREATE TABLE gyvft_customer_accounts(id uuid PRIMARY KEY,created_at timestamptz);
      CREATE TABLE customer_projects(id uuid PRIMARY KEY,customer_account_id uuid,submission_key text,title text,customer_email text,created_at timestamptz,stage int,kind text,task_owner text DEFAULT 'Aarla',shopify_order_reference text,shopify_order_id text,is_draft boolean DEFAULT false);
      CREATE TABLE customer_project_approvals(id uuid DEFAULT gen_random_uuid(),project_id uuid,kind text,version int,status text,amount_paise bigint,created_at timestamptz,decided_at timestamptz);
      CREATE TABLE gyvft_gift_options(project_id uuid,published boolean,operator_hidden boolean,created_at timestamptz);
      CREATE TABLE gyvft_gift_selections(project_id uuid,created_at timestamptz);
      CREATE TABLE customer_payment_submissions(project_id uuid,status text,amount_paise bigint,created_at timestamptz,verified_at timestamptz);
      CREATE TABLE customer_project_messages(project_id uuid,sender text,created_at timestamptz);
      CREATE TABLE gyvft_gift_brief_revisions(project_id uuid,created_at timestamptz);`);
      for (const id of [account, emptyAccount, demoAccountIds[0]])
        await sql`INSERT INTO gyvft_customer_accounts VALUES(${id}::uuid,'2026-11-01T00:00:00Z')`;
      for (const [id, title, owner, key, draft] of [
        [paid, "Bank check", account, null, false],
        [unanswered, "Customer asked a question", account, null, false],
        [pending, "Pending proposal", account, null, false],
        [randomUUID(), "PRIVATE DRAFT CONTENT", account, null, true],
        [
          randomUUID(),
          "Demo account without a labelled key",
          demoAccountIds[0],
          null,
          false,
        ],
        [
          randomUUID(),
          "Legacy labelled sample",
          null,
          "gyvft-demo-example",
          false,
        ],
      ] as const)
        await sql`INSERT INTO customer_projects(id,title,customer_account_id,submission_key,is_draft,customer_email,created_at,stage,kind) VALUES(${id}::uuid,${title},${owner}::uuid,${key},${draft},'fictional@example.test','2026-11-01T00:00:00Z',${id === paid ? 4 : 3},'enquiry')`;
      for (const id of [paid, unanswered, pending]) {
        await sql`INSERT INTO customer_project_approvals(project_id,kind,version,status,amount_paise,created_at,decided_at) VALUES(${id}::uuid,'proposal',1,${id === paid ? "approved" : "pending"},1330000,'2026-11-15T00:00:00Z',${id === paid ? "2026-11-16T00:00:00Z" : null}::timestamptz)`;
        await sql`INSERT INTO gyvft_gift_options VALUES(${id}::uuid,true,false,'2026-11-10T00:00:00Z')`;
      }
      // Several versions and payment submissions still represent one request.
      await sql`INSERT INTO customer_project_approvals(project_id,kind,version,status,amount_paise,created_at) VALUES(${paid}::uuid,'proposal',2,'approved',1330000,'2026-11-17T00:00:00Z')`;
      await sql`INSERT INTO customer_payment_submissions VALUES(${paid}::uuid,'verified',665000,'2026-11-17T00:00:00Z','2026-11-18T00:00:00Z'),(${paid}::uuid,'pending',665000,'2026-11-19T00:00:00Z',null)`;
      await sql`INSERT INTO customer_project_messages VALUES(${unanswered}::uuid,'customer','2026-11-19T00:00:00Z')`;
    });
    afterAll(async () => {
      if (sql) await sql.end();
    });
    it("counts unique real request milestones, verified money and the correct waiting party", async () => {
      const report = await conversionReport(
        { window_days: 90, stalled_days: 3 },
        sql,
        now,
      );
      expect(report.cohortCount).toBe(3);
      expect(report.quoteApproval).toEqual({ numerator: 1, denominator: 3 });
      expect(report.quoteToPayment).toEqual({ numerator: 1, denominator: 3 });
      expect(report.verifiedPaise).toBe("665000");
      expect(report.accounts).toEqual({ registered: 2, withRequest: 1 });
      expect(report.savedPrivateBriefs).toBe(1);
      expect(report.stalledProposals).toBe(1);
      expect(report.followUps.find((r) => r.id === paid)).toMatchObject({
        waiting: "Aarla",
        action: "Verify payment",
      });
      expect(report.followUps.find((r) => r.id === unanswered)).toMatchObject({
        waiting: "Aarla",
        action: "Reply to customer",
      });
      expect(report.followUps.find((r) => r.id === pending)).toMatchObject({
        waiting: "Customer",
        proposal: true,
      });
      expect(JSON.stringify(report)).not.toContain("PRIVATE DRAFT CONTENT");
      expect(JSON.stringify(report)).not.toContain(
        "Demo account without a labelled key",
      );
    });
  },
);
