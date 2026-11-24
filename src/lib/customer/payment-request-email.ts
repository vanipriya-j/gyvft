import "server-only";
import type { Sql } from "postgres";
/** A payment request is a snapshot; changed quotes/receipts must not send stale asks. */
export async function paymentRequestEmail(sql: Sql, eventKey: string) {
  if (!eventKey?.startsWith("payment-request:")) return null;
  const [table] =
    await sql`SELECT to_regclass('gyvft_payment_requests')::text AS name`;
  if (!table?.name) return { superseded: true, text: "" };
  const id = eventKey.slice("payment-request:".length);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { superseded: true, text: "" };
  const [request] =
    await sql`SELECT r.*,p.paid_paise AS current_paid,p.total_paise AS current_total,p.stage,p.kind,p.customer_email,
    (SELECT id FROM customer_project_approvals a WHERE a.project_id=p.id AND a.kind='proposal' ORDER BY version DESC LIMIT 1) AS current_approval,
    (SELECT status FROM customer_project_approvals a WHERE a.id=r.approval_id) AS approval_status,
    (SELECT gift_selection_id FROM customer_project_approvals a WHERE a.id=r.approval_id) AS quote_selection,
    (SELECT id FROM gyvft_gift_selections s WHERE s.project_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1) AS current_selection,
    EXISTS(SELECT 1 FROM customer_payment_submissions s WHERE s.project_id=p.id AND s.status='pending') AS pending_payment
    FROM gyvft_payment_requests r JOIN customer_projects p ON p.id=r.project_id WHERE r.id=${id}::uuid`;
  if (!request) return { superseded: true, text: "" };
  const stale =
    !!request.superseded_at ||
    request.current_approval !== request.approval_id ||
    request.approval_status !== "approved" ||
    (request.current_selection &&
      request.current_selection !== request.quote_selection) ||
    Number(request.current_paid) !== Number(request.paid_paise) ||
    Number(request.current_total) !== Number(request.total_paise) ||
    request.pending_payment ||
    request.kind !== "project" ||
    (request.phase === "balance" && request.stage < 8);
  if (stale) {
    await sql`UPDATE gyvft_payment_requests SET superseded_at=COALESCE(superseded_at,now()) WHERE id=${id}::uuid`;
    return { superseded: true, text: "" };
  }
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://www.gyvft.com"
      : "http://localhost:3000");
  const url = new URL(
    `/account/projects/${request.project_id}?view=quote`,
    origin,
  );
  const due = (Number(request.amount_paise) / 100).toFixed(2),
    later = (
      (Number(request.total_paise) -
        Number(request.paid_paise) -
        Number(request.amount_paise)) /
      100
    ).toFixed(2);
  return {
    superseded: false,
    text: `Your GYVFT quote v${request.approval_version} is approved.\n\n${request.phase === "advance" ? `Pay ₹${due} as the advance. The remaining ₹${later} is due before dispatch.` : `Pay the remaining ₹${due} before dispatch.`}\n\nOpen your secure payment page to review the quote, scan the UPI QR or use the payment instructions:\n${url.href}\n\nAfter paying, submit the transaction reference and screenshot in GYVFT. Receipt is verified separately; please do not pay again while a submission is under review.\n\nYour story. Our telling.`,
  };
}
