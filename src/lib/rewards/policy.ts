/** GYVFT is the calculation authority. All money entering this module is integer paise. */
export const rewardsPolicy = Object.freeze({
  version: "d2c-2026-11-v1",
  paisePerPoint: 5000,
  pointValuePaise: 100,
  holdDays: 14,
  expiryDays: 365,
  redemptionPercent: 25,
  celebrationPoints: 150,
  celebrationMinimumPaise: 150000,
});
export const dayMs = 86400000;
export function paise(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Invalid money");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result))
    throw new Error("Money exceeds supported range");
  return result;
}
export function wholePoints(eligiblePaise: number, carryPaise = 0) {
  if (
    ![eligiblePaise, carryPaise].every((v) => Number.isSafeInteger(v) && v >= 0)
  )
    throw new Error("Invalid earning basis");
  const total = eligiblePaise + carryPaise;
  return {
    points: Math.floor(total / rewardsPolicy.paisePerPoint),
    carryPaise: total % rewardsPolicy.paisePerPoint,
  };
}
export function minimumSpendPaise(points: number) {
  if (!Number.isSafeInteger(points) || points < 1 || points > 1000000)
    throw new Error("Choose a valid whole-point amount");
  return points * 400;
}
/** Month/day only: a customer's own dates, never a recipient's calendar. Kolkata calendar. */
export function celebrationWindow(monthDay: string, now = new Date()) {
  if (!/^\d{2}-\d{2}$/.test(monthDay)) throw new Error("Enter MM-DD");
  const [month, day] = monthDay.split("-").map(Number);
  const validation = new Date(Date.UTC(2000, month - 1, day));
  if (validation.getUTCMonth() !== month - 1 || validation.getUTCDate() !== day)
    throw new Error("Invalid date");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, mo, da] = today.split("-").map(Number);
  const midnight = Date.UTC(year, mo - 1, da);
  for (const eventYear of [year - 1, year, year + 1]) {
    // On non-leap years celebrate 29 February on 28 February.
    const event = Date.UTC(
      eventYear,
      month - 1,
      month === 2 &&
        day === 29 &&
        new Date(Date.UTC(eventYear, 1, 29)).getUTCMonth() === 2
        ? 28
        : day,
    );
    if (Math.abs(midnight - event) <= 7 * dayMs)
      return {
        year: eventYear,
        endsAt: new Date(event + 8 * dayMs - 19800000).toISOString(),
      };
  }
  return null;
}
export type OrderFact = {
  id: string;
  customer: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  status: string;
  source: string;
  test: boolean;
  cancelled: boolean;
  company: boolean;
  tags: string[];
  currency: string;
  paid: boolean;
  refunded: boolean;
  complete: boolean;
  eligiblePaise: number;
  catalogue: boolean;
  codes: string[];
};
export function classifyOrder(order: OrderFact): {
  classification: "d2c" | "excluded" | "review";
  reason: string;
  eligiblePaise: number;
} {
  const excluded = (reason: string) => ({
    classification: "excluded" as const,
    reason,
    eligiblePaise: 0,
  });
  const review = (reason: string) => ({
    classification: "review" as const,
    reason,
    eligiblePaise: 0,
  });
  if (
    order.test ||
    order.cancelled ||
    order.company ||
    order.tags.some((t) =>
      /^(wholesale|b2b|gyvft-custom|gyvft-order)(?:$|[-_:])/i.test(t),
    )
  )
    return excluded("Test, cancelled or business/custom order");
  if (order.codes.some((code) => /^GYVFT(R|B|A)-/i.test(code)))
    return excluded("Benefit redemption: no points earned on this order");
  if (!order.customer || !order.email)
    return review("Customer identity missing");
  if (order.currency !== "INR") return review("Non-INR order");
  if (!order.paid) return excluded("Not fully paid");
  if (!order.paidAt) return review("Successful payment timestamp needs review");
  if (!order.complete) return review("Incomplete line or discount snapshot");
  if (order.refunded)
    return review(
      "Refund: review the retained merchandise amount before earning",
    );
  if (
    !["web", "pos", "android", "iphone"].includes(order.source) ||
    !order.catalogue
  )
    return review("Confirm retail classification and merchandise amount");
  return {
    classification: "d2c",
    reason: "Paid retail merchandise",
    eligiblePaise: order.eligiblePaise,
  };
}
