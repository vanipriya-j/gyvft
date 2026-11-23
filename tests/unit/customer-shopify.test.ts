import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("@/lib/database/client", () => ({ getSql: () => mocks.sql }));
vi.mock("next/server", () => ({ after: vi.fn() }));
import {
  syncShopifyCustomer,
  shopifyRequest,
  provinceCode,
  createOrSyncShopifyOrder,
  ShopifyError,
} from "@/lib/customer/shopify";
import { demoAccounts } from "@/lib/customer/demo-accounts";
const owner = "11111111-1111-4111-8111-111111111111";
describe("Shopify customer identity and retry boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "fixture-token");
    mocks.sql.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("never sends fictional demo customers to Shopify", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const a of demoAccounts)
      expect(await syncShopifyCustomer(a.id)).toBeNull();
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reuses the stored customer without external calls", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    mocks.sql.mockResolvedValueOnce([
      {
        id: owner,
        email: "owner@example.test",
        shopify_customer_id: "gid://shopify/Customer/1",
      },
    ]);
    expect(await syncShopifyCustomer(owner)).toBe("gid://shopify/Customer/1");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("matches email exactly without overwriting an existing customer", async () => {
    mocks.sql
      .mockResolvedValueOnce([{ id: owner, email: "owner@example.test" }])
      .mockResolvedValueOnce([{ id: owner }])
      .mockResolvedValue([]);
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          customers: {
            nodes: [
              {
                id: "gid://shopify/Customer/2",
                defaultEmailAddress: { emailAddress: "OWNER@example.test" },
              },
              {
                id: "wrong",
                defaultEmailAddress: { emailAddress: "other@example.test" },
              },
            ],
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await syncShopifyCustomer(owner)).toBe("gid://shopify/Customer/2");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body).query).not.toContain(
      "customerCreate",
    );
  });
  it("does not race a customer sync already claimed by another request", async () => {
    mocks.sql
      .mockResolvedValueOnce([{ id: owner, email: "owner@example.test" }])
      .mockResolvedValueOnce([]);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await syncShopifyCustomer(owner)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("creates a Shopify customer when no exact match exists and stores the returned customer ID", async () => {
    mocks.sql
      .mockResolvedValueOnce([{ id: owner, email: "new@example.test" }])
      .mockResolvedValueOnce([{ id: owner }])
      .mockResolvedValue([]);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ data: { customers: { nodes: [] } } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            customerCreate: {
              customer: { id: "gid://shopify/Customer/456" },
              userErrors: [],
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await syncShopifyCustomer(owner)).toBe("gid://shopify/Customer/456");
    expect(fetch).toHaveBeenCalledTimes(2);
    const creation = JSON.parse(fetch.mock.calls[1][1].body);
    expect(creation.query).toContain("customerCreate");
    expect(creation.variables).toEqual({
      input: { email: "new@example.test", tags: ["GYVFT"] },
    });
    expect(mocks.sql.mock.calls[2].slice(1)).toEqual([
      "gid://shopify/Customer/456",
      owner,
    ]);
  });
  it("blocks duplicate order creation after an ambiguous response", async () => {
    mocks.sql.mockResolvedValueOnce([
      {
        id: owner,
        kind: "project",
        customer_type: "b2c",
        total_paise: 100000,
        paid_paise: 50000,
        shopify_customer_id: "gid://shopify/Customer/1",
        shopify_order_state: "uncertain",
      },
    ]);
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ data: { orders: { nodes: [] } } }));
    vi.stubGlobal("fetch", fetch);
    await expect(createOrSyncShopifyOrder(owner, true)).rejects.toThrow(
      "previous creation",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body).query).not.toContain(
      "orderCreate(",
    );
  });
  it("requires a valid server store domain before sending credentials", async () => {
    vi.stubEnv("SHOPIFY_SHOP_DOMAIN", "attacker.example");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(shopifyRequest("query{}", {})).rejects.toThrow(
      "myshopify.com",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("classifies protected-data/permission errors without exposing the provider response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        Response.json({
          errors: [
            {
              message: "private provider body",
              extensions: { code: "ACCESS_DENIED" },
            },
          ],
        }),
      ),
    );
    const failure = await shopifyRequest(
      "query GYVFTCustomer { fixture }",
      {},
    ).catch((e) => e);
    if (!(failure instanceof ShopifyError))
      throw Error("Expected a classified Shopify failure");
    expect(failure.details).toMatchObject({
      code: "SHOPIFY_ACCESS_DENIED",
      operation: "GYVFTCustomer",
      providerCode: "ACCESS_DENIED",
    });
    expect(failure.message).not.toContain("private provider body");
  });
  it("records only a fully verified outstanding balance without the Plus-only amount field", async () => {
    mocks.sql
      .mockResolvedValueOnce([
        {
          id: owner,
          kind: "project",
          customer_type: "b2c",
          total_paise: 100000,
          paid_paise: 100000,
          shopify_customer_id: "gid://shopify/Customer/1",
          shopify_order_id: "gid://shopify/Order/1",
          shopify_payment_version: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: owner }])
      .mockResolvedValue([]);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            orders: {
              nodes: [
                {
                  id: "gid://shopify/Order/1",
                  name: "#1",
                  customer: { id: "gid://shopify/Customer/1" },
                  totalPriceSet: {
                    shopMoney: { amount: "1000.00", currencyCode: "INR" },
                  },
                  totalReceivedSet: {
                    shopMoney: { amount: "500.00", currencyCode: "INR" },
                  },
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            orderCreateManualPayment: {
              order: { id: "gid://shopify/Order/1" },
              userErrors: [],
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await createOrSyncShopifyOrder(owner, true)).toBe("#1");
    const mutation = JSON.parse(fetch.mock.calls[1][1].body);
    expect(mutation.query).not.toContain("amount");
    expect(mutation.variables).toEqual({ id: "gid://shopify/Order/1" });
  });
  it("keeps an additional partial receipt in GYVFT without marking the whole Shopify order paid", async () => {
    mocks.sql
      .mockResolvedValueOnce([
        {
          id: owner,
          kind: "project",
          customer_type: "b2c",
          total_paise: 100000,
          paid_paise: 75000,
          shopify_customer_id: "gid://shopify/Customer/1",
        },
      ])
      .mockResolvedValue([]);
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          orders: {
            nodes: [
              {
                id: "gid://shopify/Order/1",
                name: "#1",
                customer: { id: "gid://shopify/Customer/1" },
                totalPriceSet: {
                  shopMoney: { amount: "1000.00", currencyCode: "INR" },
                },
                totalReceivedSet: {
                  shopMoney: { amount: "500.00", currencyCode: "INR" },
                },
              },
            ],
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(createOrSyncShopifyOrder(owner, true)).rejects.toThrow(
      "Additional partial receipts",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("maps Indian state names and codes without inventing unknown states", () => {
    expect(provinceCode("Tamil Nadu")).toBe("TN");
    expect(provinceCode("KA")).toBe("KA");
    expect(provinceCode("Unknown")).toBeNull();
  });
});
