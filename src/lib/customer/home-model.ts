/** Shared data contract; desktop and mobile choose their own presentation. */
export type Page<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
};
export function pageOf<T>(items: T[], offset: number, limit: number): Page<T> {
  return pageResult(
    items.slice(offset, offset + limit),
    items.length,
    offset,
    limit,
  );
}
export function pageResult<T>(
  items: T[],
  total: number,
  offset: number,
  limit: number,
): Page<T> {
  return {
    items,
    total,
    offset,
    limit,
    nextOffset:
      items.length > 0 && offset + items.length < total
        ? offset + items.length
        : null,
  };
}
export function financialYear(today: string) {
  const year =
    Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 4 ? 1 : 0);
  return {
    start: `${year}-04-01`,
    endExclusive: `${year + 1}-04-01`,
    label: `${year}–${String(year + 1).slice(-2)}`,
  };
}
export type GiftCard = {
  id: string;
  title: string;
  stage: number;
  stageLabel: string;
  nextAction: string;
  requestedDeliveryDate: string | null;
  occasionDate: string | null;
  quantityRange: string | null;
  image: string | null;
  demo: boolean;
  visibleOptionCount: number;
  action: {
    kind:
      | "options"
      | "proposal"
      | "design"
      | "payment"
      | "payment_verification"
      | "view";
    label: string;
    href: string;
    requiresAction: boolean;
  };
};
export function giftAction(input: {
  id: string;
  kind: string;
  stage: number;
  demo: boolean;
  total: number;
  paid: number;
  pendingKind: string | null;
  pendingPayment: boolean;
  options: number;
  quoteRequested: boolean;
}): GiftCard["action"] {
  const href = `/account/projects/${input.id}`;
  if (input.demo)
    return { kind: "view", label: "View sample", href, requiresAction: false };
  if (input.pendingKind === "design" || input.pendingKind === "proposal")
    return {
      kind: input.pendingKind,
      label: input.pendingKind === "design" ? "Review design" : "Review quote",
      href,
      requiresAction: true,
    };
  if (
    input.kind === "project" &&
    input.total > input.paid &&
    input.total > 0 &&
    input.stage < 10
  ) {
    if (input.pendingPayment)
      return {
        kind: "payment_verification",
        label: "Payment under review",
        href,
        requiresAction: false,
      };
    if (
      (input.stage === 4 && input.paid < Math.ceil(input.total / 2)) ||
      input.stage === 8
    )
      return {
        kind: "payment",
        label: input.stage === 4 ? "Pay advance" : "Pay balance",
        href,
        requiresAction: true,
      };
  }
  if (input.kind === "enquiry" && input.options > 0 && !input.quoteRequested)
    return {
      kind: "options",
      label: "Review options",
      href: `${href}/options`,
      requiresAction: true,
    };
  return { kind: "view", label: "View gift", href, requiresAction: false };
}
export type SavedIdea = {
  kind: "story" | "product";
  id: string;
  title: string;
  image: string;
  href: string;
  savedAt: string;
  availability: "published" | "available" | "unavailable" | "unknown";
};
