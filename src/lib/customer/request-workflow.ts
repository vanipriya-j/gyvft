/** Domain state shared by customer and operator views; no routes or screen layout. */
export type ApprovalVersion = {
  id: string;
  kind: string;
  version: number;
  status: string;
  gift_selection_id?: string | null;
};
export function latestApproval<T extends ApprovalVersion>(
  approvals: T[],
  kind: string,
) {
  return (
    approvals
      .filter((a) => a.kind === kind)
      .sort((a, b) => b.version - a.version)[0] ?? null
  );
}
export function requestWorkflow(input: {
  kind: string;
  stage: number;
  total: number;
  paid: number;
  approvals: ApprovalVersion[];
  selectionId: string | null;
  visibleOptions: number;
  pendingPayment: boolean;
}) {
  const proposal = latestApproval(input.approvals, "proposal");
  const design = latestApproval(input.approvals, "design");
  const currentQuote =
    proposal &&
    (!input.selectionId || proposal.gift_selection_id === input.selectionId)
      ? proposal
      : null;
  if (input.kind === "enquiry") {
    if (currentQuote?.status === "pending") return "quote_review";
    if (currentQuote?.status === "changes_requested") return "quote_changes";
    if (currentQuote?.status === "approved") return "quote_approved";
    if (input.selectionId) return "quote_requested";
    if (input.visibleOptions > 0) return "options_ready";
    return "curation";
  }
  if (input.stage >= 11) return "completed";
  if (input.stage >= 10) return "delivered";
  if (input.stage >= 9) return "dispatched";
  const advanceDue = input.total > 0 && input.paid < Math.ceil(input.total / 2);
  const balanceDue = input.total > input.paid && input.stage >= 8;
  if ((advanceDue || balanceDue) && input.pendingPayment)
    return "payment_review";
  if (advanceDue) return "advance_due";
  if (design?.status === "pending") return "design_review";
  if (design?.status === "changes_requested") return "design_changes";
  if (balanceDue) return "balance_due";
  if (input.stage >= 8) return "packing";
  if (input.stage >= 7) return "production";
  return "design_in_progress";
}
export type RequestWorkflow = ReturnType<typeof requestWorkflow>;
export const requestStateLabels: Record<RequestWorkflow, string> = {
  curation: "Curation in progress",
  options_ready: "Options ready",
  quote_requested: "Quote requested",
  quote_review: "Quote ready",
  quote_changes: "Quote changes requested",
  quote_approved: "Quote approved",
  advance_due: "Advance due",
  payment_review: "Payment under review",
  design_review: "Design ready",
  design_changes: "Design changes requested",
  design_in_progress: "Design in progress",
  production: "In production",
  balance_due: "Balance due",
  packing: "Quality check & packing",
  dispatched: "Dispatched",
  delivered: "Delivered",
  completed: "Completed",
};
