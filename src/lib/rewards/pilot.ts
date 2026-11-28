import "server-only";
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { getSql, withTransaction } from "@/lib/database/client";
import { hashCustomerPassword, newOpaqueToken } from "@/lib/customer/password";
import { demoAccountIds } from "@/lib/customer/demo-accounts";
import {
  REWARD_CUSTOMER,
  REWARD_ORDER_FIELDS,
  ensureRewardConnection,
  RewardConnectionError,
  rewardOrderFact,
  rewardsShopify,
  type RawRewardOrder,
} from "@/services/shopify/rewards";
import { classifyOrder, wholePoints } from "./policy";
import {
  fingerprint,
  lockWallet,
  openingSnapshot,
  reconcileEarnings,
  rewardConflict,
  rewardSettings,
  type Settings,
} from "./store";
import {
  pilotCustomerSchema,
  type PilotCustomer,
  type PilotPreview,
} from "./pilot-model";

export const PILOT_ORDERS =
  `query GYVFTPilotRewardOrders($query:String!,$after:String,$collectionId:ID!) {
  orders(first:10,after:$after,query:$query,sortKey:UPDATED_AT) {
    pageInfo { hasNextPage endCursor } nodes { ...GYVFTRewardOrder }
  }
}` + REWARD_ORDER_FIELDS;

export async function pilotStatus() {
  const [tables] = await getSql()`SELECT
    to_regclass('gyvft_customer_accounts') IS NOT NULL AND
    to_regclass('gyvft_customer_profiles') IS NOT NULL AND
    to_regclass('gyvft_operations_intakes') IS NOT NULL AND
    to_regclass('gyvft_reward_settings') IS NOT NULL AS ready`;
  if (!tables.ready)
    throw rewardConflict(
      "Required customer intake or rewards tables are missing. Check /setup/operations-intake and /setup/rewards. This page does not run migrations.",
    );
  const settings = await rewardSettings();
  if (!settings.collection_id)
    throw rewardConflict(
      "Choose and save the eligible retail collection in Operations → Rewards first. The programme may remain off during this test.",
    );
  return { enabled: settings.enabled, collection: settings.collection_id };
}

async function fetchCustomerOrders(
  customer: PilotCustomer,
  collectionId: string,
) {
  try {
    await ensureRewardConnection();
  } catch (e) {
    if (e instanceof RewardConnectionError) throw rewardConflict(e.message);
    throw rewardConflict(
      "Shopify connection could not be checked. Nothing was saved.",
    );
  }
  const identity = await rewardsShopify<{
    customer: {
      id: string;
      defaultEmailAddress: { emailAddress: string } | null;
    } | null;
  }>(REWARD_CUSTOMER, { id: customer.shopifyCustomerId });
  if (
    identity.customer?.id !== customer.shopifyCustomerId ||
    identity.customer.defaultEmailAddress?.emailAddress.toLowerCase() !==
      customer.email
  )
    throw rewardConflict(
      "Shopify customer email changed or is missing. Check the selected customer before importing.",
    );
  const orders: RawRewardOrder[] = [];
  let after: string | null = null;
  const start = Date.now();
  for (let page = 0; page < 10; page++) {
    const result: {
      orders: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: RawRewardOrder[];
      };
    } = await rewardsShopify(PILOT_ORDERS, {
      query: `customer_id:${customer.shopifyCustomerId.split("/").at(-1)}`,
      after,
      collectionId,
    });
    for (const raw of result.orders.nodes) {
      if (
        raw.customer?.id !== customer.shopifyCustomerId ||
        raw.customer.defaultEmailAddress?.emailAddress.toLowerCase() !==
          customer.email ||
        orders.some((o) => o.id === raw.id)
      )
        throw rewardConflict(
          "Shopify returned a changed or repeated customer order. Nothing was saved.",
        );
      orders.push(raw);
    }
    if (!result.orders.pageInfo.hasNextPage) return orders;
    if (
      !result.orders.pageInfo.endCursor ||
      result.orders.pageInfo.endCursor === after ||
      Date.now() - start > 25000
    )
      break;
    after = result.orders.pageInfo.endCursor;
  }
  throw rewardConflict(
    "Customer history exceeds this test's bounded scan. Nothing was saved; use the full rewards workflow for this customer.",
  );
}

/** Holds settings, wallet and account locks; no provider/network work happens in this transaction. */
async function stageAndPreview(
  tx: Sql,
  customer: PilotCustomer,
  raw: RawRewardOrder[],
  settings: Settings,
) {
  const [current] =
    await tx`SELECT * FROM gyvft_reward_settings WHERE id=true FOR UPDATE`;
  if (
    current.collection_id !== settings.collection_id ||
    current.revision !== settings.revision ||
    current.sync_until ||
    (current.lease_until &&
      new Date(current.lease_until).getTime() > Date.now())
  )
    throw rewardConflict(
      "Rewards settings or scan changed. Finish the scan and check this customer again.",
    );
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${"customer-pilot:" + customer.email},0))`;
  const [account] =
    await tx`SELECT id,email,is_active,updated_at FROM gyvft_customer_accounts WHERE email=${customer.email} FOR UPDATE`;
  if (
    account &&
    (!account.is_active || demoAccountIds.includes(String(account.id)))
  )
    throw rewardConflict(
      "This email belongs to an inactive or demo account. Nothing was saved.",
    );
  const [wallet] =
    await tx`SELECT email,account_id FROM gyvft_reward_wallets WHERE customer_id=${customer.shopifyCustomerId} FOR UPDATE`;
  if (
    wallet &&
    (wallet.email !== customer.email ||
      (wallet.account_id && wallet.account_id !== account?.id))
  )
    throw rewardConflict(
      "The existing wallet identity needs review. No wallet was reassigned.",
    );
  await tx`INSERT INTO gyvft_reward_wallets(customer_id,email) VALUES(${customer.shopifyCustomerId},${customer.email}) ON CONFLICT(customer_id) DO NOTHING`;
  await lockWallet(tx, customer.shopifyCustomerId);
  const reviews: { id: string; reason: string }[] = [];
  let excluded = 0;
  for (const order of raw) {
    const fact = rewardOrderFact(order),
      classified = classifyOrder(fact);
    const hash = fingerprint(fact);
    const [prior] =
      await tx`SELECT o.*,l.customer_id AS lot_customer FROM gyvft_reward_orders o LEFT JOIN gyvft_reward_lots l ON l.order_id=o.id WHERE o.id=${fact.id} FOR UPDATE OF o`;
    if (
      prior &&
      (prior.customer_id !== customer.shopifyCustomerId ||
        (prior.lot_customer &&
          prior.lot_customer !== customer.shopifyCustomerId) ||
        (prior.authorised && prior.snapshot_hash !== hash))
    )
      throw rewardConflict(
        "An existing credited order changed. Reconcile it in Operations Rewards before this test; existing credits were preserved.",
      );
    if (classified.classification === "review")
      reviews.push({ id: fact.id, reason: classified.reason });
    if (classified.classification === "excluded") excluded++;
    await tx`INSERT INTO gyvft_reward_orders(id,customer_id,email,created_at,paid_at,updated_at,classification,reason,eligible_paise,codes,snapshot_hash,is_historical,authorised)
      VALUES(${fact.id},${fact.customer},${fact.email},${fact.createdAt},${fact.paidAt},${fact.updatedAt},${classified.classification},${classified.reason},${classified.eligiblePaise},${fact.codes},${hash},true,false)
      ON CONFLICT(id) DO UPDATE SET paid_at=excluded.paid_at,updated_at=excluded.updated_at,classification=excluded.classification,reason=excluded.reason,eligible_paise=excluded.eligible_paise,codes=excluded.codes,snapshot_hash=excluded.snapshot_hash,synced_at=now()
      WHERE NOT gyvft_reward_orders.authorised`;
  }
  const snapshot = await openingSnapshot(
    tx,
    [customer.shopifyCustomerId],
    raw.map((o) => o.id),
    true,
  );
  const matureBasis = snapshot.rows
    .filter((r) => r.matured)
    .reduce((sum, r) => sum + Number(r.basis), 0);
  const totalBasis = snapshot.rows.reduce((sum, r) => sum + Number(r.basis), 0);
  // Version/identity and live order facts are bound to the review, including excluded orders.
  const hash = fingerprint({
    version: "customer-pilot-v1",
    customer,
    settings: {
      collection: current.collection_id,
      revision: current.revision,
      enabled: current.enabled,
    },
    account: account || null,
    wallet: wallet || null,
    facts: raw.map(rewardOrderFact).sort((a, b) => a.id.localeCompare(b.id)),
    snapshot: snapshot.hash,
  });
  return {
    snapshot,
    account,
    hash,
    preview: {
      customer,
      account: account ? "preserve" : "create",
      orders: raw.length,
      points: snapshot.points,
      pendingPoints:
        wholePoints(totalBasis).points - wholePoints(matureBasis).points,
      review: reviews,
      excluded,
      enabled: current.enabled,
    } as Omit<PilotPreview, "id" | "fingerprint">,
  };
}

class RolledBackPreview extends Error {
  constructor(readonly result: PilotPreview) {
    super("Preview rolled back");
  }
}
export async function previewPilotCustomer(
  input: unknown,
): Promise<PilotPreview> {
  const customer = pilotCustomerSchema.parse(input);
  await pilotStatus();
  const settings = await rewardSettings();
  const orders = await fetchCustomerOrders(customer, settings.collection_id!);
  try {
    await withTransaction(async (tx) => {
      const check = await stageAndPreview(tx, customer, orders, settings);
      throw new RolledBackPreview({
        ...check.preview,
        id: randomUUID(),
        fingerprint: check.hash,
      });
    });
  } catch (e) {
    if (e instanceof RolledBackPreview) return e.result;
    throw e;
  }
  throw Error("Preview transaction unexpectedly committed");
}

export async function applyPilotCustomer(
  input: unknown,
  id: string,
  expected: string,
) {
  const customer = pilotCustomerSchema.parse(input);
  await pilotStatus();
  // A confirmed replay does not require Shopify availability and never awards twice.
  const prior = await appliedResult(getSql(), customer, id, expected);
  if (prior) return prior;
  const settings = await rewardSettings();
  const orders = await fetchCustomerOrders(customer, settings.collection_id!);
  const passwordHash = await hashCustomerPassword(newOpaqueToken());
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${"pilot-apply:" + id},0))`;
    const replay = await appliedResult(tx, customer, id, expected);
    if (replay) return replay;
    const check = await stageAndPreview(tx, customer, orders, settings);
    if (check.hash !== expected)
      throw rewardConflict(
        "Customer or orders changed after the check. Nothing was saved; check this customer again.",
      );
    let accountId = check.account?.id;
    if (!accountId) {
      const [created] =
        await tx`INSERT INTO gyvft_customer_accounts(email,password_hash) VALUES(${customer.email},${passwordHash}) ON CONFLICT(email) DO NOTHING RETURNING id`;
      if (!created)
        throw rewardConflict(
          "An account was just created for this email. Check it again to preserve that account.",
        );
      accountId = created.id;
      await tx`INSERT INTO gyvft_customer_profiles(account_id,name) VALUES(${accountId}::uuid,${customer.name})`;
    }
    await tx`INSERT INTO gyvft_operations_intakes(id,account_id,created_account,input_hash) VALUES(${id}::uuid,${accountId}::uuid,${!check.account},${expected})`;
    const orderIds = check.snapshot.candidates.map((o) => String(o.id));
    await tx`UPDATE gyvft_reward_orders SET authorised=true,authorised_at=now() WHERE id=ANY(${orderIds}::text[]) AND customer_id=${customer.shopifyCustomerId} AND NOT authorised`;
    await reconcileEarnings(tx, customer.shopifyCustomerId);
    await tx`INSERT INTO gyvft_reward_imports(id,state,fingerprint,order_ids,order_count,points,applied_at) VALUES(${id}::uuid,'applied',${expected},${orderIds},${orderIds.length},${check.preview.points},now())`;
    await tx`INSERT INTO gyvft_reward_ledger(customer_id,kind,points,reference,detail) VALUES(${customer.shopifyCustomerId},'pilot-import',0,${id},'Owner-approved customer and Shopify opening rewards test; no invitation or welcome bonus.')`;
    // Do not bind/verify wallets by an operator-supplied email. The customer verifies ownership.
    return {
      alreadyApplied: false,
      accountId: String(accountId),
      createdAccount: !check.account,
      points: check.preview.points,
      pendingPoints: check.preview.pendingPoints,
    };
  });
}
async function appliedResult(
  tx: Sql,
  customer: PilotCustomer,
  id: string,
  expected: string,
) {
  const [prior] =
    await tx`SELECT r.fingerprint,r.points,i.account_id,i.created_account,a.email,
    EXISTS(SELECT 1 FROM gyvft_reward_ledger l WHERE l.reference=r.id::text AND l.kind='pilot-import' AND l.customer_id=${customer.shopifyCustomerId}) AS matched
    FROM gyvft_reward_imports r JOIN gyvft_operations_intakes i ON i.id=r.id JOIN gyvft_customer_accounts a ON a.id=i.account_id
    WHERE r.id=${id}::uuid AND r.state='applied'`;
  if (!prior) return null;
  if (
    prior.fingerprint !== expected ||
    prior.email !== customer.email ||
    !prior.matched
  )
    throw rewardConflict(
      "This apply key belongs to a different reviewed customer.",
    );
  return {
    alreadyApplied: true,
    accountId: String(prior.account_id),
    createdAccount: !!prior.created_account,
    points: Number(prior.points),
  };
}
