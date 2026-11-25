import "server-only";
import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logging/logger";
import { ShopifyError } from "@/services/shopify/admin-auth";
import { getSql, withTransaction } from "@/lib/database/client";
import {
  REWARD_ORDERS,
  ensureRewardConnection,
  RewardConnectionError,
  rewardOrderFact,
  rewardsShopify,
  type RawRewardOrder,
} from "@/services/shopify/rewards";
import { classifyOrder } from "./policy";
import {
  fingerprint,
  lockWallet,
  reconcileEarnings,
  rewardConflict,
  rewardSettings,
} from "./store";
export async function syncRewardOrders(budgetMs = 35000) {
  const settings = await rewardSettings();
  if (!settings.collection_id)
    throw rewardConflict(
      "Save the eligible Aarla retail collection before scanning orders.",
    );
  try {
    await ensureRewardConnection();
  } catch (error) {
    if (error instanceof RewardConnectionError)
      throw rewardConflict(error.message);
    const reference = randomUUID();
    logger.warn("Rewards connection check failed", {
      requestId: reference,
      code: "REWARDS_CONNECTION_UNCONFIRMED",
      ...(error instanceof ShopifyError ? error.details : {}),
    });
    throw rewardConflict(
      `The Shopify connection could not be checked. Retry before changing app permissions. Support reference: ${reference}`,
    );
  }
  const sql = getSql();
  const [lease] =
    await sql`UPDATE gyvft_reward_settings SET lease_until=now()+interval '90 seconds',sync_until=COALESCE(sync_until,now()),last_error=NULL WHERE id=true AND (lease_until IS NULL OR lease_until<now()) RETURNING *`;
  if (!lease) return { busy: true, more: true, processed: 0 };
  const start = Date.now();
  let processed = 0,
    more = true;
  try {
    let cursor = lease.sync_cursor;
    const since = lease.sync_since
      ? new Date(lease.sync_since).toISOString()
      : "1970-01-01T00:00:00.000Z";
    const until = new Date(lease.sync_until).toISOString();
    // Bounded pages keep a large historical scan resumable on a 60-second function.
    while (more && processed < 25 && Date.now() - start < budgetMs) {
      const result = await rewardsShopify<{
        orders: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: RawRewardOrder[];
        };
      }>(REWARD_ORDERS, {
        query: `updated_at:>='${since}' updated_at:<='${until}'`,
        after: cursor,
        collectionId: settings.collection_id,
      });
      await withTransaction(async (tx) => {
        await tx`SELECT id FROM gyvft_reward_settings WHERE id=true FOR UPDATE`;
        const customers = new Set<string>();
        for (const raw of result.orders.nodes) {
          const fact = rewardOrderFact(raw),
            classification = classifyOrder(fact);
          const [prior] =
            await tx`SELECT o.customer_id,l.customer_id AS lot_customer FROM gyvft_reward_orders o LEFT JOIN gyvft_reward_lots l ON l.order_id=o.id WHERE o.id=${fact.id}`;
          if (prior?.customer_id) customers.add(String(prior.customer_id));
          if (fact.customer && fact.email) {
            await tx`INSERT INTO gyvft_reward_wallets(customer_id,email) VALUES(${fact.customer},${fact.email}) ON CONFLICT(customer_id) DO UPDATE SET email=excluded.email`;
            customers.add(fact.customer);
          }
          const historical =
            !lease.activated_at ||
            new Date(fact.createdAt) < new Date(lease.activated_at);
          await tx`INSERT INTO gyvft_reward_orders(id,customer_id,email,created_at,paid_at,updated_at,classification,reason,eligible_paise,codes,snapshot_hash,is_historical,authorised,authorised_at)
      VALUES(${fact.id},${fact.customer},${fact.email},${fact.createdAt},${fact.paidAt},${fact.updatedAt},${classification.classification},${classification.reason},${classification.eligiblePaise},${fact.codes},${fingerprint(fact)},${historical},${!historical},${!historical ? new Date() : null})
      ON CONFLICT(id) DO UPDATE SET customer_id=excluded.customer_id,email=excluded.email,paid_at=excluded.paid_at,updated_at=excluded.updated_at,classification=excluded.classification,reason=excluded.reason,eligible_paise=excluded.eligible_paise,codes=excluded.codes,snapshot_hash=excluded.snapshot_hash,synced_at=now()`;
          if (
            prior?.customer_id &&
            (prior.customer_id !== fact.customer ||
              (prior.lot_customer && prior.lot_customer !== fact.customer))
          ) {
            // Never transfer an earned/spent lot to a different customer silently.
            await tx`UPDATE gyvft_reward_orders SET classification='excluded',reason='Order customer changed: contact GYVFT to review both wallets',eligible_paise=0,reviewed_version=NULL WHERE id=${fact.id}`;
          }
        }
        for (const customer of [...customers].sort()) {
          await lockWallet(tx, customer);
          await reconcileEarnings(tx, customer);
        }
        more = result.orders.pageInfo.hasNextPage;
        cursor = result.orders.pageInfo.endCursor;
        if (more)
          await tx`UPDATE gyvft_reward_settings SET sync_cursor=${cursor} WHERE id=true`;
        else
          await tx`UPDATE gyvft_reward_settings SET sync_cursor=NULL,sync_since=${new Date(new Date(until).getTime() - 3600000)},sync_until=NULL,last_sync_at=now() WHERE id=true`;
      });
      processed += result.orders.nodes.length;
    }
    return { busy: false, more, processed };
  } catch (error) {
    const reference = randomUUID();
    logger.warn("Rewards Shopify scan paused", {
      requestId: reference,
      code: "REWARDS_SYNC_PAUSED",
      ...(error instanceof ShopifyError ? error.details : {}),
    });
    await sql`UPDATE gyvft_reward_settings SET last_error='Shopify scan incomplete; resume from the saved checkpoint.' WHERE id=true`;
    throw rewardConflict(
      `Shopify scan paused. Your saved checkpoint is safe; retry the next batch. Support reference: ${reference}`,
    );
  } finally {
    await sql`UPDATE gyvft_reward_settings SET lease_until=NULL WHERE id=true`;
  }
}
export async function reviewRewardOrder(
  id: string,
  version: string,
  eligiblePaise: number | null,
  reason: string,
) {
  await rewardSettings();
  return withTransaction(async (tx) => {
    await tx`SELECT id FROM gyvft_reward_settings WHERE id=true FOR UPDATE`;
    const [order] =
      await tx`SELECT * FROM gyvft_reward_orders WHERE id=${id} FOR UPDATE`;
    if (
      !order ||
      new Date(order.updated_at).toISOString() !== version ||
      !order.customer_id
    )
      throw rewardConflict("Order changed. Refresh before reviewing.");
    // An owner review cannot override a redemption/test/business/cancelled exclusion.
    if (order.classification === "excluded")
      throw rewardConflict("This order is excluded by policy.");
    await lockWallet(tx, order.customer_id);
    await tx`UPDATE gyvft_reward_orders SET reviewed_paise=${eligiblePaise ?? 0},reviewed_version=updated_at WHERE id=${id}`;
    await tx`INSERT INTO gyvft_reward_ledger(customer_id,kind,points,reference,detail) VALUES(${order.customer_id},'review',0,${id},${reason})`;
    await reconcileEarnings(tx, order.customer_id);
    return {
      message: "Classification and eligible merchandise amount reviewed.",
    };
  });
}
