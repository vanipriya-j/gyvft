import type { CustomerProject } from "./data";
import { storyRequestSchema } from "./story-request";
export type RequestRow = {
  id: string;
  title: string;
  kind: string;
  stage: number;
  nextAction: string;
  organisation: string;
  occasion: string;
  formats: string[];
  quantity: string;
  budget: string;
  briefDate: string | null;
  datePrecision: string;
  occasionDate: string | null;
  deliveryDate: string | null;
  paidPaise: number;
  totalPaise: number | null;
  createdAt: string;
  demo: boolean;
};
export type Occasion = {
  id: string;
  title: string;
  occasion_date: string;
  repeats_annually: boolean;
};
export type PendingApproval = {
  id: string;
  project_id: string;
  project_title: string;
  title: string;
  kind: string;
  version: number;
};
export type Idea = {
  slug: string;
  title: string;
  summary: string;
  group: string;
  image: string;
  alt: string;
};
export const finiteMoney = (value: unknown) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
};
export function dateKey(value: unknown): string | null {
  const s =
    value instanceof Date
      ? Number.isNaN(value.getTime())
        ? ""
        : value.toISOString().slice(0, 10)
      : typeof value === "string"
        ? value.slice(0, 10)
        : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number(s.slice(0, 4)) < 1) return null;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
    ? s
    : null;
}
const indiaDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function indiaToday(now = new Date()) {
  const parts = indiaDayFormatter.formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)?.value)
    .join("-");
}

export function summarizeRequests(projects: CustomerProject[]): RequestRow[] {
  return projects.map((p) => {
    const parsed = storyRequestSchema.safeParse(p.gift_brief);
    const brief = parsed.success ? parsed.data : null;
    return {
      id: p.id,
      title: p.title,
      kind: p.kind,
      stage: p.stage,
      nextAction: p.next_action,
      organisation: p.organisation_name || brief?.organisation_name || "",
      occasion: brief
        ? brief.occasion_type === "Other"
          ? brief.occasion_other || "Other"
          : brief.occasion_type
        : "Not specified",
      formats: brief?.preferred_formats || [],
      quantity: brief?.quantity_range || "",
      budget: brief?.budget_range || "",
      briefDate: dateKey(brief?.target_date || p.target_date),
      datePrecision: brief?.target_date_precision || "unspecified",
      occasionDate: dateKey(p.occasion_date),
      deliveryDate: dateKey(p.delivery_date),
      paidPaise: finiteMoney(p.paid_paise),
      totalPaise: p.total_paise == null ? null : finiteMoney(p.total_paise),
      createdAt: String(p.created_at),
      demo: Boolean(p.submission_key?.startsWith("gyvft-demo-")),
    };
  });
}
/** A Feb 29 anniversary is displayed on Feb 28 in a non-leap year. The saved
 * date is unchanged, so it returns to Feb 29 in the next leap year. */
export function nextOccasionDate(
  occasion: Occasion,
  today: string,
): string | null {
  const original = dateKey(occasion.occasion_date);
  if (!original) return null;
  if (!occasion.repeats_annually) return original >= today ? original : null;
  if (original.slice(0, 4) > today.slice(0, 4)) return original;
  const year = Number(today.slice(0, 4));
  const monthDay = original.slice(5);
  const inYear = (y: number) =>
    dateKey(`${y}-${monthDay}`) || (monthDay === "02-29" ? `${y}-02-28` : null);
  const thisYear = inYear(year);
  return thisYear && thisYear >= today ? thisYear : inYear(year + 1);
}
export type Upcoming = {
  id: string;
  title: string;
  date: string;
  kind: "occasion" | "delivery";
  href: string | null;
  annual: boolean;
};
export function upcomingDates(
  requests: RequestRow[],
  occasions: Occasion[],
  today: string,
  includeDemo = false,
): Upcoming[] {
  const result: Upcoming[] = [];
  for (const o of occasions) {
    const date = nextOccasionDate(o, today);
    if (date)
      result.push({
        id: o.id,
        title: o.title,
        date,
        kind: "occasion",
        href: null,
        annual: o.repeats_annually,
      });
  }
  for (const r of requests.filter(
    (r) => r.stage < 10 && (includeDemo || !r.demo),
  )) {
    if (r.occasionDate && r.occasionDate >= today)
      result.push({
        id: `${r.id}-occasion`,
        title: r.title,
        date: r.occasionDate,
        kind: "occasion",
        href: `/account/projects/${r.id}`,
        annual: false,
      });
    if (r.deliveryDate && r.deliveryDate >= today)
      result.push({
        id: `${r.id}-delivery`,
        title: r.title,
        date: r.deliveryDate,
        kind: "delivery",
        href: `/account/projects/${r.id}`,
        annual: false,
      });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
export function dashboardStats(requests: RequestRow[]) {
  const real = requests.filter((r) => !r.demo);
  const sampleMode = real.length === 0 && requests.some((r) => r.demo);
  const activity = sampleMode ? requests : real;
  return {
    sampleMode,
    activity,
    total: activity.length,
    open: activity.filter((r) => r.stage < 10).length,
    completed: activity.filter((r) => r.stage >= 10).length,
    paidPaise: real
      .filter((r) => r.kind === "project")
      .reduce((sum, r) => sum + r.paidPaise, 0),
    balancePaise: real
      .filter((r) => r.kind === "project" && r.totalPaise !== null)
      .reduce(
        (sum, r) => sum + Math.max(0, (r.totalPaise || 0) - r.paidPaise),
        0,
      ),
  };
}
export function requestActivity(requests: RequestRow[], today: string) {
  const year = Number(today.slice(0, 4)),
    month = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 5 + i, 1));
    const key = d.toISOString().slice(0, 7);
    return {
      key,
      label: d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
      count: requests.filter((r) => {
        const date = new Date(r.createdAt);
        return (
          !Number.isNaN(date.getTime()) && indiaToday(date).slice(0, 7) === key
        );
      }).length,
    };
  });
}
export function formatCounts(requests: RequestRow[]) {
  const counts = new Map<string, number>();
  for (const r of requests)
    for (const f of new Set(r.formats)) counts.set(f, (counts.get(f) || 0) + 1);
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
export function filterRequests(
  requests: RequestRow[],
  query: string,
  filter: string,
  sort: string,
) {
  const q = query.trim().toLocaleLowerCase();
  return requests
    .filter(
      (r) =>
        (!q ||
          [r.title, r.organisation, r.occasion, r.nextAction, ...r.formats]
            .join(" ")
            .toLocaleLowerCase()
            .includes(q)) &&
        (filter === "all" ||
          (filter === "open" && r.stage < 10) ||
          (filter === "completed" && r.stage >= 10) ||
          (filter === "enquiry" && r.kind === "enquiry") ||
          (filter === "project" && r.kind === "project")),
    )
    .sort((a, b) =>
      sort === "delivery"
        ? (a.deliveryDate || "9999").localeCompare(b.deliveryDate || "9999")
        : sort === "oldest"
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}
