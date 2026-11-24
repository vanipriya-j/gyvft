import { nextOperatorTask } from "./next-task";

export type ConversionProject = {
  id: string;
  title: string;
  customer_email: string;
  created_at: string;
  stage: number;
  kind: string;
  task_owner: string;
  shopify_order_reference: string | null;
  has_options: boolean;
  visible_options: boolean;
  has_selection: boolean;
  has_quote: boolean;
  approved_quote: boolean;
  verified_payment: boolean;
  pending_payment: boolean;
  paid_paise: string;
  quote_status: string | null;
  design_status: string | null;
  quote_paise: string;
  shared_at: string | null;
  decided_at: string | null;
  last_customer: string | null;
  last_team: string | null;
  last_activity: string | null;
};
export type ConversionSettings = { windowDays: number; stalledDays: number };
const timestamp = (value: string | null) =>
  value ? new Date(value).getTime() || 0 : 0;
const latest = (...values: (string | null)[]) =>
  Math.max(...values.map(timestamp));
export function conversionFacts(
  projects: ConversionProject[],
  settings: ConversionSettings,
  asOf = new Date(),
) {
  const now = asOf.getTime(),
    day = 86400000;
  const cohort = projects.filter(
    (p) =>
      timestamp(p.created_at) <= now &&
      (!settings.windowDays ||
        timestamp(p.created_at) >= now - settings.windowDays * day),
  );
  const count = (fn: (p: ConversionProject) => boolean) =>
    cohort.filter(fn).length;
  const quoted = count((p) => p.has_quote),
    approved = count((p) => p.has_quote && p.approved_quote);
  const paid = count((p) => p.has_quote && p.verified_payment);
  const followUps = projects
    .flatMap((p) => {
      if (p.stage >= 7 || timestamp(p.created_at) > now) return [];
      const task = nextOperatorTask(p);
      let waiting = task.waiting,
        tab = task.tab,
        action = task.label;
      const unanswered =
        timestamp(p.last_customer) > latest(p.last_team, p.shared_at);
      if (unanswered && !p.pending_payment) {
        waiting = "Aarla";
        tab = "messages";
        action = "Reply to customer";
      }
      const since = latest(
        p.created_at,
        p.shared_at,
        p.decided_at,
        p.last_activity,
        p.last_customer,
        p.last_team,
      );
      const age = Math.max(0, Math.floor((now - since) / day));
      if (age < settings.stalledDays || !Number.isFinite(age)) return [];
      return [
        {
          id: p.id,
          title: p.title,
          email: p.customer_email,
          waiting,
          action,
          tab,
          days: age,
          since: new Date(since).toISOString(),
          owner: p.task_owner || "Aarla",
          quotePaise: p.quote_paise || "0",
          proposal:
            p.quote_status === "pending" &&
            waiting === "Customer" &&
            tab === "quote",
        },
      ];
    })
    .sort((a, b) => b.days - a.days || a.id.localeCompare(b.id));
  const milestones = [
    { key: "requests", label: "Requests submitted", count: cohort.length },
    {
      key: "options",
      label: "Options published",
      count: count((p) => p.has_options),
    },
    {
      key: "selected",
      label: "Gift selected",
      count: count((p) => p.has_selection),
    },
    { key: "quoted", label: "Quote shared", count: quoted },
    { key: "approved", label: "Quote approved", count: approved },
    {
      key: "paid",
      label: "Payment verified",
      count: count((p) => p.verified_payment),
    },
    {
      key: "ordered",
      label: "Shopify order linked",
      count: count((p) => !!p.shopify_order_reference),
    },
    {
      key: "delivered",
      label: "Delivered",
      count: count((p) => p.stage >= 10),
    },
  ];
  return {
    generatedAt: asOf.toISOString(),
    ...settings,
    cohortCount: cohort.length,
    milestones,
    quoteApproval: { numerator: approved, denominator: quoted },
    quoteToPayment: { numerator: paid, denominator: quoted },
    verifiedPaise: cohort
      .reduce((sum, p) => sum + BigInt(p.paid_paise || "0"), BigInt(0))
      .toString(),
    followUps,
    stalledProposals: followUps.filter((p) => p.proposal).length,
    waitingCustomer: followUps.filter((p) => p.waiting === "Customer").length,
    waitingAarla: followUps.filter((p) => p.waiting !== "Customer").length,
  };
}

/** Spreadsheet cells cannot execute titles or customer-entered text as formulas. */
export function reportCsv(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let value = String(cell ?? "");
          if (/^[\s]*[=+@\-]/.test(value)) value = "'" + value;
          return '"' + value.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
