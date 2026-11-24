import "server-only";
import QRCode from "qrcode";
import { getSql } from "@/lib/database/client";
import { AgentOperationsError } from "./agent-operations";
import { milestonePayment } from "./agent-operations-model";
import { demoAccountIds } from "./demo-accounts";
export function upiPaymentUri(input: {
  upiId: string;
  payee: string;
  amountPaise: number;
  reference: string;
  note: string;
}) {
  if (
    !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}$/.test(input.upiId) ||
    !input.payee.trim() ||
    !Number.isSafeInteger(input.amountPaise) ||
    input.amountPaise <= 0
  )
    throw new AgentOperationsError(
      "Configure a valid receiving UPI account before generating a payment QR.",
    );
  const params = new URLSearchParams({
    pa: input.upiId,
    pn: input.payee,
    am: (input.amountPaise / 100).toFixed(2),
    cu: "INR",
    tr: input.reference,
    tn: input.note,
  });
  return "upi://pay?" + params.toString();
}
export async function paymentQrFor(
  projectId: string,
  accountId: string | null,
  operator = false,
) {
  const sql = getSql();
  const [p] =
    await sql`SELECT id,kind,total_paise,paid_paise,stage,upi_id,is_draft,submission_key,customer_account_id FROM customer_projects WHERE id=${projectId}::uuid AND (${operator} OR customer_account_id=${accountId}::uuid)`;
  if (
    !p ||
    p.is_draft ||
    p.kind !== "project" ||
    !p.total_paise ||
    String(p.submission_key || "").startsWith("gyvft-demo-") ||
    demoAccountIds.includes(p.customer_account_id)
  )
    throw new AgentOperationsError("Payment request unavailable.");
  const [quote] =
    await sql`SELECT id,version,status,gift_selection_id,amount_paise FROM customer_project_approvals WHERE project_id=${projectId}::uuid AND kind='proposal' ORDER BY version DESC LIMIT 1`;
  const [selection] =
    await sql`SELECT id FROM gyvft_gift_selections WHERE project_id=${projectId}::uuid ORDER BY created_at DESC,id DESC LIMIT 1`;
  const [pending] =
    await sql`SELECT id FROM customer_payment_submissions WHERE project_id=${projectId}::uuid AND status='pending' LIMIT 1`;
  if (
    quote?.status !== "approved" ||
    Number(quote.amount_paise) !== Number(p.total_paise) ||
    pending ||
    (selection && selection.id !== quote.gift_selection_id)
  )
    throw new AgentOperationsError(
      "Review the latest quote or pending payment before paying again.",
    );
  const total = Number(p.total_paise),
    paid = Number(p.paid_paise),
    phase = paid < Math.ceil(total / 2) ? "advance" : "balance",
    amount = milestonePayment(total, paid, phase);
  if (amount <= 0)
    throw new AgentOperationsError("This order has no outstanding payment.");
  const [settings] =
    await sql`SELECT upi_id,payee_name FROM gyvft_customer_upi_settings WHERE singleton=true`;
  const upiId = String(p.upi_id || settings?.upi_id || ""),
    payee =
      settings?.upi_id === upiId
        ? String(settings.payee_name || "GYVFT")
        : "GYVFT";
  const uri = upiPaymentUri({
    upiId,
    payee,
    amountPaise: amount,
    reference: `GY${projectId.replaceAll("-", "").slice(0, 20)}${phase === "advance" ? "A" : "B"}${quote.version}`,
    note: `GYVFT ${phase} quote v${quote.version}`,
  });
  return {
    uri,
    amountPaise: amount,
    phase,
    upiId,
    payee,
    png: await QRCode.toBuffer(uri, {
      type: "png",
      width: 360,
      margin: 4,
      errorCorrectionLevel: "M",
    }),
  };
}
