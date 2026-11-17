/** Opt-in against a disposable local Postgres database, never a hosted DB. */
import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
let sql: Sql;
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
const catalogue = vi.hoisted(() => vi.fn());
vi.mock("@/lib/customer/catalogue", () => ({ aarlaCatalogue: catalogue }));
import { runPendingMigrations } from "@/lib/database/migrations";
import {
  homeGifts,
  homeOccasions,
  homePayments,
} from "@/lib/customer/home-data";
import { savedIdeasFor, setSavedIdea } from "@/lib/customer/saved-ideas";
const url = process.env.HOME_TEST_DATABASE_URL;
const owner = randomUUID(),
  other = randomUUID(),
  draftGift = randomUUID(),
  order = randomUUID(),
  completed = randomUUID(),
  privateGift = randomUUID();
describe.skipIf(!url)("Home reads against a disposable database", () => {
  beforeAll(async () => {
    catalogue.mockResolvedValue({
      available: false,
      allProducts: [],
      products: [],
      offers: [],
    });
    const u = new URL(url!);
    if (!["localhost", "127.0.0.1"].includes(u.hostname))
      throw Error("Local test database required");
    sql = postgres(url!, { prepare: false, max: 1 });
    for (const role of ["anon", "authenticated"])
      await sql.unsafe(
        `DO $$ BEGIN CREATE ROLE ${role}; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      );
    await runPendingMigrations(sql, undefined, "customer");
    // Repeat setup must skip the new migration as well.
    expect(await runPendingMigrations(sql, undefined, "customer")).toEqual([]);
    for (const id of [owner, other])
      await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${id}::uuid,${id + "@example.test"},'test-only')`;
    for (const [id, account, stage, kind] of [
      [draftGift, owner, 2, "enquiry"],
      [order, owner, 4, "project"],
      [completed, owner, 11, "project"],
      [privateGift, other, 6, "project"],
    ] as const) {
      await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,kind,stage,total_paise,paid_paise,occasion_date,delivery_date) VALUES(${id}::uuid,${account}::uuid,${account + "@example.test"},${id},${kind},${stage},10000,5000,'2027-02-10','2027-02-08')`;
    }
    await sql`INSERT INTO gyvft_gift_options(project_id,title,contents,image_data,image_type,request_id) VALUES(${draftGift}::uuid,'Published A','[]',${Buffer.from("image")},'image/png',${randomUUID()}::uuid)`;
    const [hidden] =
      await sql`INSERT INTO gyvft_gift_options(project_id,title,contents,image_data,image_type,request_id) VALUES(${draftGift}::uuid,'Hidden B','[]',${Buffer.from("hidden-image")},'image/png',${randomUUID()}::uuid) RETURNING id`;
    await sql`INSERT INTO gyvft_gift_visibility(project_id,option_id,kind,hidden) VALUES(${draftGift}::uuid,${hidden.id},'curated',true)`;
    // Superseded pending proof must not surface as an action or thumbnail.
    await sql`INSERT INTO customer_project_approvals(project_id,kind,version,title,description,status,image_data,image_type) VALUES(${order}::uuid,'design',1,'Old','old','pending',${Buffer.from("old")},'image/png'),(${order}::uuid,'design',2,'Latest','latest','approved',NULL,NULL)`;
    for (const [project, status, amount, date] of [
      [order, "verified", 1000, "2026-03-31T18:29:59Z"],
      [order, "verified", 2000, "2026-03-31T18:30:00Z"],
      [completed, "verified", 3000, "2027-03-31T18:29:59Z"],
      [completed, "verified", 4000, "2027-03-31T18:30:00Z"],
      [order, "pending", 9999, null],
      [order, "rejected", 9999, null],
      [privateGift, "verified", 90000, "2026-06-01T00:00:00Z"],
    ] as const)
      await sql`INSERT INTO customer_payment_submissions(project_id,reference,status,amount_paise,verified_at) VALUES(${project}::uuid,${randomUUID()},${status},${amount},${date}::timestamptz)`;
    await sql`INSERT INTO gyvft_customer_occasions(account_id,title,occasion_date,repeats_annually) VALUES(${owner}::uuid,'Annual leap birthday','2000-02-29',true),(${owner}::uuid,'Old one-off','2020-01-01',false),(${other}::uuid,'Private birthday','2027-01-01',false)`;
  }, 30000);
  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM customer_projects WHERE customer_account_id IN (${owner}::uuid,${other}::uuid)`;
      await sql`DELETE FROM gyvft_customer_accounts WHERE id IN (${owner}::uuid,${other}::uuid)`;
      await sql.end();
    }
  });
  it("scopes and pages active cards, hides retired options and superseded proof images", async () => {
    const result = await homeGifts(owner, 0, 1);
    expect(result.total).toBe(2);
    expect(result.nextOffset).toBe(1);
    expect(result.items[0].id).toBe(draftGift);
    expect(result.items[0].visibleOptionCount).toBe(1);
    expect(result.items[0].action.kind).toBe("options");
    expect(JSON.stringify(result)).not.toContain("image_data");
    expect(JSON.stringify(result)).not.toContain("password_hash");
    const next = await homeGifts(owner, 1, 1);
    expect(next.items[0]).toMatchObject({
      id: order,
      image: null,
      action: { kind: "payment_verification" },
    });
    expect(await homeGifts(owner, 20, 1)).toMatchObject({
      items: [],
      total: 2,
      nextOffset: null,
    });
  });
  it("keeps occasion dates separate from delivery dates and rolls annual dates before paging", async () => {
    const result = await homeOccasions(owner, "2027-02-11", 0, 10);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "Annual leap birthday",
      date: "2027-02-28",
      daysAway: 17,
    });
    const earlier = await homeOccasions(owner, "2027-02-01", 0, 10);
    expect(earlier.items.filter((i) => i.source === "gift")).toHaveLength(2);
    expect(earlier.items.some((i) => i.date === "2027-02-08")).toBe(false);
  });
  it("sums only dated verified money within the Indian financial year, excluding pending/rejected and other accounts", async () => {
    const result = await homePayments(owner, "2026-11-17", 0, 2);
    expect(result.paidThisFinancialYearPaise).toBe(5000);
    expect(result.completedGifts).toBe(1);
    expect(result.receipts.total).toBe(4);
    expect(result.receipts.nextOffset).toBe(2);
    expect(result.pendingVerificationGiftCount).toBe(1);
    expect(result.dueGiftCount).toBe(0);
    expect(JSON.stringify(result)).not.toContain("reference");
  });
  it("saves ideas idempotently, prevents cross-account removal and preserves products through a catalogue outage", async () => {
    await setSavedIdea(
      owner,
      { kind: "story", id: "private-diwali-hampers" },
      true,
    );
    await setSavedIdea(
      owner,
      { kind: "story", id: "private-diwali-hampers" },
      true,
    );
    await setSavedIdea(
      other,
      { kind: "story", id: "private-diwali-hampers" },
      false,
    );
    expect((await savedIdeasFor(owner, 0, 10)).total).toBe(1);
    const snapshot = {
      title: "Saved product",
      image: "https://cdn.shopify.com/image.png",
      href: "https://aarla.in/products/saved",
    };
    await sql`INSERT INTO gyvft_customer_saved_products(account_id,product_id,snapshot) VALUES(${owner}::uuid,'123',${sql.json(snapshot)})`;
    expect(
      (await savedIdeasFor(owner, 0, 10)).items.find(
        (i) => i.kind === "product",
      ),
    ).toMatchObject({ availability: "unknown", title: "Saved product" });
    await expect(
      setSavedIdea(owner, { kind: "product", id: "456" }, true),
    ).rejects.toThrow("temporarily unavailable");
    await setSavedIdea(other, { kind: "product", id: "123" }, false);
    expect((await savedIdeasFor(owner, 0, 10)).total).toBe(2);
    await setSavedIdea(owner, { kind: "product", id: "123" }, false);
    expect((await savedIdeasFor(owner, 0, 10)).total).toBe(1);
  });
  it("stores a server-derived product snapshot once and can remove it during an outage", async () => {
    catalogue.mockResolvedValue({
      available: true,
      allProducts: [
        {
          id: "777",
          title: "Trusted catalogue title",
          image: "https://cdn.shopify.com/trusted.png",
          href: "https://aarla.in/products/trusted",
        },
      ],
    });
    await setSavedIdea(owner, { kind: "product", id: "777" }, true);
    await setSavedIdea(owner, { kind: "product", id: "777" }, true);
    const rows =
      await sql`SELECT snapshot FROM gyvft_customer_saved_products WHERE account_id=${owner}::uuid AND product_id='777'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].snapshot.title).toBe("Trusted catalogue title");
    catalogue.mockResolvedValue({
      available: false,
      allProducts: [],
      products: [],
      offers: [],
    });
    await setSavedIdea(owner, { kind: "product", id: "777" }, false);
    expect(
      (await savedIdeasFor(owner, 0, 10)).items.some((i) => i.id === "777"),
    ).toBe(false);
  });
  it("prevents direct browser database roles from reading saved ideas", async () => {
    await sql`SET ROLE anon`;
    try {
      await expect(
        sql`SELECT * FROM gyvft_customer_saved_products`,
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await sql`RESET ROLE`;
    }
  });
});
