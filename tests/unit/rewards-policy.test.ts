import { describe, it, expect } from "vitest";
import {
  paise,
  wholePoints,
  minimumSpendPaise,
  celebrationWindow,
  classifyOrder,
  type OrderFact,
} from "@/lib/rewards/policy";
import {
  rewardOrderFact,
  rewardCouponInput,
  validRewardCoupon,
  type RawRewardOrder,
  type RewardCouponNode,
  type CouponIntent,
} from "@/services/shopify/rewards";
import { aarlaDiscountUrl } from "@/lib/customer/aarla-shop-model";
const bag = (amount: string) => ({
  shopMoney: { amount, currencyCode: "INR" },
});
const fact: OrderFact = {
  id: "gid://shopify/Order/1",
  customer: "gid://shopify/Customer/1",
  email: "buyer@example.test",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  paidAt: "2026-10-01T00:00:00Z",
  status: "PAID",
  source: "web",
  test: false,
  cancelled: false,
  company: false,
  tags: [],
  currency: "INR",
  paid: true,
  refunded: false,
  complete: true,
  eligiblePaise: 500000,
  catalogue: true,
  codes: [],
};
export const intent: CouponIntent = {
  code: "GYVFTR-1234567890ABCDEF1234567890ABCDEF",
  customer_id: "gid://shopify/Customer/1",
  points: 100,
  minimum_paise: 40000,
  collection_id: "gid://shopify/Collection/1",
  created_at: "2026-11-25T00:00:00.000Z",
  expires_at: "2026-11-26T00:00:00.000Z",
};
function node(): RewardCouponNode {
  return {
    id: "gid://shopify/DiscountCodeNode/1",
    codeDiscount: {
      __typename: "DiscountCodeBasic",
      title: "Reward",
      tags: ["gyvft-rewards-v1"],
      startsAt: intent.created_at,
      endsAt: intent.expires_at,
      status: "ACTIVE",
      asyncUsageCount: 0,
      usageLimit: 1,
      appliesOncePerCustomer: true,
      combinesWith: {
        orderDiscounts: false,
        productDiscounts: false,
        shippingDiscounts: false,
      },
      context: {
        __typename: "DiscountCustomers",
        customers: [{ id: intent.customer_id }],
      },
      codes: { nodes: [{ code: intent.code }] },
      minimumRequirement: {
        __typename: "DiscountMinimumSubtotal",
        greaterThanOrEqualToSubtotal: { amount: "400.00", currencyCode: "INR" },
      },
      customerGets: {
        appliesOnOneTimePurchase: true,
        appliesOnSubscription: false,
        value: {
          __typename: "DiscountAmount",
          amount: { amount: "100.00", currencyCode: "INR" },
          appliesOnEachItem: false,
        },
        items: {
          __typename: "DiscountCollections",
          collections: {
            nodes: [{ id: intent.collection_id }],
            pageInfo: { hasNextPage: false },
          },
        },
      },
    },
  };
}
describe("D2C rewards policy", () => {
  it("uses integer money and carries small purchases", () => {
    expect(paise("12.05")).toBe(1205);
    expect(wholePoints(4900)).toEqual({ points: 0, carryPaise: 4900 });
    expect(wholePoints(100, 4900)).toEqual({ points: 1, carryPaise: 0 });
    expect(() => paise("1.001")).toThrow();
    expect(() => paise("-1")).toThrow();
  });
  it("requires at least four times the point value as merchandise subtotal", () => {
    expect(minimumSpendPaise(100)).toBe(40000);
    expect(() => minimumSpendPaise(0)).toThrow();
    expect(() => minimumSpendPaise(1.5)).toThrow();
  });
  it("keeps normal saving orders eligible but excludes every reward/occasion order", () => {
    expect(classifyOrder({ ...fact, codes: ["GYVFT5-EXAMPLE"] })).toMatchObject(
      { classification: "d2c" },
    );
    for (const code of ["GYVFTR-X", "GYVFTB-X", "GYVFTA-X"])
      expect(classifyOrder({ ...fact, codes: [code] })).toMatchObject({
        classification: "excluded",
        eligiblePaise: 0,
      });
  });
  it.each([
    { company: true },
    { test: true },
    { cancelled: true },
    { tags: ["wholesale"] },
  ])("excludes non-retail/test/cancelled orders: %s", (change) => {
    expect(classifyOrder({ ...fact, ...change }).classification).toBe(
      "excluded",
    );
  });
  it.each([
    { source: "shopify_draft_order" },
    { refunded: true },
    { complete: false },
    { catalogue: false },
    { paidAt: null },
  ])("holds ambiguous orders for review: %s", (change) => {
    expect(classifyOrder({ ...fact, ...change }).classification).toBe("review");
  });
  it("opens across New Year in Kolkata and maps leap birthdays", () => {
    expect(
      celebrationWindow("01-01", new Date("2026-12-25T19:00:00Z"))?.year,
    ).toBe(2027);
    expect(
      celebrationWindow("02-29", new Date("2027-02-28T06:00:00Z"))?.year,
    ).toBe(2027);
    expect(
      celebrationWindow("01-01", new Date("2027-01-09T06:00:00Z")),
    ).toBeNull();
    expect(() => celebrationWindow("02-30")).toThrow();
  });
  it("calculates retained selected merchandise after allocated discounts and inclusive GST", () => {
    const raw: RawRewardOrder = {
      id: fact.id,
      createdAt: fact.createdAt,
      updatedAt: fact.updatedAt,
      test: false,
      cancelledAt: null,
      sourceName: "web",
      tags: [],
      taxesIncluded: true,
      displayFinancialStatus: "PAID",
      transactions: [
        { kind: "SALE", status: "SUCCESS", processedAt: fact.paidAt },
      ],
      purchasingEntity: { __typename: "Customer" },
      customer: {
        id: fact.customer!,
        defaultEmailAddress: { emailAddress: fact.email! },
      },
      totalOutstandingSet: bag("0"),
      lineItems: {
        pageInfo: { hasNextPage: false },
        nodes: [
          {
            id: "L1",
            isGiftCard: false,
            quantity: 1,
            currentQuantity: 1,
            product: { id: "P1", inCollection: true },
            variant: { id: "V1" },
            originalTotalSet: bag("1180"),
            discountAllocations: [{ allocatedAmountSet: bag("118") }],
            taxLines: [{ priceSet: bag("162") }],
          },
          {
            id: "L2",
            isGiftCard: true,
            quantity: 1,
            currentQuantity: 1,
            product: { id: "P2", inCollection: true },
            variant: { id: "V2" },
            originalTotalSet: bag("500"),
            discountAllocations: [],
            taxLines: [],
          },
          {
            id: "L3",
            isGiftCard: false,
            quantity: 1,
            currentQuantity: 1,
            product: { id: "P3", inCollection: false },
            variant: { id: "V3" },
            originalTotalSet: bag("500"),
            discountAllocations: [],
            taxLines: [],
          },
        ],
      },
      discountApplications: { pageInfo: { hasNextPage: false }, nodes: [] },
    };
    expect(rewardOrderFact(raw).eligiblePaise).toBe(90000);
    raw.lineItems.pageInfo.hasNextPage = true;
    expect(rewardOrderFact(raw).complete).toBe(false);
  });
  it("creates a restricted, non-combinable coupon and omits unsupported subscription inputs", () => {
    const input = rewardCouponInput(intent);
    expect(input.customerGets).not.toHaveProperty("appliesOnSubscription");
    expect(input.customerGets).not.toHaveProperty("appliesOnOneTimePurchase");
    expect(input.context).toEqual({ customers: { add: [intent.customer_id] } });
    expect(input.customerGets.value).toEqual({
      discountAmount: { amount: "100.00", appliesOnEachItem: false },
    });
    expect(input.combinesWith).toEqual({
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false,
    });
    expect(validRewardCoupon(node(), intent)).toBe(true);
  });
  it.each([
    "customer",
    "amount",
    "minimum",
    "combining",
    "collection",
    "expiry",
  ])("rejects altered provider policy: %s", (change) => {
    const n = node();
    if (change === "customer")
      n.codeDiscount.context.customers![0].id = "wrong";
    if (change === "amount")
      n.codeDiscount.customerGets.value.amount!.amount = "200";
    if (change === "minimum")
      n.codeDiscount.minimumRequirement!.greaterThanOrEqualToSubtotal!.amount =
        "0";
    if (change === "combining")
      n.codeDiscount.combinesWith.orderDiscounts = true;
    if (change === "collection")
      n.codeDiscount.customerGets.items.collections!.nodes[0].id = "wrong";
    if (change === "expiry") n.codeDiscount.endsAt = null;
    expect(validRewardCoupon(n, intent)).toBe(false);
  });
  it("allows only canonical saving and reward handoff codes", () => {
    expect(
      aarlaDiscountUrl(intent.code, "https://aarla.in/collections/all"),
    ).toContain("/discount/GYVFTR-");
    expect(() => aarlaDiscountUrl("FREE-ALL", "https://aarla.in")).toThrow();
    expect(() => aarlaDiscountUrl(intent.code, "https://evil.test")).toThrow();
  });
});
