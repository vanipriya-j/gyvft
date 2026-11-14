"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useActionState, useId, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowDownLeft,
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Gift,
  LayoutDashboard,
  ListFilter,
  Plus,
  Search,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import {
  addOccasion,
  removeOccasion,
  saveIdea,
} from "@/app/account/dashboard-actions";
import { ActionForm, type ActionResult } from "./action-form";
import {
  dashboardStats,
  filterRequests,
  formatCounts,
  nextOccasionDate,
  requestActivity,
  upcomingDates,
  type Idea,
  type Occasion,
  type PendingApproval,
  type RequestRow,
} from "@/lib/customer/dashboard-model";
import { money, stages } from "@/lib/customer/model";
const panel = "rounded-2xl border border-border bg-paper";
const field =
  "w-full rounded-xl border border-border bg-paper px-3 py-2.5 text-sm outline-none focus:border-olive focus:ring-2 focus:ring-olive/15";
const smallButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition hover:bg-surface disabled:cursor-wait disabled:opacity-50";
const fullDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
type View = "overview" | "requests" | "occasions" | "ideas";
type Props = {
  requests: RequestRow[];
  occasions: Occasion[];
  approvals: PendingApproval[];
  savedSlugs: string[];
  ideas: Idea[];
  today: string;
  setupRequired: boolean;
};
function PendingButton({
  children,
  label,
  disabled = false,
}: {
  children: React.ReactNode;
  label?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending || disabled}
      aria-label={label}
      className={smallButton}
    >
      {pending ? <span className="animate-pulse">Saving…</span> : children}
    </button>
  );
}
function InlineAction({
  action,
  children,
  label,
  disabled = false,
}: {
  disabled?: boolean;
  action: (data: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  label?: string;
}) {
  const router = useRouter();
  const [state, submit] = useActionState(
    async (_: ActionResult, data: FormData) => {
      try {
        const result = await action(data);
        if (result.ok) router.refresh();
        return result;
      } catch {
        return {
          ok: false,
          message: "We couldn’t save that. Please try again.",
        };
      }
    },
    { ok: false, message: "" },
  );
  return (
    <form action={submit}>
      <PendingButton label={label} disabled={disabled}>
        {children}
      </PendingButton>
      <p
        role="status"
        className={state.ok ? "sr-only" : "mt-1 text-xs text-red-800"}
      >
        {state.message}
      </p>
    </form>
  );
}
function ActivityChart({
  requests,
  today,
}: {
  requests: RequestRow[];
  today: string;
}) {
  const id = useId().replaceAll(":", "");
  const values = requestActivity(requests, today);
  const max = Math.max(1, ...values.map((v) => v.count));
  const total = values.reduce((n, v) => n + v.count, 0);
  const points = values
    .map((v, i) => `${20 + i * 88},${112 - (v.count / max) * 85}`)
    .join(" ");
  return (
    <div className={`${panel} p-5 md:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-medium">Your gifting rhythm</h2>
          <p className="mt-1 text-xs text-muted-text">
            Requests started over the last six months
          </p>
        </div>
        <span className="text-xs text-muted-text">
          {total} {total === 1 ? "request" : "requests"}
        </span>
      </div>
      <svg
        viewBox="0 0 480 135"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Requests by month: ${values.map((v) => `${v.label} ${v.count}`).join(", ")}`}
        className="mt-5 h-32 w-full overflow-visible"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#85876c" stopOpacity=".28" />
            <stop offset="100%" stopColor="#85876c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[28, 70, 112].map((y) => (
          <line
            key={y}
            x1="20"
            x2="460"
            y1={y}
            y2={y}
            stroke="#ded8cc"
            strokeDasharray="3 5"
          />
        ))}
        <polygon points={`20,125 ${points} 460,125`} fill={`url(#${id})`} />
        <polyline
          points={points}
          fill="none"
          stroke="#73765c"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {values.map((v, i) => (
          <g key={v.key}>
            <circle
              cx={20 + i * 88}
              cy={112 - (v.count / max) * 85}
              r="4"
              fill="#73765c"
              stroke="#fbf8f2"
              strokeWidth="2"
            />
            <text
              x={20 + i * 88}
              y={101 - (v.count / max) * 85}
              textAnchor="middle"
              fontSize="14"
              fill="#625b50"
            >
              {v.count}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex justify-between px-2 text-xs text-muted-text">
        {values.map((v) => (
          <span key={v.key}>{v.label}</span>
        ))}
      </div>
    </div>
  );
}
function FormatChart({ requests }: { requests: RequestRow[] }) {
  const values = formatCounts(requests);
  const max = Math.max(1, ...values.map((v) => v.count));
  return (
    <section className={`${panel} p-5 md:p-6`}>
      <h2 className="font-medium">What catches your eye</h2>
      <p className="mt-1 text-xs text-muted-text">
        Formats requested in your briefs
      </p>
      {values.length ? (
        <div className="mt-6 space-y-4">
          {values.map((v, i) => (
            <div key={v.label}>
              <div className="mb-1.5 flex justify-between gap-3 text-xs">
                <span>{v.label}</span>
                <span className="text-muted-text">{v.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface">
                <div
                  className={`h-1.5 rounded-full ${i % 2 ? "bg-copper/60" : "bg-olive/70"}`}
                  style={{ width: `${(v.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-7 flex items-start gap-3 text-sm text-muted-text">
          <Sparkles size={19} className="shrink-0 text-olive" />
          <p>
            Your preferences will take shape as you share briefs. Explore a few
            ideas to get started.
          </p>
        </div>
      )}
      <p className="mt-5 text-xs text-muted-text">
        Request preferences, not purchase counts.
      </p>
    </section>
  );
}
function RequestList({
  requests,
  compact = false,
}: {
  requests: RequestRow[];
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const rows = useMemo(
    () => filterRequests(requests, query, filter, sort),
    [requests, query, filter, sort],
  );
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const actualPage = Math.min(page, pages);
  const visible = compact
    ? rows.slice(0, 5)
    : rows.slice((actualPage - 1) * 10, actualPage * 10);
  const timing = (r: RequestRow) => (
    <div className="space-y-1 text-xs text-muted-text">
      {r.occasionDate && <p>Occasion · {fullDate(r.occasionDate)}</p>}
      {r.deliveryDate && <p>Delivery requested · {fullDate(r.deliveryDate)}</p>}
      {!r.occasionDate && !r.deliveryDate && (
        <p>
          {r.briefDate
            ? `Brief target · ${fullDate(r.briefDate)} (${r.datePrecision})`
            : "Dates to be added"}
        </p>
      )}
    </div>
  );
  const badge = (r: RequestRow) => (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs ${r.stage >= 10 ? "bg-emerald-50 text-emerald-800" : r.stage === 6 ? "bg-amber-50 text-amber-900" : "bg-surface text-olive-dark"}`}
    >
      {stages[r.stage] || "In progress"}
    </span>
  );
  return (
    <div>
      {!compact && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-64">
            <span className="sr-only">Search requests</span>
            <Search
              size={16}
              className="absolute left-3 top-3 text-muted-text"
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search a request, occasion or organisation"
              className={`${field} pl-9`}
            />
          </label>
          <label>
            <span className="sr-only">Filter requests</span>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className={field}
            >
              <option value="all">All requests</option>
              <option value="open">Open</option>
              <option value="completed">Delivered / completed</option>
              <option value="enquiry">Enquiries</option>
              <option value="project">Projects</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Sort requests</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className={field}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="delivery">Next delivery date</option>
            </select>
          </label>
        </div>
      )}
      {visible.length ? (
        <div className={`${panel} overflow-hidden`}>
          <div className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface/50 text-xs text-muted-text">
                <tr>
                  {["Request", "Status", "Dates", "Budget", "Next step"].map(
                    (c) => (
                      <th key={c} scope="col" className="px-4 py-3 font-medium">
                        {c}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    className="align-top transition hover:bg-surface/40"
                  >
                    <td className="max-w-[250px] px-4 py-4">
                      <Link
                        href={`/account/projects/${r.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted-text">
                        {r.kind === "project" ? "Project" : "Enquiry"}
                        {r.organisation ? ` · ${r.organisation}` : ""}
                        {r.demo ? " · DEMO" : ""}
                      </p>
                      {r.quantity && (
                        <p className="mt-1 text-xs text-muted-text">
                          Quantity: {r.quantity}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">{badge(r)}</td>
                    <td className="min-w-36 px-4 py-4">{timing(r)}</td>
                    <td className="px-4 py-4 text-xs">
                      {r.totalPaise !== null ? (
                        <>
                          <p>{money(r.totalPaise)}</p>
                          <span className="text-muted-text">Quoted</span>
                        </>
                      ) : r.budget ? (
                        <>
                          <p>{r.budget}</p>
                          <span className="text-muted-text">Brief range</span>
                        </>
                      ) : (
                        <span className="text-muted-text">Not quoted</span>
                      )}
                    </td>
                    <td className="max-w-[230px] px-4 py-4 text-xs leading-5 text-muted-text">
                      {r.nextAction}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-border md:hidden">
            {visible.map((r) => (
              <Link
                key={r.id}
                href={`/account/projects/${r.id}`}
                className="block px-4 py-4 transition hover:bg-surface/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="break-words text-sm font-medium leading-5">
                    {r.title}
                  </h3>
                  <ArrowRight size={16} className="mt-1 shrink-0 text-olive" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {badge(r)}
                  <span className="text-xs text-muted-text">
                    {r.kind}
                    {r.demo ? " · DEMO" : ""}
                  </span>
                </div>
                <div className="mt-3">{timing(r)}</div>
                <p className="mt-2 text-xs leading-5 text-muted-text">
                  {r.nextAction}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className={`${panel} px-6 py-10 text-center`}>
          <Search className="mx-auto text-olive" size={22} />
          <p className="mt-3 font-medium">
            {requests.length
              ? "No matching requests"
              : "Your next story starts here."}
          </p>
          <p className="mt-2 text-sm text-muted-text">
            {requests.length
              ? "Try a different search or filter."
              : "Start a new story, or save an idea for your next occasion."}
          </p>
          {requests.length ? (
            <button
              className="mt-4 text-sm underline"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
            </button>
          ) : (
            <Link href="/tell-your-story" className={`${smallButton} mt-4`}>
              Start a new story <ArrowRight size={14} />
            </Link>
          )}
        </div>
      )}
      {!compact && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-text">
          <span>
            {rows.length} {rows.length === 1 ? "request" : "requests"}
            {rows.some((r) => r.demo)
              ? " · sample requests are labelled DEMO"
              : ""}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-3">
              <button
                className={smallButton}
                disabled={actualPage === 1}
                onClick={() => setPage(actualPage - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                Page {actualPage} of {pages}
              </span>
              <button
                className={smallButton}
                disabled={actualPage === pages}
                onClick={() => setPage(actualPage + 1)}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function MoreToDiscover() {
  return (
    <section className="rounded-2xl border border-border bg-surface/50 p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-olive" />
        <h2 className="text-sm font-medium">A little more to discover</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Something to play",
            copy: "Games and small discoveries for curious minds.",
            path: "play-and-learn",
          },
          {
            title: "A story to take home",
            copy: "Books that make room for culture and imagination.",
            path: "books",
          },
          {
            title: "A little piece of Madras",
            copy: "Everyday objects with a sense of place.",
            path: "madras",
          },
        ].map((item) => (
          <a
            key={item.path}
            href={`https://aarla.in/collections/${item.path}?utm_source=gyvft&utm_medium=customer_dashboard&utm_campaign=discovery`}
            target="_blank"
            rel="noopener noreferrer"
            className="group min-w-0 rounded-xl p-2 transition hover:bg-paper"
          >
            <p className="break-words text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-text">
              {item.copy}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs text-olive-dark">
              Explore at Aarla <ArrowRight size={12} />
              <span className="sr-only"> (opens in a new tab)</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function GiftingDashboard({
  requests,
  occasions,
  approvals,
  savedSlugs,
  ideas,
  today,
  setupRequired,
}: Props) {
  const [view, setView] = useState<View>("overview");
  const [addOpen, setAddOpen] = useState(false);
  const [ideaFilter, setIdeaFilter] = useState("all");
  const stats = dashboardStats(requests),
    upcoming = upcomingDates(requests, occasions, today, stats.sampleMode);
  const ideasShown = ideas.filter((i) =>
    ideaFilter === "saved"
      ? savedSlugs.includes(i.slug)
      : ideaFilter === "all" || i.group === ideaFilter,
  );
  const go = (next: View) => {
    setView(next);
  };
  const tabs = [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
    { id: "requests" as const, label: "Requests", icon: ListFilter },
    { id: "occasions" as const, label: "Occasions", icon: CalendarDays },
    { id: "ideas" as const, label: "Ideas", icon: Sparkles },
  ];
  function calendar(limit?: number) {
    const entries = limit ? upcoming.slice(0, limit) : upcoming;
    return entries.length ? (
      <div className="divide-y divide-border">
        {entries.map((item) => (
          <div key={item.id} className="flex gap-4 py-3">
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-surface text-olive-dark">
              <span className="text-[10px] uppercase">
                {new Date(item.date + "T00:00:00Z").toLocaleDateString(
                  "en-IN",
                  { month: "short", timeZone: "UTC" },
                )}
              </span>
              <span className="text-lg leading-5">
                {Number(item.date.slice(8))}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-sm font-medium hover:underline"
                >
                  {item.title}
                </Link>
              ) : (
                <p className="break-words text-sm font-medium">{item.title}</p>
              )}
              <p className="mt-1 text-xs text-muted-text">
                {item.kind === "delivery" ? "Requested delivery" : "Occasion"}
                {item.annual ? " · repeats yearly" : ""} ·{" "}
                {item.date.slice(0, 4)}
              </p>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="py-6 text-sm text-muted-text">
        <CalendarDays size={24} className="mb-3 text-olive" />
        <p>A birthday, a visit, a little thank-you.</p>
        <p className="mt-1">
          Add a date to make room for the next thoughtful gift.
        </p>
      </div>
    );
  }
  function ideaCards(limit?: number) {
    const source = limit ? ideasShown.slice(0, limit) : ideasShown;
    return source.length ? (
      <div
        className={
          limit
            ? "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3"
            : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {source.map((idea) => (
          <article
            key={idea.slug}
            className={`${panel} overflow-hidden ${limit ? "w-[85%] shrink-0 snap-start sm:w-auto" : ""}`}
          >
            <Link href={`/stories/${idea.slug}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden bg-surface">
                <Image
                  src={idea.image}
                  alt={idea.alt}
                  fill
                  sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="px-5 pt-4">
                <p className="text-[10px] uppercase tracking-widest text-olive">
                  From our stories
                </p>
                <h3 className="mt-2 font-serif text-xl leading-6">
                  {idea.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-text">
                  {idea.summary}
                </p>
              </div>
            </Link>
            <div className="flex items-center justify-between gap-2 px-5 pb-5 pt-4">
              <Link
                href={`/stories/${idea.slug}`}
                className="inline-flex items-center gap-1 text-xs text-olive-dark"
              >
                Explore the story <ArrowRight size={13} />
              </Link>
              <InlineAction
                disabled={setupRequired}
                action={saveIdea}
                label={
                  savedSlugs.includes(idea.slug)
                    ? `Unsave ${idea.title}`
                    : `Save ${idea.title}`
                }
              >
                <input type="hidden" name="slug" value={idea.slug} />
                <input
                  type="hidden"
                  name="intent"
                  value={savedSlugs.includes(idea.slug) ? "remove" : "save"}
                />
                <Bookmark
                  size={14}
                  fill={
                    savedSlugs.includes(idea.slug) ? "currentColor" : "none"
                  }
                />
                {savedSlugs.includes(idea.slug) ? "Saved" : "Save"}
              </InlineAction>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className={`${panel} p-8 text-sm text-muted-text`}>
        No saved ideas yet. Browse the stories and save a few that feel right.
      </div>
    );
  }
  return (
    <div>
      <nav
        aria-label="Gifting workspace"
        className="mb-7 flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={view === tab.id}
            onClick={() => go(tab.id)}
            className={`inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 border-b-2 px-2 py-3 text-xs transition sm:flex-none sm:gap-2 sm:px-3 sm:text-sm md:px-5 ${view === tab.id ? "border-olive text-olive-dark" : "border-transparent text-muted-text hover:text-ink"}`}
          >
            <tab.icon size={15} className="hidden sm:block" />
            {tab.label}
            {tab.id === "ideas" && savedSlugs.length > 0 && (
              <span
                aria-hidden="true"
                className="rounded-full bg-surface px-1.5 text-[10px]"
              >
                {savedSlugs.length}
              </span>
            )}
          </button>
        ))}
      </nav>
      {setupRequired && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Your requests are available. Calendar and saved ideas need the latest
          database setup; ask the GYVFT team to finish the update.
        </div>
      )}
      {view === "overview" && (
        <div className="space-y-7">
          {stats.sampleMode && (
            <p className="rounded-xl bg-surface px-4 py-3 text-xs leading-5 text-muted-text">
              You’re exploring labelled sample requests. Activity counts below
              are examples; sample budgets are excluded from money totals.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Open requests",
                value: stats.open,
                sub: "Stories taking shape",
                icon: Gift,
              },
              {
                label: "Upcoming occasions",
                value: upcoming.filter((u) => u.kind === "occasion").length,
                sub: "Dates you have explicitly saved",
                icon: CalendarDays,
              },
              {
                label: "Recorded spend",
                value: money(stats.paidPaise),
                sub: "Recorded project payments",
                icon: Wallet,
              },
              {
                label: "Awaiting approval",
                value: approvals.length,
                sub: "Proposals and designs to review",
                icon: Check,
              },
            ].map((item) => (
              <div key={item.label} className={`${panel} p-4 md:p-5`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-text">{item.label}</span>
                  <item.icon size={15} className="shrink-0 text-olive" />
                </div>
                <p className="mt-3 break-words font-serif text-2xl md:text-3xl">
                  {item.value}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-muted-text">
                  {item.sub}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <ActivityChart requests={stats.activity} today={today} />
            <section className={`${panel} p-5 md:p-6`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">Coming up</h2>
                  <p className="mt-1 text-xs text-muted-text">
                    Occasions and requested deliveries, kept separate
                  </p>
                </div>
                <button
                  className="shrink-0 whitespace-nowrap text-xs text-olive-dark underline"
                  onClick={() => go("occasions")}
                >
                  View all
                </button>
              </div>
              {calendar(3)}
              <button
                onClick={() => {
                  go("occasions");
                  setAddOpen(true);
                }}
                disabled={setupRequired}
                className={`${smallButton} mt-2`}
              >
                <Plus size={14} /> Add an occasion
              </button>
            </section>
          </div>
          {approvals.length > 0 && (
            <section className={`${panel} p-5`}>
              <h2 className="font-medium">A little attention needed</h2>
              <div className="mt-3 divide-y divide-border">
                {approvals.slice(0, 4).map((a) => (
                  <Link
                    key={a.id}
                    href={`/account/projects/${a.project_id}`}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="text-sm">
                        {a.title}{" "}
                        <span className="text-xs text-muted-text">
                          · v{a.version}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-text">
                        {a.project_title}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-olive-dark">
                      Review <ArrowRight size={13} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[.18em] text-olive">
                  A little inspiration
                </p>
                <h2 className="mt-1 font-serif text-2xl">
                  What could your next gift become?
                </h2>
              </div>
              <button
                onClick={() => go("ideas")}
                className="shrink-0 text-xs text-olive-dark underline"
              >
                All ideas
              </button>
            </div>
            {ideaCards(3)}
          </section>
          <MoreToDiscover />
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">Your recent requests</h2>
              <button
                onClick={() => go("requests")}
                className="shrink-0 whitespace-nowrap text-xs text-olive-dark underline"
              >
                View all {requests.length}
              </button>
            </div>
            <RequestList requests={requests} compact />
          </section>
          <div className="grid gap-5 md:grid-cols-2">
            <FormatChart requests={stats.activity} />
            <section className={`${panel} p-5 md:p-6`}>
              <div className="flex items-center gap-2">
                <ArrowDownLeft size={17} className="text-olive" />
                <h2 className="font-medium">Your gifting story so far</h2>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="font-serif text-3xl">{stats.completed}</p>
                  <p className="mt-1 text-xs text-muted-text">
                    Delivered / completed requests
                  </p>
                </div>
                <div>
                  <p className="font-serif text-2xl">
                    {money(stats.balancePaise)}
                  </p>
                  <p className="mt-1 text-xs text-muted-text">
                    Remaining on quoted projects
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-sm">Your most ordered gifts</p>
                <p className="mt-2 text-xs leading-5 text-muted-text">
                  No item purchase history yet. Your favourite products will
                  appear here when item-level order history is available.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
      {view === "requests" && (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Your requests</h2>
              <p className="mt-2 text-sm text-muted-text">
                One place for enquiries, projects and the next step.
              </p>
            </div>
            <Link href="/tell-your-story" className={smallButton}>
              <Plus size={14} /> New request
            </Link>
          </div>
          <RequestList requests={requests} />
        </section>
      )}
      {view === "occasions" && (
        <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className={`${panel} p-5 md:p-6`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">
                  Make room for meaningful moments
                </h2>
                <p className="mt-2 text-sm text-muted-text">
                  Birthdays, visits, milestones. For home, work and everyone in
                  between.
                </p>
              </div>
              <CalendarDays className="shrink-0 text-olive" size={22} />
            </div>
            {calendar()}
            <p className="mt-3 border-t border-border pt-4 text-xs leading-5 text-muted-text">
              Occasion dates are not delivery deadlines. Add requested delivery
              dates separately inside each request. Your calendar is private to
              your account; saving a date does not send a gift or notification.
            </p>
          </section>
          <div className="space-y-5">
            <section className={`${panel} p-5 md:p-6`}>
              <button
                type="button"
                className="flex w-full items-center justify-between text-left font-medium"
                aria-expanded={addOpen}
                onClick={() => setAddOpen(!addOpen)}
              >
                Add an occasion {addOpen ? <X size={16} /> : <Plus size={16} />}
              </button>
              {addOpen && (
                <div className="mt-4">
                  {setupRequired ? (
                    <p className="text-sm text-muted-text">
                      The calendar will be available once GYVFT finishes the
                      database update.
                    </p>
                  ) : (
                    <ActionForm action={addOccasion} label="Save occasion">
                      <fieldset disabled={setupRequired} className="space-y-4">
                        <label className="block space-y-2 text-sm">
                          Occasion name
                          <input
                            name="title"
                            required
                            minLength={2}
                            maxLength={160}
                            placeholder="Maya’s birthday, annual day, family visit…"
                            className={field}
                          />
                        </label>
                        <label className="block space-y-2 text-sm">
                          Occasion date
                          <input
                            type="date"
                            name="occasion_date"
                            required
                            className={field}
                          />
                        </label>
                        <label className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="repeats_annually"
                            className="mt-1 accent-olive"
                          />
                          Repeat every year
                        </label>
                        <p className="text-xs leading-5 text-muted-text">
                          Yearly dates repeat in your calendar. Leap-day
                          occasions appear on 28 February in non-leap years.
                        </p>
                      </fieldset>
                    </ActionForm>
                  )}
                </div>
              )}
            </section>
            {occasions.length > 0 && (
              <section className={`${panel} p-5`}>
                <h3 className="text-sm font-medium">Your saved occasions</h3>
                <div className="mt-3 divide-y divide-border">
                  {occasions.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-start justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="break-words text-sm">{o.title}</p>
                        <p className="mt-1 text-xs text-muted-text">
                          {fullDate(o.occasion_date)}
                          {o.repeats_annually ? " · yearly" : ""}
                          {!nextOccasionDate(o, today)
                            ? " · past occasion"
                            : ""}
                        </p>
                      </div>
                      <InlineAction
                        action={removeOccasion.bind(null, o.id)}
                        label={`Remove ${o.title}`}
                      >
                        <span className="sr-only">Remove</span>
                        <X size={13} />
                      </InlineAction>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
      {view === "ideas" && (
        <section>
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-[.18em] text-olive">
              Something worth giving
            </p>
            <h2 className="mt-1 font-serif text-3xl">
              Ideas for your next story
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-text">
              Explore what we have made for people, gatherings and teams. Save a
              little inspiration for the next occasion. These are past projects;
              availability and pricing are confirmed with your brief.
            </p>
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {[
              { id: "all", label: "All stories" },
              { id: "saved", label: `Saved (${savedSlugs.length})` },
              ...Array.from(new Set(ideas.map((i) => i.group))).map(
                (group) => ({ id: group, label: group }),
              ),
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setIdeaFilter(option.id)}
                aria-pressed={ideaFilter === option.id}
                className={`${smallButton} ${ideaFilter === option.id ? "bg-olive-dark text-white" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {ideaCards()}
          <div className="mt-6">
            <MoreToDiscover />
          </div>
        </section>
      )}
    </div>
  );
}
