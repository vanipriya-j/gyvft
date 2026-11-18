import "server-only";
import { z } from "zod";
import { operationalExtras } from "./operations-workflow";
import { giftWorkspace } from "./gift-workspace";
import { getSql } from "@/lib/database/client";
import type { Sql } from "postgres";
import { safePaymentUrl } from "./model";
import {
  quoteTotal,
  lineItemSchema,
  productionAllowed,
  dispatchAllowed,
  secureLink,
} from "./pilot-model";
import { queueNotification } from "./notifications";
export class PilotError extends Error {}
export async function pilotList(query = "") {
  const q = `%${query.slice(0, 120)}%`;
  return getSql()`SELECT p.id,p.title,p.customer_email,p.customer_type,p.kind,p.stage,p.next_action,p.total_paise,p.paid_paise,p.created_at,p.task_owner,p.task_due_at,p.production_started_at,p.delivery_date,(SELECT a.status FROM customer_project_approvals a WHERE a.project_id=p.id AND a.kind='proposal' ORDER BY a.version DESC LIMIT 1) AS quote_status,(SELECT a.status FROM customer_project_approvals a WHERE a.project_id=p.id AND a.kind='design' ORDER BY a.version DESC LIMIT 1) AS design_status,EXISTS(SELECT 1 FROM customer_payment_submissions pay WHERE pay.project_id=p.id AND pay.status='pending') AS pending_payment,EXISTS(SELECT 1 FROM gyvft_gift_selections s WHERE s.project_id=p.id) AS has_selection,EXISTS(SELECT 1 FROM gyvft_gift_options o WHERE o.project_id=p.id AND NOT o.operator_hidden) AS visible_options,EXISTS(SELECT 1 FROM customer_project_approvals a WHERE a.project_id=p.id AND a.image_data IS NOT NULL) AS has_mockup FROM customer_projects p WHERE p.is_draft=false AND (p.title ILIKE ${q} OR p.customer_email ILIKE ${q}) ORDER BY p.created_at DESC LIMIT 200`;
}
export async function pilotDetail(id: string) {
  const sql = getSql();
  const [project] =
    await sql`SELECT * FROM customer_projects WHERE id=${id}::uuid`;
  if (!project || project.is_draft)
    throw new PilotError("Request unavailable.");
  const [
    approvals,
    messages,
    payments,
    events,
    items,
    addresses,
    notifications,
    audit,
  ] = await Promise.all([
    sql`SELECT id,kind,version,title,description,status,customer_response,amount_paise,items,gift_selection_id,image_data IS NOT NULL AS has_image FROM customer_project_approvals WHERE project_id=${id}::uuid ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT id,sender,body,created_at FROM customer_project_messages WHERE project_id=${id}::uuid ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT id,reference,amount_paise,status,created_at,evidence_data IS NOT NULL AS has_evidence FROM customer_payment_submissions WHERE project_id=${id}::uuid ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT id,title,body,created_at FROM customer_project_events WHERE project_id=${id}::uuid ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT name,quantity,unit_paise,item_type,personalisation FROM customer_order_items WHERE project_id=${id}::uuid`,
    sql`SELECT recipient_name,phone,address,city,state,postal_code FROM customer_delivery_addresses WHERE project_id=${id}::uuid`,
    sql`SELECT id,destination,state,attempts,created_at FROM gyvft_customer_notifications WHERE project_id=${id}::uuid ORDER BY created_at DESC LIMIT 20`,
    sql`SELECT operation,created_at FROM gyvft_customer_admin_events WHERE project_id=${id}::uuid ORDER BY created_at DESC LIMIT 20`,
  ]);
  return {
    workspace: await giftWorkspace(id),
    journey: await operationalExtras(id),
    project,
    approvals,
    messages,
    payments,
    events,
    items,
    address: addresses[0] || null,
    notifications,
    audit,
  };
}
const common = z.object({
  id: z.string().uuid(),
  request_id: z.string().uuid(),
  op: z.enum([
    "reply",
    "publish",
    "convert",
    "progress",
    "payment",
    "reject_payment",
    "instructions",
  ]),
});
export async function mutatePilot(raw: Record<string, unknown>) {
  const base = common.safeParse(raw);
  if (!base.success) throw new PilotError("Invalid request action.");
  const { id, request_id, op } = base.data;
  return getSql().begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    const [p] =
      await tx`SELECT * FROM customer_projects WHERE id=${id}::uuid FOR UPDATE`;
    if (!p || p.is_draft) throw new PilotError("Request unavailable.");
    if (String(p.submission_key || "").startsWith("gyvft-demo-"))
      throw new PilotError(
        "Sample requests are read-only. Use a real enquiry to run the gifting workflow.",
      );
    const [prior] =
      await tx`SELECT operation,project_id FROM gyvft_customer_admin_events WHERE request_id=${request_id}::uuid`;
    if (prior) {
      if (prior.project_id !== id || prior.operation !== op)
        throw new PilotError("This action key was already used.");
      return { duplicate: true };
    }
    let eventTitle = "",
      eventBody = "";
    if (op === "reply") {
      const body = z.string().trim().min(1).max(4000).safeParse(raw.body);
      if (!body.success)
        throw new PilotError("Enter a reply of 1–4000 characters.");
      await tx`INSERT INTO customer_project_messages(project_id,sender,body) VALUES(${id}::uuid,'team',${body.data})`;
      eventTitle = "New message from GYVFT";
    } else if (op === "publish") {
      if (raw.saved_draft_version !== undefined) {
        const [draft] =
          await tx`SELECT document,version,image_data,image_type FROM gyvft_gift_approval_drafts WHERE project_id=${id}::uuid AND kind=${String(raw.kind)} FOR UPDATE`;
        if (!draft || Number(draft.version) !== Number(raw.saved_draft_version))
          throw new PilotError(
            "The draft changed. Refresh and preview the latest version.",
          );
        Object.assign(raw, draft.document);
        if (draft.image_data)
          raw.image = {
            data: Buffer.from(draft.image_data).toString("base64"),
            mime: draft.image_type,
          };
      }
      const a = z
        .object({
          kind: z.enum(["proposal", "design"]),
          title: z.string().trim().min(2).max(180),
          description: z.string().trim().min(2).max(5000),
        })
        .safeParse(raw);
      if (!a.success)
        throw new PilotError("Add an approval title and description.");
      if (p.production_started_at || p.stage >= 7)
        throw new PilotError(
          "This order is already in fulfilment. Resolve changes before publishing another design.",
        );
      if (
        a.data.kind === "proposal" &&
        (p.shopify_order_id ||
          p.shopify_order_reference ||
          p.shopify_order_state !== "pending")
      )
        throw new PilotError(
          "The official Shopify order is linked. Its quoted amount cannot be changed here.",
        );
      let items = null,
        total = null;
      if (a.data.kind === "proposal") {
        const parsed = z
          .array(lineItemSchema)
          .min(1)
          .max(50)
          .safeParse(raw.items);
        if (!parsed.success)
          throw new PilotError("Add valid quote items, quantities and prices.");
        items = parsed.data;
        try {
          total = quoteTotal(items);
        } catch {
          throw new PilotError(
            "Enter a positive quote total within the supported limit.",
          );
        }
      }
      if (total !== null && Number(p.paid_paise) > total)
        throw new PilotError(
          "The revised quote is below verified payments. Reconcile receipts before changing the quote.",
        );
      let selectionId: string | null = null;
      if (a.data.kind === "proposal") {
        const [latest] =
          await tx`SELECT id FROM gyvft_gift_selections WHERE project_id=${id}::uuid ORDER BY created_at DESC,id DESC LIMIT 1`;
        if (latest) {
          if (raw.gift_selection_id !== latest.id)
            throw new PilotError(
              "Choose the latest customer selection before publishing its quote.",
            );
          selectionId = latest.id;
        } else if (raw.gift_selection_id)
          throw new PilotError("Customer selection unavailable.");
      }
      let image: Buffer | null = null,
        mime: string | null = null;
      if (raw.image && typeof raw.image === "object") {
        const v = z
          .object({
            mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
            data: z.string().max(2800000),
          })
          .safeParse(raw.image);
        if (!v.success)
          throw new PilotError("Use a PNG, JPEG or WebP mockup under 2 MB.");
        image = Buffer.from(v.data.data, "base64");
        mime = v.data.mime;
        const png = image
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const jpeg = image[0] === 255 && image[1] === 216 && image[2] === 255;
        const webp =
          image.subarray(0, 4).toString() === "RIFF" &&
          image.subarray(8, 12).toString() === "WEBP";
        if (
          image.length < 12 ||
          image.length > 2 * 1024 * 1024 ||
          !(mime === "image/png" ? png : mime === "image/jpeg" ? jpeg : webp)
        )
          throw new PilotError(
            "Use a valid PNG, JPEG or WebP mockup under 2 MB.",
          );
      }
      const [version] =
        await tx`SELECT COALESCE(MAX(version),0)+1 AS n FROM customer_project_approvals WHERE project_id=${id}::uuid AND kind=${a.data.kind}`;
      await tx`INSERT INTO customer_project_approvals(project_id,kind,version,title,description,amount_paise,items,image_data,image_type,gift_selection_id) VALUES(${id}::uuid,${a.data.kind},${Number(version.n)},${a.data.title},${a.data.description},${total},${items ? tx.json(items) : null},${image},${mime},${selectionId}::uuid)`;
      await tx`UPDATE gyvft_gift_changes c SET status='addressed' FROM customer_project_approvals a WHERE c.approval_id=a.id AND c.project_id=${id}::uuid AND a.kind=${a.data.kind}`;
      await tx`DELETE FROM gyvft_gift_approval_drafts WHERE project_id=${id}::uuid AND kind=${a.data.kind}`;
      await tx`UPDATE customer_projects SET stage=${a.data.kind === "proposal" ? 3 : 6},next_action=${a.data.kind === "proposal" ? "Review the proposal and tell us your decision." : "Review your latest design and approve it or request changes."} WHERE id=${id}::uuid`;
      eventTitle = `${a.data.kind === "proposal" ? "Proposal" : "Design"} shared · v${version.n}`;
      eventBody = a.data.title;
    } else if (op === "convert") {
      if (p.kind === "project")
        throw new PilotError("This request is already an order.");
      if (p.customer_type === "b2b")
        throw new PilotError("This pilot conversion is for personal gifting.");
      if (!p.customer_account_id)
        throw new PilotError(
          "The customer must create and connect their account before conversion.",
        );
      const [q] =
        await tx`SELECT id,amount_paise,items,status,gift_selection_id FROM customer_project_approvals WHERE project_id=${id}::uuid AND kind='proposal' ORDER BY version DESC LIMIT 1`;
      const [latestSelection] =
        await tx`SELECT id FROM gyvft_gift_selections WHERE project_id=${id}::uuid ORDER BY created_at DESC,id DESC LIMIT 1`;
      if (latestSelection && q?.gift_selection_id !== latestSelection.id)
        throw new PilotError(
          "The customer selected a different gift. Publish and approve its revised quote before conversion.",
        );
      if (
        !q ||
        q.status !== "approved" ||
        !q.amount_paise ||
        !Array.isArray(q.items)
      )
        throw new PilotError(
          "The customer must approve the latest priced proposal first.",
        );
      await tx`UPDATE customer_projects SET kind='project',customer_type='b2c',total_paise=${q.amount_paise},stage=4,next_action='Pay the 50% advance using the payment instructions below.' WHERE id=${id}::uuid`;
      for (const item of q.items)
        await tx`INSERT INTO customer_order_items(project_id,approval_id,name,quantity,unit_paise,item_type,personalisation) VALUES(${id}::uuid,${q.id}::uuid,${item.name},${item.quantity},${item.unit_paise},${item.item_type},${item.personalisation || ""})`;
      eventTitle = "Your personal gifting order is confirmed";
      eventBody =
        "A 50% advance is required. The remaining balance is due before dispatch.";
    } else if (op === "instructions") {
      const r = z
        .object({
          upi_id: z.string().trim().max(160),
          razorpay_url: z.string().trim().max(2000),
          shopify_order_reference: z.string().trim().max(120),
        })
        .safeParse(raw);
      if (!r.success)
        throw new PilotError("Check the payment and order details.");
      if (
        r.data.upi_id &&
        !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}$/.test(r.data.upi_id)
      )
        throw new PilotError("Enter a valid UPI ID.");
      if (r.data.razorpay_url && !safePaymentUrl(r.data.razorpay_url))
        throw new PilotError("Use an approved HTTPS Razorpay payment link.");
      if (
        p.shopify_order_reference &&
        r.data.shopify_order_reference !== p.shopify_order_reference
      )
        throw new PilotError(
          "A linked Shopify order reference cannot be replaced manually.",
        );
      if (r.data.shopify_order_reference && !p.shopify_order_reference) {
        const [quote] =
          await tx`SELECT status FROM customer_project_approvals WHERE project_id=${id}::uuid AND kind='proposal' ORDER BY version DESC LIMIT 1`;
        if (p.kind !== "project" || quote?.status !== "approved")
          throw new PilotError(
            "Approve the latest quote before linking an official order.",
          );
      }
      await tx`UPDATE customer_projects SET upi_id=${r.data.upi_id || null},razorpay_url=${r.data.razorpay_url || null},shopify_order_reference=${r.data.shopify_order_reference || null} WHERE id=${id}::uuid`;
      eventTitle = "Payment or order instructions updated";
      eventBody =
        "View your request for the latest payment instructions and order reference.";
    } else if (op === "payment" || op === "reject_payment") {
      if (p.kind !== "project" || !p.total_paise)
        throw new PilotError(
          "Convert an approved quote before recording a payment.",
        );
      const ref = z.string().trim().min(6).max(100).safeParse(raw.reference);
      if (!ref.success)
        throw new PilotError(
          "Enter the bank or provider transaction reference.",
        );
      const [payment] =
        await tx`SELECT id,status,amount_paise FROM customer_payment_submissions WHERE project_id=${id}::uuid AND reference=${ref.data} FOR UPDATE`;
      if (op === "reject_payment") {
        if (!payment || payment.status !== "pending")
          throw new PilotError(
            "Only a pending payment reference can be rejected.",
          );
        await tx`UPDATE customer_payment_submissions SET status='rejected' WHERE id=${payment.id}::uuid`;
        eventTitle = "Payment reference needs attention";
        eventBody =
          "We could not verify the submitted reference. Please contact us or submit a corrected reference.";
      } else {
        if (raw.confirmed_receipt !== true)
          throw new PilotError(
            "Confirm receipt in the bank/provider before crediting payment.",
          );
        const amount = payment
          ? Number(payment.amount_paise)
          : z.number().int().positive().max(9999999999).parse(raw.amount_paise);
        if (
          payment &&
          raw.expected_amount_paise !== undefined &&
          Number(raw.expected_amount_paise) !== Number(payment.amount_paise)
        )
          throw new PilotError(
            "This submission changed. Refresh and check the corrected bank receipt before verifying.",
          );
        if (payment && payment.status !== "pending")
          throw new PilotError(
            "This reference has already received a decision.",
          );
        if (Number(p.paid_paise) + amount > Number(p.total_paise))
          throw new PilotError(
            "This payment exceeds the remaining quoted amount. Reconcile it before crediting.",
          );
        if (payment)
          await tx`UPDATE customer_payment_submissions SET status='verified',verified_at=now() WHERE id=${payment.id}::uuid`;
        else
          await tx`INSERT INTO customer_payment_submissions(project_id,reference,amount_paise,status,verified_at) VALUES(${id}::uuid,${ref.data},${amount},'verified',now())`;
        const paid = Number(p.paid_paise) + amount;
        await tx`UPDATE customer_projects SET paid_paise=${paid},stage=${p.stage === 4 && paid >= Math.ceil(Number(p.total_paise) / 2) ? 5 : p.stage},next_action=${p.stage === 4 && paid >= Math.ceil(Number(p.total_paise) / 2) ? "Your advance is verified. We are preparing your design." : p.next_action} WHERE id=${id}::uuid`;
        eventTitle = "Payment receipt verified";
        eventBody =
          "Your recorded payments and remaining balance have been updated.";
      }
    } else if (op === "progress") {
      const r = z
        .object({
          stage: z.number().int().min(1).max(11),
          next_action: z.string().trim().min(2).max(1000),
          tracking_reference: z.string().trim().max(160).default(""),
          tracking_url: z.string().trim().max(2000).default(""),
        })
        .safeParse(raw);
      if (!r.success)
        throw new PilotError(
          "Add a valid stage and customer-visible next step.",
        );
      const stage = r.data.stage;
      if ((p.production_started_at || p.stage >= 7) && stage < 7)
        throw new PilotError("Production has started. This gift is locked.");
      if (![1, 2, 7, 8, 9, 10, 11].includes(stage))
        throw new PilotError(
          "Quotes, approvals and payment actions control that stage.",
        );
      if (stage <= 2) {
        if (p.kind !== "enquiry" || stage < p.stage)
          throw new PilotError("This stage is only for early enquiries.");
      } else {
        if (
          p.kind !== "project" ||
          (stage === 7 && p.stage > 7) ||
          (stage > 7 && stage !== Number(p.stage) + 1)
        )
          throw new PilotError(
            "Move the order forward one fulfilment stage at a time.",
          );
        if (stage === 7 && !p.shopify_order_id && !p.shopify_order_reference)
          throw new PilotError(
            "Link the official Shopify order before starting production.",
          );
        const [openChanges] =
          await tx`SELECT id FROM gyvft_gift_changes WHERE project_id=${id}::uuid AND status='open' LIMIT 1`;
        if (openChanges)
          throw new PilotError(
            "Resolve customer change requests before starting production.",
          );
        const [design] =
          await tx`SELECT status FROM customer_project_approvals WHERE project_id=${id}::uuid AND kind='design' ORDER BY version DESC LIMIT 1`;
        if (
          !productionAllowed(
            Number(p.paid_paise),
            Number(p.total_paise),
            design?.status === "approved",
          )
        )
          throw new PilotError(
            "Production requires the verified 50% advance and latest design approval.",
          );
        if (stage >= 9) {
          const [address] =
            await tx`SELECT project_id FROM customer_delivery_addresses WHERE project_id=${id}::uuid`;
          if (
            !dispatchAllowed(
              Number(p.paid_paise),
              Number(p.total_paise),
              true,
              Boolean(address),
              r.data.tracking_reference || p.tracking_reference || "",
            )
          )
            throw new PilotError(
              "Dispatch requires full verified payment, a delivery address and tracking reference.",
            );
        }
      }
      const tracking = secureLink(r.data.tracking_url);
      if (tracking === null)
        throw new PilotError("Use a valid HTTPS tracking link.");
      await tx`UPDATE customer_projects SET stage=${stage},production_started_at=CASE WHEN ${stage}>=7 THEN COALESCE(production_started_at,now()) ELSE production_started_at END,next_action=${r.data.next_action},tracking_reference=${r.data.tracking_reference || p.tracking_reference || null},tracking_url=${tracking || p.tracking_url || null} WHERE id=${id}::uuid`;
      eventTitle = "Progress update";
      eventBody = r.data.next_action;
    }
    if (op !== "reply")
      await tx`INSERT INTO customer_project_events(project_id,title,body) VALUES(${id}::uuid,${eventTitle},${eventBody})`;
    await tx`INSERT INTO gyvft_customer_admin_events(request_id,project_id,operation) VALUES(${request_id}::uuid,${id}::uuid,${op})`;
    await queueNotification(
      tx,
      id,
      `admin:${request_id}`,
      "customer",
      p.customer_email,
      `GYVFT: ${eventTitle}`,
    );
    return { duplicate: false };
  });
}
