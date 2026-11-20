// Explicit disposable local browser fixture, never used by app startup.
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { runPendingMigrations } from "../../src/lib/database/migrations";
const databaseURL = process.env.DATABASE_URL!;
const u = new URL(databaseURL);
if (
  u.hostname !== "127.0.0.1" ||
  !u.pathname.startsWith("/gyvft_shipping_browser_")
)
  throw Error("Local only");
const sql = postgres(databaseURL, {
  max: 1,
  prepare: false,
  onnotice: () => {},
});
for (const role of ["anon", "authenticated"])
  await sql.unsafe(
    `DO $$ BEGIN CREATE ROLE ${role}; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  );
await runPendingMigrations(sql, undefined, "customer");
const accountId = randomUUID(),
  projectId = randomUUID();
const email = `shipping-browser-${accountId}@example.test`;
mkdirSync("work", { recursive: true });
await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${accountId},${email},'test-only')`;
await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,kind,stage,total_paise,paid_paise,shopify_order_reference) VALUES(${projectId},${accountId},${email},'Shipping browser gift','project',8,100000,100000,'#SHIPPING-LOCAL')`;
await sql`INSERT INTO customer_project_approvals(project_id,kind,version,title,description,status) VALUES(${projectId},'design',1,'Approved proof','Test artwork','approved')`;
writeFileSync(
  "work/shipping-browser-fixture.json",
  JSON.stringify({ databaseURL, accountId, projectId }),
);
await sql.end();
