"use server";
import type { Sql } from "postgres";
import { validImage } from "@/lib/customer/images";
import { deliverySchema } from "@/lib/customer/pilot-model";
import {
  queueNotification,
  scheduleNotifications,
} from "@/lib/customer/notifications";
import { recordCustomerEvent } from "@/lib/customer/observability";
import { uuidPattern } from "@/lib/customer/model";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ownedProject } from "@/lib/customer/data";
import { getSql } from "@/lib/database/client";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import {
  requireCustomerAccount,
  destroyCustomerSession,
} from "@/lib/customer/session";
export async function signOut() {
  await destroyCustomerSession();
  redirect("/account/login");
}
export async function sendMessage(id: string, data: FormData) {
  const account = await requireCustomerAccount();
  if (!(await ownedProject(id, account.id)))
    throw new Error("Project unavailable");
  assertPublicFormRateLimit({
    ip: account.id,
    formKey: "customer-write",
    limit: 30,
    windowMs: 60000,
  });
  const body = String(data.get("body") ?? "").trim();
  if (!body || body.length > 4000)
    return { ok: false, message: "Message must contain 1–4000 characters." };
  await getSql().begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    const rows =
      await tx`INSERT INTO customer_project_messages (project_id, sender, body) SELECT id, 'customer', ${body} FROM customer_projects WHERE id = ${id}::uuid AND customer_account_id = ${account.id}::uuid RETURNING id`;
    if (rows[0])
      await queueNotification(
        tx,
        id,
        `message:${rows[0].id}`,
        "team",
        account.email,
        "GYVFT: customer message",
      );
  });
  scheduleNotifications(id);
  revalidatePath(`/account/projects/${id}`);
  await recordCustomerEvent("message.sent", {
    accountId: account.id,
    metadata: { operation: "message", status: 201 },
  });
  return { ok: true, message: "Your message has been saved." };
}
export async function submitPayment(id: string, data: FormData) {
  const account = await requireCustomerAccount();
  if (!(await ownedProject(id, account.id)))
    throw new Error("Project unavailable");
  assertPublicFormRateLimit({
    ip: account.id,
    formKey: "customer-write",
    limit: 30,
    windowMs: 60000,
  });
  const reference = String(data.get("reference") ?? "").trim();
  const amountText = String(data.get("amount") ?? "");
  if (
    !/^\d{1,8}(\.\d{1,2})?$/.test(amountText) ||
    reference.length < 6 ||
    reference.length > 100
  )
    return {
      ok: false,
      message: "Enter a valid amount and payment reference.",
    };
  const amount = Math.round(Number(amountText) * 100);
  if (amount <= 0) return { ok: false, message: "Enter a positive amount." };
  const proof = data.get("evidence");
  if (!(proof instanceof File) || !proof.size || proof.size > 2 * 1024 * 1024)
    return {
      ok: false,
      message:
        "Upload a transaction screenshot as PNG, JPEG or WebP, up to 2 MB.",
    };
  const bytes = Buffer.from(await proof.arrayBuffer());
  if (!validImage(bytes, proof.type))
    return { ok: false, message: "Use a valid PNG, JPEG or WebP screenshot." };
  const inserted = await getSql().begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    const [p] =
      await tx`SELECT id,total_paise,paid_paise FROM customer_projects WHERE id=${id}::uuid AND customer_account_id=${account.id}::uuid FOR UPDATE`;
    const [quote] =
      await tx`SELECT status,gift_selection_id FROM customer_project_approvals WHERE project_id=${id}::uuid AND kind='proposal' ORDER BY version DESC LIMIT 1`;
    const [selection] =
      await tx`SELECT id FROM gyvft_gift_selections WHERE project_id=${id}::uuid ORDER BY created_at DESC,id DESC LIMIT 1`;
    if (
      !p ||
      quote?.status !== "approved" ||
      (selection && quote.gift_selection_id !== selection.id) ||
      amount > Number(p.total_paise) - Number(p.paid_paise)
    )
      return false;
    const rows =
      await tx`INSERT INTO customer_payment_submissions (project_id, amount_paise, reference,evidence_data,evidence_type) SELECT id, ${amount}, ${reference},${bytes},${proof.type} FROM customer_projects WHERE id = ${id}::uuid AND customer_account_id = ${account.id}::uuid AND kind='project' ON CONFLICT (project_id, reference) DO NOTHING RETURNING id`;
    if (rows[0])
      await queueNotification(
        tx,
        id,
        `payment:${rows[0].id}`,
        "team",
        account.email,
        "GYVFT: payment verification needed",
      );
    return rows.length > 0;
  });
  if (!inserted)
    return {
      ok: false,
      message:
        "This reference is already submitted, or the order is not ready for payment. Check the existing payment status.",
    };
  scheduleNotifications(id);
  revalidatePath(`/account/projects/${id}`);
  return {
    ok: true,
    message:
      "Payment screenshot and reference recorded. Allow up to 24 hours for verification.",
  };
}

export async function decideApproval(
  id: string,
  approvalId: string,
  data: FormData,
) {
  const account = await requireCustomerAccount();
  if (!(await ownedProject(id, account.id)) || !uuidPattern.test(approvalId))
    throw new Error("Approval unavailable");
  assertPublicFormRateLimit({
    ip: account.id,
    formKey: "customer-write",
    limit: 30,
    windowMs: 60000,
  });
  const decision = String(data.get("decision") ?? "");
  const response = String(data.get("response") ?? "").trim();
  if (
    !["approved", "changes_requested"].includes(decision) ||
    response.length > 4000 ||
    (decision === "changes_requested" && !response)
  )
    return { ok: false, message: "Please describe the changes you need." };
  const rows = await getSql().begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    await tx`SELECT id FROM customer_projects WHERE id=${id}::uuid AND customer_account_id=${account.id}::uuid FOR UPDATE`;
    const rows = await tx`WITH decision AS (
  UPDATE customer_project_approvals a SET status = ${decision}, customer_response = ${response}, decided_at = now()
  FROM customer_projects p WHERE a.id = ${approvalId}::uuid AND a.project_id = p.id AND p.id = ${id}::uuid
   AND p.stage<7 AND p.production_started_at IS NULL AND p.customer_account_id = ${account.id}::uuid AND a.status = 'pending'
   AND (a.kind <> 'proposal' OR NOT EXISTS (SELECT 1 FROM gyvft_gift_selections s WHERE s.project_id=p.id) OR a.gift_selection_id=(SELECT s.id FROM gyvft_gift_selections s WHERE s.project_id=p.id ORDER BY s.created_at DESC,s.id DESC LIMIT 1))
   AND NOT EXISTS (SELECT 1 FROM customer_project_approvals newer WHERE newer.project_id = a.project_id AND newer.kind = a.kind AND newer.version > a.version)
  RETURNING a.project_id, a.title, a.version
 ) INSERT INTO customer_project_events (project_id, title, body)
 SELECT project_id, title || ' · v' || version || ${decision === "approved" ? " approved" : " — changes requested"}, ${response} FROM decision RETURNING id`;
    if (rows[0] && decision === "approved") {
      const [q] =
        await tx`SELECT kind,amount_paise,items FROM customer_project_approvals WHERE id=${approvalId}::uuid`;
      if (q?.kind === "proposal" && q.amount_paise && Array.isArray(q.items)) {
        const [p] =
          await tx`SELECT paid_paise,shopify_order_id,shopify_order_reference,shopify_order_state FROM customer_projects WHERE id=${id}::uuid`;
        if (
          p.shopify_order_id ||
          p.shopify_order_reference ||
          (p.shopify_order_state && p.shopify_order_state !== "pending") ||
          Number(p.paid_paise) > Number(q.amount_paise)
        )
          throw new Error(
            "The official order or receipts need reconciliation before approving this revision.",
          );
        await tx`UPDATE customer_projects SET kind='project',customer_type=COALESCE(customer_type,'b2c'),total_paise=${q.amount_paise},stage=CASE WHEN paid_paise>=ceil(${q.amount_paise}::numeric/2) THEN 5 ELSE 4 END,next_action='Your quote is approved. Pay the 50% advance; the balance is due before dispatch.' WHERE id=${id}::uuid`;
        await tx`DELETE FROM customer_order_items WHERE project_id=${id}::uuid`;
        for (const item of q.items)
          await tx`INSERT INTO customer_order_items(project_id,approval_id,name,quantity,unit_paise,item_type,personalisation) VALUES(${id}::uuid,${approvalId}::uuid,${item.name},${item.quantity},${item.unit_paise},${item.item_type},${item.personalisation || ""})`;
      }
    }
    if (rows[0]) {
      await queueNotification(
        tx,
        id,
        `approval:${rows[0].id}`,
        "team",
        account.email,
        "GYVFT: customer approval decision",
      );
    }
    return rows;
  });
  if (rows.length) scheduleNotifications(id);
  revalidatePath("/account");
  revalidatePath(`/account/projects/${id}`);
  return {
    ok: rows.length > 0,
    message: rows.length
      ? "Your decision has been recorded."
      : "This version has already received a decision. Refresh to see the latest.",
  };
}

export async function saveDeliveryAddress(id: string, data: FormData) {
  const account = await requireCustomerAccount();
  if (!(await ownedProject(id, account.id)))
    return { ok: false, message: "Request unavailable." };
  const parsed = deliverySchema.safeParse(Object.fromEntries(data.entries()));
  if (!parsed.success)
    return {
      ok: false,
      message:
        "Complete recipient, phone, address, city, state and six-digit PIN code.",
    };
  const a = parsed.data;
  assertPublicFormRateLimit({
    ip: account.id,
    formKey: "customer-write",
    limit: 30,
    windowMs: 60000,
  });
  const saved = await getSql().begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    const [project] =
      await tx`SELECT stage,shopify_order_id,shopify_order_reference,shopify_order_state FROM customer_projects WHERE id=${id}::uuid AND customer_account_id=${account.id}::uuid FOR UPDATE`;
    if (
      !project ||
      project.stage >= 9 ||
      project.shopify_order_id ||
      project.shopify_order_reference ||
      (project.shopify_order_state && project.shopify_order_state !== "pending")
    )
      return false;
    await tx`INSERT INTO customer_delivery_addresses(project_id,recipient_name,phone,address,city,state,postal_code) SELECT id,${a.recipient_name},${a.phone},${a.address},${a.city},${a.state},${a.postal_code} FROM customer_projects WHERE id=${id}::uuid AND customer_account_id=${account.id}::uuid ON CONFLICT(project_id) DO UPDATE SET recipient_name=EXCLUDED.recipient_name,phone=EXCLUDED.phone,address=EXCLUDED.address,city=EXCLUDED.city,state=EXCLUDED.state,postal_code=EXCLUDED.postal_code,updated_at=now()`;
    return true;
  });
  if (!saved)
    return {
      ok: false,
      message:
        "Delivery details are locked in the official order or after dispatch. Please message the team for corrections.",
    };
  revalidatePath(`/account/projects/${id}`);
  return {
    ok: true,
    message: "Delivery details saved. The team will confirm fulfilment.",
  };
}
export async function correctPaymentProof(
  id: string,
  paymentId: string,
  data: FormData,
) {
  const account = await requireCustomerAccount();
  if (!uuidPattern.test(id) || !uuidPattern.test(paymentId))
    return { ok: false, message: "Submission unavailable." };
  assertPublicFormRateLimit({
    ip: account.id,
    formKey: "customer-write",
    limit: 30,
    windowMs: 60000,
  });
  const amountText = String(data.get("amount") || ""),
    reference = String(data.get("reference") || "").trim(),
    proof = data.get("evidence");
  if (
    !/^\d{1,8}(\.\d{1,2})?$/.test(amountText) ||
    Number(amountText) <= 0 ||
    reference.length < 6 ||
    reference.length > 100 ||
    !(proof instanceof File) ||
    proof.size > 2 * 1024 * 1024
  )
    return {
      ok: false,
      message: "Check the amount, reference and screenshot (up to 2 MB).",
    };
  const bytes = Buffer.from(await proof.arrayBuffer());
  if (!validImage(bytes, proof.type))
    return { ok: false, message: "Use a valid PNG, JPEG or WebP screenshot." };
  const amount = Math.round(Number(amountText) * 100);
  const saved = await getSql().begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    const [p] =
      await tx`SELECT id,total_paise,paid_paise FROM customer_projects WHERE id=${id}::uuid AND customer_account_id=${account.id}::uuid FOR UPDATE`;
    if (!p || amount > Number(p.total_paise) - Number(p.paid_paise))
      return false;
    const [duplicate] =
      await tx`SELECT id FROM customer_payment_submissions WHERE project_id=${id}::uuid AND reference=${reference} AND id<>${paymentId}::uuid`;
    if (duplicate) return false;
    const rows =
      await tx`UPDATE customer_payment_submissions SET reference=${reference},amount_paise=${amount},evidence_data=${bytes},evidence_type=${proof.type},status='pending' WHERE id=${paymentId}::uuid AND project_id=${id}::uuid AND status IN ('pending','rejected') RETURNING id`;
    if (rows[0])
      await queueNotification(
        tx,
        id,
        `proof-corrected:${paymentId}:${Date.now()}`,
        "team",
        account.email,
        "GYVFT: corrected payment proof",
      );
    return !!rows[0];
  });
  if (saved) {
    scheduleNotifications(id);
    revalidatePath(`/account/projects/${id}`);
  }
  return {
    ok: saved,
    message: saved
      ? "Corrected proof saved. Allow up to 24 hours for bank verification."
      : "This submission was already verified, the reference exists, or the amount exceeds the remaining balance. Refresh to check.",
  };
}
