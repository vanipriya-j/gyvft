import "server-only";
import { createHash } from "crypto";
import { shopifyRequest, ShopifyError } from "@/lib/customer/shopify";

export const COUPON_FIELDS = `fragment GYVFTCouponFields on DiscountCodeBasic {
  title tags startsAt endsAt status asyncUsageCount usageLimit appliesOncePerCustomer
  minimumRequirement { __typename }
  codes(first:1) { nodes { code } }
  context { __typename ... on DiscountCustomers { customers { id } } }
  customerGets {
    appliesOnOneTimePurchase appliesOnSubscription
    value { __typename ... on DiscountPercentage { percentage } }
    items { __typename ... on AllDiscountItems { allItems } }
  }
}`;
export const COUPON_CONNECTION = `query GYVFTCouponConnection {
  shop { primaryDomain { host } }
  currentAppInstallation { accessScopes { handle } }
}`;
export type CouponConnection = {
  shop: { primaryDomain: { host: string } };
  currentAppInstallation: { accessScopes: { handle: string }[] };
};
export function checkCouponConnection(data: CouponConnection) {
  const host = data.shop.primaryDomain.host.toLowerCase();
  if (!["aarla.in", "www.aarla.in"].includes(host))
    throw new ShopifyError(
      "The Shopify connection does not point to Aarla. Check the configured store.",
    );
  return data.currentAppInstallation.accessScopes.some(
    (s) => s.handle === "write_discounts",
  );
}
export const COUPON_LATEST =
  `query GYVFTLatestCoupon($query:String!) {
  shop { primaryDomain { host } }
  currentAppInstallation { accessScopes { handle } }
  discountNodes(first:1,query:$query,sortKey:CREATED_AT,reverse:true) {
    nodes { id discount { __typename ...GYVFTCouponFields } }
  }
}` + COUPON_FIELDS;
export const COUPON_BY_CODE =
  `query GYVFTCouponByCode($code:String!) {
  codeDiscountNodeByCode(code:$code) { id codeDiscount { __typename ...GYVFTCouponFields } }
}` + COUPON_FIELDS;
export const COUPON_CREATE =
  `mutation GYVFTCreateCoupon($input:DiscountCodeBasicInput!) {
  discountCodeBasicCreate(basicCodeDiscount:$input) {
    codeDiscountNode { id codeDiscount { __typename ...GYVFTCouponFields } }
    userErrors { code field message }
  }
}` + COUPON_FIELDS;
export type Coupon = {
  __typename: string;
  title: string;
  tags: string[];
  startsAt: string;
  endsAt: string | null;
  status: string;
  asyncUsageCount: number;
  usageLimit: number | null;
  appliesOncePerCustomer: boolean;
  minimumRequirement: unknown;
  codes: { nodes: { code: string }[] };
  context: { __typename: string; customers?: { id: string }[] };
  customerGets: {
    appliesOnOneTimePurchase: boolean;
    appliesOnSubscription: boolean;
    value: { __typename: string; percentage?: number };
    items: { __typename: string; allItems?: boolean };
  };
};
type Node = { id: string; codeDiscount: Coupon };
type Identity = ReturnType<typeof couponIdentity>;
const day = 86400000;

export function couponIdentity(accountId: string, customerId: string) {
  if (
    !/^[0-9a-f-]{36}$/i.test(accountId) ||
    !/^gid:\/\/shopify\/Customer\/\d+$/.test(customerId)
  )
    throw new ShopifyError("Customer connection needs review.");
  const shop = process.env.SHOPIFY_SHOP_DOMAIN || "aarla-merch.myshopify.com";
  const key = createHash("sha256")
    .update(`${shop.toLowerCase()}\0${accountId.toLowerCase()}\0${customerId}`)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
  return {
    customerId,
    prefix: `GYVFT5-${key}`,
    tag: `gyvft-coupon-${key.toLowerCase()}`,
  };
}
function codeNumber(code: string, i: Identity) {
  const suffix = code.slice(i.prefix.length + 1),
    n = parseInt(suffix, 36);
  if (
    !code.startsWith(i.prefix + "-") ||
    !/^[A-Z0-9]{1,8}$/.test(suffix) ||
    !Number.isSafeInteger(n) ||
    n < 1 ||
    n >= 2147483647
  )
    throw new ShopifyError("Saving reference needs review.");
  return n;
}
function checked(node: Node, i: Identity) {
  const c = node.codeDiscount,
    code = c.codes?.nodes?.[0]?.code?.toUpperCase();
  if (
    c.__typename !== "DiscountCodeBasic" ||
    !Array.isArray(c.tags) ||
    !c.tags.includes(i.tag) ||
    !code
  )
    throw new ShopifyError("Saving rules need review.");
  codeNumber(code, i);
  const start = Date.parse(c.startsAt),
    end = Date.parse(c.endsAt || "");
  if (
    c.context?.__typename !== "DiscountCustomers" ||
    c.context.customers?.length !== 1 ||
    c.context.customers[0].id !== i.customerId ||
    c.customerGets?.value?.__typename !== "DiscountPercentage" ||
    c.customerGets.value.percentage !== 0.05 ||
    c.customerGets.items?.__typename !== "AllDiscountItems" ||
    c.customerGets.items.allItems !== true ||
    c.customerGets.appliesOnOneTimePurchase !== true ||
    c.customerGets.appliesOnSubscription !== false ||
    c.usageLimit !== 1 ||
    c.appliesOncePerCustomer !== true ||
    c.minimumRequirement !== null ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end - start !== day ||
    !Number.isInteger(c.asyncUsageCount) ||
    c.asyncUsageCount < 0
  )
    throw new ShopifyError("Saving rules need review.");
  return {
    code,
    expiresAt: c.endsAt!,
    pending: c.status === "SCHEDULED" || start > Date.now(),
    live:
      c.status === "ACTIVE" &&
      c.asyncUsageCount === 0 &&
      start <= Date.now() &&
      end > Date.now(),
  };
}
async function byCode(code: string) {
  return (
    await shopifyRequest<{ codeDiscountNodeByCode: Node | null }>(
      COUPON_BY_CODE,
      { code },
    )
  ).codeDiscountNodeByCode;
}

/** Shopify holds the record. Canonical codes make concurrent/retried creation idempotent. */
export async function liveAarlaCoupon(accountId: string, customerId: string) {
  const identity = couponIdentity(accountId, customerId);
  const data = await shopifyRequest<
    CouponConnection & {
      discountNodes: { nodes: { id: string; discount: Coupon }[] };
    }
  >(COUPON_LATEST, {
    query: `tag:${JSON.stringify(identity.tag)} method:code`,
  });
  const mayCreate = checkCouponConnection(data);
  const latest = data.discountNodes.nodes[0];
  let sequence = 1;
  if (latest) {
    const c = checked(
      { id: latest.id, codeDiscount: latest.discount },
      identity,
    );
    if (c.live) return c;
    if (c.pending)
      throw new ShopifyError(
        "Your saving is being activated. Try again shortly.",
      );
    sequence = codeNumber(c.code, identity) + 1;
  }
  // Direct lookup covers search-index lag and a previous POST whose response was lost.
  for (let step = 0; step < 3; step++, sequence++) {
    const code = identity.prefix + "-" + sequence.toString(36).toUpperCase();
    const existing = await byCode(code);
    if (existing) {
      const c = checked(existing, identity);
      if (c.live) return c;
      if (c.pending)
        throw new ShopifyError(
          "Your saving is being activated. Try again shortly.",
        );
      continue;
    }
    if (!mayCreate)
      throw new ShopifyError(
        "The Shopify app needs write_discounts permission to create this saving.",
      );
    const now = new Date(),
      ends = new Date(now.getTime() + day);
    try {
      const result = await shopifyRequest<{
        discountCodeBasicCreate: {
          codeDiscountNode: Node | null;
          userErrors: unknown[];
        };
      }>(COUPON_CREATE, {
        input: {
          title: "Your GYVFT 5% saving",
          code,
          tags: ["gyvft", identity.tag],
          startsAt: now.toISOString(),
          endsAt: ends.toISOString(),
          context: { customers: { add: [customerId] } },
          customerGets: {
            value: { percentage: 0.05 },
            items: { all: true },
            appliesOnOneTimePurchase: true,
            appliesOnSubscription: false,
          },
          usageLimit: 1,
          appliesOncePerCustomer: true,
        },
      });
      const node = result.discountCodeBasicCreate.codeDiscountNode;
      if (node) {
        const c = checked(node, identity);
        if (c.live) return c;
      }
    } catch {
      // Never choose a different code after an uncertain create response.
    }
    const recovered = await byCode(code);
    if (recovered) {
      const c = checked(recovered, identity);
      if (c.live) return c;
    }
    throw new ShopifyError(
      "Saving creation was not confirmed. Retry the same shopping action.",
    );
  }
  throw new ShopifyError(
    "Saving history is updating. Please try again shortly.",
  );
}
