import "server-only";
import { z } from "zod";
import { getSql } from "@/lib/database/client";
import { pilotDetail, mutatePilot } from "@/lib/customer/pilot-admin";
import { operatorJourneyCommand } from "@/lib/customer/operations-workflow";
import { publishOptionDraft } from "@/lib/customer/option-drafts";
import {
  recordOfflineApproval,
  offlineApprovalsFor,
  AgentOperationsError,
  requireAgentOperations,
} from "@/lib/customer/agent-operations";
import { requestCustomerPayment } from "@/lib/customer/payment-requests";
import {
  inrAmount,
  rupeesToPaise,
  milestonePayment,
} from "@/lib/customer/agent-operations-model";
import {
  createOperationsIntake,
  intakeCustomers,
  sendOperationsSetupEmail,
  operationsIntakeReady,
} from "@/lib/customer/operations-intake";
import { requirementSchema } from "@/lib/customer/operations-intake-model";
import {
  createOrSyncShopifyOrder,
  shopifyConfigured,
} from "@/lib/customer/shopify";
import { deliverNotifications } from "@/lib/customer/notifications";
import { demoAccountIds } from "@/lib/customer/demo-accounts";
import { mcpOrigin, McpScopeError } from "./config";
import { operationToolScope } from "./operation-tools";
import {
  openAiFileSchema,
  prepareMcpImages,
  prepareMcpRequirementFiles,
} from "./images";
import {
  operationFingerprint,
  reserveOperation,
  completeOperation,
} from "./operation-commands";

type Actor = { id: string; scopes: string[] };
const uuid = z.string().uuid(),
  base = { request_id: uuid, client_reference: uuid };
const version = {
  approval_id: uuid,
  expected_version: z.number().int().positive(),
};
const nonnegativeInr = z
  .number()
  .finite()
  .min(0)
  .max(99999999.99)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
    "Use at most two decimal places.",
  );
const quoteItem = z
  .object({
    name: z.string().trim().min(2).max(160),
    quantity: z.number().int().min(1).max(100000),
    unit_inr: nonnegativeInr,
    item_type: z.enum(["gift", "fee"]),
    personalisation: z.string().trim().max(1000).default(""),
  })
  .strict();
const quoteKind = z.enum(["quote", "artwork"]);
const schemas = {
  get_gift_operations: z.object({ request_id: uuid }).strict(),
  find_customers: z
    .object({ query: z.string().trim().min(2).max(120) })
    .strict(),
  publish_gift_option: z
    .object({
      ...base,
      option_id: uuid,
      expected_version: z.number().int().positive(),
      notify_customer: z.literal(true),
    })
    .strict(),
  save_approval_draft: z
    .object({
      ...base,
      kind: quoteKind,
      expected_draft_version: z.number().int().nonnegative(),
      title: z.string().trim().min(2).max(180),
      description: z.string().trim().min(2).max(5000),
      gift_selection_id: uuid.nullable().optional(),
      items: z.array(quoteItem).max(50).optional(),
      files: z.array(openAiFileSchema).max(1).optional(),
    })
    .strict(),
  publish_approval_draft: z
    .object({
      ...base,
      kind: quoteKind,
      expected_version: z.number().int().positive(),
      notify_customer: z.literal(true),
    })
    .strict(),
  record_offline_approval: z
    .object({
      ...base,
      ...version,
      channel: z.enum(["whatsapp", "email", "in_person", "phone", "other"]),
      customer_approved_at: z
        .string()
        .datetime({ offset: true })
        .nullable()
        .optional(),
      note: z.string().trim().min(1).max(2000),
      recorded_by: z.string().trim().min(2).max(120),
      files: z.array(openAiFileSchema).min(1).max(3),
    })
    .strict(),
  send_customer_message: z
    .object({ ...base, body: z.string().trim().min(1).max(4000) })
    .strict(),
  request_customer_payment: z
    .object({
      ...base,
      ...version,
      phase: z.enum(["advance", "balance"]),
      expected_due_inr: inrAmount,
      expected_paid_inr: nonnegativeInr,
    })
    .strict(),
  verify_customer_payment: z
    .object({
      ...base,
      ...version,
      reference: z.string().trim().min(6).max(100),
      amount_inr: inrAmount,
      expected_paid_inr: nonnegativeInr,
      confirmed_receipt: z.literal(true),
    })
    .strict(),
  create_shopify_order: z
    .object({
      ...base,
      ...version,
      design_id: uuid,
      expected_design_version: z.number().int().positive(),
      expected_paid_inr: nonnegativeInr,
      confirmed_create: z.literal(true),
    })
    .strict(),
  create_customer_intake: z
    .object({
      client_reference: uuid,
      email: z.string().trim().toLowerCase().email().max(254),
      name: z.string().trim().max(120).optional(),
      customer_id: uuid.optional(),
      requirement: requirementSchema.optional(),
      files: z.array(openAiFileSchema).max(6).optional(),
    })
    .strict(),
  send_customer_setup_email: z
    .object({ client_reference: uuid, customer_id: uuid })
    .strict(),
};
async function submittedProject(id: string) {
  const [p] =
    await getSql()`SELECT p.id,p.is_draft,p.submission_key,p.customer_account_id,a.is_active FROM customer_projects p LEFT JOIN gyvft_customer_accounts a ON a.id=p.customer_account_id WHERE p.id=${id}::uuid`;
  if (
    !p ||
    p.is_draft ||
    String(p.submission_key || "").startsWith("gyvft-demo-") ||
    demoAccountIds.includes(p.customer_account_id) ||
    p.is_active === false
  )
    throw new AgentOperationsError(
      "Submitted active customer request unavailable.",
    );
}
async function notificationDelivery(id: string) {
  const configured = !!process.env.RESEND_API_KEY;
  try {
    return {
      configured,
      ...(await deliverNotifications(id)),
      inbox_delivery_confirmed: false,
    };
  } catch {
    return {
      configured,
      candidates: 0,
      accepted: 0,
      needs_attention: true,
      inbox_delivery_confirmed: false,
    };
  }
}
function amounts(items: unknown) {
  return Array.isArray(items)
    ? items.map((item) => ({
        ...item,
        unit_inr: Number(item.unit_paise) / 100,
        unit_paise: undefined,
      }))
    : [];
}
export async function giftOperations(id: string) {
  await submittedProject(id);
  await requireAgentOperations();
  const detail = await pilotDetail(id),
    p = detail.project;
  const quotes = detail.approvals
    .filter((a) => a.kind === "proposal")
    .sort((a, b) => Number(b.version) - Number(a.version));
  const designs = detail.approvals
    .filter((a) => a.kind === "design")
    .sort((a, b) => Number(b.version) - Number(a.version));
  const q = quotes[0],
    design = designs[0],
    total = Number(p.total_paise || q?.amount_paise || 0),
    paid = Number(p.paid_paise || 0);
  const paymentRequests =
    await getSql()`SELECT id,approval_id,approval_version,phase,amount_paise,created_at,superseded_at FROM gyvft_payment_requests WHERE project_id=${id}::uuid ORDER BY created_at DESC LIMIT 20`;
  return {
    request: {
      id,
      title: p.title,
      customer_email: p.customer_email,
      customer_type: p.customer_type,
      kind: p.kind,
      stage: p.stage,
      production_locked: !!p.production_started_at || p.stage >= 7,
    },
    current_quote: q
      ? {
          id: q.id,
          version: q.version,
          status: q.status,
          title: q.title,
          description: q.description,
          total_inr: Number(q.amount_paise || 0) / 100,
          gift_selection_id: q.gift_selection_id,
          items: amounts(q.items),
        }
      : null,
    current_artwork: design
      ? {
          id: design.id,
          version: design.version,
          status: design.status,
          title: design.title,
          description: design.description,
          has_image: !!design.has_image,
        }
      : null,
    approval_drafts: detail.journey.drafts.map((d) => ({
      kind: d.kind === "proposal" ? "quote" : "artwork",
      version: d.version,
      document: { ...d.document, items: amounts(d.document.items) },
      has_image: d.has_image,
    })),
    gift_options: detail.workspace.options.map((o) => ({
      id: o.id,
      title: o.title,
      version: o.draft_version || 1,
      published: o.published,
      image_count: (o.has_image ? 1 : 0) + (o.images?.length || 0),
    })),
    latest_selection_id: detail.workspace.selections[0]?.id || null,
    payments: {
      total_inr: total / 100,
      verified_paid_inr: paid / 100,
      outstanding_inr: Math.max(0, total - paid) / 100,
      advance_due_inr: milestonePayment(total, paid, "advance") / 100,
      balance_due_inr: milestonePayment(total, paid, "balance") / 100,
      balance_request_available: paid >= Math.ceil(total / 2) && p.stage >= 8,
      submissions: detail.payments.map((pay) => ({
        id: pay.id,
        reference: pay.reference,
        amount_inr: Number(pay.amount_paise) / 100,
        status: pay.status,
        has_evidence: pay.has_evidence,
      })),
    },
    payment_requests: paymentRequests.map((r) => ({
      ...r,
      amount_inr: Number(r.amount_paise) / 100,
      amount_paise: undefined,
    })),
    offline_approvals: await offlineApprovalsFor(id),
    notifications: detail.notifications,
    messages: detail.messages.slice(0, 20).map((m) => ({
      sender: m.sender,
      body: m.body,
      created_at: m.created_at,
    })),
    shopify: {
      server_configured: shopifyConfigured(),
      order_id: p.shopify_order_id,
      reference: p.shopify_order_reference,
      state: p.shopify_order_state,
      has_delivery_address: !!detail.address,
      supported_billing: p.customer_type === "b2c",
    },
    operations_url: mcpOrigin() + "/operations/requests?request=" + id,
  };
}
export async function callOperationTool(
  name: string,
  raw: unknown,
  actor: Actor,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const scope = operationToolScope.get(name);
  if (!scope) throw new AgentOperationsError("Unknown Operations tool.");
  if (!actor.scopes.includes(scope)) throw new McpScopeError(scope);
  const schema = schemas[name as keyof typeof schemas];
  if (!schema) throw new AgentOperationsError("Unknown Operations tool.");
  // Each branch re-parses with its exact schema so transformations remain typed.
  const parsed = schema.parse(raw) as Record<string, unknown>;
  if (name === "get_gift_operations")
    return giftOperations(parsed.request_id as string);
  if (name === "find_customers")
    return { customers: await intakeCustomers(parsed.query as string) };
  const reference = parsed.client_reference as string,
    projectId =
      typeof parsed.request_id === "string" ? parsed.request_id : null;
  if (projectId) await submittedProject(projectId);
  const digest = operationFingerprint(name, parsed),
    cached = await reserveOperation(
      reference,
      projectId,
      name,
      digest,
      actor.id,
    );
  if (cached) return { ...cached, replayed: true };
  let result: Record<string, unknown>;
  if (name === "publish_gift_option") {
    const input = schemas.publish_gift_option.parse(parsed);
    await publishOptionDraft(
      input.request_id,
      input.option_id,
      input.expected_version,
    );
    result = {
      published: true,
      option_id: input.option_id,
      version: input.expected_version,
      notification_delivery: await notificationDelivery(input.request_id),
    };
  } else if (name === "save_approval_draft") {
    const input = schemas.save_approval_draft.parse(parsed),
      kind = input.kind === "quote" ? "proposal" : "design";
    if (kind === "proposal" && !input.items?.length)
      throw new AgentOperationsError(
        "A quote needs the owner-supplied priced items. Keep unknown prices in a private gift option instead.",
      );
    const [prior] =
      await getSql()`SELECT project_id,operation FROM gyvft_customer_admin_events WHERE request_id=${reference}::uuid`;
    if (
      prior &&
      (prior.project_id !== projectId ||
        prior.operation !== "save_approval_draft")
    )
      throw new AgentOperationsError(
        "This action key belongs to another operation.",
      );
    if (!prior) {
      const images = await prepareMcpImages(input.files, signal);
      await operatorJourneyCommand({
        op: "save_approval_draft",
        id: projectId,
        request_id: reference,
        kind,
        expected_draft_version: input.expected_draft_version,
        title: input.title,
        description: input.description,
        gift_selection_id: input.gift_selection_id || null,
        items: input.items?.map((item) => ({
          ...item,
          unit_paise: Math.round(item.unit_inr * 100),
        })),
        ...(images[0] ? { image: images[0] } : {}),
      });
    }
    const [draft] =
      await getSql()`SELECT version FROM gyvft_gift_approval_drafts WHERE project_id=${projectId}::uuid AND kind=${kind}`;
    result = {
      private: true,
      kind: input.kind,
      version: draft?.version || null,
      message: prior
        ? "This save already completed. Read the current draft before publishing."
        : "Approval draft saved privately. No customer email was sent.",
    };
  } else if (name === "publish_approval_draft") {
    const input = schemas.publish_approval_draft.parse(parsed),
      kind = input.kind === "quote" ? "proposal" : "design";
    await mutatePilot({
      op: "publish",
      id: projectId,
      request_id: reference,
      kind,
      saved_draft_version: input.expected_version,
    });
    const [published] =
      await getSql()`SELECT id,version FROM customer_project_approvals WHERE project_id=${projectId}::uuid AND kind=${kind} ORDER BY version DESC LIMIT 1`;
    result = {
      published: true,
      kind: input.kind,
      approval_id: published?.id,
      version: published?.version,
      notification_delivery: await notificationDelivery(input.request_id),
    };
  } else if (name === "record_offline_approval") {
    const input = schemas.record_offline_approval.parse(parsed);
    const [prior] =
      await getSql()`SELECT id,approval_id,approval_version,input_hash FROM gyvft_offline_approvals WHERE id=${reference}::uuid`;
    if (prior) {
      if (prior.input_hash !== digest)
        throw new AgentOperationsError(
          "This action key belongs to different approval data.",
        );
      result = {
        id: prior.id,
        approval_id: prior.approval_id,
        version: prior.approval_version,
        duplicate: true,
      };
    } else
      result = await recordOfflineApproval(
        {
          request_id: reference,
          project_id: projectId,
          approval_id: input.approval_id,
          expected_version: input.expected_version,
          channel: input.channel,
          customer_approved_at: input.customer_approved_at || null,
          note: input.note,
          recorded_by: input.recorded_by,
          proof: await prepareMcpImages(input.files, signal),
        },
        { source: "mcp", id: actor.id },
        digest,
      );
    result = {
      ...result,
      approved: true,
      proof_private: true,
      message:
        "The customer’s offline approval and proof were recorded. No customer email was sent.",
    };
  } else if (name === "send_customer_message") {
    const input = schemas.send_customer_message.parse(parsed);
    await mutatePilot({
      op: "reply",
      id: projectId,
      request_id: reference,
      body: input.body,
    });
    result = {
      saved: true,
      notification_delivery: await notificationDelivery(input.request_id),
    };
  } else if (name === "request_customer_payment") {
    const input = schemas.request_customer_payment.parse(parsed);
    result = await requestCustomerPayment({
      request_id: reference,
      project_id: projectId,
      approval_id: input.approval_id,
      expected_version: input.expected_version,
      phase: input.phase,
      expected_due_paise: rupeesToPaise(input.expected_due_inr),
      expected_paid_paise: Math.round(input.expected_paid_inr * 100),
    });
    result = {
      ...result,
      payment_collected: false,
      notification_delivery: await notificationDelivery(input.request_id),
    };
  } else if (name === "verify_customer_payment") {
    const input = schemas.verify_customer_payment.parse(parsed),
      amount = rupeesToPaise(input.amount_inr);
    await mutatePilot({
      op: "payment",
      id: projectId,
      request_id: reference,
      reference: input.reference,
      amount_paise: amount,
      expected_amount_paise: amount,
      confirmed_receipt: true,
      expected_quote_id: input.approval_id,
      expected_quote_version: input.expected_version,
      expected_paid_paise: Math.round(input.expected_paid_inr * 100),
    });
    result = {
      verified: true,
      reference: input.reference,
      amount_inr: input.amount_inr,
      notification_delivery: await notificationDelivery(input.request_id),
    };
  } else if (name === "create_shopify_order") {
    const input = schemas.create_shopify_order.parse(parsed);
    const [design] =
      await getSql()`SELECT id,version,status FROM customer_project_approvals WHERE project_id=${projectId}::uuid AND kind='design' ORDER BY version DESC LIMIT 1`;
    if (
      !design ||
      design.id !== input.design_id ||
      Number(design.version) !== input.expected_design_version ||
      design.status !== "approved"
    )
      throw new AgentOperationsError(
        "Read and review the latest approved artwork before creating the official order.",
      );
    const order = await createOrSyncShopifyOrder(input.request_id, true, {
      quoteId: input.approval_id,
      quoteVersion: input.expected_version,
      paidPaise: Math.round(input.expected_paid_inr * 100),
      createOnly: true,
      designId: input.design_id,
      designVersion: input.expected_design_version,
    });
    result = {
      shopify_order_reference: order,
      additional_payment_synced: false,
    };
  } else if (name === "create_customer_intake") {
    if (!(await operationsIntakeReady()))
      throw new AgentOperationsError(
        "Customer intake needs its reviewed database update. Open /setup/agent-operations.",
      );
    const input = schemas.create_customer_intake.parse(parsed);
    const [prior] =
      await getSql()`SELECT i.account_id,i.project_id,i.created_account,a.email,COALESCE(f.name,'') AS name FROM gyvft_operations_intakes i JOIN gyvft_customer_accounts a ON a.id=i.account_id LEFT JOIN gyvft_customer_profiles f ON f.account_id=a.id WHERE i.id=${reference}::uuid`;
    result = prior
      ? { ...prior, duplicate: true }
      : await createOperationsIntake({
          request_id: reference,
          customer: input.customer_id
            ? { kind: "existing", id: input.customer_id, email: input.email }
            : { kind: "new", name: input.name, email: input.email },
          requirement: input.requirement,
          files: await prepareMcpRequirementFiles(input.files, signal),
        });
    result = { ...result, email_sent: false };
  } else {
    const input = schemas.send_customer_setup_email.parse(parsed);
    result = await sendOperationsSetupEmail(input.customer_id, reference);
    if (result.state !== "sent") return result;
  }
  const url = projectId
    ? mcpOrigin() + "/operations/requests?request=" + projectId
    : undefined;
  return completeOperation(reference, {
    ...result,
    ...(url ? { operations_url: url } : {}),
  });
}
