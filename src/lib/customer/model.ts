export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const stages = [
  "Enquiry received",
  "Understanding your story",
  "Curation in progress",
  "Proposal shared",
  "Awaiting advance",
  "Design in progress",
  "Awaiting design approval",
  "Production",
  "Quality check & packing",
  "Dispatched",
  "Delivered",
  "Completed",
] as const;
export function paymentSummary(total: number, paid: number) {
  const advance = Math.ceil(total / 2);
  return {
    advance,
    advanceDue: Math.max(0, advance - paid),
    balance: Math.max(0, total - paid),
  };
}
export function safePaymentUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      [
        "rzp.io",
        "rzp.co",
        "pages.razorpay.com",
        "checkout.razorpay.com",
      ].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    paise / 100,
  );
