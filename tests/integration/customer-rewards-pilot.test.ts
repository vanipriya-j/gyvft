import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres, { type Sql } from "postgres";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
let sql: Sql;
const state = vi.hoisted(() => ({ shop: vi.fn(), mail: vi.fn() }));
vi.mock("@/lib/database/client", () => ({
  getSql: () => sql,
  withTransaction: <T>(fn: (tx: Sql) => Promise<T>) =>
    sql.begin((tx) => fn(tx as unknown as Sql)),
}));
vi.mock("@/lib/customer/shopify", () => ({ shopifyRequest: state.shop }));
vi.mock("@/services/notifications/transports", () => ({
  sendNotificationEmail: state.mail,
}));
import {
  applyPilotCustomer,
  previewPilotCustomer,
  pilotStatus,
} from "@/lib/rewards/pilot";
import { rewardWallet } from "@/lib/rewards/store";
import { POST } from "@/app/api/operations/customer-pilot/route";
import type { PilotCustomer } from "@/lib/rewards/pilot-model";
import type { RawRewardOrder } from "@/services/shopify/rewards";

const uri = process.env.TEST_PILOT_DB_URL;
const schema = "pilot_" + randomUUID().replaceAll("-", "");
const customer: PilotCustomer = {
  shopifyCustomerId: "gid://shopify/Customer/42",
  email: "selected@example.test",
  name: "Selected customer",
};
const other: PilotCustomer = {
  shopifyCustomerId: "gid://shopify/Customer/99",
  email: "outside@example.test",
  name: "Outside customer",
};
const collection = "gid://shopify/Collection/1";
const money = (amount: string) => ({
  shopMoney: { amount, currencyCode: "INR" },
});
let orders: RawRewardOrder[], identityEmail: string, fullHistory: boolean;
function raw(id = "gid://shopify/Order/42"): RawRewardOrder {
  return {
    id,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    transactions: [
      { kind: "SALE", status: "SUCCESS", processedAt: "2026-01-02T00:00:00Z" },
    ],
    test: false,
    cancelledAt: null,
    sourceName: "web",
    tags: [],
    taxesIncluded: true,
    displayFinancialStatus: "PAID",
    purchasingEntity: { __typename: "Customer" },
    customer: {
      id: customer.shopifyCustomerId,
      defaultEmailAddress: { emailAddress: customer.email },
    },
    totalOutstandingSet: money("0.00"),
    lineItems: {
      pageInfo: { hasNextPage: false },
      nodes: [
        {
          id: "L1",
          isGiftCard: false,
          quantity: 1,
          currentQuantity: 1,
          product: { id: "P1", inCollection: true },
          variant: { id: "V1" },
          originalTotalSet: money("6000.00"),
          discountAllocations: [{ allocatedAmountSet: money("100.00") }],
          taxLines: [{ priceSet: money("900.00") }],
        },
      ],
    },
    discountApplications: { pageInfo: { hasNextPage: false }, nodes: [] },
  };
}
const counts = async () => {
  const [r] = await sql`SELECT
    (SELECT count(*)::int FROM gyvft_customer_accounts) AS accounts,
    (SELECT count(*)::int FROM gyvft_customer_profiles) AS profiles,
    (SELECT count(*)::int FROM gyvft_reward_wallets) AS wallets,
    (SELECT count(*)::int FROM gyvft_reward_orders) AS orders,
    (SELECT count(*)::int FROM gyvft_reward_lots) AS lots,
    (SELECT count(*)::int FROM gyvft_reward_imports) AS imports,
    (SELECT count(*)::int FROM gyvft_reward_ledger) AS ledger,
    (SELECT count(*)::int FROM gyvft_operations_intakes) AS intakes`;
  return r;
};
describe.skipIf(!uri)(
  "owner-run customer rewards test on a disposable local database",
  () => {
    beforeAll(async () => {
      const target = new URL(uri!);
      if (
        !["127.0.0.1", "localhost"].includes(target.hostname) ||
        target.pathname !== "/gyvft_gallery_test"
      )
        throw Error("Requires dedicated localhost pilot fixture");
      sql = postgres(uri!, {
        max: 1,
        prepare: false,
        connection: { search_path: schema },
        onnotice() {},
      });
      await sql.unsafe(`CREATE SCHEMA ${schema}`);
      await sql.unsafe(`SET search_path TO ${schema}`);
      await sql.unsafe(
        "DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$",
      );
      for (const file of [
        "20261112000000_customer_portal.sql",
        "20261114000001_customer_accounts.sql",
        "20261124000003_operations_intake.sql",
        "20261125000001_d2c_rewards.sql",
      ])
        await sql.unsafe(readFileSync("supabase/migrations/" + file, "utf8"));
      // Exact profile table definition, without unrelated gifting workflow migrations.
      const profileSql = readFileSync(
        "supabase/migrations/20261119000001_gifting_journeys.sql",
        "utf8",
      ).match(
        /CREATE TABLE IF NOT EXISTS gyvft_customer_profiles[\s\S]+?\);/,
      )![0];
      await sql.unsafe(profileSql);
      vi.stubEnv("DATABASE_URL", uri!);
      vi.stubEnv("SETUP_SECRET", "pilot-local-fixture-only");
    });
    beforeEach(async () => {
      // Only this new localhost fixture schema is cleared.
      await sql.unsafe(
        "TRUNCATE gyvft_customer_accounts,gyvft_customer_profiles,gyvft_operations_intakes,gyvft_reward_wallets,gyvft_reward_orders,gyvft_reward_lots,gyvft_reward_imports,gyvft_reward_ledger CASCADE",
      );
      await sql`UPDATE gyvft_reward_settings SET enabled=false,collection_id=${collection},revision=1,lease_until=NULL,sync_until=NULL,last_sync_at=NULL`;
      orders = [raw()];
      identityEmail = customer.email;
      fullHistory = true;
      state.mail.mockReset();
      state.shop.mockReset();
      state.shop.mockImplementation(async (q: string) => {
        if (q.includes("query GYVFTRewardConnection"))
          return {
            shop: { currencyCode: "INR" },
            currentAppInstallation: {
              accessScopes: [
                "read_orders",
                ...(fullHistory ? ["read_all_orders"] : []),
                "read_products",
                "read_customers",
                "write_discounts",
              ].map((handle) => ({ handle })),
            },
          };
        if (q.includes("query GYVFTRewardCustomer"))
          return {
            customer: {
              id: customer.shopifyCustomerId,
              defaultEmailAddress: { emailAddress: identityEmail },
            },
          };
        if (q.includes("query GYVFTPilotRewardOrders"))
          return {
            orders: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: orders,
            },
          };
        throw Error("Unexpected provider operation: " + q.slice(0, 40));
      });
    });
    afterAll(async () => {
      await sql?.end();
      vi.unstubAllEnvs();
    });
    it("checks the real transaction and rolls back all staged rows", async () => {
      const before = await counts();
      const preview = await previewPilotCustomer(customer);
      expect(preview).toMatchObject({
        account: "create",
        orders: 1,
        points: 100,
        pendingPoints: 0,
        enabled: false,
      });
      expect(await counts()).toEqual(before);
      expect(state.mail).not.toHaveBeenCalled();
    });
    it("creates a claimable account and exact order reward once, without verifying identity or sending mail", async () => {
      const preview = await previewPilotCustomer(customer);
      const result = await applyPilotCustomer(
        customer,
        preview.id,
        preview.fingerprint,
      );
      expect(result).toMatchObject({ createdAccount: true, points: 100 });
      const [account] = await sql`SELECT * FROM gyvft_customer_accounts`;
      expect(account.password_hash).toMatch(/^scrypt\$/);
      const [profile] = await sql`SELECT * FROM gyvft_customer_profiles`;
      expect(profile).toMatchObject({
        name: customer.name,
        share_profile: false,
      });
      const [wallet] = await sql`SELECT * FROM gyvft_reward_wallets`;
      expect(wallet).toMatchObject({
        account_id: null,
        verified_at: null,
        verified_email: null,
      });
      expect((await rewardWallet(customer.shopifyCustomerId)).available).toBe(
        100,
      );
      expect(
        (await sql`SELECT enabled FROM gyvft_reward_settings`)[0].enabled,
      ).toBe(false);
      expect(state.mail).not.toHaveBeenCalled();
      expect(state.shop.mock.calls.every(([q]) => q.startsWith("query "))).toBe(
        true,
      );
      const before = await counts();
      state.shop.mockRejectedValue(Error("Provider offline"));
      expect(
        await applyPilotCustomer(customer, preview.id, preview.fingerprint),
      ).toMatchObject({ alreadyApplied: true });
      expect(await counts()).toEqual(before);
    });
    it("preserves existing password, profile and credits on a new preview/rerun", async () => {
      const [account] =
        await sql`INSERT INTO gyvft_customer_accounts(email,password_hash) VALUES(${customer.email},'existing-password-hash') RETURNING id`;
      await sql`INSERT INTO gyvft_customer_profiles(account_id,name,interests,avoid,share_profile) VALUES(${account.id},'Original name','Books','Plastic',true)`;
      const preview = await previewPilotCustomer(customer);
      expect(preview.account).toBe("preserve");
      await applyPilotCustomer(customer, preview.id, preview.fingerprint);
      const second = await previewPilotCustomer(customer);
      expect(second.points).toBe(0);
      await applyPilotCustomer(customer, second.id, second.fingerprint);
      expect((await rewardWallet(customer.shopifyCustomerId)).available).toBe(
        100,
      );
      expect(
        (await sql`SELECT password_hash FROM gyvft_customer_accounts`)[0]
          .password_hash,
      ).toBe("existing-password-hash");
      expect(
        (await sql`SELECT * FROM gyvft_customer_profiles`)[0],
      ).toMatchObject({
        name: "Original name",
        interests: "Books",
        avoid: "Plastic",
        share_profile: true,
      });
    });
    it("does not approve another customer’s eligible historical order", async () => {
      await sql`INSERT INTO gyvft_reward_wallets(customer_id,email) VALUES(${other.shopifyCustomerId},${other.email})`;
      await sql`INSERT INTO gyvft_reward_orders(id,customer_id,email,created_at,paid_at,updated_at,classification,reason,eligible_paise,snapshot_hash,is_historical) VALUES('gid://shopify/Order/99',${other.shopifyCustomerId},${other.email},'2026-01-01','2026-01-01','2026-01-01','d2c','Other fixture',500000,'outside',true)`;
      const preview = await previewPilotCustomer(customer);
      await applyPilotCustomer(customer, preview.id, preview.fingerprint);
      expect(
        (
          await sql`SELECT authorised FROM gyvft_reward_orders WHERE customer_id=${other.shopifyCustomerId}`
        )[0].authorised,
      ).toBe(false);
      expect(
        (
          await sql`SELECT count(*)::int AS n FROM gyvft_reward_lots WHERE customer_id=${other.shopifyCustomerId}`
        )[0].n,
      ).toBe(0);
    });
    it("rejects changed live orders after preview and rolls back the account and mirrors", async () => {
      const preview = await previewPilotCustomer(customer);
      orders[0].lineItems.nodes[0].originalTotalSet = money("9000");
      await expect(
        applyPilotCustomer(customer, preview.id, preview.fingerprint),
      ).rejects.toThrow("changed after");
      expect(await counts()).toMatchObject({
        accounts: 0,
        wallets: 0,
        orders: 0,
        ledger: 0,
      });
    });
    it("rejects a new account or settings change since the preview", async () => {
      const preview = await previewPilotCustomer(customer);
      await sql`INSERT INTO gyvft_customer_accounts(email,password_hash) VALUES(${customer.email},'keep-me')`;
      await expect(
        applyPilotCustomer(customer, preview.id, preview.fingerprint),
      ).rejects.toThrow("changed after");
      expect(
        (await sql`SELECT password_hash FROM gyvft_customer_accounts`)[0]
          .password_hash,
      ).toBe("keep-me");
      const fresh = await previewPilotCustomer(customer);
      await sql`UPDATE gyvft_reward_settings SET revision=revision+1`;
      await expect(
        applyPilotCustomer(customer, fresh.id, fresh.fingerprint),
      ).rejects.toThrow("changed after");
      expect((await counts()).orders).toBe(0);
    });
    it("holds recent earning, excludes cancelled/redemption orders and leaves draft orders for review", async () => {
      const recent = raw();
      recent.transactions[0].processedAt = new Date().toISOString();
      const redemption = raw("gid://shopify/Order/43");
      redemption.discountApplications.nodes = [
        { __typename: "DiscountCodeApplication", code: "GYVFTR-example" },
      ];
      const draft = raw("gid://shopify/Order/44");
      draft.sourceName = "shopify_draft_order";
      const cancelled = raw("gid://shopify/Order/45");
      cancelled.cancelledAt = new Date().toISOString();
      orders = [recent, redemption, draft, cancelled];
      const preview = await previewPilotCustomer(customer);
      expect(preview).toMatchObject({
        points: 0,
        pendingPoints: 100,
        excluded: 2,
      });
      expect(preview.review).toHaveLength(1);
      await applyPilotCustomer(customer, preview.id, preview.fingerprint);
      expect(await rewardWallet(customer.shopifyCustomerId)).toMatchObject({
        available: 0,
        pending: 100,
      });
      expect(
        (
          await sql`SELECT count(*)::int AS n FROM gyvft_reward_orders WHERE authorised`
        )[0].n,
      ).toBe(1);
    });
    it("requires collection membership and carries fractional earning across orders", async () => {
      const a = raw(),
        b = raw("gid://shopify/Order/43"),
        outside = raw("gid://shopify/Order/44");
      a.taxesIncluded = b.taxesIncluded = false;
      a.lineItems.nodes[0].originalTotalSet = money("149.00");
      b.lineItems.nodes[0].originalTotalSet = money("101.00");
      outside.lineItems.nodes[0].product!.inCollection = false;
      orders = [a, b, outside]; // after each ₹100 discount: ₹49 + ₹1 = one point.
      const preview = await previewPilotCustomer(customer);
      expect(preview.points).toBe(1);
      await applyPilotCustomer(customer, preview.id, preview.fingerprint);
      expect((await rewardWallet(customer.shopifyCustomerId)).available).toBe(
        1,
      );
    });
    it("fails closed on missing history permissions, identity changes or inactive accounts", async () => {
      fullHistory = false;
      await expect(previewPilotCustomer(customer)).rejects.toThrow(
        "complete order history",
      );
      fullHistory = true;
      identityEmail = other.email;
      await expect(previewPilotCustomer(customer)).rejects.toThrow(
        "email changed",
      );
      identityEmail = customer.email;
      await sql`INSERT INTO gyvft_customer_accounts(email,password_hash,is_active) VALUES(${customer.email},'keep',false)`;
      await expect(previewPilotCustomer(customer)).rejects.toThrow("inactive");
      expect((await counts()).orders).toBe(0);
    });
    it("never adjusts an existing credited order through this import", async () => {
      const preview = await previewPilotCustomer(customer);
      await applyPilotCustomer(customer, preview.id, preview.fingerprint);
      orders[0].updatedAt = "2026-02-01T00:00:00Z";
      await expect(previewPilotCustomer(customer)).rejects.toThrow(
        "credited order changed",
      );
      expect((await rewardWallet(customer.shopifyCustomerId)).available).toBe(
        100,
      );
    });
    it("stops a concurrent or unfinished global scan rather than advancing its checkpoint", async () => {
      await sql`UPDATE gyvft_reward_settings SET sync_until=now(),sync_cursor='global-checkpoint'`;
      await expect(previewPilotCustomer(customer)).rejects.toThrow(
        "Finish the scan",
      );
      expect(
        (await sql`SELECT sync_cursor FROM gyvft_reward_settings`)[0]
          .sync_cursor,
      ).toBe("global-checkpoint");
      expect((await counts()).orders).toBe(0);
    });
    it("does not install a missing collection configuration", async () => {
      await sql`UPDATE gyvft_reward_settings SET collection_id=NULL`;
      await expect(pilotStatus()).rejects.toThrow("eligible retail collection");
      expect((await counts()).accounts).toBe(0);
    });
    it("rolls back account, order and credit together if the final ledger write fails", async () => {
      const preview = await previewPilotCustomer(customer);
      await sql.unsafe(
        `CREATE FUNCTION ${schema}.reject_earning() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='earn' THEN RAISE EXCEPTION 'fictional fixture failure'; END IF; RETURN NEW; END $$`,
      );
      await sql.unsafe(
        `CREATE TRIGGER reject_earning BEFORE INSERT ON gyvft_reward_ledger FOR EACH ROW EXECUTE FUNCTION ${schema}.reject_earning()`,
      );
      try {
        await expect(
          applyPilotCustomer(customer, preview.id, preview.fingerprint),
        ).rejects.toThrow("fictional fixture failure");
        expect(await counts()).toMatchObject({
          accounts: 0,
          profiles: 0,
          wallets: 0,
          orders: 0,
          lots: 0,
          imports: 0,
          ledger: 0,
          intakes: 0,
        });
      } finally {
        await sql.unsafe("DROP TRIGGER reject_earning ON gyvft_reward_ledger");
      }
      await applyPilotCustomer(customer, preview.id, preview.fingerprint);
      expect((await rewardWallet(customer.shopifyCustomerId)).available).toBe(
        100,
      );
    });
    it("serializes duplicate concurrent applies and rejects replay for another customer", async () => {
      const preview = await previewPilotCustomer(customer);
      const results = await Promise.all([
        applyPilotCustomer(customer, preview.id, preview.fingerprint),
        applyPilotCustomer(customer, preview.id, preview.fingerprint),
      ]);
      expect(results.filter((r) => !r.alreadyApplied)).toHaveLength(1);
      expect((await counts()).imports).toBe(1);
      expect((await rewardWallet(customer.shopifyCustomerId)).available).toBe(
        100,
      );
      await expect(
        applyPilotCustomer(other, preview.id, preview.fingerprint),
      ).rejects.toThrow("different reviewed customer");
    });
    it("refuses truncated or repeating history without creating partial customer records", async () => {
      const normal = state.shop.getMockImplementation()!;
      state.shop.mockImplementation(async (q: string, vars: unknown) =>
        q.includes("query GYVFTPilotRewardOrders")
          ? {
              orders: {
                nodes: orders,
                pageInfo: { hasNextPage: true, endCursor: "same" },
              },
            }
          : normal(q, vars),
      );
      await expect(previewPilotCustomer(customer)).rejects.toThrow(
        "repeated customer order",
      );
      expect((await counts()).orders).toBe(0);
    });
    it("protects the API by secret, origin, strict schema and explicit confirmation", async () => {
      const req = (
        payload: unknown,
        secret = "pilot-local-fixture-only",
        origin = "https://www.gyvft.com",
      ) =>
        new Request("https://www.gyvft.com/api/operations/customer-pilot", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-setup-secret": secret,
            origin,
          },
          body: JSON.stringify(payload),
        });
      expect((await POST(req({ op: "status" }, "wrong"))).status).toBe(401);
      expect(
        (await POST(req({ op: "status" }, undefined, "https://evil.test")))
          .status,
      ).toBe(403);
      expect((await POST(req({ op: "apply", customer }))).status).toBe(400);
      expect(
        (
          await POST(
            req({ op: "preview", customer: { ...customer, points: 999999 } }),
          )
        ).status,
      ).toBe(400);
      const response = await POST(req({ op: "preview", customer }));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect((await counts()).accounts).toBe(0);
    });
  },
);
