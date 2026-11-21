import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/customer/shopify", () => ({
  shopifyRequest: mock.request,
  ShopifyError: class extends Error {},
}));
import {
  liveAarlaCoupon,
  couponIdentity,
  COUPON_LATEST,
  COUPON_BY_CODE,
  COUPON_CREATE,
  COUPON_CONNECTION,
  type Coupon,
} from "@/services/shopify/aarla-coupon";
import {
  aarlaDestination,
  aarlaDiscountUrl,
  aarlaShopHref,
} from "@/lib/customer/aarla-shop-model";
const account = "11111111-1111-4111-8111-111111111111",
  customer = "gid://shopify/Customer/123";
let host = "aarla.in",
  canWrite = true;
let rows: Map<string, { id: string; codeDiscount: Coupon }>,
  created: number,
  lag: boolean,
  lost: boolean;
const clone = <T>(x: T): T => structuredClone(x);
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-21T10:00:00Z"));
  host = "aarla.in";
  canWrite = true;
  rows = new Map();
  created = 0;
  lag = false;
  lost = false;
  mock.request.mockReset();
  mock.request.mockImplementation(
    async (query: string, v: Record<string, unknown>) => {
      if (query === COUPON_CONNECTION)
        return {
          shop: { primaryDomain: { host } },
          currentAppInstallation: {
            accessScopes: canWrite ? [{ handle: "write_discounts" }] : [],
          },
        };
      if (query === COUPON_LATEST) {
        const tag = JSON.parse(String(v.query).match(/tag:("[^"]+")/)![1]);
        const all = [...rows.values()].filter((x) =>
          x.codeDiscount.tags.includes(tag),
        );
        return {
          shop: { primaryDomain: { host } },
          currentAppInstallation: {
            accessScopes: canWrite ? [{ handle: "write_discounts" }] : [],
          },
          discountNodes: {
            nodes: lag
              ? []
              : all
                  .slice(-1)
                  .map((x) => ({ id: x.id, discount: clone(x.codeDiscount) })),
          },
        };
      }
      if (query === COUPON_BY_CODE)
        return {
          codeDiscountNodeByCode: clone(rows.get(String(v.code)) || null),
        };
      if (query === COUPON_CREATE) {
        const p = v.input as {
          title: string;
          code: string;
          tags: string[];
          startsAt: string;
          endsAt: string;
          usageLimit: number;
          appliesOncePerCustomer: boolean;
          context: { customers: { add: string[] } };
          customerGets: {
            appliesOnOneTimePurchase: boolean;
            appliesOnSubscription: boolean;
            value: { percentage: number };
            items: { all: boolean };
          };
        };
        if (rows.has(p.code))
          return {
            discountCodeBasicCreate: {
              codeDiscountNode: null,
              userErrors: [{ code: "TAKEN" }],
            },
          };
        created++;
        const r = {
          id: "gid://shopify/DiscountCodeNode/" + created,
          codeDiscount: {
            __typename: "DiscountCodeBasic",
            title: p.title,
            tags: p.tags,
            startsAt: p.startsAt,
            endsAt: p.endsAt,
            status: "ACTIVE",
            asyncUsageCount: 0,
            usageLimit: p.usageLimit,
            appliesOncePerCustomer: p.appliesOncePerCustomer,
            minimumRequirement: null,
            codes: { nodes: [{ code: p.code }] },
            context: {
              __typename: "DiscountCustomers",
              customers: p.context.customers.add.map((id: string) => ({ id })),
            },
            customerGets: {
              appliesOnOneTimePurchase: p.customerGets.appliesOnOneTimePurchase,
              appliesOnSubscription: p.customerGets.appliesOnSubscription,
              value: {
                __typename: "DiscountPercentage",
                percentage: p.customerGets.value.percentage,
              },
              items: {
                __typename: "AllDiscountItems",
                allItems: p.customerGets.items.all,
              },
            },
          },
        };
        rows.set(p.code, r);
        if (lost) throw Error("Reply lost after save");
        return {
          discountCodeBasicCreate: {
            codeDiscountNode: clone(r),
            userErrors: [],
          },
        };
      }
      throw Error("Unexpected operation");
    },
  );
});
afterEach(() => vi.useRealTimers());
describe("user-specific Aarla saving", () => {
  it("creates 5% for exactly one customer and exactly 24 hours with one redemption", async () => {
    const c = await liveAarlaCoupon(account, customer);
    const d = rows.get(c.code)!.codeDiscount;
    expect(created).toBe(1);
    expect(c.live).toBe(true);
    expect(Date.parse(d.endsAt!) - Date.parse(d.startsAt)).toBe(86400000);
    expect(d.context.customers).toEqual([{ id: customer }]);
    expect(d.usageLimit).toBe(1);
    expect(d.appliesOncePerCustomer).toBe(true);
    expect(d.customerGets.value.percentage).toBe(0.05);
  });
  it("does not create a discount on the wrong store or without write permission", async () => {
    host = "other-store.test";
    await expect(liveAarlaCoupon(account, customer)).rejects.toThrow(
      "does not point to Aarla",
    );
    expect(created).toBe(0);
    host = "aarla.in";
    canWrite = false;
    await expect(liveAarlaCoupon(account, customer)).rejects.toThrow(
      "write_discounts",
    );
    expect(created).toBe(0);
  });
  it("reuses a live coupon across repeated shopping clicks", async () => {
    const a = await liveAarlaCoupon(account, customer);
    const b = await liveAarlaCoupon(account, customer);
    expect(b.code).toBe(a.code);
    expect(created).toBe(1);
  });
  it("waits for a scheduled coupon rather than creating another live generation", async () => {
    const a = await liveAarlaCoupon(account, customer),
      c = rows.get(a.code)!.codeDiscount;
    c.status = "SCHEDULED";
    c.startsAt = new Date(Date.now() + 10000).toISOString();
    c.endsAt = new Date(Date.now() + 10000 + 86400000).toISOString();
    await expect(liveAarlaCoupon(account, customer)).rejects.toThrow(
      "being activated",
    );
    expect(created).toBe(1);
  });
  it("creates a new code after expiry without extending the former code", async () => {
    const a = await liveAarlaCoupon(account, customer);
    const end = a.expiresAt;
    vi.advanceTimersByTime(86400001);
    const b = await liveAarlaCoupon(account, customer);
    expect(b.code).not.toBe(a.code);
    expect(created).toBe(2);
    expect(rows.get(a.code)!.codeDiscount.endsAt).toBe(end);
  });
  it("creates a replacement after redemption, then reuses that replacement", async () => {
    const a = await liveAarlaCoupon(account, customer);
    rows.get(a.code)!.codeDiscount.asyncUsageCount = 1;
    const b = await liveAarlaCoupon(account, customer);
    expect(b.code).not.toBe(a.code);
    expect((await liveAarlaCoupon(account, customer)).code).toBe(b.code);
    expect(created).toBe(2);
  });
  it("recovers a lost creation reply by the same code without creating another coupon", async () => {
    lost = true;
    const a = await liveAarlaCoupon(account, customer);
    expect(a.live).toBe(true);
    expect(created).toBe(1);
  });
  it("uses native code uniqueness under concurrent clicks even while search results lag", async () => {
    lag = true;
    const [a, b] = await Promise.all([
      liveAarlaCoupon(account, customer),
      liveAarlaCoupon(account, customer),
    ]);
    expect(a.code).toBe(b.code);
    expect(created).toBe(1);
    expect(rows.size).toBe(1);
  });
  it("does not share a code between customer identities", async () => {
    const a = await liveAarlaCoupon(account, customer);
    const b = await liveAarlaCoupon(
      "22222222-2222-4222-8222-222222222222",
      "gid://shopify/Customer/456",
    );
    expect(a.code).not.toBe(b.code);
    expect(couponIdentity(account, customer).tag).not.toBe(
      couponIdentity(
        "22222222-2222-4222-8222-222222222222",
        "gid://shopify/Customer/456",
      ).tag,
    );
  });
  it.each(["customer", "percentage", "expiry", "limit", "items"])(
    "refuses a coupon whose %s policy was changed",
    async (kind) => {
      const a = await liveAarlaCoupon(account, customer);
      const c = rows.get(a.code)!.codeDiscount;
      if (kind === "customer")
        c.context.customers!.push({ id: "gid://shopify/Customer/999" });
      if (kind === "percentage") c.customerGets.value.percentage = 0.2;
      if (kind === "expiry") c.endsAt = "2028-01-01T00:00:00Z";
      if (kind === "limit") c.usageLimit = 20;
      if (kind === "items") c.customerGets.items.allItems = false;
      await expect(liveAarlaCoupon(account, customer)).rejects.toThrow(
        "rules need review",
      );
      expect(created).toBe(1);
    },
  );
});
describe("safe Aarla redirect", () => {
  it("applies the code through Shopify’s discount URL while preserving the chosen product", () => {
    const code = couponIdentity(account, customer).prefix + "-1";
    const url = new URL(
      aarlaDiscountUrl(
        code,
        "https://aarla.in/products/sabha-ready?variant=123&return_to=https://evil.test",
      ),
    );
    expect(url.origin).toBe("https://aarla.in");
    expect(url.pathname).toBe("/discount/" + code);
    const dest = new URL(url.searchParams.get("redirect")!, "https://aarla.in");
    expect(dest.pathname).toBe("/products/sabha-ready");
    expect(dest.searchParams.get("variant")).toBe("123");
    expect(dest.searchParams.has("return_to")).toBe(false);
    expect(dest.searchParams.get("utm_source")).toBe("gyvft");
  });
  it.each([
    "https://evil.test/products/x",
    "//evil.test",
    "javascript:alert(1)",
    "https://aarla.in@evil.test/products/x",
    "/products/%2f%2fevil",
    "/products/%252f%252fevil",
    "https://aarla.in:444/products/x",
    "/account/login",
  ])("rejects %s", (value) => {
    expect(() => aarlaDestination(value)).toThrow();
  });
  it("leaves ordinary browsing unchanged when the server connection is unavailable", () => {
    expect(aarlaShopHref("https://aarla.in", false)).toBe("https://aarla.in");
    expect(aarlaShopHref("https://aarla.in/collections/books", true)).toMatch(
      /^\/account\/shop\?to=/,
    );
  });
});
