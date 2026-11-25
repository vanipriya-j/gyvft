import "server-only";
import { logger } from "@/lib/logging/logger";
import {
  ShopifyError,
  shopifyProviderCode,
} from "@/services/shopify/admin-auth";
import { randomUUID } from "node:crypto";
import { getSql, withTransaction } from "@/lib/database/client";
import { aarlaDiscountUrl } from "@/lib/customer/aarla-shop-model";
import {
  REWARD_COUPON_LOOKUP,
  REWARD_COUPON_CREATE,
  REWARD_USED_ORDERS,
  rewardsShopify,
  rewardCouponInput,
  validRewardCoupon,
  type RewardCouponNode,
  type CouponIntent,
} from "@/services/shopify/rewards";
import { celebrationWindow, dayMs, minimumSpendPaise } from "./policy";
import {
  lockWallet,
  reconcileEarnings,
  rewardConflict,
  rewardJournal,
  rewardSettings,
  walletTotals,
} from "./store";
export type RewardIntent = CouponIntent & {
  id: string;
  kind: "points" | "birthday" | "anniversary";
  state: string;
  shopify_id: string | null;
  event_year: number | null;
};
async function reserveReward(
  customer: string,
  kind: RewardIntent["kind"],
  points: number,
) {
  return withTransaction(async (tx) => {
    const [settings] =
      await tx`SELECT * FROM gyvft_reward_settings WHERE id=true FOR SHARE`;
    if (
      !settings?.enabled ||
      !settings.collection_id ||
      !settings.last_sync_at ||
      Date.now() - new Date(settings.last_sync_at).getTime() > 48 * dayMs
    )
      throw rewardConflict(
        "Rewards need a recent Shopify sync and an active retail collection. Please contact GYVFT.",
      );
    await lockWallet(tx, customer);
    await reconcileEarnings(tx, customer);
    const [existing] = await tx<
      RewardIntent[]
    >`SELECT * FROM gyvft_reward_coupons WHERE customer_id=${customer} AND kind='points' AND state IN ('creating','active','uncertain') ORDER BY created_at DESC LIMIT 1`;
    if (kind === "points" && existing) return existing;
    let eventYear: number | null = null,
      expiresAt = new Date(Date.now() + dayMs);
    if (kind !== "points") {
      const [dates] =
        await tx`SELECT * FROM gyvft_reward_dates WHERE customer_id=${customer}`;
      if (!dates?.consent || !dates[kind])
        throw rewardConflict("Add your own occasion date and opt in first.");
      const window = celebrationWindow(String(dates[kind]));
      if (!window)
        throw rewardConflict(
          "Your occasion offer opens seven days before your day.",
        );
      eventYear = window.year;
      expiresAt = new Date(new Date(window.endsAt).getTime());
      points = 150;
      const [prior] =
        await tx`SELECT id FROM gyvft_reward_orders WHERE customer_id=${customer} AND classification!='excluded' AND created_at<now() AND (CASE WHEN reviewed_version=updated_at THEN reviewed_paise WHEN classification='d2c' THEN eligible_paise ELSE 0 END)>0 LIMIT 1`;
      if (!prior)
        throw rewardConflict(
          "Occasion offers are for customers with a completed Aarla retail purchase.",
        );
      const [used] = await tx<
        RewardIntent[]
      >`SELECT * FROM gyvft_reward_coupons WHERE customer_id=${customer} AND kind=${kind} AND event_year=${eventYear}`;
      if (used) return used;
    } else {
      minimumSpendPaise(points);
      const totals = await walletTotals(tx, customer);
      if (totals.available < points)
        throw rewardConflict(
          "Not enough available points. Refresh your wallet.",
        );
    }
    const id = randomUUID(),
      prefix =
        kind === "points"
          ? "GYVFTR"
          : kind === "birthday"
            ? "GYVFTB"
            : "GYVFTA";
    const [intent] = await tx<
      RewardIntent[]
    >`INSERT INTO gyvft_reward_coupons(id,customer_id,kind,event_year,code,points,minimum_paise,collection_id,expires_at)
   VALUES(${id}::uuid,${customer},${kind},${eventYear},${`${prefix}-${id.replaceAll("-", "").toUpperCase()}`},${points},${kind === "points" ? minimumSpendPaise(points) : 150000},${settings.collection_id},${expiresAt}) RETURNING *`;
    if (kind === "points") {
      let remaining = points;
      const lots =
        await tx`SELECT * FROM gyvft_reward_lots WHERE customer_id=${customer} AND expires_at>now() AND earned-spent-held-expired>0 ORDER BY expires_at,order_id FOR UPDATE`;
      for (const lot of lots) {
        const amount = Math.min(
          remaining,
          Number(lot.earned) -
            Number(lot.spent) -
            Number(lot.held) -
            Number(lot.expired),
        );
        if (!amount) continue;
        await tx`INSERT INTO gyvft_reward_allocations(coupon_id,order_id,points) VALUES(${id}::uuid,${lot.order_id},${amount})`;
        await tx`UPDATE gyvft_reward_lots SET held=held+${amount} WHERE order_id=${lot.order_id}`;
        remaining -= amount;
        if (!remaining) break;
      }
      if (remaining)
        throw rewardConflict("Available points changed. Refresh your wallet.");
      await rewardJournal(
        tx,
        customer,
        "reserve",
        0,
        id,
        "Reserved for Aarla checkout; not yet spent",
      );
    }
    return intent;
  });
}
export async function issueReward(
  customer: string,
  kind: RewardIntent["kind"],
  points: number,
) {
  await rewardSettings();
  const intent = await reserveReward(customer, kind, points);
  if (["redeemed", "released", "expired"].includes(intent.state))
    throw rewardConflict("This benefit has already been used or has expired.");
  if (new Date(intent.expires_at).getTime() <= Date.now())
    throw rewardConflict(
      "This coupon expired. Points will be released after Shopify usage is checked.",
    );
  // Customer ownership is rechecked against Shopify at the HTTP/service boundary before this command.
  const [claim] =
    await getSql()`UPDATE gyvft_reward_coupons SET lease_until=now()+interval '90 seconds' WHERE id=${intent.id}::uuid AND (lease_until IS NULL OR lease_until<now()) RETURNING id`;
  if (!claim)
    throw rewardConflict(
      "Your Aarla coupon is being checked. Please retry in a moment.",
    );
  try {
    let data = await rewardsShopify<{
      codeDiscountNodeByCode: RewardCouponNode | null;
    }>(REWARD_COUPON_LOOKUP, { code: intent.code });
    let node = data.codeDiscountNodeByCode;
    if (!node) {
      const created = await rewardsShopify<{
        discountCodeBasicCreate: {
          codeDiscountNode: RewardCouponNode | null;
          userErrors: { code: string; message: string }[];
        };
      }>(REWARD_COUPON_CREATE, { input: rewardCouponInput(intent) });
      node = created.discountCodeBasicCreate.codeDiscountNode;
      if (!node) {
        data = await rewardsShopify(REWARD_COUPON_LOOKUP, {
          code: intent.code,
        });
        node = data.codeDiscountNodeByCode;
        if (!node && created.discountCodeBasicCreate.userErrors.length)
          throw new ShopifyError("Reward coupon was rejected", {
            code: "SHOPIFY_COUPON_REJECTED",
            phase: "coupon",
            providerCode: shopifyProviderCode(
              created.discountCodeBasicCreate.userErrors[0].code,
            ),
          });
      }
    }
    if (
      !node ||
      !validRewardCoupon(node, intent) ||
      node.codeDiscount.status !== "ACTIVE" ||
      node.codeDiscount.asyncUsageCount !== 0
    )
      throw rewardConflict(
        "We could not confirm this Aarla coupon. Your reserved points are safe; retry this same benefit.",
      );
    await getSql()`UPDATE gyvft_reward_coupons SET state='active',shopify_id=${node.id},checked_at=now() WHERE id=${intent.id}::uuid AND state IN ('creating','uncertain','active')`;
    return {
      redirectUrl: aarlaDiscountUrl(
        intent.code,
        "https://aarla.in/collections/all",
      ),
      code: intent.code,
      points: intent.points,
      minimumPaise: Number(intent.minimum_paise),
      expiresAt: intent.expires_at,
    };
  } catch (error) {
    logger.warn("Rewards coupon needs confirmation", {
      requestId: intent.id,
      code: "REWARDS_COUPON_UNCERTAIN",
      ...(error instanceof ShopifyError ? error.details : {}),
    });
    await getSql()`UPDATE gyvft_reward_coupons SET state='uncertain' WHERE id=${intent.id}::uuid AND state IN ('creating','active','uncertain')`;
    throw rewardConflict(
      `Aarla coupon confirmation is pending. Your points remain reserved. Retry to check the same coupon. Support reference: ${intent.id}`,
    );
  } finally {
    await getSql()`UPDATE gyvft_reward_coupons SET lease_until=NULL WHERE id=${intent.id}::uuid`;
  }
}
export async function reconcileRewardCoupon(id: string) {
  const [intent] = await getSql()<
    RewardIntent[]
  >`SELECT * FROM gyvft_reward_coupons WHERE id=${id}::uuid`;
  if (!intent || !["creating", "active", "uncertain"].includes(intent.state))
    return;
  const lookup = await rewardsShopify<{
    codeDiscountNodeByCode: RewardCouponNode | null;
  }>(REWARD_COUPON_LOOKUP, { code: intent.code });
  const node = lookup.codeDiscountNodeByCode;
  if (node && !validRewardCoupon(node, intent))
    throw rewardConflict(
      "Coupon settings changed; Operations review is required.",
    );
  type UsedOrder = {
    id: string;
    test: boolean;
    cancelledAt: string | null;
    displayFinancialStatus: string;
    customer: { id: string } | null;
    discountCodes: string[];
  };
  const result = await rewardsShopify<{
    orders: { pageInfo: { hasNextPage: boolean }; nodes: UsedOrder[] };
  }>(REWARD_USED_ORDERS, {
    query: `discount_code:${intent.code}`,
    after: null,
  });
  if (result.orders.pageInfo.hasNextPage)
    throw rewardConflict("Coupon has unexpected multiple orders.");
  const orders = result.orders.nodes.filter(
    (o) =>
      !o.test &&
      o.customer?.id === intent.customer_id &&
      o.discountCodes.some((code) => code.toUpperCase() === intent.code),
  );
  const paid = orders.find(
    (o) =>
      !o.cancelledAt &&
      ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(
        o.displayFinancialStatus,
      ),
  );
  const releasable =
    !paid &&
    !orders.some((o) => !o.cancelledAt) &&
    (!node ||
      (node.codeDiscount.asyncUsageCount === 0 &&
        ["EXPIRED", "DISABLED"].includes(node.codeDiscount.status))) &&
    new Date(intent.expires_at).getTime() < Date.now() - 2 * dayMs;
  if (!paid && !releasable) return;
  await withTransaction(async (tx) => {
    await lockWallet(tx, intent.customer_id);
    const [current] =
      await tx`SELECT state FROM gyvft_reward_coupons WHERE id=${id}::uuid FOR UPDATE`;
    if (
      !current ||
      !["creating", "active", "uncertain"].includes(current.state)
    )
      return;
    const allocations =
      await tx`SELECT * FROM gyvft_reward_allocations WHERE coupon_id=${id}::uuid`;
    for (const allocation of allocations)
      await tx`UPDATE gyvft_reward_lots SET held=held-${allocation.points},spent=spent+${paid ? allocation.points : 0} WHERE order_id=${allocation.order_id}`;
    await tx`UPDATE gyvft_reward_coupons SET state=${paid ? "redeemed" : "released"},order_id=${paid?.id ?? null},checked_at=now() WHERE id=${id}::uuid`;
    if (intent.kind === "points")
      await rewardJournal(
        tx,
        intent.customer_id,
        paid ? "redeem" : "release",
        paid ? -intent.points : 0,
        id,
        paid
          ? "Shopify confirmed coupon use on a paid order"
          : "Unused coupon expiry confirmed with Shopify",
      );
    await reconcileEarnings(tx, intent.customer_id);
  });
}
