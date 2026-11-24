import "server-only";
import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { journeyProject } from "./journeys";
import { demoAccountIds } from "./demo-accounts";
import {
  paymentRequestSchema,
  milestonePayment,
} from "./agent-operations-model";
import {
  AgentOperationsError,
  requireAgentOperations,
} from "./agent-operations";
import { queueNotification } from "./notifications";
import { paymentRequestEmail } from "./payment-request-email";

export async function requestCustomerPayment(raw: unknown) {
  const input = paymentRequestSchema.parse(raw),
    sql = getSql();
  await requireAgentOperations(sql);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return sql.begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql,
      p = await journeyProject(tx, input.project_id);
    if (
      p.is_draft ||
      String(p.submission_key || "").startsWith("gyvft-demo-") ||
      demoAccountIds.includes(p.customer_account_id)
    )
      throw new AgentOperationsError("Choose a submitted customer request.");
    const [prior] =
      await tx`SELECT * FROM gyvft_payment_requests WHERE id=${input.request_id}::uuid`;
    if (prior) {
      if (prior.project_id !== input.project_id || prior.input_hash !== hash)
        throw new AgentOperationsError(
          "This payment-request key belongs to different data.",
        );
      return {
        id: prior.id,
        amount_inr: Number(prior.amount_paise) / 100,
        phase: prior.phase,
        duplicate: true,
      };
    }
    const [q] =
      await tx`SELECT id,version,status,gift_selection_id,amount_paise FROM customer_project_approvals WHERE project_id=${input.project_id}::uuid AND kind='proposal' ORDER BY version DESC LIMIT 1`;
    const [selection] =
      await tx`SELECT id FROM gyvft_gift_selections WHERE project_id=${input.project_id}::uuid ORDER BY created_at DESC,id DESC LIMIT 1`;
    if (
      p.kind !== "project" ||
      !p.total_paise ||
      q?.status !== "approved" ||
      Number(q.amount_paise) !== Number(p.total_paise) ||
      q.id !== input.approval_id ||
      Number(q.version) !== input.expected_version ||
      (selection && q.gift_selection_id !== selection.id)
    )
      throw new AgentOperationsError(
        "Read the latest approved quote before requesting payment.",
      );
    const [pending] =
      await tx`SELECT id FROM customer_payment_submissions WHERE project_id=${input.project_id}::uuid AND status='pending' LIMIT 1`;
    if (pending)
      throw new AgentOperationsError(
        "Payment proof is awaiting verification. Review it before asking the customer to pay again.",
      );
    const total = Number(p.total_paise),
      paid = Number(p.paid_paise),
      amount = milestonePayment(total, paid, input.phase);
    if (
      input.phase === "balance" &&
      (paid < Math.ceil(total / 2) || p.stage < 8)
    )
      throw new AgentOperationsError(
        "Request the balance once the advance is verified and the order is packed for dispatch.",
      );
    if (amount <= 0)
      throw new AgentOperationsError("No payment is due for this milestone.");
    if (
      amount !== input.expected_due_paise ||
      paid !== input.expected_paid_paise
    )
      throw new AgentOperationsError(
        "The amount due changed. Read the latest payment position before sending.",
      );
    const [settings] =
      await tx`SELECT upi_id,payee_name FROM gyvft_customer_upi_settings WHERE singleton=true`;
    if (!(p.upi_id || settings?.upi_id || p.razorpay_url))
      throw new AgentOperationsError(
        "Configure the receiving UPI account or a payment link in Operations first.",
      );
    await tx`INSERT INTO gyvft_payment_requests(id,project_id,approval_id,approval_version,phase,amount_paise,paid_paise,total_paise,input_hash) VALUES(${input.request_id}::uuid,${input.project_id}::uuid,${q.id}::uuid,${q.version},${input.phase},${amount},${paid},${total},${hash})`;
    const email = await paymentRequestEmail(
      tx,
      "payment-request:" + input.request_id,
    );
    if (!email || email.superseded)
      throw new AgentOperationsError(
        "The payment position changed. Review it before sending.",
      );
    await tx`INSERT INTO customer_project_messages(project_id,sender,body) VALUES(${input.project_id}::uuid,'team',${email.text})`;
    await tx`INSERT INTO customer_project_events(project_id,title,body) VALUES(${input.project_id}::uuid,${input.phase === "advance" ? "Advance payment requested" : "Balance payment requested"},${`₹${(amount / 100).toFixed(2)} requested against approved quote v${q.version}.`})`;
    await queueNotification(
      tx,
      input.project_id,
      "payment-request:" + input.request_id,
      "customer",
      p.customer_email,
      "GYVFT: " +
        (input.phase === "advance"
          ? "advance payment request"
          : "balance payment request"),
    );
    return {
      id: input.request_id,
      amount_inr: amount / 100,
      phase: input.phase,
      duplicate: false,
    };
  });
}
