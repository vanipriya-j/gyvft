import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</section>;
}

export function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue" | "purple";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    purple: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", tones[tone])}>
      {children}
    </span>
  );
}

export function SubmitButton({
  children,
  destructive,
}: {
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      type="submit"
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2",
        destructive ? "bg-rose-600 text-white hover:bg-rose-500" : "bg-slate-950 text-white hover:bg-slate-800",
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClassName =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export const selectClassName = inputClassName;

export function DefinitionList({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="font-medium text-slate-500">{item.label}</dt>
          <dd className="text-slate-900 sm:col-span-2">{item.value || <span className="text-slate-400">Not set</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  params,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const makeHref = (nextPage: number) => {
    const search = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    search.set("page", String(nextPage));
    return `${basePath}?${search.toString()}`;
  };
  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-600">
      <span>
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex gap-2">
        <Link
          aria-disabled={page <= 1}
          className={cn(
            "rounded-lg border border-slate-300 px-3 py-2 font-medium",
            page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-slate-50",
          )}
          href={makeHref(Math.max(1, page - 1))}
        >
          Previous
        </Link>
        <Link
          aria-disabled={page >= totalPages}
          className={cn(
            "rounded-lg border border-slate-300 px-3 py-2 font-medium",
            page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-slate-50",
          )}
          href={makeHref(Math.min(totalPages, page + 1))}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatPercent(value: number | null) {
  if (value === null) return "No starts";
  return `${Math.round(value * 100)}%`;
}

export function humanize(value: string | null | undefined) {
  if (!value) return "Not set";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function statusTone(value: string): "slate" | "green" | "amber" | "red" | "blue" | "purple" {
  if (["won", "connected", "configured", "completed", "published", "active"].includes(value)) return "green";
  if (["lost", "error", "overdue", "disabled", "archived"].includes(value)) return "red";
  if (["proposal_sent", "negotiation", "in_progress", "paused"].includes(value)) return "amber";
  if (["new", "draft", "open"].includes(value)) return "blue";
  if (["urgent", "high"].includes(value)) return "purple";
  return "slate";
}
