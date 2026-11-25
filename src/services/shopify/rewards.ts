import "server-only";
import { shopifyRequest } from "@/lib/customer/shopify";
import { paise, type OrderFact } from "@/lib/rewards/policy";
export const REWARD_ORDER_FIELDS = `fragment GYVFTRewardOrder on Order {
 id createdAt updatedAt test cancelledAt sourceName tags taxesIncluded displayFinancialStatus
 purchasingEntity { __typename } customer { id defaultEmailAddress { emailAddress } }
 transactions(first:20) { kind status processedAt }
 totalOutstandingSet { shopMoney { amount currencyCode } }
 lineItems(first:20) { pageInfo { hasNextPage } nodes {
  id isGiftCard quantity currentQuantity product { id inCollection(id:$collectionId) } variant { id }
  originalTotalSet { shopMoney { amount currencyCode } }
  discountAllocations { allocatedAmountSet { shopMoney { amount currencyCode } } }
  taxLines { priceSet { shopMoney { amount currencyCode } } }
 } }
 discountApplications(first:30) { pageInfo { hasNextPage } nodes { __typename ... on DiscountCodeApplication { code } } }
}`;
export const REWARD_ORDERS =
  `query GYVFTRewardOrders($query:String!,$after:String,$collectionId:ID!) {
 orders(first:2,after:$after,query:$query,sortKey:UPDATED_AT) { pageInfo { hasNextPage endCursor } nodes { ...GYVFTRewardOrder } }
}` + REWARD_ORDER_FIELDS;
export const REWARD_CONNECTION = `query GYVFTRewardConnection { shop { currencyCode } currentAppInstallation { accessScopes { handle } } }`;
export const REWARD_CUSTOMER = `query GYVFTRewardCustomer($id:ID!) { customer(id:$id) { id defaultEmailAddress { emailAddress } } }`;
export const REWARD_COLLECTION = `query GYVFTRewardCollection($id:ID!) { collection(id:$id) { id title } }`;
export const REWARD_COUPON_FIELDS = `fragment GYVFTRewardCoupon on DiscountCodeBasic {
 title tags startsAt endsAt status asyncUsageCount usageLimit appliesOncePerCustomer
 combinesWith { orderDiscounts productDiscounts shippingDiscounts }
 context { __typename ... on DiscountCustomers { customers { id } } }
 codes(first:1) { nodes { code } }
 minimumRequirement { __typename ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } } }
 customerGets { appliesOnOneTimePurchase appliesOnSubscription
 value { __typename ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem } }
 items { __typename ... on DiscountCollections { collections(first:2) { nodes { id } pageInfo { hasNextPage } } } }
 }
}`;
export const REWARD_COUPON_LOOKUP =
  `query GYVFTRewardCouponLookup($code:String!) {
 codeDiscountNodeByCode(code:$code) { id codeDiscount { __typename ...GYVFTRewardCoupon } }
}` + REWARD_COUPON_FIELDS;
export const REWARD_COUPON_CREATE =
  `mutation GYVFTRewardCouponCreate($input:DiscountCodeBasicInput!) {
 discountCodeBasicCreate(basicCodeDiscount:$input) { codeDiscountNode { id codeDiscount { __typename ...GYVFTRewardCoupon } } userErrors { code field message } }
}` + REWARD_COUPON_FIELDS;
export const REWARD_USED_ORDERS = `query GYVFTRewardUse($query:String!,$after:String) {
 orders(first:50,after:$after,query:$query) { pageInfo { hasNextPage endCursor } nodes { id test cancelledAt displayFinancialStatus customer { id } discountCodes } }
}`;
type Money = { shopMoney: { amount: string; currencyCode: string } };
export type RawRewardOrder = {
  id: string;
  createdAt: string;
  updatedAt: string;
  test: boolean;
  cancelledAt: string | null;
  sourceName: string;
  tags: string[];
  taxesIncluded: boolean;
  displayFinancialStatus: string;
  purchasingEntity: { __typename: string } | null;
  customer: {
    id: string;
    defaultEmailAddress: { emailAddress: string } | null;
  } | null;
  transactions: { kind: string; status: string; processedAt: string | null }[];
  totalOutstandingSet: Money;
  lineItems: {
    pageInfo: { hasNextPage: boolean };
    nodes: {
      id: string;
      isGiftCard: boolean;
      quantity: number;
      currentQuantity: number;
      product: { id: string; inCollection: boolean } | null;
      variant: { id: string } | null;
      originalTotalSet: Money;
      discountAllocations: { allocatedAmountSet: Money }[];
      taxLines: { priceSet: Money }[];
    }[];
  };
  discountApplications: {
    pageInfo: { hasNextPage: boolean };
    nodes: { __typename: string; code?: string }[];
  };
};
export function rewardOrderFact(raw: RawRewardOrder): OrderFact {
  let eligiblePaise = 0;
  let complete =
    !raw.lineItems.pageInfo.hasNextPage &&
    !raw.discountApplications.pageInfo.hasNextPage &&
    raw.transactions.length < 20;
  const currency = raw.totalOutstandingSet.shopMoney.currencyCode;
  for (const line of raw.lineItems.nodes) {
    if (line.isGiftCard) continue;
    if (line.currentQuantity !== line.quantity) complete = false;
    const money = [
      line.originalTotalSet,
      ...line.discountAllocations.map((d) => d.allocatedAmountSet),
      ...line.taxLines.map((t) => t.priceSet),
    ];
    if (money.some((m) => m.shopMoney.currencyCode !== currency))
      complete = false;
    const net =
      paise(line.originalTotalSet.shopMoney.amount) -
      line.discountAllocations.reduce(
        (s, d) => s + paise(d.allocatedAmountSet.shopMoney.amount),
        0,
      ) -
      (raw.taxesIncluded
        ? line.taxLines.reduce(
            (s, t) => s + paise(t.priceSet.shopMoney.amount),
            0,
          )
        : 0);
    if (net < 0) complete = false;
    if (line.product?.inCollection) eligiblePaise += Math.max(0, net);
  }
  return {
    id: raw.id,
    customer: raw.customer?.id ?? null,
    email:
      raw.customer?.defaultEmailAddress?.emailAddress.toLowerCase() ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    paidAt:
      raw.transactions
        .filter(
          (t) =>
            t.status === "SUCCESS" &&
            ["SALE", "CAPTURE"].includes(t.kind) &&
            t.processedAt,
        )
        .map((t) => t.processedAt!)
        .sort()
        .at(-1) || null,
    status: raw.displayFinancialStatus,
    source: raw.sourceName,
    test: raw.test,
    cancelled: !!raw.cancelledAt,
    company: raw.purchasingEntity?.__typename === "PurchasingCompany",
    tags: raw.tags,
    currency,
    paid:
      ["PAID", "PARTIALLY_REFUNDED"].includes(raw.displayFinancialStatus) &&
      paise(raw.totalOutstandingSet.shopMoney.amount) === 0,
    refunded: ["REFUNDED", "PARTIALLY_REFUNDED"].includes(
      raw.displayFinancialStatus,
    ),
    complete,
    eligiblePaise,
    catalogue: raw.lineItems.nodes
      .filter((l) => !l.isGiftCard)
      .every((l) => l.product && l.variant),
    codes: raw.discountApplications.nodes.flatMap((d) =>
      d.code ? [d.code] : [],
    ),
  };
}
export type RewardCoupon = {
  __typename: string;
  title: string;
  tags: string[];
  startsAt: string;
  endsAt: string | null;
  status: string;
  asyncUsageCount: number;
  usageLimit: number | null;
  appliesOncePerCustomer: boolean;
  combinesWith: {
    orderDiscounts: boolean;
    productDiscounts: boolean;
    shippingDiscounts: boolean;
  };
  context: { __typename: string; customers?: { id: string }[] };
  codes: { nodes: { code: string }[] };
  minimumRequirement: {
    __typename: string;
    greaterThanOrEqualToSubtotal?: { amount: string; currencyCode: string };
  } | null;
  customerGets: {
    appliesOnOneTimePurchase: boolean;
    appliesOnSubscription: boolean;
    value: {
      __typename: string;
      amount?: { amount: string; currencyCode: string };
      appliesOnEachItem?: boolean;
    };
    items: {
      __typename: string;
      collections?: {
        nodes: { id: string }[];
        pageInfo: { hasNextPage: boolean };
      };
    };
  };
};
export type RewardCouponNode = { id: string; codeDiscount: RewardCoupon };
export type CouponIntent = {
  code: string;
  customer_id: string;
  points: number;
  minimum_paise: number;
  collection_id: string;
  expires_at: string;
  created_at: string;
};
export function rewardCouponInput(intent: CouponIntent) {
  return {
    title: `GYVFT reward · ${intent.points} points`,
    code: intent.code,
    tags: ["gyvft-rewards", "gyvft-rewards-v1"],
    startsAt: new Date(intent.created_at).toISOString(),
    endsAt: new Date(intent.expires_at).toISOString(),
    usageLimit: 1,
    appliesOncePerCustomer: true,
    context: { customers: { add: [intent.customer_id] } },
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false,
    },
    minimumRequirement: {
      subtotal: {
        greaterThanOrEqualToSubtotal: (intent.minimum_paise / 100).toFixed(2),
      },
    },
    customerGets: {
      items: { collections: { add: [intent.collection_id] } },
      value: {
        discountAmount: {
          amount: intent.points.toFixed(2),
          appliesOnEachItem: false,
        },
      },
    },
  };
}
export function validRewardCoupon(
  node: RewardCouponNode,
  intent: CouponIntent,
) {
  const c = node.codeDiscount,
    min = c.minimumRequirement?.greaterThanOrEqualToSubtotal;
  const collections = c.customerGets.items.collections;
  return (
    c.__typename === "DiscountCodeBasic" &&
    c.tags.includes("gyvft-rewards-v1") &&
    c.codes.nodes.length === 1 &&
    c.codes.nodes[0].code === intent.code &&
    c.usageLimit === 1 &&
    c.appliesOncePerCustomer &&
    c.context.__typename === "DiscountCustomers" &&
    c.context.customers?.length === 1 &&
    c.context.customers[0].id === intent.customer_id &&
    !Object.values(c.combinesWith).some(Boolean) &&
    !!c.endsAt &&
    new Date(c.endsAt).getTime() === new Date(intent.expires_at).getTime() &&
    new Date(c.startsAt).getTime() === new Date(intent.created_at).getTime() &&
    c.customerGets.appliesOnOneTimePurchase &&
    !c.customerGets.appliesOnSubscription &&
    c.customerGets.value.__typename === "DiscountAmount" &&
    !c.customerGets.value.appliesOnEachItem &&
    c.customerGets.value.amount?.currencyCode === "INR" &&
    paise(c.customerGets.value.amount.amount) === intent.points * 100 &&
    c.minimumRequirement?.__typename === "DiscountMinimumSubtotal" &&
    min?.currencyCode === "INR" &&
    paise(min.amount) === Number(intent.minimum_paise) &&
    c.customerGets.items.__typename === "DiscountCollections" &&
    collections?.nodes.length === 1 &&
    !collections.pageInfo.hasNextPage &&
    collections.nodes[0].id === intent.collection_id
  );
}
export const rewardsShopify = shopifyRequest;

export class RewardConnectionError extends Error {}
export async function ensureRewardConnection() {
  const data = await rewardsShopify<{
    shop: { currencyCode: string };
    currentAppInstallation: { accessScopes: { handle: string }[] };
  }>(REWARD_CONNECTION, {});
  const scopes = new Set(
    data.currentAppInstallation.accessScopes.map((s) => s.handle),
  );
  const required = [
    ["read_orders", "write_orders"],
    ["read_all_orders"],
    ["read_products", "write_products"],
    ["read_customers", "write_customers"],
    ["write_discounts"],
  ];
  if (data.shop.currencyCode !== "INR")
    throw new RewardConnectionError(
      "Rewards require Aarla store currency INR.",
    );
  const missing = required
    .filter((alternatives) => !alternatives.some((scope) => scopes.has(scope)))
    .map((alternatives) => alternatives[0]);
  if (missing.length)
    throw new RewardConnectionError(
      `Rewards need complete order history and Shopify permissions: ${missing.join(", ")}. Check the installed app grant.`,
    );
}
