import { z } from "zod";
export const lineItemSchema = z.object({
  name: z.string().trim().min(2).max(160),
  quantity: z.number().int().min(1).max(100000),
  unit_paise: z.number().int().min(0).max(999999999),
  item_type: z.enum(["gift", "fee"]),
  personalisation: z.string().trim().max(1000).default(""),
});
export type OrderItem = z.infer<typeof lineItemSchema>;
export function quoteTotal(items: OrderItem[]) {
  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_paise, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 9999999999)
    throw new Error("Enter a valid quote total.");
  return total;
}
export function secureLink(value: string) {
  if (!value) return "";
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      value.length <= 2000
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function productionAllowed(
  paid: number,
  total: number,
  designApproved: boolean,
) {
  return total > 0 && paid >= Math.ceil(total / 2) && designApproved;
}
export function dispatchAllowed(
  paid: number,
  total: number,
  designApproved: boolean,
  addressSaved: boolean,
  tracking: string,
) {
  return (
    total > 0 &&
    paid >= total &&
    designApproved &&
    addressSaved &&
    tracking.trim().length > 0
  );
}
export const deliverySchema = z.object({
  recipient_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(40),
  address: z.string().trim().min(8).max(1500),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  postal_code: z.string().regex(/^\d{6}$/, "Use an Indian six-digit PIN code."),
});
export type DeliveryAddress = z.infer<typeof deliverySchema>;
