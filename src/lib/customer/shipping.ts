import "server-only";
import type { Sql } from "postgres";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";
import { getSql } from "@/lib/database/client";
import { ownedProject } from "./data";
import { isDemoAccount } from "./demo-accounts";
import { secureLink } from "./pilot-model";
import { queueNotification } from "./notifications";
import {
  requireShipping,
  shippingReady,
  shippingConfig,
  shippingError,
} from "./shipping-settings";
import {
  shipmentSchema,
  parcelSchema,
  deliveryAddressComplete,
  isDispatched,
  allocationMessage,
  type Shipment,
  type ShippingView,
} from "./shipping-model";
import {
  checkPin,
  createParcel,
  trackParcel,
  trackParcels,
  requestPickup,
  type Tracking,
} from "@/services/shipping/delhivery";
const uuid = z.string().uuid();
type ShippingProject = {
  id: string;
  kind: string;
  stage: number;
  total_paise: unknown;
  paid_paise: unknown;
  shopify_order_id?: string | null;
  shopify_order_reference?: string | null;
  is_draft: boolean;
  submission_key?: string | null;
  customer_account_id?: string | null;
  customer_email: string;
};
async function project(tx: Sql, id: string) {
  uuid.parse(id);
  const [p] = await tx<
    ShippingProject[]
  >`SELECT * FROM customer_projects WHERE id=${id}::uuid FOR UPDATE`;
  if (!p || p.is_draft) throw shippingError("Request unavailable.");
  if (
    String(p.submission_key || "").startsWith("gyvft-demo-") ||
    isDemoAccount(String(p.customer_account_id))
  )
    throw shippingError(
      "Fictional demo requests cannot book or record real shipments.",
    );
  return p;
}
async function seen(
  tx: Sql,
  request: string,
  op: string,
  p: string | null = null,
  s: string | null = null,
) {
  uuid.parse(request);
  const [prior] =
    await tx`SELECT operation,project_id,shipment_id FROM gyvft_shipping_events WHERE request_id=${request}::uuid`;
  if (
    prior &&
    (prior.operation !== op ||
      prior.project_id !== p ||
      prior.shipment_id !== s)
  )
    throw shippingError(
      "This action key was already used for another command.",
    );
  return !!prior;
}
async function audit(
  tx: Sql,
  r: string,
  op: string,
  p: string | null = null,
  s: string | null = null,
) {
  await tx`INSERT INTO gyvft_shipping_events(request_id,project_id,shipment_id,operation) VALUES(${r}::uuid,${p}::uuid,${s}::uuid,${op})`;
}
export async function shipmentsForProject(
  id: string,
  accountId?: string,
): Promise<ShippingView> {
  uuid.parse(id);
  if (accountId && !(await ownedProject(id, accountId)))
    throw shippingError("Request unavailable.");
  const sql = getSql();
  if (!(await shippingReady(sql)))
    return {
      available: false,
      plan: null,
      shipments: [],
      allocated: 0,
      dispatched: 0,
      delivered: 0,
      missing: 0,
    };
  const [p] =
    await sql`SELECT expected_sets,version FROM gyvft_shipping_plans WHERE project_id=${id}::uuid`;
  const rows = await sql<
    Shipment[]
  >`SELECT id,project_id,method,label,gift_sets,recipient_name,phone,address,city,state,postal_code,courier_name,tracking_reference,tracking_url,status,booking_state,provider_reference,provider_status,provider_time,pickup_state,pickup_reference,version,created_at,last_sync_at,dispatched_at,last_sync_error IS NOT NULL AS has_sync_issue FROM gyvft_shipments WHERE project_id=${id}::uuid AND archived_at IS NULL ORDER BY created_at,id`;
  return {
    available: true,
    plan: p ? { expected_sets: p.expected_sets, version: p.version } : null,
    shipments: rows,
    allocated: rows.reduce((n, s) => n + s.gift_sets, 0),
    dispatched: rows.filter(isDispatched).reduce((n, s) => n + s.gift_sets, 0),
    delivered: rows
      .filter((s) => ["delivered", "collected"].includes(s.status))
      .reduce((n, s) => n + s.gift_sets, 0),
    missing: rows.filter((s) => !deliveryAddressComplete(s)).length,
  };
}
export async function saveShippingPlan(input: unknown) {
  const d = z
    .object({
      project_id: uuid,
      expected_sets: z.number().int().min(1).max(100000),
      expected_version: z.number().int().min(0),
      request_id: uuid,
      confirmed_manifest: z.literal(true),
    })
    .strict()
    .parse(input);
  const sql = getSql();
  await requireShipping(sql);
  await sql.begin(async (raw) => {
    const tx = raw as unknown as Sql,
      p = await project(tx, d.project_id);
    if (await seen(tx, d.request_id, "plan", p.id)) return;
    if (p.stage >= 9)
      throw shippingError(
        "The order has already dispatched. Contact Operations to reconcile its manifest.",
      );
    const [plan] =
      await tx`SELECT * FROM gyvft_shipping_plans WHERE project_id=${p.id}::uuid`;
    if ((plan?.version || 0) !== d.expected_version)
      throw shippingError("The delivery plan changed. Reload before saving.");
    const [counts] =
      await tx`SELECT COALESCE(sum(gift_sets),0)::int AS allocated,count(*) FILTER(WHERE booking_state<>'draft' OR status<>'draft')::int AS committed FROM gyvft_shipments WHERE project_id=${p.id}::uuid AND archived_at IS NULL`;
    if (counts.committed && plan.expected_sets !== d.expected_sets)
      throw shippingError(
        "Shipments are committed. The confirmed gift-set total cannot change here.",
      );
    if (counts.allocated > d.expected_sets)
      throw shippingError(allocationMessage(d.expected_sets, counts.allocated));
    await tx`INSERT INTO gyvft_shipping_plans(project_id,expected_sets) VALUES(${p.id}::uuid,${d.expected_sets}) ON CONFLICT(project_id) DO UPDATE SET expected_sets=EXCLUDED.expected_sets,version=gyvft_shipping_plans.version+1`;
    await audit(tx, d.request_id, "plan", p.id);
  });
}
export async function saveShipment(input: unknown) {
  const d = shipmentSchema.parse(input),
    sql = getSql();
  await requireShipping(sql);
  await sql.begin(async (raw) => {
    const tx = raw as unknown as Sql,
      p = await project(tx, d.project_id);
    if (await seen(tx, d.request_id, "shipment", p.id, d.id)) return;
    if (p.stage >= 9)
      throw shippingError(
        "The order has already dispatched. Reconcile changes through Operations.",
      );
    const [plan] =
      await tx`SELECT expected_sets FROM gyvft_shipping_plans WHERE project_id=${p.id}::uuid`;
    if (!plan) throw shippingError("Confirm the number of gift sets first.");
    const [old] =
      await tx`SELECT * FROM gyvft_shipments WHERE id=${d.id}::uuid FOR UPDATE`;
    if (old && (old.project_id !== p.id || old.archived_at))
      throw shippingError("Shipment unavailable.");
    if ((old?.version || 0) !== d.expected_version)
      throw shippingError("The shipment changed. Reload before saving.");
    if (old && (old.booking_state !== "draft" || old.status !== "draft"))
      throw shippingError(
        "This shipment is committed. Its destination and quantity are locked.",
      );
    const [sum] =
      await tx`SELECT COALESCE(sum(gift_sets),0)::int AS n,count(*)::int AS count FROM gyvft_shipments WHERE project_id=${p.id}::uuid AND id<>${d.id}::uuid AND archived_at IS NULL`;
    if (sum.count >= 1000)
      throw shippingError("This order needs a reviewed bulk-delivery import.");
    if (sum.n + d.gift_sets > plan.expected_sets)
      throw shippingError(
        allocationMessage(plan.expected_sets, sum.n + d.gift_sets),
      );
    const saved =
      await tx`INSERT INTO gyvft_shipments(id,project_id,method,label,gift_sets,recipient_name,phone,address,city,state,postal_code,courier_name,provider_reference)
      VALUES(${d.id}::uuid,${p.id}::uuid,${d.method},${d.label},${d.gift_sets},${d.recipient_name},${d.phone},${d.address},${d.city},${d.state},${d.postal_code},${d.courier_name},${"g-" + d.id})
      ON CONFLICT(id) DO UPDATE SET method=EXCLUDED.method,label=EXCLUDED.label,gift_sets=EXCLUDED.gift_sets,recipient_name=EXCLUDED.recipient_name,phone=EXCLUDED.phone,address=EXCLUDED.address,city=EXCLUDED.city,state=EXCLUDED.state,postal_code=EXCLUDED.postal_code,courier_name=EXCLUDED.courier_name,version=gyvft_shipments.version+1,updated_at=now()
      WHERE gyvft_shipments.project_id=EXCLUDED.project_id AND gyvft_shipments.version=${d.expected_version} AND gyvft_shipments.booking_state='draft' AND gyvft_shipments.status='draft' AND gyvft_shipments.archived_at IS NULL RETURNING id`;
    if (!saved.length)
      throw shippingError(
        "This parcel was changed by another action. Reload before saving.",
      );
    await audit(tx, d.request_id, "shipment", p.id, d.id);
  });
}
async function shipment(tx: Sql, id: string, pid: string, expected?: number) {
  const [s] = await tx<
    Shipment[]
  >`SELECT * FROM gyvft_shipments WHERE id=${uuid.parse(id)}::uuid AND project_id=${pid}::uuid AND archived_at IS NULL FOR UPDATE`;
  if (!s) throw shippingError("Shipment unavailable.");
  if (expected !== undefined && s.version !== expected)
    throw shippingError("Shipment changed. Reload before continuing.");
  return s;
}
export async function archiveShipment(input: unknown) {
  const d = z
    .object({
      project_id: uuid,
      id: uuid,
      expected_version: z.number().int().positive(),
      request_id: uuid,
    })
    .strict()
    .parse(input);
  const sql = getSql();
  await requireShipping(sql);
  await sql.begin(async (raw) => {
    const tx = raw as unknown as Sql,
      p = await project(tx, d.project_id);
    if (await seen(tx, d.request_id, "archive", p.id, d.id)) return;
    const s = await shipment(tx, d.id, p.id, d.expected_version);
    if (s.status !== "draft" || s.booking_state !== "draft" || p.stage >= 9)
      throw shippingError(
        "Only an unbooked, undispatched parcel can be removed from the plan.",
      );
    await tx`UPDATE gyvft_shipments SET archived_at=now(),version=version+1,updated_at=now() WHERE id=${s.id}::uuid`;
    await audit(tx, d.request_id, "archive", p.id, s.id);
  });
}
async function readyToDispatch(tx: Sql, p: ShippingProject) {
  if (
    p.kind !== "project" ||
    p.stage < 8 ||
    !p.total_paise ||
    Number(p.paid_paise) < Number(p.total_paise) ||
    (!p.shopify_order_id && !p.shopify_order_reference)
  )
    throw shippingError(
      "Dispatch needs the official order, packing stage and full verified payment.",
    );
  const [a] =
    await tx`SELECT status FROM customer_project_approvals WHERE project_id=${p.id}::uuid AND kind='design' ORDER BY version DESC LIMIT 1`;
  if (a?.status !== "approved")
    throw shippingError("Approve the latest artwork before dispatch.");
  const [open] =
    await tx`SELECT id FROM gyvft_gift_changes WHERE project_id=${p.id}::uuid AND status='open' LIMIT 1`;
  if (open) throw shippingError("Resolve outstanding changes before dispatch.");
  const [r] =
    await tx`SELECT p.expected_sets,COALESCE(sum(s.gift_sets),0)::int AS allocated FROM gyvft_shipping_plans p LEFT JOIN gyvft_shipments s ON s.project_id=p.project_id AND s.archived_at IS NULL WHERE p.project_id=${p.id}::uuid GROUP BY p.expected_sets`;
  if (!r || r.expected_sets !== r.allocated)
    throw shippingError(
      r
        ? allocationMessage(r.expected_sets, r.allocated)
        : "Confirm the delivery plan first.",
    );
}
async function progress(tx: Sql, pid: string) {
  const [p] =
    await tx`SELECT * FROM customer_projects WHERE id=${pid}::uuid FOR UPDATE`;
  const [r] =
    await tx`SELECT p.expected_sets,COALESCE(sum(s.gift_sets),0)::int AS allocated,COALESCE(sum(s.gift_sets) FILTER(WHERE s.dispatched_at IS NOT NULL OR s.status IN ('in_transit','out_for_delivery','delivered','collected')),0)::int AS dispatched,COALESCE(sum(s.gift_sets) FILTER(WHERE s.status IN ('delivered','collected')),0)::int AS delivered FROM gyvft_shipping_plans p LEFT JOIN gyvft_shipments s ON s.project_id=p.project_id AND s.archived_at IS NULL WHERE p.project_id=${pid}::uuid GROUP BY p.expected_sets`;
  if (
    !r ||
    p.stage < 8 ||
    p.stage >= 11 ||
    r.allocated !== r.expected_sets ||
    Number(p.paid_paise) < Number(p.total_paise)
  )
    return;
  const stage =
    r.delivered === r.expected_sets
      ? 10
      : r.dispatched === r.expected_sets
        ? 9
        : Math.min(p.stage, 9);
  const next =
    stage === 10
      ? "Every shipment has been delivered or collected."
      : `${r.dispatched}/${r.expected_sets} gift sets dispatched · ${r.delivered}/${r.expected_sets} delivered or collected.`;
  await tx`UPDATE customer_projects SET stage=${stage},next_action=${next} WHERE id=${pid}::uuid`;
}
async function changed(tx: Sql, s: Shipment, status: string) {
  const [p] =
    await tx`SELECT customer_email FROM customer_projects WHERE id=${s.project_id}::uuid`;
  await queueNotification(
    tx,
    s.project_id,
    `shipment:${s.project_id}:${status}:${Math.floor(Date.now() / 300000)}`,
    "customer",
    p.customer_email,
    "GYVFT: your delivery plan has an update",
  );
  await progress(tx, s.project_id);
}
export async function manualShipmentStatus(input: unknown) {
  const d = z
    .object({
      project_id: uuid,
      id: uuid,
      expected_version: z.number().int().positive(),
      request_id: uuid,
      status: z.enum([
        "ready_for_pickup",
        "in_transit",
        "delivered",
        "collected",
        "exception",
        "returned",
      ]),
      tracking_reference: z.string().trim().max(160).default(""),
      tracking_url: z.string().trim().max(2000).default(""),
      confirmed: z.literal(true),
    })
    .strict()
    .parse(input);
  const sql = getSql();
  await requireShipping(sql);
  await sql.begin(async (raw) => {
    const tx = raw as unknown as Sql,
      p = await project(tx, d.project_id);
    if (await seen(tx, d.request_id, "manual_status", p.id, d.id)) return;
    const s = await shipment(tx, d.id, p.id, d.expected_version);
    if (s.method === "delhivery")
      throw shippingError(
        "Delhivery statuses come from its API. Use Refresh tracking or reconcile the booking.",
      );
    const allowed: Partial<Record<Shipment["status"], string[]>> =
      s.method === "pickup"
        ? {
            draft: ["ready_for_pickup"],
            ready_for_pickup: ["collected", "exception"],
            exception: ["ready_for_pickup"],
          }
        : {
            draft: ["in_transit"],
            in_transit: ["delivered", "exception", "returned"],
            exception: ["in_transit", "returned"],
          };
    if (!allowed[s.status]?.includes(d.status))
      throw shippingError("Choose the next valid shipment state.");
    if (!deliveryAddressComplete(s))
      throw shippingError("Complete this destination address/contact first.");
    if (d.status === "ready_for_pickup" && p.stage < 8)
      throw shippingError(
        "Complete production and packing before offering collection.",
      );
    if (["in_transit", "delivered", "collected"].includes(d.status))
      await readyToDispatch(tx, p);
    if (
      s.method !== "pickup" &&
      !(d.tracking_reference || s.tracking_reference)
    )
      throw shippingError("Add the courier booking/tracking reference.");
    const url = secureLink(d.tracking_url);
    if (url === null) throw shippingError("Use a valid HTTPS tracking link.");
    await tx`UPDATE gyvft_shipments SET status=${d.status},dispatched_at=CASE WHEN ${d.status} IN ('in_transit','delivered','collected') THEN COALESCE(dispatched_at,now()) ELSE dispatched_at END,booking_state='booked',tracking_reference=${d.tracking_reference || s.tracking_reference},tracking_url=${url || s.tracking_url},version=version+1,updated_at=now() WHERE id=${s.id}::uuid`;
    await audit(tx, d.request_id, "manual_status", p.id, s.id);
    await changed(tx, s, d.status);
  });
}
const shipmentAction = z.object({
  project_id: uuid,
  id: uuid,
  expected_version: z.number().int().positive(),
  request_id: uuid,
  confirmed: z.literal(true),
});
export async function bookDelhivery(input: unknown) {
  const raw = input as Record<string, unknown>,
    d = shipmentAction.parse(raw),
    parcel = parcelSchema.parse(raw.parcel),
    sql = getSql();
  await requireShipping(sql);
  const c = await shippingConfig("production");
  if (!c.enabled)
    throw shippingError(
      "Enable live Delhivery bookings in Operations Settings after testing the key and confirming the warehouse.",
    );
  const claimed = await sql.begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql,
      p = await project(tx, d.project_id);
    if (await seen(tx, d.request_id, "book_delhivery", p.id, d.id)) return null;
    const s = await shipment(tx, d.id, p.id, d.expected_version);
    if (s.method !== "delhivery" || s.booking_state !== "draft")
      throw shippingError(
        "Booking is already active or uncertain. Reconcile it instead of booking again.",
      );
    await readyToDispatch(tx, p);
    if (!deliveryAddressComplete(s))
      throw shippingError(
        "Complete the destination address/contact before booking.",
      );
    const [values] =
      await tx`SELECT COALESCE(sum((booking_document->>'declared_value_paise')::bigint),0) AS total FROM gyvft_shipments WHERE project_id=${p.id}::uuid AND id<>${s.id}::uuid AND booking_state<>'draft' AND archived_at IS NULL`;
    if (
      Number(values.total) + parcel.declared_value_paise >
      Number(p.total_paise)
    )
      throw shippingError(
        "Declared parcel values exceed the order total. Reconcile invoice allocations before booking.",
      );
    await tx`UPDATE gyvft_shipments SET booking_state='creating',booking_started_at=now(),provider_account=${c.client_name},booking_document=${tx.json(parcel)},version=version+1,updated_at=now() WHERE id=${s.id}::uuid`;
    await audit(tx, d.request_id, "book_delhivery", p.id, s.id);
    return s;
  });
  if (!claimed) return;
  let posted = false;
  try {
    const pin = await checkPin(c, claimed.postal_code);
    if (!pin.serviceable)
      throw shippingError(
        "This destination PIN is not currently serviceable for Delhivery prepaid parcels.",
      );
    posted = true;
    const awb = await createParcel(c, claimed, parcel);
    await sql`UPDATE gyvft_shipments SET booking_state='booked',status='booked',tracking_reference=${awb},provider_status='Manifested',version=version+1,updated_at=now() WHERE id=${claimed.id}::uuid AND booking_state='creating'`;
  } catch (error) {
    await sql`UPDATE gyvft_shipments SET booking_state=${posted ? "uncertain" : "draft"},version=version+1,updated_at=now() WHERE id=${claimed.id}::uuid AND booking_state='creating'`;
    if (posted)
      throw shippingError(
        "Delhivery booking was not confirmed. The parcel may have been created. Check booking by reference before taking any further action.",
      );
    throw error;
  }
}
async function applyTracking(s: Shipment, t: Tracking) {
  const sql = getSql();
  await sql.begin(async (raw) => {
    const tx = raw as unknown as Sql;
    await project(tx, s.project_id);
    const current = await shipment(tx, s.id, s.project_id);
    if (current.provider_account !== s.provider_account)
      throw shippingError(
        "The carrier account changed. Reconcile before updating tracking.",
      );
    if (
      current.provider_time &&
      t.provider_time &&
      Date.parse(t.provider_time) < new Date(current.provider_time).getTime()
    )
      return;
    if (
      current.status === "delivered" &&
      !["delivered", "returned"].includes(t.status)
    )
      return;
    if (current.provider_time && !t.provider_time) return;
    if (
      current.status !== "booked" &&
      t.status === "booked" &&
      !t.provider_time
    )
      return;
    await tx`UPDATE gyvft_shipments SET booking_state='booked',tracking_reference=${t.awb},status=${t.status},dispatched_at=CASE WHEN ${t.status} IN ('in_transit','out_for_delivery','delivered') THEN COALESCE(dispatched_at,now()) ELSE dispatched_at END,provider_status=${t.provider_status},provider_time=${t.provider_time}::timestamptz,last_sync_at=now(),last_sync_error=NULL,version=version+1,updated_at=now() WHERE id=${s.id}::uuid`;
    if (current.status !== t.status) await changed(tx, current, t.status);
  });
}
export async function refreshDelhivery(projectId: string, id: string) {
  const sql = getSql();
  await requireShipping(sql);
  const [s] = await sql<
    Shipment[]
  >`SELECT * FROM gyvft_shipments WHERE id=${uuid.parse(id)}::uuid AND project_id=${uuid.parse(projectId)}::uuid AND archived_at IS NULL`;
  if (!s || s.method !== "delhivery")
    throw shippingError("Delhivery shipment unavailable.");
  if (s.booking_state === "draft")
    throw shippingError("Book this parcel first.");
  const c = await shippingConfig("production");
  if (c.client_name !== s.provider_account)
    throw shippingError(
      "The saved carrier account differs from the booking account. Reconcile credentials before tracking.",
    );
  const t = await trackParcel(c, s.tracking_reference, s.provider_reference);
  if (!t)
    throw shippingError(
      "No booking was found yet. Check Delhivery One; this does not authorise a new booking.",
    );
  await applyTracking(s, t);
}
export async function scheduleDelhiveryPickup(input: unknown) {
  const d = z
    .object({
      project_id: uuid,
      ids: z.array(uuid).min(1).max(1000),
      request_id: uuid,
      confirmed: z.literal(true),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/),
      date: z.string().date(),
    })
    .strict()
    .parse(input);
  if (new Set(d.ids).size !== d.ids.length)
    throw shippingError("Select each parcel once.");
  const at = Date.parse(`${d.date}T${d.time}+05:30`);
  if (
    !Number.isFinite(at) ||
    at < Date.now() ||
    at > Date.now() + 14 * 86400000
  )
    throw shippingError(
      "Choose a valid future pickup time within 14 days (India time).",
    );
  const sql = getSql();
  await requireShipping(sql);
  const c = await shippingConfig("production");
  if (!c.enabled) throw shippingError("Live Delhivery bookings are disabled.");
  const selected = await sql.begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql,
      p = await project(tx, d.project_id);
    if (await seen(tx, d.request_id, "pickup", p.id)) return [];
    await readyToDispatch(tx, p);
    const rows = await tx<
      Shipment[]
    >`SELECT * FROM gyvft_shipments WHERE project_id=${p.id}::uuid AND id IN ${tx(d.ids)} AND archived_at IS NULL ORDER BY id FOR UPDATE`;
    if (
      rows.length !== d.ids.length ||
      rows.some(
        (s) =>
          s.method !== "delhivery" ||
          s.booking_state !== "booked" ||
          s.status !== "booked" ||
          s.pickup_state !== "none" ||
          s.provider_account !== c.client_name,
      )
    )
      throw shippingError(
        "A selected parcel is already moving or its booking/pickup needs reconciliation. Reload before scheduling.",
      );
    await tx`UPDATE gyvft_shipments SET pickup_state='requesting',version=version+1,updated_at=now() WHERE id IN ${tx(d.ids)}`;
    await audit(tx, d.request_id, "pickup", p.id);
    return rows;
  });
  if (!selected.length) return;
  try {
    const ref = await requestPickup(c, {
      date: d.date,
      time: d.time,
      packages: selected.length,
    });
    await sql`UPDATE gyvft_shipments SET pickup_state='requested',pickup_reference=${ref},version=version+1,updated_at=now() WHERE id IN ${sql(d.ids)} AND pickup_state='requesting'`;
  } catch {
    await sql`UPDATE gyvft_shipments SET pickup_state='uncertain',version=version+1,updated_at=now() WHERE id IN ${sql(d.ids)} AND pickup_state='requesting'`;
    throw shippingError(
      "Pickup request was not confirmed. Check the warehouse's existing requests in Delhivery One before scheduling another.",
    );
  }
}
/** Prevent the legacy whole-order controls from bypassing split quantities. */
export async function assertShippingProgress(
  tx: Sql,
  id: string,
  stage: number,
) {
  if (!(await shippingReady(tx))) return false;
  const [r] =
    await tx`SELECT p.expected_sets,COALESCE(sum(s.gift_sets),0)::int AS allocated,COALESCE(sum(s.gift_sets) FILTER(WHERE s.dispatched_at IS NOT NULL OR s.status IN ('in_transit','out_for_delivery','delivered','collected')),0)::int AS dispatched,COALESCE(sum(s.gift_sets) FILTER(WHERE s.status IN ('delivered','collected')),0)::int AS delivered FROM gyvft_shipping_plans p LEFT JOIN gyvft_shipments s ON s.project_id=p.project_id AND s.archived_at IS NULL WHERE p.project_id=${id}::uuid GROUP BY p.expected_sets`;
  if (!r) return false;
  if (
    r.allocated !== r.expected_sets ||
    (stage === 9 ? r.dispatched : r.delivered) !== r.expected_sets
  )
    throw shippingError(
      "The delivery plan is only partly fulfilled. Update the remaining destinations; do not mark the whole order dispatched or delivered.",
    );
  return true;
}

export async function refreshDueShipments(projectId?: string) {
  const sql = getSql();
  if (!(await shippingReady(sql))) return { checked: 0 };
  let c;
  try {
    c = await shippingConfig("production");
  } catch {
    return { checked: 0 };
  }
  const rows = await sql<
    Shipment[]
  >`UPDATE gyvft_shipments SET sync_claimed_at=now() WHERE id IN (
    SELECT id FROM gyvft_shipments WHERE method='delhivery' AND archived_at IS NULL AND booking_state='booked' AND status NOT IN ('delivered','returned')
    AND provider_account=${c.client_name} AND (${projectId || null}::uuid IS NULL OR project_id=${projectId || null}::uuid)
    AND (last_sync_at IS NULL OR last_sync_at<now()-interval '5 minutes') AND (sync_claimed_at IS NULL OR sync_claimed_at<now()-interval '5 minutes')
    ORDER BY last_sync_at NULLS FIRST,created_at LIMIT 20 FOR UPDATE SKIP LOCKED) RETURNING *`;
  if (!rows.length) return { checked: 0 };
  try {
    const result = await trackParcels(c, rows);
    for (const { shipment, tracking } of result) {
      try {
        if (!tracking) throw shippingError("Tracking temporarily unavailable.");
        await applyTracking(shipment, tracking);
      } catch {
        await sql`UPDATE gyvft_shipments SET last_sync_error='TRACKING_UPDATE_PENDING' WHERE id=${shipment.id}::uuid`;
      }
    }
  } catch {
    await sql`UPDATE gyvft_shipments SET last_sync_error='TRACKING_UPDATE_PENDING' WHERE id IN ${sql(rows.map((s) => s.id))}`;
    logger.warn("Carrier tracking update pending", {
      code: "DELHIVERY_TRACKING_PENDING",
    });
  }
  return { checked: rows.length };
}
