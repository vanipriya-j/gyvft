/** The same domain task is used in the worklist and request detail. */
export function nextOperatorTask(p: {
  stage?: unknown;
  has_selection?: unknown;
  visible_options?: unknown;
  kind?: unknown;
  pending_payment?: unknown;
  quote_status?: unknown;
  design_status?: unknown;
  shopify_order_reference?: unknown;
}) {
  const stage = Number(p.stage);
  if (p.pending_payment)
    return { label: "Verify payment", waiting: "Aarla", tab: "payments" };
  if (stage >= 10)
    return {
      label: "Review feedback",
      waiting: "Customer · optional",
      tab: "moments",
    };
  if (stage >= 9)
    return {
      label: "Follow delivery",
      waiting: "Delivery partner",
      tab: "fulfilment",
    };
  if (stage >= 7)
    return {
      label: "Follow production",
      waiting: "Production team",
      tab: "fulfilment",
    };
  if (
    p.quote_status === "changes_requested" ||
    p.design_status === "changes_requested"
  )
    return {
      label: "Review requested changes",
      waiting: "Aarla",
      tab: "messages",
    };
  if (p.design_status === "pending")
    return {
      label: "Await artwork approval",
      waiting: "Customer",
      tab: "design",
    };
  if (p.design_status === "approved")
    return {
      label: p.shopify_order_reference
        ? "Start production"
        : "Create official order",
      waiting: "Aarla",
      tab: "fulfilment",
    };
  if (stage >= 5)
    return { label: "Prepare artwork", waiting: "Aarla", tab: "design" };
  if (stage === 4)
    return { label: "Await 50% advance", waiting: "Customer", tab: "payments" };
  if (p.quote_status === "pending")
    return { label: "Await quote approval", waiting: "Customer", tab: "quote" };
  if (p.quote_status === "approved")
    return {
      label: "Create official order",
      waiting: "Aarla",
      tab: "fulfilment",
    };
  if (stage === 3)
    return { label: "Prepare quote", waiting: "Aarla", tab: "quote" };
  if (p.has_selection)
    return { label: "Prepare quote", waiting: "Aarla", tab: "quote" };
  if (p.visible_options)
    return { label: "Await gift choice", waiting: "Customer", tab: "options" };
  return { label: "Curate gift options", waiting: "Aarla", tab: "options" };
}
