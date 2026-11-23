import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  sync: vi.fn(),
  coupon: vi.fn(),
  request: vi.fn(),
  check: vi.fn(),
}));
vi.mock("@/lib/customer/shopify", async () => ({
  ShopifyError: (await import("@/services/shopify/admin-auth")).ShopifyError,
  shopifyConfigured: () => true,
  syncShopifyCustomer: mock.sync,
  shopifyRequest: mock.request,
}));
vi.mock("@/services/shopify/aarla-coupon", () => ({
  COUPON_CONNECTION: "fixture",
  checkCouponConnection: mock.check,
  liveAarlaCoupon: mock.coupon,
}));
import {
  shopAarlaForAccount,
  aarlaCouponConnectionStatus,
} from "@/lib/customer/aarla-shop";
import { ShopifyError } from "@/services/shopify/admin-auth";
const account = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.test",
};
beforeEach(() => {
  mock.sync.mockReset().mockResolvedValue("gid://shopify/Customer/123");
  mock.coupon.mockReset();
  mock.request.mockReset();
  mock.check.mockReset().mockReturnValue(true);
});
it("does not mark a discounts-only app ready to create new customer links", async () => {
  mock.request.mockResolvedValueOnce({
    currentAppInstallation: { accessScopes: [{ handle: "write_discounts" }] },
  });
  const result = await aarlaCouponConnectionStatus();
  expect(result.ready).toBe(false);
  expect(result.message).toContain("write_customers");
  expect(mock.sync).not.toHaveBeenCalled();
  expect(mock.coupon).not.toHaveBeenCalled();
});
it("keeps protected customer-data access failures visible in the read-only connection check", async () => {
  mock.request.mockRejectedValueOnce(
    new ShopifyError("Customer data access denied", {
      code: "SHOPIFY_ACCESS_DENIED",
      operation: "GYVFTCouponConnection",
    }),
  );
  await expect(aarlaCouponConnectionStatus()).rejects.toMatchObject({
    details: { code: "SHOPIFY_ACCESS_DENIED" },
  });
});
it("distinguishes a customer-link failure from coupon creation", async () => {
  mock.sync.mockRejectedValueOnce(
    new ShopifyError("Permission denied", {
      code: "SHOPIFY_ACCESS_DENIED",
      operation: "GYVFTCustomer",
    }),
  );
  const error = await shopAarlaForAccount(account, "/").catch((e) => e);
  expect(error.details).toMatchObject({
    phase: "customer",
    code: "SHOPIFY_ACCESS_DENIED",
    operation: "GYVFTCustomer",
  });
  expect(mock.coupon).not.toHaveBeenCalled();
});
it("preserves authentication as the original failure stage", async () => {
  mock.sync.mockRejectedValueOnce(
    new ShopifyError("Authentication failed", {
      code: "SHOPIFY_AUTH_FAILED",
      phase: "authentication",
      upstreamStatus: 401,
    }),
  );
  const error = await shopAarlaForAccount(account, "/").catch((e) => e);
  expect(error.details.phase).toBe("authentication");
});
it("attributes a failed coupon operation after a successful customer link", async () => {
  mock.coupon.mockRejectedValueOnce(
    new ShopifyError("Coupon denied", {
      code: "SHOPIFY_COUPON_REJECTED",
      operation: "GYVFTCreateCoupon",
    }),
  );
  const error = await shopAarlaForAccount(account, "/").catch((e) => e);
  expect(error.details).toMatchObject({
    phase: "coupon",
    operation: "GYVFTCreateCoupon",
  });
});
