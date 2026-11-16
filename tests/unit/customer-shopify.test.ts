import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("@/lib/database/client", () => ({ getSql: () => mocks.sql }));
vi.mock("next/server", () => ({ after: vi.fn() }));
import {
  syncShopifyCustomer,
  shopifyRequest,
  provinceCode,
  createOrSyncShopifyOrder,
} from "@/lib/customer/shopify";
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
              { id: "gid://shopify/Customer/2", email: "OWNER@example.test" },
              { id: "wrong", email: "other@example.test" },
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
  it("maps Indian state names and codes without inventing unknown states", () => {
    expect(provinceCode("Tamil Nadu")).toBe("TN");
    expect(provinceCode("KA")).toBe("KA");
    expect(provinceCode("Unknown")).toBeNull();
  });
});
