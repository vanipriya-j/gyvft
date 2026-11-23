import "server-only";
import { createHash } from "node:crypto";

export type ShopifyFailure = {
  code?:
    | "SHOPIFY_UNCONFIRMED"
    | "SHOPIFY_AUTH_FAILED"
    | "SHOPIFY_NETWORK_FAILED"
    | "SHOPIFY_HTTP_FAILED"
    | "SHOPIFY_ACCESS_DENIED"
    | "SHOPIFY_GRAPHQL_FAILED"
    | "SHOPIFY_CUSTOMER_REJECTED"
    | "SHOPIFY_COUPON_REJECTED";
  phase?: "authentication" | "customer" | "coupon";
  operation?: string;
  upstreamStatus?: number;
  providerCode?: string;
};
export class ShopifyError extends Error {
  readonly details: ShopifyFailure;
  constructor(message: string, details: ShopifyFailure = {}) {
    super(message);
    this.details = { code: "SHOPIFY_UNCONFIRMED", ...details };
  }
}

/** Accept only a provider enum, never its raw message or input field values. */
export function shopifyProviderCode(value: unknown) {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{0,39}$/.test(value)
    ? value
    : undefined;
}

type CachedToken = { key: string; token: string; refreshAt: number };
let cached: CachedToken | undefined;
let pending: { key: string; request: Promise<CachedToken> } | undefined;

export function shopifyStoreDomain() {
  // Verified Aarla store. An environment typo must not block or redirect auth.
  return "aarla-merch.myshopify.com";
}

export function shopifyServerConfigured() {
  const id = process.env.SHOPIFY_CLIENT_ID?.trim();
  const secret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  return id || secret
    ? Boolean(id && secret)
    : Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim());
}

async function exchange(
  domain: string,
  id: string,
  secret: string,
  key: string,
): Promise<CachedToken> {
  try {
    const started = Date.now();
    const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: id,
        client_secret: secret,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (body.error === "shop_not_permitted")
        throw new ShopifyError(
          "The Shopify app and Aarla store must belong to the same Shopify organization for client credentials. Check the app installation and store domain.",
          {
            code: "SHOPIFY_AUTH_FAILED",
            phase: "authentication",
            upstreamStatus: response.status,
          },
        );
      throw new ShopifyError(
        "Shopify authentication was not confirmed. Check the client ID, client secret and approved app installation on Aarla.",
        {
          code: "SHOPIFY_AUTH_FAILED",
          phase: "authentication",
          upstreamStatus: response.status,
        },
      );
    }
    const body = await response.json();
    if (
      typeof body.access_token !== "string" ||
      !body.access_token.trim() ||
      body.access_token.length > 4096 ||
      !Number.isSafeInteger(body.expires_in) ||
      body.expires_in < 1 ||
      body.expires_in > 31536000
    )
      throw new ShopifyError(
        "Shopify returned an invalid authentication response.",
        { code: "SHOPIFY_AUTH_FAILED", phase: "authentication" },
      );
    const lifetime = body.expires_in * 1000;
    const token = {
      key,
      token: body.access_token,
      refreshAt: started + lifetime - Math.min(60000, lifetime / 10),
    };
    cached = token;
    return token;
  } catch (error) {
    if (error instanceof ShopifyError) throw error;
    throw new ShopifyError(
      "Shopify authentication could not be completed. Check the connection and try again.",
      { code: "SHOPIFY_AUTH_FAILED", phase: "authentication" },
    );
  }
}

/** Server-memory cache only; each instance can authenticate independently. */
export async function shopifyAdminToken() {
  // Both authentication modes use the verified Aarla host.
  const domain = shopifyStoreDomain();
  const id = process.env.SHOPIFY_CLIENT_ID?.trim();
  const secret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  if (!id && !secret) {
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
    if (!token)
      throw new ShopifyError(
        "Configure SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in Vercel before connecting.",
      );
    return token;
  }
  if (!id || !secret)
    throw new ShopifyError(
      "Set both SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in Vercel.",
    );
  const key = createHash("sha256")
    .update(JSON.stringify([domain, id, secret]))
    .digest("hex");
  if (cached?.key === key && cached.refreshAt > Date.now()) return cached.token;
  if (pending?.key === key) return (await pending.request).token;
  const request = exchange(domain, id, secret, key);
  pending = { key, request };
  try {
    return (await request).token;
  } finally {
    if (pending?.request === request) pending = undefined;
  }
}

export function invalidateShopifyAdminToken(token: string) {
  if (cached?.token === token) cached = undefined;
}
