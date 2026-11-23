import "server-only";
import type { CustomerAccount } from "./session";
import { isDemoAccount } from "./demo-accounts";
import {
  shopifyConfigured,
  syncShopifyCustomer,
  shopifyRequest,
  ShopifyError,
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
  let customer: string | null;
  try {
    customer = await syncShopifyCustomer(account.id);
  } catch (error) {
    if (error instanceof ShopifyError)
      throw new ShopifyError(error.message, {
        ...error.details,
        phase: error.details.phase || "customer",
      });
    throw error;
  }
  if (!customer)
    throw new AppError(
      "CONFLICT",
      "Your Aarla connection is being prepared. Please try again in a moment.",
    );
  let coupon: Awaited<ReturnType<typeof liveAarlaCoupon>>;
  try {
    coupon = await liveAarlaCoupon(account.id, customer);
  } catch (error) {
    if (error instanceof ShopifyError)
      throw new ShopifyError(error.message, {
        ...error.details,
        phase: error.details.phase || "coupon",
      });
    throw error;
  }
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
  // Probe the same protected email field used by matching, without exposing it.
  const connection = await shopifyRequest<CouponConnection>(
    COUPON_CONNECTION,
    {},
  );
  const allowed = checkCouponConnection(connection);
  const mayCreateCustomers =
    connection.currentAppInstallation.accessScopes.some(
      (s) => s.handle === "write_customers",
    );
  return {
    ready: allowed && mayCreateCustomers,
    message: allowed
      ? mayCreateCustomers
        ? "Connected to Aarla. Discount creation is permitted. This check created no coupon."
        : "Customer lookup succeeded, but the app also needs write_customers to link new GYVFT customers. Approve that permission on the installed app."
      : "The Shopify app needs Discounts read/write (write_discounts). Update its permissions, then check again.",
  };
}
