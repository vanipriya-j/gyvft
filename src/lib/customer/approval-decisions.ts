import "server-only";
import type { Sql } from "postgres";
import { queueNotification } from "./notifications";
import { isDemoAccount } from "./demo-accounts";

export class ApprovalDecisionError extends Error {}
/** One approval decision for customer self-service and recorded offline consent. */
export async function applyApprovalDecision(
  tx: Sql,
  input: {
    projectId: string;
    approvalId: string;
    accountId: string | null;
    decision: "approved" | "changes_requested";
    response: string;
    notifyTeam: boolean;
  },
) {
  const { projectId: id, approvalId, accountId, decision, response } = input;
  const [project] =
    await tx`SELECT id,customer_account_id,customer_email,is_draft,submission_key FROM customer_projects WHERE id=${id}::uuid AND (${accountId === null} OR customer_account_id=${accountId}::uuid) FOR UPDATE`;
  if (
    !project ||
    project.is_draft ||
    String(project.submission_key || "").startsWith("gyvft-demo-") ||
    isDemoAccount(project.customer_account_id)
  )
    throw new ApprovalDecisionError("Submitted customer request unavailable.");
  const rows = await tx`WITH decision AS (
    UPDATE customer_project_approvals a SET status=${decision},customer_response=${response},decided_at=now()
    FROM customer_projects p WHERE a.id=${approvalId}::uuid AND a.project_id=p.id AND p.id=${id}::uuid
    AND p.stage<7 AND p.production_started_at IS NULL AND (${accountId === null} OR p.customer_account_id=${accountId}::uuid) AND a.status='pending'
    AND (a.kind<>'proposal' OR NOT EXISTS(SELECT 1 FROM gyvft_gift_selections s WHERE s.project_id=p.id) OR a.gift_selection_id=(SELECT s.id FROM gyvft_gift_selections s WHERE s.project_id=p.id ORDER BY s.created_at DESC,s.id DESC LIMIT 1))
    AND NOT EXISTS(SELECT 1 FROM customer_project_approvals newer WHERE newer.project_id=a.project_id AND newer.kind=a.kind AND newer.version>a.version)
    RETURNING a.project_id,a.title,a.version
  ) INSERT INTO customer_project_events(project_id,title,body) SELECT project_id,title||' · v'||version||${decision === "approved" ? " approved" : " — changes requested"},${response} FROM decision RETURNING id`;
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
        throw new ApprovalDecisionError(
          "The official order or receipts need reconciliation before approving this revision.",
        );
      await tx`UPDATE customer_projects SET kind='project',customer_type=COALESCE(customer_type,'b2c'),total_paise=${q.amount_paise},stage=CASE WHEN paid_paise>=ceil(${q.amount_paise}::numeric/2) THEN 5 ELSE 4 END,next_action='Your quote is approved. Pay the 50% advance; the balance is due before dispatch.' WHERE id=${id}::uuid`;
      await tx`DELETE FROM customer_order_items WHERE project_id=${id}::uuid`;
      for (const item of q.items)
        await tx`INSERT INTO customer_order_items(project_id,approval_id,name,quantity,unit_paise,item_type,personalisation) VALUES(${id}::uuid,${approvalId}::uuid,${item.name},${item.quantity},${item.unit_paise},${item.item_type},${item.personalisation || ""})`;
    }
  }
  if (rows[0] && input.notifyTeam)
    await queueNotification(
      tx,
      id,
      `approval:${rows[0].id}`,
      "team",
      project.customer_email,
      "GYVFT: customer approval decision",
    );
  return rows;
}
