import { expect, it } from "vitest";
import { sanitizeCustomerEventMetadata } from "@/lib/customer/observability";
it("retains the shopping route/stage reference metadata while discarding personal/provider fields", () => {
  expect(
    sanitizeCustomerEventMetadata({
      route: "/api/customer/aarla-shop",
      operation: "aarla-coupon",
      code: "SHOPIFY_ACCESS_DENIED",
      status: 503,
      email: "private@example.test",
      providerBody: "private",
      secret: "private",
    }),
  ).toEqual({
    route: "/api/customer/aarla-shop",
    operation: "aarla-coupon",
    code: "SHOPIFY_ACCESS_DENIED",
    status: 503,
  });
});
