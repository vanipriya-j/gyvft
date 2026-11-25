"use client";
import { AarlaSavingsConnection } from "@/components/operations/aarla-savings";
import { CircleOrganisations } from "@/components/operations/circle-organisations";
import type { circleOrganisationDirectory } from "@/lib/customer/circles";
import {
  OperationsDashboard,
  ReceiptChart,
} from "@/components/operations/dashboard";
import type { OperationsSnapshot } from "@/lib/customer/operations-snapshot";
import { BrandLogo } from "@/components/public/BrandLogo";
import {
  LayoutDashboard,
  Gift,
  Inbox,
  Users,
  CalendarDays,
  MessageSquareQuote,
  BarChart3,
  Settings,
  RefreshCw,
  LockKeyhole,
} from "lucide-react";
import { OperationsPageHeader } from "@/components/operations/page-header";
import { OperationsConversions } from "@/components/operations/conversions";
import { AgentConnections } from "@/components/operations/agent-connections";
import { OperationsNotifications } from "@/components/operations/notifications";
import {
  OperationsCustomerIntake,
  CustomerSetupEmail,
} from "@/components/operations/customer-intake";
import {
  OfflineApproval,
  PaymentRequestAction,
} from "@/components/operations/offline-approval";
import { RequirementAttachments } from "@/components/customer/requirement-attachments";
import { RewardsDesk } from "@/components/operations/rewards-desk";
import { ShippingSettings } from "@/components/operations/shipping-settings";
import { OperationsShipments } from "@/components/operations/shipments";
import { deliveryLabel } from "@/lib/customer/notification-model";
import { useHydrated } from "@/hooks/use-hydrated";
/* eslint-disable @next/next/no-img-element -- Operator previews use authenticated blob URLs. */
import Link from "next/link";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { GiftOptionsAdmin } from "@/components/customer/gift-options-admin";
import { GiftSnapshot } from "@/components/customer/gift-workspace";
import { PaymentCommitment } from "@/components/customer/payment-commitment";
import { CustomerStoryDetails } from "@/components/customer/story-details";
import { stages, money } from "@/lib/customer/model";
import { nextOperatorTask } from "@/lib/customer/next-task";
import { giftLocked } from "@/lib/customer/journey-model";
import type { pilotDetail } from "@/lib/customer/pilot-admin";
import type { OrderItem } from "@/lib/customer/pilot-model";
type Detail = Awaited<ReturnType<typeof pilotDetail>>;
type Row = {
  id: string;
  title: string;
  customer_email: string;
  stage: number;
  kind: string;
  task_owner: string;
  task_due_at: string | null;
  delivery_date: string | null;
  pending_payment: boolean;
  is_sample?: boolean;
  has_selection?: boolean;
  visible_options?: boolean;
  quote_status: string | null;
  design_status: string | null;
  total_paise: string;
  paid_paise: string;
};
type Directory = {
  customers: {
    id: string;
    email: string;
    name: string;
    gifts: number;
    paid: string;
    setup_pending?: boolean;
    setup_email_state?: string | null;
  }[];
  occasions: {
    id: string;
    title: string;
    occasion_date: string;
    customer_email: string;
  }[];
  submissions: {
    id: string;
    title: string;
    customer_email: string;
    rating: number;
    public_permission: boolean;
    photos: number;
  }[];
};
type Report = {
  metrics: { key: string; label: string; value: number }[];
  byStatus: { label: string; count: number }[];
  events: { type: string; count: number }[];
  recentErrors: { code?: string; operation?: string; createdAt: string }[];
};
const tabs = [
  ["overview", "Overview"],
  ["brief", "Brief"],
  ["options", "Options"],
  ["quote", "Quote"],
  ["design", "Artwork"],
  ["payments", "Payments"],
  ["fulfilment", "Order & delivery"],
  ["messages", "Messages & notes"],
  ["moments", "Feedback & photos"],
  ["activity", "Activity"],
];
const blankLine = (): OrderItem => ({
  name: "",
  quantity: 1,
  unit_paise: 0,
  item_type: "gift",
  personalisation: "",
});
function Field({
  name,
  label,
  type = "text",
  value,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
}) {
  return (
    <label className="app-label">
      {label}
      <input
        name={name}
        className="app-input"
        type={type}
        defaultValue={value}
        required={required}
      />
    </label>
  );
}
async function picture(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size) return undefined;
  if (file.size > 2 * 1024 * 1024) throw Error("Use an image under 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return { mime: file.type, data: btoa(binary) };
}
function DirectoryLoading() {
  return (
    <div className="ops-directory-loading" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}
export function B2CAdmin({
  initialId,
  initialArea = "dashboard",
}: {
  initialId: string;
  initialArea?: "dashboard" | "worklist" | "analytics" | "rewards";
}) {
  const hydrated = useHydrated();
  const imageOpener = useRef<HTMLElement | null>(null),
    confirmOpener = useRef<HTMLElement | null>(null);
  const readAbort = useRef<AbortController | null>(null);
  const readSequence = useRef(0);
  const secret = useRef(""),
    lock = useRef(false),
    retry = useRef<{ key: string; id: string } | null>(null);
  const [unlocked, setUnlocked] = useState(false),
    [analyticsRevision, setAnalyticsRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [actionLocked, setActionLocked] = useState(false),
    [message, setMessage] = useState(""),
    [rows, setRows] = useState<Row[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [area, setArea] = useState<string>(initialId ? "worklist" : initialArea),
    [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null),
    [tab, setTab] = useState("overview"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [directory, setDirectory] = useState<Directory | null>(null),
    [circleOrgs, setCircleOrgs] = useState<Awaited<
      ReturnType<typeof circleOrganisationDirectory>
    > | null>(null),
    [report, setReport] = useState<Report | null>(null),
    [shopify, setShopify] = useState(false),
    [image, setImage] = useState<{ url: string; title: string } | null>(null),
    [composer, setComposer] = useState<"reply" | "internal">("reply"),
    [reply, setReply] = useState(""),
    [note, setNote] = useState(""),
    [items, setItems] = useState<OrderItem[]>([blankLine()]),
    [selection, setSelection] = useState(""),
    [confirm, setConfirmValue] = useState<{
      title: string;
      body: string;
      payload: Record<string, unknown>;
    } | null>(null);
  function setConfirm(
    next: {
      title: string;
      body: string;
      payload: Record<string, unknown>;
    } | null,
  ) {
    if (next)
      confirmOpener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    setConfirmValue(next);
  }
  function restoreFocus(opener: HTMLElement | null) {
    if (opener?.isConnected) opener.focus();
    else
      document
        .querySelector<HTMLButtonElement>(
          '[aria-label="Manage request"] [aria-current="page"]',
        )
        ?.focus();
  }
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );
  const post = useCallback(async function post(
    payload: Record<string, unknown>,
    candidate = secret.current,
    signal?: AbortSignal,
  ) {
    const response = await fetch("/api/operations/requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-setup-secret": candidate,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok || !data.ok)
      throw Error(
        data.message ||
          "The operation could not be confirmed. Refresh before retrying.",
      );
    return data;
  }, []);
  const rewardsPost = useCallback(
    async (payload: Record<string, unknown>, signal?: AbortSignal) => {
      const response = await fetch("/api/operations/rewards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-secret": secret.current,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
          : AbortSignal.timeout(60000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw Error(result.message || "Rewards unavailable.");
      return result as Record<string, unknown>;
    },
    [],
  );
  const intakePost = useCallback(
    async (payload: Record<string, unknown>, signal?: AbortSignal) => {
      const response = await fetch("/api/operations/intake", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-setup-secret": secret.current,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
          : AbortSignal.timeout(45000),
      });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw Error(data.message || "Customer intake could not be confirmed.");
      return data;
    },
    [],
  );
  async function refreshIntake() {
    const data = await post({ op: "directory" });
    setDirectory(data);
    await loadList();
  }
  async function loadList(search = query, signal?: AbortSignal) {
    const data = await post(
      { op: "list", query: search },
      secret.current,
      signal,
    );
    setRows(data.requests);
    setShopify(data.shopifyConfigured);
  }
  async function open(id: string, nextTab = "overview") {
    if (lock.current) return;
    lock.current = true;
    setActionLocked(true);
    setBusy(true);
    try {
      const d = await post({ op: "detail", id });
      setDetail(d);
      window.history.replaceState(
        null,
        "",
        `/operations/requests?request=${id}`,
      );
      setTab(nextTab);
      setArea("worklist");
      setItems([blankLine()]);
      setSelection(d.workspace.selections[0]?.id || "");
      setReply("");
      setNote("");
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      lock.current = false;
      setActionLocked(false);
      setBusy(false);
    }
  }
  async function perform(payload: Record<string, unknown>) {
    if (lock.current) return false;
    lock.current = true;
    setActionLocked(true);
    setBusy(true);
    try {
      const key = JSON.stringify(payload);
      if (retry.current?.key !== key)
        retry.current = { key, id: crypto.randomUUID() };
      const result = await post({
        id: detail?.project.id,
        ...payload,
        request_id: retry.current.id,
      });
      retry.current = null;
      setMessage(result.message || "Saved.");
      await Promise.all([
        loadList(),
        detail
          ? post({ op: "detail", id: detail.project.id }).then(setDetail)
          : Promise.resolve(),
      ]);
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      lock.current = false;
      setActionLocked(false);
      setBusy(false);
    }
  }
  async function navigate(next: string, search = query) {
    if (lock.current) return;
    const sequence = ++readSequence.current;
    readAbort.current?.abort();
    const controller = new AbortController();
    readAbort.current = controller;
    setArea(next);
    setDetail(null);
    setMessage("");
    setBusy(true);
    try {
      if (next === "analytics" || next === "rewards") {
        setAnalyticsRevision((v) => v + 1);
      } else if (next === "dashboard") {
        const data = await post(
          { op: "snapshot" },
          secret.current,
          controller.signal,
        );
        if (sequence === readSequence.current) setSnapshot(data.snapshot);
      } else if (next === "worklist") await loadList(search, controller.signal);
      else if (["customers", "occasions", "stories"].includes(next)) {
        const data = await post(
          { op: "directory" },
          secret.current,
          controller.signal,
        );
        if (sequence === readSequence.current) setDirectory(data);
      } else if (next === "circles") {
        const data = await post(
          { op: "circle_organisations" },
          secret.current,
          controller.signal,
        );
        if (sequence === readSequence.current)
          setCircleOrgs(data.organisations);
      } else if (next === "reports") {
        const [r, facts] = await Promise.all([
          fetch("/api/operations", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-setup-secret": secret.current,
            },
            body: JSON.stringify({}),
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(30000),
            ]),
          }),
          post({ op: "snapshot" }, secret.current, controller.signal),
        ]);
        const data = await r.json();
        if (!r.ok) throw Error(data.message || "Reports unavailable.");
        if (sequence === readSequence.current) {
          setReport(data);
          setSnapshot(facts.snapshot);
        }
      }
    } catch (e) {
      if (sequence === readSequence.current && !controller.signal.aborted)
        setMessage((e as Error).message);
    } finally {
      if (sequence === readSequence.current) setBusy(false);
    }
  }
  async function preview(kind: string, id: string) {
    imageOpener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    try {
      const response = await fetch(`/api/customer-assets/${kind}/${id}`, {
        headers: { "x-setup-secret": secret.current },
        cache: "no-store",
      });
      if (!response.ok) throw Error("Image unavailable.");
      setImage({
        url: URL.createObjectURL(await response.blob()),
        title:
          kind === "approval-draft"
            ? "Private draft preview"
            : "Gift image preview",
      });
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function form(fn: (d: FormData) => Promise<unknown>) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      void fn(data).catch((e) => setMessage((e as Error).message));
    };
  }
  const p = detail?.project,
    locked = p ? giftLocked(p as { stage: number }) : false;
  const q = detail?.approvals
      .filter((a) => a.kind === "proposal")
      .sort((a, b) => Number(b.version) - Number(a.version))[0],
    art = detail?.approvals
      .filter((a) => a.kind === "design")
      .sort((a, b) => Number(b.version) - Number(a.version))[0];
  const task = nextOperatorTask(
    p
      ? {
          ...p,
          has_selection: !!detail?.workspace.selections.length,
          visible_options: !!detail?.workspace.options.filter(
            (o) => o.published && !o.operator_hidden,
          ).length,
          pending_payment: detail?.payments.some((x) => x.status === "pending"),
          quote_status: q?.status,
          design_status: art?.status,
        }
      : {},
  );
  const menu = [
    ["dashboard", "Dashboard"],
    ["worklist", "Requests & orders"],
    ["customers", "Customers"],
    ["circles", "Circles & organisations"],
    ["occasions", "Occasions"],
    ["stories", "Feedback & photos"],
    ["analytics", "Analytics & conversions"],
    ["rewards", "Rewards"],
    ["reports", "Reports & health"],
    ["settings", "Settings & connections"],
  ];
  const menuIcons: Record<string, typeof LayoutDashboard> = {
    dashboard: LayoutDashboard,
    worklist: Inbox,
    customers: Users,
    circles: Users,
    occasions: CalendarDays,
    stories: MessageSquareQuote,
    analytics: BarChart3,
    rewards: Gift,
    reports: BarChart3,
    settings: Settings,
  };
  const draft = detail?.journey.drafts.find(
    (d) => d.kind === (tab === "design" ? "design" : "proposal"),
  );
  const displayed = rows
    .filter(
      (r) =>
        !["active", "production", "packed", "overdue", "payments"].includes(
          filter,
        ) || !r.is_sample,
    )
    .filter(
      (r) =>
        !query ||
        `${r.title} ${r.customer_email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .filter(
      (r) =>
        filter === "all" ||
        (filter === "active" && r.stage < 10) ||
        (filter === "production" && [7, 8].includes(r.stage)) ||
        (filter === "packed" && r.stage === 8) ||
        (filter === "overdue" &&
          r.stage < 10 &&
          !!r.delivery_date &&
          r.delivery_date <
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Kolkata",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date())) ||
        (filter === "payments" && r.pending_payment) ||
        (filter === "action" && nextOperatorTask(r).waiting === "Aarla") ||
        (filter === "delivered" && r.stage >= 10),
    );
  const publishDraft = (kind: string) => {
    if (!draft) return;
    setConfirm({
      title: `Publish ${kind === "design" ? "artwork" : "quote"}?`,
      body: "This publishes the saved draft as a new customer-visible version and requires fresh approval.",
      payload: {
        op: "publish_saved_approval",
        kind,
        version: Number(draft.version),
      },
    });
  };
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6">
      <header className="ops-header">
        <div className="ops-brand">
          <Link href="/" aria-label="GYVFT home">
            <BrandLogo height={28} className="h-7 w-[115px]" />
          </Link>
          <span>Operations</span>
        </div>
        {unlocked && (
          <div className="app-actions mt-0">
            <button
              disabled={busy || !hydrated}
              className="app-button"
              onClick={() => void navigate(area)}
            >
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} />{" "}
              Refresh
            </button>
            <button
              className="app-button"
              onClick={() => {
                readAbort.current?.abort();
                readSequence.current++;
                secret.current = "";
                setUnlocked(false);
                setBusy(false);
                setActionLocked(false);
                setDetail(null);
                setRows([]);
                setSnapshot(null);
                setReport(null);
                setDirectory(null);
              }}
            >
              <LockKeyhole size={14} /> Lock desk
            </button>
          </div>
        )}
        <span
          className="ops-progress"
          data-active={busy && unlocked}
          aria-hidden="true"
        />
      </header>
      <span role="status" className="sr-only">
        {busy && unlocked ? "Working… please wait." : ""}
      </span>
      {!unlocked ? (
        <form
          className="app-panel mx-auto max-w-md"
          onSubmit={(event) =>
            form(async (d) => {
              setBusy(true);
              try {
                const value = String(d.get("secret"));
                const data = await post(
                  {
                    op:
                      initialId || initialArea === "worklist"
                        ? "list"
                        : "snapshot",
                  },
                  value,
                );
                secret.current = value;
                setRows(data.requests || []);
                setSnapshot(data.snapshot || null);
                setShopify(data.shopifyConfigured);
                setArea(initialId ? "worklist" : initialArea);
                setUnlocked(true);
                if (initialId) await open(initialId);
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            })(event)
          }
        >
          <h2>Operator access</h2>
          <Field
            name="secret"
            label="Operator secret"
            type="password"
            required
          />
          <button
            className="app-button primary mt-4"
            disabled={busy || !hydrated}
          >
            {busy ? "Opening…" : "Open customer desk"}
          </button>
          <p className="app-note">
            Team access is separate from customer accounts. The secret stays in
            this tab’s memory.
          </p>
        </form>
      ) : (
        <div className="app-nav-grid">
          <aside className="app-side ops-side" aria-label="Operations areas">
            {menu.map(([key, label]) => {
              const Icon = menuIcons[key];
              return (
                <button
                  key={key}
                  disabled={actionLocked || !hydrated}
                  aria-current={area === key ? "page" : undefined}
                  onClick={() => void navigate(key)}
                >
                  <Icon size={17} strokeWidth={1.7} /> {label}
                </button>
              );
            })}
          </aside>
          <section className="min-w-0">
            <label className="app-mobile-ops">
              Operations area
              <select
                className="app-input"
                disabled={actionLocked || !hydrated}
                value={area}
                onChange={(e) => void navigate(e.target.value)}
              >
                {menu.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {area === "dashboard" && (
              <OperationsDashboard
                data={snapshot}
                busy={busy}
                onOpen={(id, tab) => void open(id, tab)}
                onQueue={(nextFilter) => {
                  setFilter(nextFilter || "all");
                  setQuery("");
                  void navigate("worklist", "");
                }}
                onReports={() => void navigate("reports")}
                onRefresh={() => void navigate("dashboard")}
              />
            )}
            {area === "worklist" && !detail && (
              <>
                <OperationsPageHeader
                  title="Requests & orders"
                  description="See the next task, who owns it and what’s due."
                  meta={
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="app-badge">{rows.length} requests</span>
                      <OperationsCustomerIntake
                        post={intakePost}
                        withRequirement
                        onSaved={refreshIntake}
                        onOpenRequest={(id) => open(id, "brief")}
                      />
                    </div>
                  }
                />
                <div className="app-toolbar">
                  <label>
                    Find a request
                    <input
                      className="app-input"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setBusy(true);
                          void loadList()
                            .catch((error) => setMessage(error.message))
                            .finally(() => setBusy(false));
                        }
                      }}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Gift name or customer email"
                    />
                  </label>
                  <label>
                    Show
                    <select
                      className="app-input"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">All requests</option>
                      <option value="active">Active gifts</option>
                      <option value="production">In production</option>
                      <option value="packed">Packed · awaiting dispatch</option>
                      <option value="overdue">
                        Requested delivery overdue
                      </option>
                      <option value="action">Needs Aarla</option>
                      <option value="payments">Payment verification</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </label>
                </div>
                <button
                  className="app-button mb-4"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void loadList()
                      .catch((error) => setMessage(error.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  Search all requests
                </button>
                <div className="app-panel">
                  {displayed.map((row) => {
                    const next = nextOperatorTask(row);
                    return (
                      <article key={row.id} className="app-row">
                        <div>
                          <h2>
                            <button
                              onClick={() => void open(row.id)}
                              disabled={busy || !hydrated}
                            >
                              {row.title}
                            </button>
                          </h2>
                          <p className="app-muted break-all">
                            {row.customer_email} · {stages[row.stage]}
                          </p>
                          <p className="mt-2">
                            <strong>{next.label}</strong> · Waiting on{" "}
                            {next.waiting}
                          </p>
                          <p className="app-muted">
                            Owner: {row.task_owner || "Aarla"} ·{" "}
                            {row.task_due_at
                              ? `Due ${new Date(row.task_due_at).toLocaleString("en-IN")}`
                              : "Due date not set"}
                          </p>
                        </div>
                        <button
                          className="app-button primary"
                          disabled={busy || !hydrated}
                          onClick={() => void open(row.id, next.tab)}
                        >
                          {next.label} →
                        </button>
                      </article>
                    );
                  })}
                  {!displayed.length && (
                    <p className="app-muted">No requests match this view.</p>
                  )}
                </div>
              </>
            )}
            {p && detail && (
              <>
                <button
                  className="app-button quiet mb-3"
                  onClick={() => setDetail(null)}
                >
                  ← Requests & orders
                </button>
                <div className="app-title">
                  <div>
                    <h1>{p.title}</h1>
                    <p>{p.customer_email}</p>
                  </div>
                  <span className="app-badge">{stages[Number(p.stage)]}</span>
                </div>
                <nav className="app-tabs" aria-label="Manage request">
                  {tabs.map(([key, label]) => (
                    <button
                      key={key}
                      aria-current={tab === key ? "page" : undefined}
                      onClick={() => {
                        setTab(key);
                        setItems(
                          (detail.journey.drafts.find(
                            (d) =>
                              d.kind ===
                              (key === "design" ? "design" : "proposal"),
                          )?.document.items as OrderItem[]) ||
                            (detail.items.length
                              ? (detail.items as unknown as OrderItem[])
                              : [blankLine()]),
                        );
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <label className="app-mobile-section">
                  Request section
                  <select
                    className="app-input"
                    value={tab}
                    onChange={(e) => setTab(e.target.value)}
                  >
                    {tabs.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {locked && (
                  <div className="app-soft mb-4">
                    <strong>Production has started.</strong>
                    <p>
                      Gift and artwork changes are locked. Customer messages
                      remain available.
                    </p>
                  </div>
                )}
                {tab === "overview" && (
                  <div className="app-grid">
                    <section className="app-panel">
                      <p className="app-eyebrow">
                        Next task · waiting on {task.waiting}
                      </p>
                      <h2>{task.label}</h2>
                      <button
                        className="app-button primary mt-4"
                        onClick={() => setTab(task.tab)}
                      >
                        {task.label} →
                      </button>
                      <form
                        className="app-note"
                        onSubmit={(event) =>
                          form((d) =>
                            perform({
                              op: "task",
                              owner: String(d.get("owner")),
                              due: d.get("due")
                                ? new Date(String(d.get("due"))).toISOString()
                                : "",
                            }),
                          )(event)
                        }
                      >
                        <Field
                          name="owner"
                          label="Task owner"
                          value={p.task_owner || "Aarla"}
                          required
                        />
                        <Field
                          name="due"
                          label="Due (optional)"
                          type="datetime-local"
                          value={
                            p.task_due_at
                              ? new Date(p.task_due_at)
                                  .toISOString()
                                  .slice(0, 16)
                              : ""
                          }
                        />
                        <button
                          className="app-button mt-3"
                          disabled={busy || !hydrated}
                        >
                          Save task ownership
                        </button>
                      </form>
                    </section>
                    <section className="app-panel">
                      <h2>Production readiness</h2>
                      <ul className="space-y-3">
                        <li>
                          {q?.status === "approved" ? "✓" : "○"} Latest quote
                          approved
                        </li>
                        <li>
                          {Number(p.paid_paise) >=
                            Math.ceil(Number(p.total_paise) / 2) &&
                          Number(p.total_paise) > 0
                            ? "✓"
                            : "○"}{" "}
                          50% advance verified
                        </li>
                        <li>
                          {art?.status === "approved" ? "✓" : "○"} Latest
                          artwork approved
                        </li>
                        <li>
                          {p.shopify_order_reference ? "✓" : "○"} Official
                          Shopify order linked
                        </li>
                        <li>
                          {!detail.journey.changes.some(
                            (c) => c.status === "open",
                          )
                            ? "✓"
                            : "○"}{" "}
                          No unresolved change requests
                        </li>
                      </ul>
                    </section>
                  </div>
                )}
                {tab === "brief" && (
                  <div className="app-grid">
                    <section className="app-panel">
                      <h2>The customer’s story</h2>
                      <p className="whitespace-pre-wrap">{p.brief}</p>
                      {p.draft_document && (
                        <dl className="app-money">
                          {Object.entries(
                            p.draft_document as Record<string, unknown>,
                          )
                            .filter(
                              ([key, v]) =>
                                [
                                  "recipient_notes",
                                  "likes",
                                  "avoid",
                                  "message",
                                  "budget",
                                  "budget_basis",
                                  "city",
                                ].includes(key) && v,
                            )
                            .map(([key, v]) => (
                              <div key={key}>
                                <dt>{key.replaceAll("_", " ")}</dt>
                                <dd>{String(v)}</dd>
                              </div>
                            ))}
                        </dl>
                      )}
                      <CustomerStoryDetails value={p.gift_brief} />
                      <RequirementAttachments
                        files={detail.attachments}
                        load={(id) =>
                          fetch(`/api/customer-assets/requirement/${id}`, {
                            headers: { "x-setup-secret": secret.current },
                            cache: "no-store",
                          })
                        }
                      />
                    </section>
                    <section className="app-panel">
                      <h2>Occasion & delivery</h2>
                      <p>
                        Occasion:{" "}
                        {p.occasion_date
                          ? new Date(p.occasion_date).toLocaleDateString(
                              "en-IN",
                            )
                          : "Not set"}
                      </p>
                      <p className="mt-2">
                        Requested delivery:{" "}
                        {p.delivery_date
                          ? new Date(p.delivery_date).toLocaleDateString(
                              "en-IN",
                            )
                          : "Not set"}
                      </p>
                      <p className="app-note">
                        Preferences until confirmed. Keep the requested delivery
                        and occasion dates distinct.
                      </p>
                    </section>
                  </div>
                )}
                {tab === "options" &&
                  (locked ? (
                    <section className="app-panel">
                      <h2>Chosen gift · locked</h2>
                      {detail.workspace.selections[0] && (
                        <GiftSnapshot
                          document={detail.workspace.selections[0].snapshot}
                        />
                      )}
                    </section>
                  ) : (
                    <GiftOptionsAdmin
                      projectId={p.id}
                      data={detail.workspace}
                      busy={busy}
                      perform={perform}
                      preview={preview}
                      onUseSelection={(s) => {
                        setSelection(s.id);
                        setTab("quote");
                        setItems([blankLine()]);
                      }}
                    />
                  ))}
                {["quote", "design"].includes(tab) && (
                  <div className="app-stack">
                    {detail.workspace.selections[0] && (
                      <section className="app-panel">
                        <h2>Customer’s chosen gift</h2>
                        <GiftSnapshot
                          document={detail.workspace.selections[0].snapshot}
                        />
                      </section>
                    )}
                    <section className="app-panel">
                      <h2>
                        {tab === "design"
                          ? "Published artwork"
                          : "Published quotes"}
                      </h2>
                      {detail.approvals
                        .filter(
                          (a) =>
                            a.kind ===
                            (tab === "design" ? "design" : "proposal"),
                        )
                        .map((a) => (
                          <article className="app-row" key={a.id}>
                            <div>
                              <h3>
                                {a.title} · v{a.version}
                              </h3>
                              <p className="app-muted">
                                {a.status.replaceAll("_", " ")}
                                {a.amount_paise
                                  ? ` · ${money(Number(a.amount_paise))}`
                                  : ""}
                              </p>
                              <p className="whitespace-pre-wrap mt-2">
                                {a.description}
                              </p>
                              {a.customer_response && (
                                <p className="app-alert">
                                  {detail.offlineApprovals.some(
                                    (record) => record.approval_id === a.id,
                                  )
                                    ? "Recorded customer approval: "
                                    : "Customer: "}
                                  {a.customer_response}
                                </p>
                              )}
                              {a.has_image && (
                                <button
                                  className="app-button quiet"
                                  onClick={() => void preview("approval", a.id)}
                                >
                                  View artwork
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                    </section>
                    <OfflineApproval
                      key={p.id + tab}
                      detail={detail}
                      kind={tab === "design" ? "design" : "proposal"}
                      busy={busy}
                      perform={perform}
                      preview={preview}
                    />
                    {tab === "quote" && (
                      <PaymentRequestAction
                        detail={detail}
                        busy={busy}
                        perform={perform}
                      />
                    )}
                    {!locked &&
                      !(
                        tab === "quote" &&
                        (p.shopify_order_id ||
                          p.shopify_order_reference ||
                          p.shopify_order_state !== "pending")
                      ) && (
                        <section className="app-panel">
                          <h2>
                            {tab === "design"
                              ? "Prepare artwork"
                              : "Prepare quote"}{" "}
                            · private draft
                          </h2>
                          <p className="app-muted">
                            Save privately, preview, then publish a new version
                            for the customer.
                          </p>
                          <form
                            key={`${p.id}-${tab}-${draft?.version || 0}`}
                            onSubmit={(event) =>
                              form(async (d) => {
                                await perform({
                                  op: "save_approval_draft",
                                  kind:
                                    tab === "design" ? "design" : "proposal",
                                  title: String(d.get("title")),
                                  description: String(d.get("description")),
                                  items: tab === "quote" ? items : undefined,
                                  gift_selection_id: selection || null,
                                  image: await picture(d.get("image")),
                                });
                              })(event)
                            }
                          >
                            <Field
                              name="title"
                              label="Title"
                              value={draft?.document.title || ""}
                              required
                            />
                            <label className="app-label">
                              Description
                              <textarea
                                className="app-input"
                                name="description"
                                required
                                maxLength={5000}
                                defaultValue={draft?.document.description || ""}
                              />
                            </label>
                            {tab === "quote" && (
                              <>
                                <label className="app-label">
                                  Quote this customer selection
                                  <select
                                    className="app-input"
                                    value={selection}
                                    onChange={(e) =>
                                      setSelection(e.target.value)
                                    }
                                  >
                                    <option value="">
                                      No selected workspace
                                    </option>
                                    {detail.workspace.selections.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.snapshot.label} ·{" "}
                                        {s.snapshot.recipients} recipients
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                {items.map((item, i) => (
                                  <fieldset className="app-soft mt-4" key={i}>
                                    <legend>
                                      Line {i + 1} · taxes included
                                    </legend>
                                    <div className="app-fields">
                                      <label className="app-label">
                                        Product or charge
                                        <input
                                          className="app-input"
                                          value={item.name}
                                          required
                                          onChange={(e) =>
                                            setItems((v) =>
                                              v.map((x, n) =>
                                                n === i
                                                  ? {
                                                      ...x,
                                                      name: e.target.value,
                                                    }
                                                  : x,
                                              ),
                                            )
                                          }
                                        />
                                      </label>
                                      <label className="app-label">
                                        Quantity
                                        <input
                                          className="app-input"
                                          type="number"
                                          min={1}
                                          max={100000}
                                          value={item.quantity}
                                          required
                                          onChange={(e) =>
                                            setItems((v) =>
                                              v.map((x, n) =>
                                                n === i
                                                  ? {
                                                      ...x,
                                                      quantity: Number(
                                                        e.target.value,
                                                      ),
                                                    }
                                                  : x,
                                              ),
                                            )
                                          }
                                        />
                                      </label>
                                      <label className="app-label">
                                        Unit price (₹)
                                        <input
                                          className="app-input"
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          value={item.unit_paise / 100}
                                          required
                                          onChange={(e) =>
                                            setItems((v) =>
                                              v.map((x, n) =>
                                                n === i
                                                  ? {
                                                      ...x,
                                                      unit_paise: Math.round(
                                                        Number(e.target.value) *
                                                          100,
                                                      ),
                                                    }
                                                  : x,
                                              ),
                                            )
                                          }
                                        />
                                      </label>
                                      <label className="app-label">
                                        Product or additional charge?
                                        <select
                                          className="app-input"
                                          value={item.item_type}
                                          onChange={(e) =>
                                            setItems((v) =>
                                              v.map((x, n) =>
                                                n === i
                                                  ? {
                                                      ...x,
                                                      item_type: e.target
                                                        .value as
                                                        "gift" | "fee",
                                                    }
                                                  : x,
                                              ),
                                            )
                                          }
                                        >
                                          <option value="gift">Product</option>
                                          <option value="fee">
                                            Packaging, personalisation or
                                            delivery
                                          </option>
                                        </select>
                                      </label>
                                    </div>
                                    <label className="app-label">
                                      Personalisation / included details
                                      <input
                                        className="app-input"
                                        value={item.personalisation}
                                        onChange={(e) =>
                                          setItems((v) =>
                                            v.map((x, n) =>
                                              n === i
                                                ? {
                                                    ...x,
                                                    personalisation:
                                                      e.target.value,
                                                  }
                                                : x,
                                            ),
                                          )
                                        }
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      className="app-button quiet"
                                      disabled={items.length === 1}
                                      onClick={() =>
                                        setItems((v) =>
                                          v.filter((_, n) => n !== i),
                                        )
                                      }
                                    >
                                      Remove line {i + 1}
                                    </button>
                                  </fieldset>
                                ))}
                                <button
                                  className="app-button mt-3"
                                  type="button"
                                  onClick={() =>
                                    setItems((v) => [...v, blankLine()])
                                  }
                                >
                                  Add item / charge
                                </button>
                                <p className="app-note">
                                  Total{" "}
                                  {money(
                                    items.reduce(
                                      (n, x) => n + x.quantity * x.unit_paise,
                                      0,
                                    ),
                                  )}
                                  . Include taxes in unit prices; list
                                  packaging, individual personalisation and
                                  delivery separately. Standard product printing
                                  is included.
                                </p>
                              </>
                            )}
                            <label className="app-label">
                              {tab === "design"
                                ? "Artwork image"
                                : "Optional visual"}{" "}
                              (up to 2 MB)
                              <input
                                className="app-input"
                                type="file"
                                name="image"
                                accept="image/png,image/jpeg,image/webp"
                              />
                            </label>
                            <button
                              className="app-button olive mt-4"
                              disabled={busy || !hydrated}
                            >
                              Save private draft
                            </button>
                          </form>
                          {draft && (
                            <div className="app-soft mt-4">
                              <h3>Saved draft · v{draft.version}</h3>
                              <p>{draft.document.title}</p>
                              <p className="mt-2 whitespace-pre-wrap">
                                {draft.document.description}
                              </p>
                              {draft.document.items && (
                                <table className="app-table">
                                  <tbody>
                                    {(draft.document.items as OrderItem[]).map(
                                      (x, i) => (
                                        <tr key={i}>
                                          <td>
                                            {x.quantity} × {x.name}
                                          </td>
                                          <td>
                                            {money(x.quantity * x.unit_paise)}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              )}
                              {draft.has_image && (
                                <button
                                  className="app-button"
                                  onClick={() =>
                                    void preview(
                                      `approval-draft`,
                                      `${p.id}?type=${tab === "design" ? "design" : "proposal"}`,
                                    )
                                  }
                                >
                                  Preview private image
                                </button>
                              )}
                              <button
                                className="app-button primary mt-3"
                                disabled={busy || !hydrated}
                                onClick={() =>
                                  publishDraft(
                                    tab === "design" ? "design" : "proposal",
                                  )
                                }
                              >
                                Publish for customer approval
                              </button>
                            </div>
                          )}
                        </section>
                      )}
                  </div>
                )}
                {tab === "payments" && (
                  <div className="app-grid">
                    <PaymentCommitment
                      total={Number(p.total_paise || q?.amount_paise || 0)}
                      paid={Number(p.paid_paise)}
                      pending={detail.payments
                        .filter((x) => x.status === "pending")
                        .reduce((n, x) => n + Number(x.amount_paise), 0)}
                      approved={q?.status === "approved"}
                    />
                    <section className="app-panel">
                      <h2>Bank verification</h2>
                      {detail.payments.length ? (
                        detail.payments.map((pay) => (
                          <article className="app-note" key={pay.id}>
                            <h3>
                              {money(Number(pay.amount_paise))} · {pay.status}
                            </h3>
                            <p className="break-all">{pay.reference}</p>
                            {pay.has_evidence && (
                              <button
                                className="app-button quiet"
                                onClick={() => void preview("payment", pay.id)}
                              >
                                View screenshot
                              </button>
                            )}
                            {pay.status === "pending" && (
                              <form
                                onSubmit={(event) =>
                                  form((d) =>
                                    perform({
                                      op: "payment",
                                      reference: pay.reference,
                                      expected_amount_paise: Number(
                                        pay.amount_paise,
                                      ),
                                      confirmed_receipt: d.has("bank"),
                                    }),
                                  )(event)
                                }
                              >
                                <label className="app-check">
                                  <input type="checkbox" name="bank" required />
                                  I checked the receiving bank/provider and this
                                  amount has arrived.
                                </label>
                                <div className="app-actions">
                                  <button
                                    className="app-button primary"
                                    disabled={busy || !hydrated}
                                  >
                                    Verify receipt
                                  </button>
                                  <button
                                    type="button"
                                    className="app-button"
                                    disabled={busy || !hydrated}
                                    onClick={() =>
                                      setConfirm({
                                        title: "Request clearer payment proof?",
                                        body: "The customer will see that this reference needs attention. Message them with the specific clarification needed.",
                                        payload: {
                                          op: "reject_payment",
                                          reference: pay.reference,
                                        },
                                      })
                                    }
                                  >
                                    Needs clarification
                                  </button>
                                </div>
                              </form>
                            )}
                          </article>
                        ))
                      ) : (
                        <p className="app-muted">No payment submitted.</p>
                      )}
                      <details className="app-note">
                        <summary>
                          Record an independently verified receipt
                        </summary>
                        <form
                          onSubmit={(event) =>
                            form((d) =>
                              perform({
                                op: "payment",
                                reference: String(d.get("reference")),
                                amount_paise: Math.round(
                                  Number(d.get("amount")) * 100,
                                ),
                                confirmed_receipt: d.has("bank"),
                              }),
                            )(event)
                          }
                        >
                          <Field
                            name="reference"
                            label="Bank / provider reference"
                            required
                          />
                          <Field
                            name="amount"
                            label="Amount (₹)"
                            type="number"
                            required
                          />
                          <label className="app-check">
                            <input type="checkbox" name="bank" required />I
                            verified the actual receipt in our bank/provider.
                          </label>
                          <button
                            className="app-button olive mt-3"
                            disabled={busy || !hydrated}
                          >
                            Record verified payment
                          </button>
                        </form>
                      </details>
                      <details className="app-note">
                        <summary>Payment instructions for this gift</summary>
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            const data = new FormData(event.currentTarget);
                            void perform({
                              op: "instructions",
                              upi_id: String(data.get("upi_id")),
                              razorpay_url: String(data.get("razorpay_url")),
                              shopify_order_reference:
                                p.shopify_order_reference || "",
                            });
                          }}
                        >
                          <Field
                            name="upi_id"
                            label="UPI override (leave blank for the saved receiving account)"
                            value={p.upi_id || ""}
                          />
                          <Field
                            name="razorpay_url"
                            label="Razorpay payment link (optional)"
                            value={p.razorpay_url || ""}
                          />
                          <button className="app-button mt-3" disabled={busy}>
                            Save payment instructions
                          </button>
                        </form>
                      </details>
                    </section>
                  </div>
                )}
                {tab === "fulfilment" && (
                  <div className="app-grid">
                    <OperationsShipments
                      projectId={p.id}
                      post={post}
                      onUpdated={async () => {
                        const updated = await post({ op: "detail", id: p.id });
                        setDetail((current) =>
                          current?.project.id === p.id ? updated : current,
                        );
                      }}
                    />
                    <section className="app-panel">
                      <h2>Official Shopify order</h2>
                      {p.shopify_order_reference ? (
                        <>
                          <span className="app-badge">Linked · read-only</span>
                          <p className="mt-3">{p.shopify_order_reference}</p>
                          <p className="app-note">
                            Shopify is the official order record. GYVFT creates
                            one custom line for the entire gifting batch,
                            attached to this customer. Edit the official order
                            in Shopify.
                          </p>
                          <button
                            className="app-button mt-3"
                            disabled={busy || !shopify}
                            onClick={() =>
                              void perform({ op: "shopify_order" })
                            }
                          >
                            Refresh official record
                          </button>
                          {Number(p.paid_paise) >= Number(p.total_paise) && (
                            <button
                              className="app-button olive mt-3"
                              disabled={busy || !shopify}
                              onClick={() =>
                                setConfirm({
                                  title:
                                    "Sync the verified balance to Shopify?",
                                  body: "The full order total is verified. Record only the outstanding balance; matching receipts are not recorded twice.",
                                  payload: {
                                    op: "shopify_order",
                                    confirm_order: true,
                                  },
                                })
                              }
                            >
                              Record verified balance in Shopify
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="app-muted">
                            Create once, after quote approval, verified advance
                            and complete delivery details. The order contains
                            one custom gifting-batch line.
                          </p>
                          <dl className="app-money">
                            <div>
                              <dt>Customer</dt>
                              <dd>{p.customer_email}</dd>
                            </div>
                            <div>
                              <dt>Order total</dt>
                              <dd>{money(Number(p.total_paise || 0))}</dd>
                            </div>
                            <div>
                              <dt>Address</dt>
                              <dd>
                                {detail.address
                                  ? `${detail.address.recipient_name}, ${detail.address.city}, ${detail.address.postal_code}`
                                  : "Customer needs to save an address"}
                              </dd>
                            </div>
                          </dl>
                          <button
                            className="app-button primary mt-3"
                            disabled={busy || !shopify}
                            onClick={() =>
                              setConfirm({
                                title: "Create official Shopify order?",
                                body: "This creates one customer-linked custom batch line for the approved total. The linked order is read-only here. Do not create it again manually.",
                                payload: {
                                  op: "shopify_order",
                                  confirm_order: true,
                                },
                              })
                            }
                          >
                            Create Shopify order
                          </button>
                          {!shopify && (
                            <p className="app-alert mt-2">
                              The server-side Shopify credential is not
                              configured.
                            </p>
                          )}
                        </>
                      )}
                      {detail.address && (
                        <p className="app-note whitespace-pre-wrap">
                          {[
                            detail.address.recipient_name,
                            detail.address.address,
                            detail.address.city,
                            detail.address.state,
                            detail.address.postal_code,
                            detail.address.phone,
                          ].join("\n")}
                        </p>
                      )}
                      {!p.shopify_order_reference && (
                        <details className="app-note">
                          <summary>
                            Already created this order in Shopify?
                          </summary>
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              const data = new FormData(event.currentTarget);
                              void perform({
                                op: "instructions",
                                upi_id: p.upi_id || "",
                                razorpay_url: p.razorpay_url || "",
                                shopify_order_reference: String(
                                  data.get("reference"),
                                ),
                              });
                            }}
                          >
                            <Field
                              name="reference"
                              label="Official Shopify order reference"
                              required
                            />
                            <label className="app-check">
                              <input type="checkbox" required />I checked that
                              the order belongs to this customer and matches the
                              approved total.
                            </label>
                            <button
                              className="app-button olive mt-3"
                              disabled={busy}
                            >
                              Link official order reference
                            </button>
                          </form>
                          <p className="app-note">
                            The reference is read-only after linking. Use the
                            same customer email in Shopify.
                          </p>
                        </details>
                      )}
                    </section>
                    <section className="app-panel">
                      <h2>Production & delivery</h2>
                      <form
                        onSubmit={(event) =>
                          form((d) => {
                            const payload = {
                              op: "progress",
                              stage: Number(d.get("stage")),
                              next_action: String(d.get("next_action")),
                              tracking_reference: String(
                                d.get("tracking_reference"),
                              ),
                              tracking_url: String(d.get("tracking_url")),
                            };
                            if (payload.stage === 7) {
                              setConfirm({
                                title: "Start production and lock this gift?",
                                body: "The final approved gift and artwork become read-only. No changes are accepted after production starts.",
                                payload,
                              });
                              return Promise.resolve();
                            }
                            return perform(payload);
                          })(event)
                        }
                      >
                        <label className="app-label">
                          Next stage
                          <select
                            className="app-input"
                            name="stage"
                            defaultValue={
                              Number(p.stage) < 7
                                ? 7
                                : Math.min(11, Number(p.stage) + 1)
                            }
                          >
                            {[1, 2, 7, 8, 9, 10, 11]
                              .filter((n) =>
                                Number(p.stage) < 7
                                  ? n === 7 || (p.kind === "enquiry" && n < 3)
                                  : n === Number(p.stage) + 1,
                              )
                              .map((n) => (
                                <option key={n} value={n}>
                                  {stages[n]}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="app-label">
                          Customer-visible next step
                          <textarea
                            className="app-input"
                            name="next_action"
                            required
                            defaultValue={p.next_action}
                          />
                        </label>
                        <Field
                          name="tracking_reference"
                          label="Tracking / delivery reference"
                          value={p.tracking_reference || ""}
                        />
                        <Field
                          name="tracking_url"
                          label="HTTPS tracking link (optional)"
                          value={p.tracking_url || ""}
                        />
                        <button
                          className="app-button primary mt-4"
                          disabled={busy || Number(p.stage) >= 11}
                        >
                          Update production / delivery
                        </button>
                      </form>
                      <p className="app-note">
                        Production: verified 50% advance + latest artwork
                        approval + official order + no open changes. Dispatch:
                        full verified payment + address + tracking.
                      </p>
                    </section>
                  </div>
                )}
                {tab === "messages" && (
                  <div className="app-grid">
                    <section className="app-panel">
                      <h2>Customer conversation</h2>
                      {detail.messages.toReversed().map((m) => (
                        <article className="app-row" key={m.id}>
                          <div>
                            <strong>
                              {m.sender === "team" ? "Aarla" : "Customer"}
                            </strong>
                            <p className="whitespace-pre-wrap">{m.body}</p>
                          </div>
                        </article>
                      ))}
                      {detail.journey.changes
                        .filter((c) => c.status === "open")
                        .map((c) => (
                          <div className="app-soft mt-3" key={c.id}>
                            <strong>
                              Changes to {c.kind} v{c.version}
                            </strong>
                            <p>{c.body}</p>
                          </div>
                        ))}
                    </section>
                    <section className="app-panel">
                      <h2>
                        {composer === "reply"
                          ? "Reply to customer"
                          : "Private internal note"}
                      </h2>
                      <div className="app-actions mt-0">
                        <button
                          className="app-button"
                          aria-pressed={composer === "reply"}
                          onClick={() => setComposer("reply")}
                        >
                          Customer reply
                        </button>
                        <button
                          className="app-button"
                          aria-pressed={composer === "internal"}
                          onClick={() => setComposer("internal")}
                        >
                          Internal note
                        </button>
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void perform({
                            op:
                              composer === "reply" ? "reply" : "internal_note",
                            body: composer === "reply" ? reply : note,
                          }).then((ok) => {
                            if (ok) {
                              if (composer === "reply") setReply("");
                              else setNote("");
                            }
                          });
                        }}
                      >
                        <label className="app-label">
                          {composer === "reply"
                            ? "Visible to the customer"
                            : "Only the GYVFT team can read this"}
                          <textarea
                            className="app-input"
                            required
                            maxLength={4000}
                            value={composer === "reply" ? reply : note}
                            onChange={(e) =>
                              composer === "reply"
                                ? setReply(e.target.value)
                                : setNote(e.target.value)
                            }
                          />
                        </label>
                        <button
                          className="app-button primary mt-4"
                          disabled={busy || !hydrated}
                        >
                          {composer === "reply"
                            ? "Send customer reply"
                            : "Save internal note"}
                        </button>
                      </form>
                      <div className="app-note">
                        <h3>Private team notes</h3>
                        {detail.journey.notes.map((n) => (
                          <p key={n.id} className="mt-3 whitespace-pre-wrap">
                            {n.body}
                          </p>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
                {tab === "moments" && (
                  <div className="app-stack">
                    <section className="app-panel">
                      <h2>Customer experience</h2>
                      {detail.journey.testimonial ? (
                        <>
                          <p>
                            {"★".repeat(detail.journey.testimonial.rating)} ·{" "}
                            {detail.journey.testimonial.body}
                          </p>
                          <p className="app-muted mt-2">
                            {detail.journey.testimonial.public_permission
                              ? "Public permission given"
                              : "Private · do not publish"}
                          </p>
                          <button
                            className="app-button olive mt-3"
                            disabled={
                              busy ||
                              !detail.journey.testimonial.public_permission
                            }
                            onClick={() =>
                              void perform({
                                op: "feature_testimonial",
                                featured: !detail.journey.testimonial!.featured,
                              })
                            }
                          >
                            {detail.journey.testimonial.featured
                              ? "Remove from public use"
                              : "Feature testimonial"}
                          </button>
                        </>
                      ) : (
                        <p className="app-muted">No customer feedback yet.</p>
                      )}
                    </section>
                    <section className="app-panel">
                      <h2>Photos & individual permissions</h2>
                      <div className="app-gallery">
                        {detail.journey.photos.map((photo) => (
                          <figure key={photo.id}>
                            <button
                              className="app-button"
                              onClick={() => void preview("moment", photo.id)}
                            >
                              View photo
                            </button>
                            <figcaption className="mt-2">
                              {photo.caption || photo.kind}
                              <p className="app-muted">
                                {photo.public_permission
                                  ? photo.featured
                                    ? "Featured publicly"
                                    : "Permission given · not featured"
                                  : "Private · do not publish"}
                              </p>
                            </figcaption>
                            <button
                              className="app-button olive mt-3"
                              disabled={busy || !photo.public_permission}
                              onClick={() =>
                                void perform({
                                  op: "feature_photo",
                                  photo_id: photo.id,
                                  featured: !photo.featured,
                                })
                              }
                            >
                              {photo.featured
                                ? "Remove from public use"
                                : "Feature this photo"}
                            </button>
                          </figure>
                        ))}
                      </div>
                      <p className="app-note">
                        A withdrawn photo disappears from anonymous media reads
                        immediately. Other photos retain their own permissions.
                      </p>
                      <Link
                        className="app-button quiet"
                        href="/gift-moments"
                        target="_blank"
                      >
                        View public gallery →
                      </Link>
                    </section>
                  </div>
                )}
                {tab === "activity" && (
                  <div className="app-grid">
                    <section className="app-panel">
                      <h2>Customer-visible activity</h2>
                      {detail.events.map((e) => (
                        <article className="app-row" key={e.id}>
                          <div>
                            <h3>{e.title}</h3>
                            <p>{e.body}</p>
                            <p className="app-muted">
                              {new Date(e.created_at).toLocaleString("en-IN")}
                            </p>
                          </div>
                        </article>
                      ))}
                    </section>
                    <section className="app-panel">
                      <h2>Operations audit & notifications</h2>
                      {detail.audit.map((e, i) => (
                        <p className="mt-3" key={i}>
                          {e.operation} ·{" "}
                          {new Date(e.created_at).toLocaleString("en-IN")}
                        </p>
                      ))}
                      {detail.notifications.map((n) => (
                        <p className="app-muted mt-3" key={n.id}>
                          Email · {n.destination} ·{" "}
                          {deliveryLabel(n.state, n.can_retry)} · {n.attempts}{" "}
                          attempts
                        </p>
                      ))}
                      <button
                        className="app-button mt-4"
                        disabled={busy || !hydrated}
                        onClick={() =>
                          void perform({ op: "retry_notifications" })
                        }
                      >
                        Retry pending notifications
                      </button>
                    </section>
                  </div>
                )}
              </>
            )}
            {area === "circles" && (
              <CircleOrganisations
                entries={circleOrgs}
                busy={busy}
                verify={async (id, details) => {
                  const ok = await perform({
                    op: "verify_circle_organisation",
                    id,
                    ...details,
                  });
                  if (ok) {
                    const data = await post({ op: "circle_organisations" });
                    setCircleOrgs(data.organisations);
                  }
                  return ok;
                }}
              />
            )}
            {area === "customers" && (
              <OperationsPageHeader
                title="Customers"
                description="People you’re creating thoughtful gifts for."
                meta={
                  <OperationsCustomerIntake
                    post={intakePost}
                    onSaved={refreshIntake}
                    onOpenRequest={(id) => open(id, "brief")}
                  />
                }
              />
            )}
            {area === "customers" && (
              <section className="app-panel" aria-busy={busy}>
                {busy && !directory ? (
                  <DirectoryLoading />
                ) : !directory?.customers.length ? (
                  <p className="app-muted">
                    Add a customer here, or invite them to join GYVFT.
                  </p>
                ) : null}
                {directory?.customers.map((c) => (
                  <article className="app-row" key={c.id}>
                    <div>
                      <h3>{c.name || c.email}</h3>
                      <p className="app-muted">
                        {c.email} · {c.gifts} gifts · {money(Number(c.paid))}{" "}
                        verified
                      </p>
                      {c.setup_pending && (
                        <div className="mt-3">
                          <span className="app-badge">
                            Password setup pending
                          </span>
                          <CustomerSetupEmail
                            accountId={c.id}
                            post={intakePost}
                          />
                        </div>
                      )}
                    </div>
                    <div className="app-actions">
                      <OperationsCustomerIntake
                        post={intakePost}
                        initialCustomer={c}
                        withRequirement
                        onSaved={refreshIntake}
                        onOpenRequest={(id) => open(id, "brief")}
                      />
                      <button
                        className="app-button"
                        onClick={() => {
                          setQuery(c.email);
                          setFilter("all");
                          void navigate("worklist", c.email);
                        }}
                      >
                        View their gifts
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            )}
            {area === "occasions" && (
              <OperationsPageHeader
                title="Occasions"
                description="Only dates and context customers have attached to their gifts."
              />
            )}
            {area === "occasions" && (
              <section className="app-panel" aria-busy={busy}>
                {busy && !directory ? (
                  <DirectoryLoading />
                ) : !directory?.occasions.length ? (
                  <p className="app-muted">
                    No occasions have been linked to customer gifts yet.
                  </p>
                ) : null}
                {directory?.occasions.map((o) => (
                  <article className="app-row" key={o.id}>
                    <div>
                      <h3>{o.title}</h3>
                      <p className="app-muted">
                        {o.occasion_date} · {o.customer_email}
                      </p>
                    </div>
                    <button
                      className="app-button"
                      onClick={() => {
                        setQuery(o.customer_email);
                        setFilter("all");
                        void navigate("worklist", o.customer_email);
                      }}
                    >
                      View customer gifts
                    </button>
                  </article>
                ))}
              </section>
            )}
            {area === "stories" && (
              <OperationsPageHeader
                title="Feedback & photos"
                description="Review permission before anything is shared publicly."
              />
            )}
            {area === "stories" && (
              <section className="app-panel" aria-busy={busy}>
                {busy && !directory ? (
                  <DirectoryLoading />
                ) : !directory?.submissions.length ? (
                  <p className="app-muted">
                    Customer feedback and gift moments appear after delivery.
                  </p>
                ) : null}
                {directory?.submissions.map((s) => (
                  <article className="app-row" key={s.id}>
                    <div>
                      <h3>{s.title}</h3>
                      <p className="app-muted">
                        {s.customer_email} · {s.photos} photos
                        {s.rating ? ` · ${s.rating} stars` : ""}
                      </p>
                    </div>
                    <button
                      className="app-button primary"
                      disabled={busy || !hydrated}
                      onClick={() => void open(s.id, "moments")}
                    >
                      Review permissions
                    </button>
                  </article>
                ))}
              </section>
            )}
            {area === "rewards" && (
              <RewardsDesk key={analyticsRevision} post={rewardsPost} />
            )}
            {area === "analytics" && (
              <OperationsConversions
                post={post}
                refreshVersion={analyticsRevision}
                onOpen={(id, nextTab) => void open(id, nextTab)}
              />
            )}
            {area === "reports" && (
              <OperationsPageHeader
                title="Reports & health"
                description="Verified money, gifting activity and application diagnostics."
              />
            )}
            {area === "reports" && (
              <div className="app-stack">
                {snapshot && (
                  <section className="ops-panel">
                    <h2>Money received & outstanding</h2>
                    <p className="app-muted mt-2">
                      Real customer records. Receipts are dated when verified in
                      the bank.
                    </p>
                    <div className="ops-money mt-4">
                      <div>
                        <span>Verified receipts · last 30 days</span>
                        <strong>
                          {money(snapshot.money.verifiedLast30Days)}
                        </strong>
                      </div>
                      <div>
                        <span>Outstanding on confirmed orders</span>
                        <strong>{money(snapshot.money.outstanding)}</strong>
                      </div>
                    </div>
                    <ReceiptChart data={snapshot} />
                  </section>
                )}

                <section className="app-panel">
                  <h2>Application reports</h2>
                  <div className="app-fields">
                    {report?.metrics.map((m) => (
                      <div className="app-soft" key={m.key}>
                        <p className="app-muted">{m.label}</p>
                        <p className="app-step-title">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="app-panel">
                  <h2>Gifts by stage</h2>
                  {report?.byStatus.map((s) => (
                    <div className="app-row" key={s.label}>
                      <span>{s.label}</span>
                      <strong>{s.count}</strong>
                    </div>
                  ))}
                </section>
                <section className="app-panel">
                  <h2>Activity & safe diagnostics</h2>
                  {report?.events.map((e) => (
                    <p key={e.type} className="mt-2">
                      {e.type} · {e.count}
                    </p>
                  ))}
                  {report?.recentErrors.map((e, i) => (
                    <p className="app-alert mt-2" key={i}>
                      {e.code || "App error"} · {e.operation} ·{" "}
                      {new Date(e.createdAt).toLocaleString("en-IN")}
                    </p>
                  ))}
                  <p className="app-note">
                    Application activity stays here. Infrastructure logs and
                    deployment monitoring remain in Vercel.
                  </p>
                </section>
              </div>
            )}
            {area === "settings" && (
              <OperationsPageHeader
                title="Settings & connections"
                description="Receiving account, Shopify and workspace configuration."
              />
            )}
            {area === "settings" && <OperationsNotifications post={post} />}
            {area === "settings" && <AgentConnections post={post} />}
            {area === "settings" && <ShippingSettings post={post} />}
            {area === "settings" && (
              <div className="app-grid">
                <section className="app-panel">
                  <h2>Direct UPI receiving account</h2>
                  <form
                    onSubmit={(event) =>
                      form(async (d) =>
                        perform({
                          op: "upi_settings",
                          upi_id: String(d.get("upi_id")),
                          payee_name: String(d.get("payee_name")),
                          confirmed_payee: d.has("confirmed"),
                          image: await picture(d.get("image")),
                        }),
                      )(event)
                    }
                  >
                    <Field name="upi_id" label="Receiving UPI ID" required />
                    <Field
                      name="payee_name"
                      label="Payee name customers should verify"
                      required
                    />
                    <label className="app-label">
                      Receiving QR (optional, up to 2 MB)
                      <input
                        className="app-input"
                        type="file"
                        name="image"
                        accept="image/png,image/jpeg,image/webp"
                      />
                    </label>
                    <label className="app-check">
                      <input type="checkbox" name="confirmed" />I verified that
                      the QR pays the same receiving account.
                    </label>
                    <button
                      className="app-button primary mt-4"
                      disabled={busy || !hydrated}
                    >
                      Save receiving details
                    </button>
                  </form>
                </section>
                <section className="app-panel">
                  <h2>Connections & access</h2>
                  <AarlaSavingsConnection post={post} />
                  <p>
                    Shopify server credential:{" "}
                    {shopify ? "Configured" : "Not configured"}
                  </p>
                  <p className="app-note">
                    Every account links to a matching Shopify customer. Official
                    gifting orders use a single custom batch line. An app
                    credential is required on the deployment; a connector in
                    chat does not supply it.
                  </p>
                  <button
                    className="app-button mt-3"
                    disabled={busy || !shopify}
                    onClick={() => void perform({ op: "sync_customers" })}
                  >
                    Sync pending customers
                  </button>
                  <Link className="app-button quiet mt-3" href="/setup">
                    Database setup →
                  </Link>
                  <Link
                    className="app-button quiet mt-3"
                    href="/operations/demo-data"
                  >
                    Add fictional demo accounts →
                  </Link>
                  <p className="app-note">
                    Operator access is separate from customer accounts. Use Lock
                    desk when finished.
                  </p>
                </section>
              </div>
            )}
          </section>
        </div>
      )}
      {message && (
        <p className="app-soft mt-4" role="status">
          {message}
        </p>
      )}

      <Dialog.Root
        open={!!image}
        onOpenChange={(on) => {
          if (!on) setImage(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="app-dialog-overlay" />
          <Dialog.Content
            className="app-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              restoreFocus(imageOpener.current);
            }}
          >
            <Dialog.Title>{image?.title || "Gift image"}</Dialog.Title>
            <Dialog.Description>
              Private image for this request.
            </Dialog.Description>
            {image && <img src={image.url} alt={image.title} />}
            <Dialog.Close className="app-button mt-4">
              Close preview
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={!!confirm}
        onOpenChange={(on) => {
          if (!on) setConfirm(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="app-dialog-overlay" />
          <Dialog.Content
            className="app-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              restoreFocus(confirmOpener.current);
            }}
          >
            <Dialog.Title>{confirm?.title || "Confirm action"}</Dialog.Title>
            <Dialog.Description>{confirm?.body}</Dialog.Description>
            <div className="app-actions">
              <button
                className="app-button primary"
                disabled={busy || !hydrated}
                onClick={() => {
                  if (confirm)
                    void perform(confirm.payload).then((ok) => {
                      if (ok) setConfirm(null);
                    });
                }}
              >
                Confirm
              </button>
              <Dialog.Close className="app-button">Cancel</Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
