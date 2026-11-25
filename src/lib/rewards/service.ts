import "server-only";
import type { CustomerAccount } from "@/lib/customer/session";
import { AppError } from "@/lib/errors/app-error";
import { getSql, withTransaction } from "@/lib/database/client";
import { verifiedRewardCustomer } from "./identity";
import {
  rewardSettings,
  rewardsReady,
  rewardWallet,
  rewardConflict,
  lockWallet,
  refreshDueWallets,
} from "./store";
import { celebrationWindow, dayMs } from "./policy";
import {
  REWARD_CUSTOMER,
  ensureRewardConnection,
  RewardConnectionError,
  REWARD_COLLECTION,
  rewardsShopify,
} from "@/services/shopify/rewards";
import { issueReward, reconcileRewardCoupon } from "./coupons";
export async function customerRewardView(account: CustomerAccount) {
  if (!(await rewardsReady()))
    return { installed: false, enabled: false, verified: false, wallet: null };
  const settings = await rewardSettings();
  const [identity] =
    await getSql()`SELECT customer_id FROM gyvft_reward_wallets WHERE account_id=${account.id}::uuid AND email=${account.email} AND verified_email=${account.email} AND verified_at IS NOT NULL`;
  return {
    installed: true,
    enabled: settings.enabled,
    verified: !!identity,
    wallet: identity ? await rewardWallet(String(identity.customer_id)) : null,
  };
}
export async function redeemForAccount(
  account: CustomerAccount,
  kind: "points" | "birthday" | "anniversary",
  points: number,
) {
  const customer = await verifiedRewardCustomer(account);
  const data = await rewardsShopify<{
    customer: {
      id: string;
      defaultEmailAddress: { emailAddress: string } | null;
    } | null;
  }>(REWARD_CUSTOMER, { id: customer });
  if (
    data.customer?.defaultEmailAddress?.emailAddress.toLowerCase() !==
    account.email
  )
    throw rewardConflict(
      "Your Aarla email changed. Contact GYVFT before using this wallet.",
    );
  return issueReward(customer, kind, points);
}
export async function saveRewardDates(
  account: CustomerAccount,
  birthday: string | null,
  anniversary: string | null,
  consent: boolean,
) {
  const customer = await verifiedRewardCustomer(account);
  try {
    for (const date of [birthday, anniversary])
      if (date) celebrationWindow(date);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Use a real date in MM-DD format.");
  }
  await withTransaction(async (tx) => {
    await lockWallet(tx, customer);
    const [prior] =
      await tx`SELECT * FROM gyvft_reward_dates WHERE customer_id=${customer}`;
    const [issued] =
      await tx`SELECT id FROM gyvft_reward_coupons WHERE customer_id=${customer} AND kind!='points' AND created_at>now()-interval '365 days' LIMIT 1`;
    if (
      issued &&
      prior &&
      (prior.birthday !== birthday || prior.anniversary !== anniversary)
    )
      throw rewardConflict(
        "Your occasion dates are fixed for 12 months after an offer is issued. You can still switch offers off.",
      );
    await tx`INSERT INTO gyvft_reward_dates(customer_id,birthday,anniversary,consent) VALUES(${customer},${birthday},${anniversary},${consent}) ON CONFLICT(customer_id) DO UPDATE SET birthday=excluded.birthday,anniversary=excluded.anniversary,consent=excluded.consent,changed_at=now()`;
  });
  return { message: "Your own occasion preferences are saved." };
}
export async function updateRewardSettings(
  enabled: boolean,
  collection: string | null,
) {
  await rewardSettings();
  if (enabled && !collection)
    throw rewardConflict(
      "Choose the retail collection before enabling rewards.",
    );
  if (enabled) {
    try {
      await ensureRewardConnection();
    } catch (error) {
      if (error instanceof RewardConnectionError)
        throw rewardConflict(error.message);
      throw rewardConflict(
        "The Shopify connection could not be checked. Retry before changing app permissions.",
      );
    }
  }
  if (collection) {
    const data = await rewardsShopify<{
      collection: { id: string; title: string } | null;
    }>(REWARD_COLLECTION, { id: collection });
    if (!data.collection)
      throw rewardConflict("This Aarla retail collection was not found.");
  }
  await withTransaction(async (tx) => {
    const [prior] =
      await tx`SELECT * FROM gyvft_reward_settings WHERE id=true FOR UPDATE`;
    if (prior.lease_until && new Date(prior.lease_until).getTime() > Date.now())
      throw rewardConflict(
        "Wait for the current Shopify batch before changing settings.",
      );
    const changed = prior.collection_id !== collection;
    await tx`UPDATE gyvft_reward_settings SET enabled=${enabled},collection_id=${collection},activated_at=CASE WHEN ${enabled} THEN COALESCE(activated_at,now()) ELSE activated_at END,revision=revision+1,
    sync_cursor=CASE WHEN ${changed} THEN NULL ELSE sync_cursor END,sync_since=CASE WHEN ${changed} THEN NULL ELSE sync_since END,sync_until=CASE WHEN ${changed} THEN NULL ELSE sync_until END,last_sync_at=CASE WHEN ${changed} THEN NULL ELSE last_sync_at END WHERE id=true`;
  });
  return {
    message: enabled
      ? "Rewards enabled. Historical orders still require reviewed opening allocation."
      : "New reward coupon issuance paused. Existing native coupons retain their published terms.",
  };
}
export async function operationsRewardView() {
  if (!(await rewardsReady())) return { installed: false };
  const settings = await rewardSettings(),
    sql = getSql();
  const [totals] =
    await sql`SELECT count(*)::int AS orders,count(*) FILTER(WHERE classification='review' AND reviewed_version IS DISTINCT FROM updated_at)::int AS review,count(*) FILTER(WHERE is_historical AND NOT authorised)::int AS historical FROM gyvft_reward_orders`;
  const [liability] =
    await sql`SELECT COALESCE(sum(GREATEST(balance,0)),0)::int AS points,COALESCE(sum(reserved),0)::int AS reserved FROM (SELECT customer_id,sum(earned-spent-expired) AS balance,sum(held) AS reserved FROM gyvft_reward_lots GROUP BY customer_id) balances`;
  const [wallets] =
    await sql`SELECT count(*)::int AS wallets,count(*) FILTER(WHERE verified_at IS NOT NULL)::int AS verified FROM gyvft_reward_wallets`;
  const review =
    await sql`SELECT id,customer_id,email,updated_at,reason,eligible_paise FROM gyvft_reward_orders WHERE classification='review' AND reviewed_version IS DISTINCT FROM updated_at ORDER BY created_at DESC LIMIT 50`;
  const uncertain =
    await sql`SELECT id,kind,state,points,expires_at FROM gyvft_reward_coupons WHERE state IN ('creating','uncertain') ORDER BY created_at LIMIT 30`;
  const imports =
    await sql`SELECT id,state,order_count,points,created_at,applied_at FROM gyvft_reward_imports ORDER BY created_at DESC LIMIT 5`;
  return {
    installed: true,
    settings,
    totals,
    wallets,
    liability,
    review: [...review],
    uncertain: [...uncertain],
    imports: [...imports],
  };
}
export async function reconcileDueRewards(limit = 20, budgetMs = 25000) {
  const started = Date.now();
  await refreshDueWallets();
  await rewardSettings();
  const due =
    await getSql()`SELECT id FROM gyvft_reward_coupons WHERE state IN ('creating','active','uncertain') ORDER BY checked_at NULLS FIRST,created_at LIMIT ${limit}`;
  let checked = 0;
  for (const coupon of due) {
    if (Date.now() - started >= budgetMs) break;
    await reconcileRewardCoupon(String(coupon.id));
    await getSql()`UPDATE gyvft_reward_coupons SET checked_at=now() WHERE id=${coupon.id}::uuid`;
    checked++;
  }
  return { checked };
}
export async function rewardsHealth() {
  const settings = await rewardSettings();
  return {
    fresh:
      !!settings.last_sync_at &&
      Date.now() - new Date(settings.last_sync_at).getTime() <= 2 * dayMs,
  };
}

export async function refreshCustomerRewardCoupons(account: CustomerAccount) {
  const customer = await verifiedRewardCustomer(account);
  const due =
    await getSql()`SELECT id FROM gyvft_reward_coupons WHERE customer_id=${customer} AND state IN ('creating','active','uncertain') ORDER BY checked_at NULLS FIRST LIMIT 2`;
  for (const coupon of due) await reconcileRewardCoupon(String(coupon.id));
  return { message: "Your Aarla checkout status has been checked." };
}
