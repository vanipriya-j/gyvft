import "server-only";
import {
  carrierStatus,
  type Parcel,
  type Shipment,
} from "@/lib/customer/shipping-model";
export type DelhiveryConfig = {
  environment: "staging" | "production";
  token: string;
  client_name: string;
  warehouse_name: string;
  origin_pin: string;
  seller_name: string;
  seller_gstin: string;
  enabled: boolean;
  version: number;
};
export class DelhiveryError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const base = (c: DelhiveryConfig) =>
  c.environment === "production"
    ? "https://track.delhivery.com"
    : "https://staging-express.delhivery.com";
async function api(
  c: DelhiveryConfig,
  path: string,
  form?: Record<string, string>,
  json?: unknown,
) {
  let response: Response;
  try {
    response = await fetch(base(c) + path, {
      method: form || json ? "POST" : "GET",
      headers: {
        Authorization: `Token ${c.token}`,
        "Content-Type": form
          ? "application/x-www-form-urlencoded"
          : "application/json",
      },
      body: form
        ? new URLSearchParams(form).toString()
        : json
          ? JSON.stringify(json)
          : undefined,
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new DelhiveryError("DELHIVERY_CONNECTION_UNCONFIRMED");
  }
  if (!response.ok)
    throw new DelhiveryError(`DELHIVERY_HTTP_${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new DelhiveryError("DELHIVERY_EMPTY_RESPONSE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024 * 1024) {
      await reader.cancel();
      throw new DelhiveryError("DELHIVERY_RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString()) as Record<
      string,
      unknown
    >;
  } catch {
    throw new DelhiveryError("DELHIVERY_INVALID_RESPONSE");
  }
}
export async function checkPin(c: DelhiveryConfig, pin: string) {
  const data = await api(
    c,
    `/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pin)}`,
  );
  const rows = data.delivery_codes;
  if (!Array.isArray(rows))
    throw new DelhiveryError("DELHIVERY_INVALID_RESPONSE");
  const row = rows.find(
    (r) => String(r?.postal_code?.pin) === pin,
  )?.postal_code;
  return {
    serviceable:
      !!row && row.pre_paid === "Y" && !String(row.remarks || "").trim(),
    city: typeof row?.city === "string" ? row.city.slice(0, 120) : "",
  };
}
export function manifestPayload(c: DelhiveryConfig, s: Shipment, p: Parcel) {
  const phone = s.phone
    .replace(/[^0-9]/g, "")
    .replace(/^(?:91)?(\d{10})$/, "$1");
  if (!/^\d{10}$/.test(phone))
    throw new DelhiveryError("DELHIVERY_PHONE_INVALID");
  return {
    shipments: [
      {
        client: c.client_name,
        name: s.recipient_name,
        add: s.address,
        pin: s.postal_code,
        city: s.city,
        state: s.state,
        country: "India",
        phone,
        order: s.provider_reference,
        payment_mode: "Prepaid",
        cod_amount: "0",
        products_desc: p.description,
        total_amount: (p.declared_value_paise / 100).toFixed(2),
        quantity: String(s.gift_sets),
        seller_name: c.seller_name,
        seller_gst_tin: c.seller_gstin,
        hsn_code: p.hsn_code,
        seller_inv: p.invoice_reference,
        invoice_reference: p.invoice_reference,
        weight: String(p.weight_g),
        shipment_length: String(p.length_cm),
        shipment_width: String(p.width_cm),
        shipment_height: String(p.height_cm),
        shipping_mode: "Surface",
        ...(p.ewaybill ? { ewbn: p.ewaybill } : {}),
      },
    ],
    pickup_location: { name: c.warehouse_name },
  };
}
export async function createParcel(c: DelhiveryConfig, s: Shipment, p: Parcel) {
  const data = await api(c, "/api/cmu/create.json", {
    format: "json",
    data: JSON.stringify(manifestPayload(c, s, p)),
  });
  const packages = data.packages;
  const row =
    Array.isArray(packages) && packages.length === 1 ? packages[0] : null;
  if (
    data.success !== true ||
    !row ||
    String(row.status).toLowerCase() !== "success" ||
    !/^\d{8,30}$/.test(String(row.waybill)) ||
    (row.refnum && row.refnum !== s.provider_reference)
  )
    throw new DelhiveryError("DELHIVERY_MANIFEST_UNCONFIRMED");
  return String(row.waybill);
}
export type Tracking = {
  awb: string;
  reference: string;
  status: Shipment["status"];
  provider_status: string;
  provider_time: string | null;
};
export async function trackParcel(
  c: DelhiveryConfig,
  awb: string,
  reference: string,
): Promise<Tracking | null> {
  const data = await api(
    c,
    `/api/v1/packages/json/?${new URLSearchParams(awb ? { waybill: awb } : { ref_ids: reference })}`,
  );
  return parseTracking(data, awb, reference);
}
export function parseTracking(
  data: Record<string, unknown>,
  awb: string,
  reference: string,
  allowMissing = false,
): Tracking | null {
  const rows = data.ShipmentData;
  if (!Array.isArray(rows))
    throw new DelhiveryError("DELHIVERY_TRACKING_UNCONFIRMED");
  if (rows.length === 0) return null;
  const matches = rows
    .map((r) => r?.Shipment)
    .filter(
      (s) =>
        s &&
        (awb ? String(s.AWB) === awb : String(s.ReferenceNo) === reference),
    );
  if (matches.length === 0 && allowMissing) return null;
  if (matches.length !== 1)
    throw new DelhiveryError("DELHIVERY_TRACKING_MISMATCH");
  const s = matches[0],
    info = s.Status;
  if (
    !/^\d{8,30}$/.test(String(s.AWB)) ||
    !info ||
    typeof info.Status !== "string" ||
    (s.ReferenceNo && String(s.ReferenceNo) !== reference)
  )
    throw new DelhiveryError("DELHIVERY_TRACKING_MISMATCH");
  // Delhivery's timestamps without an offset are interpreted in India time.
  const raw = String(info.StatusDateTime || "");
  const value =
    raw &&
    /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(
      raw,
    )
      ? raw.replace(" ", "T") +
        (/[Zz]|[+-]\d\d:\d\d$/.test(raw) ? "" : "+05:30")
      : "";
  return {
    awb: String(s.AWB),
    reference,
    status: carrierStatus(info.Status, String(info.StatusType || "")),
    provider_status: info.Status.slice(0, 160),
    provider_time:
      value && Number.isFinite(Date.parse(value))
        ? new Date(value).toISOString()
        : null,
  };
}
export async function trackParcels(c: DelhiveryConfig, rows: Shipment[]) {
  if (!rows.length || rows.length > 20)
    throw new DelhiveryError("DELHIVERY_BATCH_INVALID");
  const data = await api(
    c,
    `/api/v1/packages/json/?${new URLSearchParams({ waybill: rows.map((s) => s.tracking_reference).join(",") })}`,
  );
  return rows.map((s) => ({
    shipment: s,
    tracking: parseTracking(
      data,
      s.tracking_reference,
      s.provider_reference,
      true,
    ),
  }));
}
export async function requestPickup(
  c: DelhiveryConfig,
  input: { date: string; time: string; packages: number },
) {
  const data = await api(c, "/fm/request/new/", undefined, {
    pickup_time: input.time,
    pickup_date: input.date,
    pickup_location: c.warehouse_name,
    expected_package_count: input.packages,
  });
  const id = data.pickup_id ?? data.pr_id;
  if (!id || (typeof id !== "string" && typeof id !== "number"))
    throw new DelhiveryError("DELHIVERY_PICKUP_UNCONFIRMED");
  return String(id).slice(0, 100);
}
