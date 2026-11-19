"use client";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  Clock3,
  Gift,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { OperationsPageHeader } from "./page-header";
import type { OperationsSnapshot } from "@/lib/customer/operations-snapshot";
import { money, stages } from "@/lib/customer/model";
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
export function ReceiptChart({ data }: { data: OperationsSnapshot }) {
  if (!data.receipts.length)
    return (
      <div className="ops-chart-empty">
        <Wallet size={24} strokeWidth={1.5} />
        <p>Verified receipts will appear here.</p>
        <span>Submitting payment proof does not count as money received.</span>
      </div>
    );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const end = new Date(today + "T00:00:00Z"),
    days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - 29 + i);
      return d.toISOString().slice(0, 10);
    });
  const amounts = days.map(
      (d) => data.receipts.find((r) => r.day === d)?.amount || 0,
    ),
    max = Math.max(...amounts, 1);
  return (
    <figure className="ops-chart">
      <svg
        viewBox="0 0 600 164"
        role="img"
        aria-label={`Verified receipts over the last 30 days: ${money(data.money.verifiedLast30Days)}.`}
        preserveAspectRatio="none"
      >
        <line x1="0" y1="135" x2="600" y2="135" stroke="var(--border)" />
        {amounts.map((n, i) => (
          <rect
            key={days[i]}
            x={i * 20 + 3}
            y={135 - (n / max) * 116}
            width="12"
            height={(n / max) * 116}
            rx="2"
            fill="var(--olive)"
          >
            <title>
              {shortDate(days[i])}: {money(n)}
            </title>
          </rect>
        ))}
      </svg>
      <figcaption>
        <span>{shortDate(days[0])}</span>
        <span>Verified in bank · INR</span>
        <span>{shortDate(days[29])}</span>
      </figcaption>
    </figure>
  );
}
export function OperationsDashboard({
  data,
  busy,
  onOpen,
  onQueue,
  onReports,
  onRefresh,
}: {
  data: OperationsSnapshot | null;
  busy: boolean;
  onOpen: (id: string, tab?: string) => void;
  onQueue: (filter?: string) => void;
  onReports: () => void;
  onRefresh: () => void;
}) {
  if (!data)
    return (
      <>
        <OperationsPageHeader
          title="Dashboard"
          description="A clear next move for every thoughtful gift."
        />
        <div className="ops-dashboard-loading" role="status">
          <RefreshCw size={20} className={busy ? "animate-spin" : ""} />
          <h2>
            {busy ? "Opening your dashboard…" : "Dashboard could not load"}
          </h2>
          <p>
            {busy
              ? "Bringing your live work together."
              : "Refresh to try again. No customer record has changed."}
          </p>
          {!busy && (
            <button className="app-button primary" onClick={onRefresh}>
              Try again
            </button>
          )}
        </div>
      </>
    );
  const metrics = [
    {
      filter: "active",
      label: "Active gifts",
      value: data.counts.active,
      note: "Enquiries through delivery",
      icon: Gift,
    },
    {
      filter: "payments",
      label: "Payments to verify",
      value: data.counts.pendingPayments,
      note: "Check against the receiving bank",
      icon: Wallet,
    },
    {
      filter: "production",
      label: "In production",
      value: data.counts.production,
      note: "Being made or packed",
      icon: CheckCheck,
    },
    {
      filter: "packed",
      label: "Packed · awaiting dispatch",
      value: data.counts.packed,
      note: "Check balance and tracking next",
      icon: CalendarDays,
    },
  ];
  const maxPipeline = Math.max(...data.pipeline.map((p) => p.count), 1);
  return (
    <div className="ops-dashboard" aria-busy={busy}>
      <OperationsPageHeader
        title="Dashboard"
        description="A clear next move for every thoughtful gift."
        meta={
          <span className="ops-updated">
            Updated{" "}
            {new Date(data.generatedAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Kolkata",
            })}{" "}
            IST
          </span>
        }
      />
      {(data.counts.pendingPayments > 0 ||
        data.counts.overdueDeliveries > 0) && (
        <div className="ops-attention">
          <div className="ops-attention-dot" />
          <p>
            <strong>Needs a little attention.</strong>{" "}
            {data.counts.pendingPayments > 0 &&
              `${data.counts.pendingPayments} payment ${data.counts.pendingPayments === 1 ? "submission is" : "submissions are"} waiting for verification.`}{" "}
            {data.counts.overdueDeliveries > 0 &&
              `${data.counts.overdueDeliveries} open ${data.counts.overdueDeliveries === 1 ? "gift is" : "gifts are"} past the requested delivery date.`}
          </p>
          <button
            className="app-button primary"
            disabled={busy}
            onClick={() =>
              data.payments[0]
                ? onOpen(data.payments[0].projectId, "payments")
                : onQueue("overdue")
            }
          >
            Take a look <ArrowUpRight size={15} />
          </button>
        </div>
      )}
      <div className="ops-metrics">
        {metrics.map((m) => (
          <button
            key={m.label}
            disabled={busy}
            onClick={() => onQueue(m.filter)}
          >
            <span className="ops-metric-label">
              {m.label}
              <m.icon size={17} strokeWidth={1.6} />
            </span>
            <strong>{m.value}</strong>
            <span className="ops-metric-note">{m.note}</span>
          </button>
        ))}
      </div>
      <div className="ops-work-grid">
        <section className="ops-panel">
          <div className="ops-section-head">
            <div>
              <h2>Up next</h2>
              <p>Payment checks and due work come first.</p>
            </div>
            <button
              className="ops-text-button"
              disabled={busy}
              onClick={() => onQueue()}
            >
              All requests <ArrowUpRight size={14} />
            </button>
          </div>
          {data.queue.length ? (
            <div className="ops-task-list">
              {data.queue.map((q) => (
                <article key={q.id}>
                  <div className="ops-task-avatar">
                    <Gift size={17} strokeWidth={1.6} />
                  </div>
                  <div className="ops-task-copy">
                    <h3>{q.title}</h3>
                    <p>
                      {q.label}{" "}
                      <span>
                        ·{" "}
                        {q.waiting === "Aarla"
                          ? q.owner
                          : `Waiting with ${q.waiting.toLowerCase()}`}
                      </span>
                    </p>
                    {q.due && <small>Due {shortDate(q.due)}</small>}
                  </div>
                  <button
                    className={`app-button ${q.label === "Verify payment" ? "primary" : ""}`}
                    disabled={busy}
                    onClick={() => onOpen(q.id, q.tab)}
                  >
                    {q.waiting === "Aarla" ? q.label : "Open gift"}
                    <ArrowUpRight size={14} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="ops-empty">
              <Gift size={32} strokeWidth={1.3} />
              <h3>A little room for the next story.</h3>
              <p>Real customer requests will bring your next tasks here.</p>
              <button
                className="app-button olive"
                disabled={busy}
                onClick={() => onQueue()}
              >
                Open the request desk <ArrowUpRight size={15} />
              </button>
            </div>
          )}
        </section>
        <section className="ops-panel">
          <div className="ops-section-head">
            <div>
              <h2>Payment checks</h2>
              <p>Allow up to 24 hours. Verify the actual receipt.</p>
            </div>
            <span className="app-badge">{data.counts.pendingPayments}</span>
          </div>
          {data.payments.length ? (
            <div className="ops-payment-list">
              {data.payments.map((p) => (
                <button
                  key={p.id}
                  disabled={busy}
                  onClick={() => onOpen(p.projectId, "payments")}
                >
                  <span>
                    <strong>{money(p.amount)}</strong>
                    <span className="ops-wrap">{p.title}</span>
                    <small>
                      <Clock3 size={12} />
                      {p.overdue
                        ? "Over 24 hours · check now"
                        : `Submitted ${shortDate(p.createdAt)}`}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="ops-empty small">
              <CheckCheck size={28} strokeWidth={1.4} />
              <h3>No payment proof waiting.</h3>
              <p>New submissions will appear here for bank verification.</p>
            </div>
          )}
        </section>
      </div>
      <div className="ops-insights-grid">
        <section className="ops-panel">
          <div className="ops-section-head">
            <div>
              <h2>Money, clearly</h2>
              <p>Verified receipts over the last 30 days.</p>
            </div>
            <button
              className="ops-text-button"
              disabled={busy}
              onClick={onReports}
            >
              Reports <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="ops-money">
            <div>
              <span>Received & verified</span>
              <strong>{money(data.money.verifiedLast30Days)}</strong>
            </div>
            <div>
              <span>Outstanding on confirmed orders</span>
              <strong>{money(data.money.outstanding)}</strong>
            </div>
          </div>
          <ReceiptChart data={data} />
        </section>
        <section className="ops-panel">
          <div className="ops-section-head">
            <div>
              <h2>The gifting pipeline</h2>
              <p>Where your customer gifts are today.</p>
            </div>
          </div>
          <div className="ops-pipeline">
            {data.pipeline.map((p) => (
              <div key={p.label}>
                <span>{p.label}</span>
                <strong>{p.count}</strong>
                <div className="ops-pipeline-track">
                  <i style={{ width: `${(p.count / maxPipeline) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="ops-panel ops-deliveries">
        <div className="ops-section-head">
          <div>
            <h2>Coming up for delivery</h2>
            <p>
              Requested delivery dates in the next seven days. Confirm
              feasibility with each customer.
            </p>
          </div>
          <CalendarDays size={20} strokeWidth={1.5} />
        </div>
        {data.deliveries.length ? (
          <div className="ops-delivery-list">
            {data.deliveries.map((d) => (
              <button
                key={d.id}
                disabled={busy}
                onClick={() => onOpen(d.id, "fulfilment")}
              >
                <span className="ops-date">{shortDate(d.date)}</span>
                <span className="ops-wrap">
                  <strong>{d.title}</strong>
                  <small>
                    {stages[d.stage]}
                    {d.balance > 0
                      ? ` · ${money(d.balance)} remaining`
                      : " · Paid in full"}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <p className="ops-quiet-empty">
            No requested deliveries in the next seven days.
          </p>
        )}
      </section>
      <p className="ops-data-note">
        Live customer records. Private drafts and labelled samples are excluded.
        Payment screenshots are never counted as verified receipts.
      </p>
    </div>
  );
}
