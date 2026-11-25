import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
let sql: Sql;
const state = vi.hoisted(() => ({
  shop: vi.fn(),
  mail: vi.fn(),
  customer: vi.fn(),
  account: null as { id: string; email: string } | null,
}));
vi.mock("@/lib/database/client", () => ({
  getSql: () => sql,
  withTransaction: <T>(fn: (tx: Sql) => Promise<T>) =>
    sql.begin((tx) => fn(tx as unknown as Sql)),
}));
vi.mock("@/lib/customer/shopify", () => ({
  shopifyRequest: state.shop,
  syncShopifyCustomer: state.customer,
}));
vi.mock("@/services/notifications/transports", () => ({
  sendNotificationEmail: state.mail,
}));
vi.mock("@/lib/customer/session", () => ({
  getCustomerAccount: async () => state.account,
}));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: vi.fn(),
}));
import {
  rewardSettings,
  rewardWallet,
  previewOpening,
  applyOpening,
} from "@/lib/rewards/store";
import { issueReward, reconcileRewardCoupon } from "@/lib/rewards/coupons";
import {
  sendRewardVerification,
  confirmRewardVerification,
  verifiedRewardCustomer,
} from "@/lib/rewards/identity";
import { saveRewardDates } from "@/lib/rewards/service";
import { syncRewardOrders, reviewRewardOrder } from "@/lib/rewards/sync";
import {
  GET as customerGet,
  POST as customerPost,
} from "@/app/api/customer/rewards/route";
import { POST as operatorPost } from "@/app/api/operations/rewards/route";
import { GET as cron } from "@/app/api/cron/rewards/route";
import type {
  RawRewardOrder,
  RewardCouponNode,
} from "@/services/shopify/rewards";
const uri = process.env.TEST_REWARDS_DB_URL,
  schema = "rewards_" + randomUUID().replaceAll("-", "");
const capabilities = {
  shop: { currencyCode: "INR" },
  currentAppInstallation: {
    accessScopes: [
      "read_orders",
      "read_all_orders",
      "read_products",
      "read_customers",
      "write_discounts",
    ].map((handle) => ({ handle })),
  },
};
const customer = "gid://shopify/Customer/1",
  collection = "gid://shopify/Collection/1";
let account: { id: string; email: string },
  other: { id: string; email: string };
let sequence = 1;
const bag = (amount: string) => ({
  shopMoney: { amount, currencyCode: "INR" },
});
function rawOrder(id: string, basis = "5000.00"): RawRewardOrder {
  return {
    id,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    transactions: [
      {
        kind: "SALE",
        status: "SUCCESS",
        processedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
    ],
    test: false,
    cancelledAt: null,
    sourceName: "web",
    tags: [],
    taxesIncluded: false,
    displayFinancialStatus: "PAID",
    purchasingEntity: { __typename: "Customer" },
    customer: {
      id: customer,
      defaultEmailAddress: { emailAddress: account.email },
    },
    totalOutstandingSet: bag("0"),
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
          originalTotalSet: bag(basis),
          discountAllocations: [],
          taxLines: [],
        },
      ],
    },
    discountApplications: { pageInfo: { hasNextPage: false }, nodes: [] },
  };
}
async function seed(points = 100, historical = false) {
  const id = `gid://shopify/Order/${sequence++}`;
  await sql`INSERT INTO gyvft_reward_orders(id,customer_id,email,created_at,paid_at,updated_at,classification,reason,eligible_paise,codes,snapshot_hash,is_historical,authorised,authorised_at) VALUES(${id},${customer},${account.email},now()-interval '30 days',now()-interval '30 days',now(),'d2c','fixture',${points * 5000},'{}',${randomUUID()},${historical},${!historical},${historical ? null : new Date()})`;
  return id;
}
function fakeCoupon(input: Record<string, unknown>): RewardCouponNode {
  const min = input.minimumRequirement as {
      subtotal: { greaterThanOrEqualToSubtotal: string };
    },
    gets = input.customerGets as {
      items: { collections: { add: string[] } };
      value: { discountAmount: { amount: string; appliesOnEachItem: boolean } };
    };
  return {
    id: "gid://shopify/DiscountCodeNode/1",
    codeDiscount: {
      __typename: "DiscountCodeBasic",
      title: String(input.title),
      tags: input.tags as string[],
      startsAt: String(input.startsAt),
      endsAt: String(input.endsAt),
      status: "ACTIVE",
      asyncUsageCount: 0,
      usageLimit: 1,
      appliesOncePerCustomer: true,
      combinesWith: {
        orderDiscounts: false,
        productDiscounts: false,
        shippingDiscounts: false,
      },
      context: {
        __typename: "DiscountCustomers",
        customers: [{ id: customer }],
      },
      codes: { nodes: [{ code: String(input.code) }] },
      minimumRequirement: {
        __typename: "DiscountMinimumSubtotal",
        greaterThanOrEqualToSubtotal: {
          amount: min.subtotal.greaterThanOrEqualToSubtotal,
          currencyCode: "INR",
        },
      },
      customerGets: {
        appliesOnOneTimePurchase: true,
        appliesOnSubscription: false,
        value: {
          __typename: "DiscountAmount",
          amount: {
            amount: gets.value.discountAmount.amount,
            currencyCode: "INR",
          },
          appliesOnEachItem: false,
        },
        items: {
          __typename: "DiscountCollections",
          collections: {
            nodes: gets.items.collections.add.map((id) => ({ id })),
            pageInfo: { hasNextPage: false },
          },
        },
      },
    },
  };
}
function provider() {
  let coupon: RewardCouponNode | null = null;
  state.shop.mockImplementation(
    async (query: string, variables: Record<string, unknown>) => {
      if (query.includes("GYVFTRewardCouponLookup"))
        return { codeDiscountNodeByCode: coupon };
      if (query.includes("mutation GYVFTRewardCouponCreate")) {
        coupon = fakeCoupon(variables.input as Record<string, unknown>);
        return {
          discountCodeBasicCreate: { codeDiscountNode: coupon, userErrors: [] },
        };
      }
      if (query.includes("query GYVFTRewardUse"))
        return { orders: { pageInfo: { hasNextPage: false }, nodes: [] } };
      if (query.includes("query GYVFTRewardCustomer"))
        return {
          customer: {
            id: customer,
            defaultEmailAddress: { emailAddress: account.email },
          },
        };
      throw Error("Unexpected provider operation");
    },
  );
  return () => coupon;
}
const req = (op: Record<string, unknown>, origin = "https://www.gyvft.com") =>
  new Request("https://www.gyvft.com/api/customer/rewards", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(op),
  });
describe.skipIf(!uri)(
  "D2C rewards isolated database and provider boundaries",
  () => {
    beforeAll(async () => {
      const target = new URL(uri!);
      if (
        target.hostname !== "127.0.0.1" ||
        target.port !== "55438" ||
        target.pathname !== "/gyvft_gallery_test"
      )
        throw Error("Requires dedicated localhost rewards fixture.");
      sql = postgres(uri!, {
        max: 5,
        connection: { search_path: schema },
        onnotice: () => {},
      });
      await sql.unsafe(`CREATE SCHEMA ${schema}`);
      for (const file of [
        "20261112000000_customer_portal.sql",
        "20261114000001_customer_accounts.sql",
        "20261125000001_d2c_rewards.sql",
      ])
        await sql.unsafe(readFileSync("supabase/migrations/" + file, "utf8"));
      [account] =
        await sql`INSERT INTO gyvft_customer_accounts(email,password_hash) VALUES('reward-buyer@example.test','fixture-no-login') RETURNING id,email`;
      [other] =
        await sql`INSERT INTO gyvft_customer_accounts(email,password_hash) VALUES('other@example.test','fixture-no-login') RETURNING id,email`;
      vi.stubEnv("DATABASE_URL", uri!);
      vi.stubEnv("SETUP_SECRET", "reward-local-fixture-only");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.gyvft.com");
    });
    beforeEach(async () => {
      state.shop.mockReset();
      state.mail.mockReset();
      state.customer.mockReset();
      state.mail.mockResolvedValue("fictional-email");
      state.customer.mockResolvedValue(customer);
      state.account = account;
      // Only this test-created schema is cleared; production endpoints are never contacted.
      await sql.unsafe(
        "TRUNCATE gyvft_reward_allocations,gyvft_reward_coupons,gyvft_reward_lots,gyvft_reward_orders,gyvft_reward_ledger,gyvft_reward_imports,gyvft_reward_dates,gyvft_reward_verifications,gyvft_reward_wallets",
      );
      await sql`UPDATE gyvft_reward_settings SET enabled=true,collection_id=${collection},activated_at=now(),last_sync_at=now(),sync_until=NULL,sync_cursor=NULL,lease_until=NULL,sync_since=NULL`;
      await sql`INSERT INTO gyvft_reward_wallets(customer_id,email,account_id,verified_email,verified_at) VALUES(${customer},${account.email},${account.id}::uuid,${account.email},now())`;
    });
    afterAll(async () => {
      await sql?.end();
      vi.unstubAllEnvs();
    });
    it("keeps the programme disabled until explicit settings activation and protects private tables", async () => {
      await sql`UPDATE gyvft_reward_settings SET enabled=false`;
      expect((await rewardSettings()).enabled).toBe(false);
      const [rls] =
        await sql`SELECT bool_and(relrowsecurity) AS protected FROM pg_class WHERE relnamespace=${schema}::regnamespace AND relname LIKE 'gyvft_reward_%' AND relkind='r'`;
      expect(rls.protected).toBe(true);
    });
    it("previews historical credit without touching wallet balances; apply is idempotent", async () => {
      await seed(100, true);
      expect((await rewardWallet(customer)).available).toBe(0);
      const preview = await previewOpening();
      expect(preview.points).toBe(100);
      expect(preview.wallets).toMatchObject([
        { email: account.email, points: 100, orders: 1 },
      ]);
      expect((await rewardWallet(customer)).available).toBe(0);
      await applyOpening(String(preview.id), preview.fingerprint);
      expect((await rewardWallet(customer)).available).toBe(100);
      await applyOpening(String(preview.id), preview.fingerprint);
      expect((await rewardWallet(customer)).available).toBe(100);
    });
    it("applies a 500-customer opening allocation atomically with no duplicate credit", async () => {
      await sql`INSERT INTO gyvft_reward_wallets(customer_id,email) SELECT 'gid://shopify/Customer/'||(930000+n),'historical-'||n||'@example.test' FROM generate_series(1,500) AS n`;
      await sql`INSERT INTO gyvft_reward_orders(id,customer_id,email,created_at,paid_at,updated_at,classification,reason,eligible_paise,codes,snapshot_hash,is_historical,authorised) SELECT 'gid://shopify/Order/'||(930000+n),'gid://shopify/Customer/'||(930000+n),'historical-'||n||'@example.test',now()-interval '30 days',now()-interval '30 days',now(),'d2c','Bulk fictional fixture',500000,'{}','fixture-'||n,true,false FROM generate_series(1,500) AS n`;
      const preview = await previewOpening();
      expect(preview.wallets).toHaveLength(500);
      expect(preview.points).toBe(50000);
      await applyOpening(preview.id, preview.fingerprint);
      await applyOpening(preview.id, preview.fingerprint);
      const [balance] =
        await sql`SELECT count(*)::int AS lots,sum(earned)::int AS total FROM gyvft_reward_lots`;
      expect(balance).toMatchObject({ lots: 500, total: 50000 });
    });
    it("rejects a changed historical snapshot rather than applying a stale preview", async () => {
      const id = await seed(100, true);
      const preview = await previewOpening();
      await sql`UPDATE gyvft_reward_orders SET snapshot_hash='changed',eligible_paise=250000 WHERE id=${id}`;
      await expect(
        applyOpening(String(preview.id), preview.fingerprint),
      ).rejects.toThrow("changed");
      expect((await rewardWallet(customer)).available).toBe(0);
    });
    it("accounts for existing fractional carry in the opening preview", async () => {
      const id = await seed(0, false);
      await sql`UPDATE gyvft_reward_orders SET eligible_paise=4900 WHERE id=${id}`;
      const historical = await seed(0, true);
      await sql`UPDATE gyvft_reward_orders SET eligible_paise=100 WHERE id=${historical}`;
      const preview = await previewOpening();
      expect(preview.points).toBe(1);
      await applyOpening(String(preview.id), preview.fingerprint);
      expect((await rewardWallet(customer)).available).toBe(1);
    });
    it("includes the existing fractional carry in the pending balance", async () => {
      const first = await seed(0),
        second = await seed(0);
      await sql`UPDATE gyvft_reward_orders SET eligible_paise=4900 WHERE id=${first}`;
      await sql`UPDATE gyvft_reward_orders SET eligible_paise=100,paid_at=now()-interval '1 day' WHERE id=${second}`;
      expect(await rewardWallet(customer)).toMatchObject({
        available: 0,
        pending: 1,
      });
    });
    it("holds earning until 14 days after successful payment and expires unused points", async () => {
      const id = await seed();
      await sql`UPDATE gyvft_reward_orders SET paid_at=now()-interval '1 day' WHERE id=${id}`;
      expect(await rewardWallet(customer)).toMatchObject({
        available: 0,
        pending: 100,
      });
      await sql`UPDATE gyvft_reward_orders SET paid_at=now()-interval '15 days' WHERE id=${id}`;
      expect((await rewardWallet(customer)).available).toBe(100);
      await sql`UPDATE gyvft_reward_orders SET paid_at=now()-interval '400 days' WHERE id=${id}`;
      expect((await rewardWallet(customer)).available).toBe(0);
      const [journal] =
        await sql`SELECT sum(points)::int AS net FROM gyvft_reward_ledger WHERE customer_id=${customer}`;
      expect(journal.net).toBe(0);
    });
    it("does not spend points at checkout handoff; a retry reuses the same native coupon", async () => {
      await seed();
      provider();
      const result = await issueReward(customer, "points", 60);
      expect(result.minimumPaise).toBe(24000);
      expect(result.redirectUrl).toContain("https://aarla.in/discount/GYVFTR-");
      expect(await rewardWallet(customer)).toMatchObject({
        available: 40,
        reserved: 60,
        spent: 0,
      });
      const retry = await issueReward(customer, "points", 90);
      expect(retry.code).toBe(result.code);
      expect(
        state.shop.mock.calls.filter(([q]) =>
          q.includes("mutation GYVFTRewardCouponCreate"),
        ),
      ).toHaveLength(1);
    });
    it("serializes concurrent redemptions to one reservation", async () => {
      await seed();
      provider();
      const results = await Promise.allSettled([
        issueReward(customer, "points", 80),
        issueReward(customer, "points", 80),
      ]);
      expect(results.some((r) => r.status === "fulfilled")).toBe(true);
      const [count] =
        await sql`SELECT count(*)::int AS n FROM gyvft_reward_coupons`;
      expect(count.n).toBe(1);
      expect(await rewardWallet(customer)).toMatchObject({
        available: 20,
        reserved: 80,
      });
    });
    it("holds an uncertain create and recovers by exact code without minting another coupon", async () => {
      await seed();
      const get = provider();
      const base = state.shop.getMockImplementation()!;
      let timeout = true;
      state.shop.mockImplementation(async (q, v) => {
        const response = await base(q, v);
        if (q.includes("mutation GYVFTRewardCouponCreate") && timeout) {
          timeout = false;
          throw Error("lost provider response");
        }
        return response;
      });
      await expect(issueReward(customer, "points", 60)).rejects.toThrow(
        "pending",
      );
      expect((await rewardWallet(customer)).reserved).toBe(60);
      const recovered = await issueReward(customer, "points", 60);
      expect(recovered.code).toBe(get()!.codeDiscount.codes.nodes[0].code);
      expect(
        state.shop.mock.calls.filter(([q]) =>
          q.includes("mutation GYVFTRewardCouponCreate"),
        ),
      ).toHaveLength(1);
    });
    it("deducts only after a matching paid Shopify order; reconciliation replay is safe", async () => {
      await seed();
      const get = provider();
      await issueReward(customer, "points", 60);
      const [intent] = await sql`SELECT id,code FROM gyvft_reward_coupons`;
      const base = state.shop.getMockImplementation()!;
      state.shop.mockImplementation(async (q, v) =>
        q.includes("query GYVFTRewardUse")
          ? {
              orders: {
                pageInfo: { hasNextPage: false },
                nodes: [
                  {
                    id: "gid://shopify/Order/999",
                    test: false,
                    cancelledAt: null,
                    displayFinancialStatus: "PAID",
                    customer: { id: customer },
                    discountCodes: [intent.code],
                  },
                ],
              },
            }
          : base(q, v),
      );
      get()!.codeDiscount.asyncUsageCount = 1;
      await reconcileRewardCoupon(intent.id);
      await reconcileRewardCoupon(intent.id);
      expect(await rewardWallet(customer)).toMatchObject({
        available: 40,
        reserved: 0,
        spent: 60,
      });
    });
    it("does not release reserved points merely because a timer elapsed", async () => {
      await seed();
      provider();
      await issueReward(customer, "points", 60);
      await sql`UPDATE gyvft_reward_coupons SET state='uncertain'`;
      const wallet = await rewardWallet(customer);
      expect(wallet.reserved).toBe(60);
    });
    it("refund adjustments preserve a spent-points debt and block further use", async () => {
      const id = await seed();
      provider();
      await issueReward(customer, "points", 100);
      const [coupon] = await sql`SELECT id FROM gyvft_reward_coupons`;
      await sql`UPDATE gyvft_reward_lots SET held=0,spent=100 WHERE order_id=${id}`;
      await sql`UPDATE gyvft_reward_coupons SET state='redeemed' WHERE id=${coupon.id}`;
      await sql`UPDATE gyvft_reward_orders SET classification='review',eligible_paise=0 WHERE id=${id}`;
      expect(await rewardWallet(customer)).toMatchObject({
        available: 0,
        debt: 100,
      });
      await expect(issueReward(customer, "points", 1)).rejects.toThrow(
        "Not enough",
      );
    });
    it("requires verified email rather than claiming a wallet by login email alone", async () => {
      provider();
      await sql`UPDATE gyvft_reward_wallets SET account_id=NULL,verified_at=NULL`;
      await expect(verifiedRewardCustomer(account)).rejects.toThrow("Verify");
      await sendRewardVerification(account);
      const text = state.mail.mock.calls[0][0].text as string;
      const token = text.match(/#verify=([A-Za-z0-9_-]{43})/)![1];
      await expect(confirmRewardVerification(other, token)).rejects.toThrow();
      await confirmRewardVerification(account, token);
      expect(await verifiedRewardCustomer(account)).toBe(customer);
      await expect(confirmRewardVerification(account, token)).rejects.toThrow();
    });
    it("limits self-date edits after an annual benefit and permits withdrawal of consent", async () => {
      await seed();
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const date =
        today.length === 5
          ? today
          : `${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-${String(new Date().getUTCDate()).padStart(2, "0")}`;
      await saveRewardDates(account, date, null, true);
      provider();
      const first = await issueReward(customer, "birthday", 150);
      expect(first.minimumPaise).toBe(150000);
      expect((await rewardWallet(customer)).reserved).toBe(0);
      const again = await issueReward(customer, "birthday", 150);
      expect(again.code).toBe(first.code);
      await expect(
        saveRewardDates(account, "01-01", null, true),
      ).rejects.toThrow("fixed");
      await saveRewardDates(account, date, null, false);
      await expect(issueReward(customer, "birthday", 150)).rejects.toThrow(
        "opt in",
      );
    });
    it("mirrors Shopify changes without automatically approving historical orders", async () => {
      const raw = rawOrder("gid://shopify/Order/42");
      state.shop.mockResolvedValueOnce(capabilities).mockResolvedValue({
        orders: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [raw],
        },
      });
      const result = await syncRewardOrders();
      expect(result.processed).toBe(1);
      expect((await rewardWallet(customer)).available).toBe(0);
      const preview = await previewOpening();
      expect(preview.points).toBe(100);
    });
    it("preserves cursor state on a provider failure and resumes idempotently", async () => {
      const raw = rawOrder("gid://shopify/Order/43");
      state.shop
        .mockResolvedValueOnce(capabilities)
        .mockResolvedValueOnce({
          orders: {
            pageInfo: { hasNextPage: true, endCursor: "page-2" },
            nodes: [raw],
          },
        })
        .mockRejectedValueOnce(Error("network"));
      await expect(syncRewardOrders()).rejects.toThrow("paused");
      const [setting] =
        await sql`SELECT sync_cursor,lease_until FROM gyvft_reward_settings`;
      expect(setting.sync_cursor).toBe("page-2");
      expect(setting.lease_until).toBeNull();
      state.shop.mockResolvedValueOnce(capabilities).mockResolvedValue({
        orders: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [raw],
        },
      });
      await syncRewardOrders();
      const [count] =
        await sql`SELECT count(*)::int AS n FROM gyvft_reward_orders`;
      expect(count.n).toBe(1);
    });
    it("records an exact-version manual retail review without allowing policy exclusions", async () => {
      const id = await seed(0, true);
      await sql`UPDATE gyvft_reward_orders SET classification='review' WHERE id=${id}`;
      const [order] =
        await sql`SELECT updated_at FROM gyvft_reward_orders WHERE id=${id}`;
      await reviewRewardOrder(
        id,
        new Date(order.updated_at).toISOString(),
        500000,
        "Retail invoice verified in test",
      );
      const preview = await previewOpening();
      expect(preview.points).toBe(100);
      await expect(
        reviewRewardOrder(
          id,
          "2000-01-01T00:00:00.000Z",
          500000,
          "Stale review fixture",
        ),
      ).rejects.toThrow("changed");
    });
    it("releases an unused expired coupon only after provider and order checks, exactly once", async () => {
      await seed();
      const get = provider();
      await issueReward(customer, "points", 60);
      const [coupon] = await sql`SELECT id FROM gyvft_reward_coupons`;
      get()!.codeDiscount.status = "EXPIRED";
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(Date.now() + 4 * 86400000));
      try {
        await reconcileRewardCoupon(coupon.id);
        await reconcileRewardCoupon(coupon.id);
        expect(await rewardWallet(customer)).toMatchObject({
          available: 100,
          reserved: 0,
          spent: 0,
        });
      } finally {
        vi.useRealTimers();
      }
    });
    it("requires complete-history permissions before claiming a historical scan is complete", async () => {
      state.shop.mockResolvedValue({
        shop: { currencyCode: "INR" },
        currentAppInstallation: { accessScopes: [{ handle: "read_orders" }] },
      });
      await expect(syncRewardOrders()).rejects.toThrow(
        "complete order history",
      );
      const [count] =
        await sql`SELECT count(*)::int AS n FROM gyvft_reward_orders`;
      expect(count.n).toBe(0);
    });
    it("returns a useful validation error for an impossible own occasion date", async () => {
      const response = await customerPost(
        req({
          op: "dates",
          birthday: "02-30",
          anniversary: null,
          consent: true,
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
          message: "Use a real date in MM-DD format.",
        },
      });
    });
    it("enforces customer, origin, operator and cron boundaries without exposing another wallet", async () => {
      state.account = null;
      expect(
        (
          await customerGet(
            new Request("https://www.gyvft.com/api/customer/rewards"),
          )
        ).status,
      ).toBe(401);
      state.account = account;
      expect(
        (await customerPost(req({ op: "verify-email" }, "https://evil.test")))
          .status,
      ).toBe(403);
      expect((await operatorPost(req({ op: "status" }))).status).toBe(401);
      expect(
        (await cron(new Request("https://www.gyvft.com/api/cron/rewards")))
          .status,
      ).toBe(401);
      state.account = other;
      const result = await (
        await customerGet(
          new Request("https://www.gyvft.com/api/customer/rewards"),
        )
      ).json();
      expect(result.wallet).toBeNull();
      expect(result.verified).toBe(false);
    });
  },
);
