import "server-only";
import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { getSql, withTransaction } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { wholePoints, dayMs } from "./policy";
export const rewardConflict = (message: string) =>
  new AppError("CONFLICT", message);
export async function rewardsReady() {
  if (!process.env.DATABASE_URL) return false;
  const [row] =
    await getSql()`SELECT to_regclass('gyvft_reward_settings') IS NOT NULL AS ready`;
  return !!row?.ready;
}
export type Settings = {
  enabled: boolean;
  collection_id: string | null;
  activated_at: string | null;
  sync_cursor: string | null;
  sync_since: string | null;
  sync_until: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  revision: number;
};
export async function rewardSettings() {
  if (!(await rewardsReady()))
    throw new AppError("SETUP_REQUIRED", "Rewards are not active yet.");
  const [settings] = await getSql()<
    Settings[]
  >`SELECT * FROM gyvft_reward_settings WHERE id=true`;
  return settings;
}
export async function lockWallet(tx: Sql, customer: string) {
  await tx`SELECT customer_id FROM gyvft_reward_wallets WHERE customer_id=${customer} FOR UPDATE`;
}
export async function rewardJournal(
  tx: Sql,
  customer: string,
  kind: string,
  points: number,
  reference: string,
  detail: string,
) {
  await tx`INSERT INTO gyvft_reward_ledger(customer_id,kind,points,reference,detail) VALUES(${customer},${kind},${points},${reference},${detail})`;
}
/** Callers hold the affected wallet locks. Batch writes keep historical allocations within one function budget. */
export async function reconcileEarnings(tx: Sql, customer: string) {
  return reconcileEarningsBatch(tx, [customer]);
}
async function reconcileEarningsBatch(tx: Sql, customers: string[]) {
  if (!customers.length) return;
  const rows =
    await tx`SELECT o.*,l.earned AS old_earned,l.spent,l.held,l.expired,l.customer_id AS lot_customer FROM gyvft_reward_orders o LEFT JOIN gyvft_reward_lots l ON l.order_id=o.id WHERE o.customer_id=ANY(${customers}::text[]) OR l.customer_id=ANY(${customers}::text[]) ORDER BY o.created_at,o.id`;
  const allowed = new Set(customers),
    carry = new Map<string, number>();
  const lots: {
    order_id: string;
    customer_id: string;
    earned: number;
    expired: number;
    available_at: string;
    expires_at: string;
  }[] = [];
  const journal: {
    customer_id: string;
    kind: string;
    points: number;
    reference: string;
    detail: string;
  }[] = [];
  for (const order of rows) {
    const customer = String(order.lot_customer || order.customer_id);
    if (!allowed.has(customer)) continue;
    const availableAt = new Date(
      new Date(order.paid_at || order.updated_at).getTime() + 14 * dayMs,
    );
    const basis =
      order.customer_id === customer &&
      order.classification !== "excluded" &&
      order.authorised &&
      availableAt.getTime() <= Date.now()
        ? Number(
            order.reviewed_version &&
              new Date(order.reviewed_version).getTime() ===
                new Date(order.updated_at).getTime()
              ? order.reviewed_paise
              : order.classification === "d2c"
                ? order.eligible_paise
                : 0,
          )
        : 0;
    const earning = wholePoints(basis, carry.get(customer) || 0);
    carry.set(customer, earning.carryPaise);
    const expiresAt = new Date(
      Math.max(
        availableAt.getTime(),
        order.is_historical
          ? new Date(order.authorised_at || availableAt).getTime()
          : 0,
      ) +
        365 * dayMs,
    );
    if (order.old_earned === null && !order.authorised) continue;
    const unspent = Math.max(
      0,
      earning.points - Number(order.spent || 0) - Number(order.held || 0),
    );
    const expired =
      expiresAt.getTime() <= Date.now()
        ? unspent
        : Math.min(Number(order.expired || 0), unspent);
    lots.push({
      order_id: String(order.id),
      customer_id: customer,
      earned: earning.points,
      expired,
      available_at: availableAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
    const difference = earning.points - Number(order.old_earned || 0);
    if (difference)
      journal.push({
        customer_id: customer,
        kind: difference > 0 ? "earn" : "refund",
        points: difference,
        reference: String(order.id),
        detail:
          difference > 0
            ? "Eligible D2C merchandise"
            : "Order changed: earning adjusted",
      });
    const expiryDifference = expired - Number(order.expired || 0);
    if (expiryDifference)
      journal.push({
        customer_id: customer,
        kind: expiryDifference > 0 ? "expiry" : "expiry-adjustment",
        points: -expiryDifference,
        reference: String(order.id),
        detail:
          expiryDifference > 0
            ? "Unspent points expired"
            : "Expiry adjusted after an order change",
      });
  }
  if (lots.length)
    await tx`INSERT INTO gyvft_reward_lots(order_id,customer_id,earned,expired,available_at,expires_at)
  SELECT * FROM jsonb_to_recordset(${tx.json(lots)}) AS v(order_id text,customer_id text,earned integer,expired integer,available_at timestamptz,expires_at timestamptz)
  ON CONFLICT(order_id) DO UPDATE SET earned=excluded.earned,expired=excluded.expired,available_at=excluded.available_at,expires_at=excluded.expires_at,last_calculated_at=now()`;
  if (journal.length)
    await tx`INSERT INTO gyvft_reward_ledger(customer_id,kind,points,reference,detail)
  SELECT * FROM jsonb_to_recordset(${tx.json(journal)}) AS v(customer_id text,kind text,points integer,reference text,detail text)`;
}
export async function walletTotals(tx: Sql, customer: string) {
  const [row] =
    await tx`SELECT COALESCE(sum(earned-spent-held-expired),0)::int AS net, COALESCE(sum(held),0)::int AS held, COALESCE(sum(spent),0)::int AS spent FROM gyvft_reward_lots WHERE customer_id=${customer}`;
  return {
    available: Math.max(0, Number(row.net)),
    debt: Math.max(0, -Number(row.net)),
    reserved: Number(row.held),
    spent: Number(row.spent),
  };
}
export async function rewardWallet(customer: string) {
  return withTransaction(async (tx) => {
    await lockWallet(tx, customer);
    await reconcileEarnings(tx, customer);
    const totals = await walletTotals(tx, customer);
    const [pending] =
      await tx`SELECT COALESCE(sum(CASE WHEN paid_time>now()-interval '14 days' THEN basis ELSE 0 END),0)::bigint AS paise,COALESCE(sum(CASE WHEN paid_time<=now()-interval '14 days' THEN basis ELSE 0 END),0)::bigint AS mature_paise FROM (
      SELECT COALESCE(paid_at,updated_at) AS paid_time,CASE WHEN classification='excluded' THEN 0 WHEN reviewed_version=updated_at THEN reviewed_paise WHEN classification='d2c' THEN eligible_paise ELSE 0 END AS basis FROM gyvft_reward_orders WHERE customer_id=${customer} AND authorised
      ) earning_basis`;
    const history =
      await tx`SELECT kind,points,detail,created_at FROM gyvft_reward_ledger WHERE customer_id=${customer} ORDER BY id DESC LIMIT 30`;
    const coupons =
      await tx`SELECT id,kind,code,points,minimum_paise,state,expires_at FROM gyvft_reward_coupons WHERE customer_id=${customer} ORDER BY created_at DESC LIMIT 10`;
    const [dates] =
      await tx`SELECT birthday,anniversary,consent FROM gyvft_reward_dates WHERE customer_id=${customer}`;
    return {
      ...totals,
      pending: wholePoints(
        Number(pending.paise),
        wholePoints(Number(pending.mature_paise)).carryPaise,
      ).points,
      history: [...history],
      coupons: [...coupons],
      dates: dates || null,
    };
  });
}
export function fingerprint(rows: unknown) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
async function openingSnapshot(tx: Sql) {
  const rows =
    await tx`SELECT id,customer_id,email,updated_at,snapshot_hash,is_historical,authorised,
  (COALESCE(paid_at,updated_at)<=now()-interval '14 days') AS matured,
  COALESCE(CASE WHEN reviewed_version=updated_at AND classification!='excluded' THEN reviewed_paise END,CASE WHEN classification='d2c' THEN eligible_paise ELSE 0 END)::bigint AS basis
  FROM gyvft_reward_orders WHERE customer_id IS NOT NULL AND (authorised OR (is_historical AND (classification='d2c' OR reviewed_version=updated_at))) ORDER BY customer_id,created_at,id`;
  const candidates = rows.filter(
    (row) => row.is_historical && !row.authorised && row.matured,
  );
  const totals = new Map<string, { before: number; after: number }>();
  for (const row of rows) {
    const total = totals.get(row.customer_id) || { before: 0, after: 0 };
    if (row.matured) {
      total.after += Number(row.basis);
      if (row.authorised) total.before += Number(row.basis);
    }
    totals.set(row.customer_id, total);
  }
  let points = 0;
  for (const total of totals.values())
    points +=
      wholePoints(total.after).points - wholePoints(total.before).points;
  const wallets = [
    ...new Set(candidates.map((row) => String(row.customer_id))),
  ].map((customer) => {
    const orders = candidates.filter((row) => row.customer_id === customer),
      total = totals.get(customer)!;
    return {
      customerId: customer,
      email: String(orders[0].email || ""),
      orders: orders.length,
      eligiblePaise: orders.reduce((sum, row) => sum + Number(row.basis), 0),
      points:
        wholePoints(total.after).points - wholePoints(total.before).points,
    };
  });
  return { rows, candidates, points, wallets, hash: fingerprint(rows) };
}
export async function previewOpening() {
  await rewardSettings();
  return withTransaction(async (tx) => {
    const [settings] =
      await tx`SELECT * FROM gyvft_reward_settings WHERE id=true FOR UPDATE`;
    if (settings.sync_until || settings.lease_until || !settings.last_sync_at)
      throw rewardConflict(
        "Finish the Shopify scan before previewing opening points.",
      );
    const snapshot = await openingSnapshot(tx);
    const [result] = await tx<
      { id: string; order_count: number; points: number; created_at: string }[]
    >`INSERT INTO gyvft_reward_imports(id,state,fingerprint,order_ids,order_count,points) VALUES(gen_random_uuid(),'preview',${snapshot.hash},${snapshot.candidates.map((r) => r.id)},${snapshot.candidates.length},${snapshot.points}) RETURNING id,order_count,points,created_at`;
    return { ...result, fingerprint: snapshot.hash, wallets: snapshot.wallets };
  });
}
export async function applyOpening(id: string, expected: string) {
  await rewardSettings();
  return withTransaction(async (tx) => {
    const [settings] =
      await tx`SELECT * FROM gyvft_reward_settings WHERE id=true FOR UPDATE`;
    const [preview] =
      await tx`SELECT * FROM gyvft_reward_imports WHERE id=${id}::uuid FOR UPDATE`;
    if (!preview || preview.fingerprint !== expected)
      throw rewardConflict("Preview does not match.");
    if (preview.state === "applied") return { alreadyApplied: true };
    if (settings.sync_until || settings.lease_until)
      throw rewardConflict(
        "Finish the Shopify scan, then review a new preview.",
      );
    const snapshot = await openingSnapshot(tx);
    if (snapshot.hash !== expected)
      throw rewardConflict(
        "Orders changed since the preview. Review a fresh preview.",
      );
    await tx`UPDATE gyvft_reward_orders SET authorised=true,authorised_at=now() WHERE id=ANY(${preview.order_ids}::text[])`;
    await tx`UPDATE gyvft_reward_imports SET state='applied',applied_at=now() WHERE id=${id}::uuid`;
    const customers = [
      ...new Set(snapshot.candidates.map((r) => String(r.customer_id))),
    ].sort();
    await tx`SELECT customer_id FROM gyvft_reward_wallets WHERE customer_id=ANY(${customers}::text[]) ORDER BY customer_id FOR UPDATE`;
    await reconcileEarningsBatch(tx, customers);
    return {
      alreadyApplied: false,
      orders: snapshot.candidates.length,
      points: preview.points,
    };
  });
}

export async function refreshDueWallets(limit = 50) {
  const due =
    await getSql()`SELECT DISTINCT customer_id FROM gyvft_reward_lots WHERE (available_at<=now() AND last_calculated_at<available_at) OR (expires_at<=now() AND last_calculated_at<expires_at) LIMIT ${limit}`;
  const customers = due.map((row) => String(row.customer_id)).sort();
  await withTransaction(async (tx) => {
    await tx`SELECT customer_id FROM gyvft_reward_wallets WHERE customer_id=ANY(${customers}::text[]) ORDER BY customer_id FOR UPDATE`;
    await reconcileEarningsBatch(tx, customers);
  });
  return due.length;
}
