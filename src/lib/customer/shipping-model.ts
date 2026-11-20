import { z } from "zod";
export const shippingMethods = {
  delhivery: "Delhivery",
  porter: "Porter",
  other: "Other courier",
  pickup: "Store pickup",
} as const;
export const shippingStates = {
  draft: "Details saved",
  booked: "Booked · awaiting pickup",
  ready_for_pickup: "Ready for collection",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  collected: "Collected",
  exception: "Delivery needs attention",
  returned: "Return to sender",
} as const;
export const pinSchema = z
  .string()
  .regex(/^[1-9]\d{5}$/, "Enter a valid six-digit PIN code.");
export const settingsSchema = z
  .object({
    environment: z.enum(["staging", "production"]),
    expected_version: z.number().int().min(0),
    api_key: z.string().trim().max(500).default(""),
    client_name: z.string().trim().min(2).max(100),
    warehouse_name: z.string().trim().min(2).max(100),
    origin_pin: pinSchema,
    seller_name: z.string().trim().min(2).max(160),
    seller_gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
        "Enter the seller GSTIN registered with Delhivery.",
      ),
    enabled: z.boolean(),
    request_id: z.string().uuid(),
  })
  .strict()
  .superRefine((s, c) => {
    if (s.api_key && !/^[A-Za-z0-9._-]{10,500}$/.test(s.api_key))
      c.addIssue({
        code: "custom",
        path: ["api_key"],
        message: "Check the Delhivery API token.",
      });
  });
export const shipmentSchema = z
  .object({
    id: z.string().uuid(),
    project_id: z.string().uuid(),
    expected_version: z.number().int().min(0),
    request_id: z.string().uuid(),
    method: z.enum(["delhivery", "porter", "other", "pickup"]),
    label: z.string().trim().min(2).max(120),
    gift_sets: z.number().int().min(1).max(100000),
    recipient_name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(40).default(""),
    address: z.string().trim().max(1500).default(""),
    city: z.string().trim().max(120).default(""),
    state: z.string().trim().max(120).default(""),
    postal_code: z.string().trim().max(6).default(""),
    courier_name: z.string().trim().max(100).default(""),
  })
  .strict()
  .superRefine((s, c) => {
    if (
      s.method !== "pickup" &&
      s.postal_code &&
      !pinSchema.safeParse(s.postal_code).success
    )
      c.addIssue({
        code: "custom",
        path: ["postal_code"],
        message:
          "Check the PIN code, or leave it blank while the address is pending.",
      });
    if (s.method === "other" && !s.courier_name)
      c.addIssue({
        code: "custom",
        path: ["courier_name"],
        message: "Enter the courier name.",
      });
  });
export function deliveryAddressComplete(
  s: Pick<
    Shipment,
    "method" | "phone" | "address" | "city" | "state" | "postal_code"
  >,
) {
  if (s.method === "pickup") return s.address.length >= 8;
  return (
    /^(?:91)?\d{10}$/.test(s.phone.replace(/\D/g, "")) &&
    s.address.length >= 8 &&
    s.city.length >= 2 &&
    s.state.length >= 2 &&
    pinSchema.safeParse(s.postal_code).success
  );
}
export const parcelSchema = z
  .object({
    weight_g: z.number().int().min(1).max(50000),
    length_cm: z.number().positive().max(250),
    width_cm: z.number().positive().max(250),
    height_cm: z.number().positive().max(250),
    declared_value_paise: z.number().int().positive().max(9999999999),
    description: z.string().trim().min(2).max(500),
    hsn_code: z
      .string()
      .trim()
      .regex(
        /^\d{4}(?:\d{2})?(?:\d{2})?(?:,\d{4}(?:\d{2})?(?:\d{2})?)*$/,
        "Enter invoice HSN codes separated by commas.",
      ),
    invoice_reference: z.string().trim().min(1).max(100),
    ewaybill: z
      .string()
      .trim()
      .regex(/^(?:\d{12})?$/)
      .default(""),
  })
  .strict()
  .superRefine((s, c) => {
    if (s.declared_value_paise >= 5000000 && !s.ewaybill)
      c.addIssue({
        code: "custom",
        path: ["ewaybill"],
        message:
          "Add the shipment e-waybill required by Delhivery for this declared value.",
      });
  });
export type Parcel = z.infer<typeof parcelSchema>;
export type Shipment = Omit<
  z.infer<typeof shipmentSchema>,
  "expected_version" | "request_id"
> & {
  status: keyof typeof shippingStates;
  booking_state: "draft" | "creating" | "booked" | "uncertain";
  tracking_reference: string;
  tracking_url: string;
  provider_reference: string;
  provider_status: string | null;
  provider_time: string | null;
  pickup_state: string;
  pickup_reference: string | null;
  version: number;
  created_at: string;
  last_sync_at: string | null;
  has_sync_issue?: boolean;
  dispatched_at?: string | null;
  provider_account?: string | null;
};
export type ShippingView = {
  available: boolean;
  plan: { expected_sets: number; version: number } | null;
  shipments: Shipment[];
  allocated: number;
  dispatched: number;
  delivered: number;
  missing: number;
};
export const isDispatched = (s: Shipment) =>
  Boolean(s.dispatched_at) ||
  ["in_transit", "out_for_delivery", "delivered", "collected"].includes(
    s.status,
  );
export function allocationMessage(expected: number, allocated: number) {
  return allocated === expected
    ? "All gift sets allocated."
    : allocated < expected
      ? `Allocate ${expected - allocated} more gift set${expected - allocated === 1 ? "" : "s"}.`
      : `Reduce allocations by ${allocated - expected} gift set${allocated - expected === 1 ? "" : "s"}.`;
}
export function carrierStatus(
  status: string,
  type: string,
): keyof typeof shippingStates {
  const s = status.trim().toLowerCase();
  if (type === "RT" || /rto|returned|dto|return/.test(s)) return "returned";
  if (s === "delivered" && type === "DL") return "delivered";
  if (/lost|damage|cancel|not delivered|undelivered|failed/.test(s))
    return "exception";
  if (s === "dispatched" || s === "out for delivery") return "out_for_delivery";
  if (/in transit|picked up|in-transit|collected/.test(s)) return "in_transit";
  if (["manifested", "pending", "scheduled"].includes(s)) return "booked";
  return "exception";
}
