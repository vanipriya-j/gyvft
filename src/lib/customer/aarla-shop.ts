import "server-only";
import type { CustomerAccount } from "./session";
import { isDemoAccount } from "./demo-accounts";
import {
  shopifyConfigured,
  syncShopifyCustomer,
  shopifyRequest,
} from "./shopify";
import {
  COUPON_CONNECTION,
  checkCouponConnection,
  type CouponConnection,
  liveAarlaCoupon,
} from "@/services/shopify/aarla-coupon";
import { aarlaDiscountUrl } from "./aarla-shop-model";
import { AppError } from "@/lib/errors/app-error";

export function aarlaSavingAvailable(accountId: string) {
  return !isDemoAccount(accountId) && shopifyConfigured();
}

export async function shopAarlaForAccount(
  account: CustomerAccount,
  destination: string,
) {
  if (isDemoAccount(account.id))
    throw new AppError(
      "FORBIDDEN",
      "Sample accounts do not create real store discounts.",
    );
  if (!shopifyConfigured())
    throw new AppError(
      "INTEGRATION_ERROR",
      "Your Aarla saving is not available yet. Please contact the team.",
      { status: 503 },
    );
  const customer = await syncShopifyCustomer(account.id);
  if (!customer)
    throw new AppError(
      "CONFLICT",
      "Your Aarla connection is being prepared. Please try again in a moment.",
    );
  const coupon = await liveAarlaCoupon(account.id, customer);
  return {
    redirectUrl: aarlaDiscountUrl(coupon.code, destination),
    expiresAt: coupon.expiresAt,
    percentage: 5,
  };
}

export async function aarlaCouponConnectionStatus() {
  if (!shopifyConfigured())
    return {
      ready: false,
      message:
        "Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in Vercel, then redeploy. An existing Admin API access token is also supported.",
    };
  const allowed = checkCouponConnection(
    await shopifyRequest<CouponConnection>(COUPON_CONNECTION, {}),
  );
  return {
    ready: allowed,
    message: allowed
      ? "Connected to Aarla. Discount creation is permitted. This check created no coupon."
      : "The Shopify app needs Discounts read/write (write_discounts). Update its permissions, then check again.",
  };
}
