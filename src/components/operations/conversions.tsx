"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Download, RefreshCw } from "lucide-react";
import { OperationsPageHeader } from "./page-header";
import type { ConversionReport } from "@/lib/customer/conversion-report";
import { reportCsv } from "@/lib/customer/conversion-model";
import { money } from "@/lib/customer/model";
import "./conversions.css";

type Post = (
  body: Record<string, unknown>,
  candidate?: string,
  signal?: AbortSignal,
) => Promise<Record<string, unknown>>;
const percentage = (n: number, d: number) =>
  d ? `${Math.round((n / d) * 1000) / 10}%` : "—";
const currency = (n: string) =>
  Number.isSafeInteger(Number(n)) ? money(Number(n)) : "Amount needs review";

export function OperationsConversions({
  post,
  onOpen,
  refreshVersion = 0,
}: {
  post: Post;
  onOpen: (id: string, tab: string) => void;
  refreshVersion?: number;
}) {
  const [windowDays, setWindowDays] = useState(90),
    [stalledDays, setStalledDays] = useState(3),
    [version, setVersion] = useState(0);
  const [waiting, setWaiting] = useState("all");
  const [result, setResult] = useState<{
    key: string;
    data?: ConversionReport;
    error?: string;
  }>({ key: "" });
  const key = `${windowDays}:${stalledDays}:${version}:${refreshVersion}`;
  const loading = result.key !== key,
    data = loading ? undefined : result.data;
  useEffect(() => {
    const controller = new AbortController();
    post(
      {
        op: "conversion_report",
        window_days: windowDays,
        stalled_days: stalledDays,
      },
      undefined,
      controller.signal,
    )
      .then((r) => {
        if (!controller.signal.aborted)
          setResult({ key, data: r.report as ConversionReport });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error: e instanceof Error ? e.message : "Analytics could not load.",
          });
      });
    return () => controller.abort();
  }, [key, windowDays, stalledDays, post]);
  const rows =
    data?.followUps.filter(
      (r) =>
        waiting === "all" ||
        (waiting === "proposals" ? r.proposal : r.waiting === waiting),
    ) || [];
  function download() {
    const csv = reportCsv([
      [
        "Gift",
        "Customer email",
        "Waiting on",
        "Next action",
        "Days waiting",
        "Task owner",
        "Quoted amount (paise)",
        "Last relevant activity (UTC)",
      ],
      ...rows.map((r) => [
        r.title,
        r.email,
        r.waiting,
        r.action,
        r.days,
        r.owner,
        r.quotePaise,
        r.since,
      ]),
    ]);
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "gyvft-follow-ups.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="ops-conversions" aria-busy={loading}>
      <OperationsPageHeader
        title="Analytics & conversions"
        description="See what brings people in, what turns into a gift, and what needs a follow-up."
      />
      <div className="ops-conversion-filters">
        <label className="app-label">
          Request cohort
          <select
            className="app-input"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
          >
            <option value={30}>Created in the last 30 days</option>
            <option value={90}>Created in the last 90 days</option>
            <option value={365}>Created in the last year</option>
            <option value={0}>All time</option>
          </select>
        </label>
        <label className="app-label">
          Follow up after
          <select
            className="app-input"
            value={stalledDays}
            onChange={(e) => setStalledDays(Number(e.target.value))}
          >
            {[1, 3, 7, 14, 30].map((d) => (
              <option value={d} key={d}>
                {d} {d === 1 ? "day" : "days"} without progress
              </option>
            ))}
          </select>
        </label>
        <button
          className="app-button secondary"
          onClick={() => setVersion((v) => v + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="ops-panel" role="status">
          Loading conversion records…
        </div>
      ) : result.error ? (
        <div className="ops-panel" role="alert">
          <h2>Analytics could not load</h2>
          <p className="app-muted mt-2">{result.error}</p>
          <button
            className="app-button primary mt-3"
            onClick={() => setVersion((v) => v + 1)}
          >
            Try again
          </button>
        </div>
      ) : data ? (
        <>
          <section className="ops-panel ops-traffic-link">
            <div>
              <p className="ops-conversion-eyebrow">
                Website traffic · Google Analytics
              </p>
              <h2>Visits, new visitors & where they come from.</h2>
              <p className="app-muted mt-2">
                Sessions, new and returning users, sources, popular pages,
                devices and engagement are measured in GA4. The figures below
                come from GYVFT’s own gift records.
              </p>
              {!data.googleAnalytics.configured && (
                <p className="app-alert mt-3">
                  The Google Analytics tag still needs your Measurement ID
                  before visitor collection can start.
                </p>
              )}
            </div>
            <a
              className="app-button secondary"
              href={data.googleAnalytics.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Google Analytics <ArrowUpRight size={16} />
            </a>
          </section>
          <div className="ops-conversion-metrics">
            {[
              {
                label: "Sign-up → first request",
                value: percentage(
                  data.accounts.withRequest,
                  data.accounts.registered,
                ),
                note: `${data.accounts.withRequest} of ${data.accounts.registered} accounts registered in this period have submitted a real request.`,
              },
              {
                label: "Quote → approval",
                value: percentage(
                  data.quoteApproval.numerator,
                  data.quoteApproval.denominator,
                ),
                note: `${data.quoteApproval.numerator} of ${data.quoteApproval.denominator} quoted requests reached approval.`,
              },
              {
                label: "Quote → verified payment",
                value: percentage(
                  data.quoteToPayment.numerator,
                  data.quoteToPayment.denominator,
                ),
                note: `${data.quoteToPayment.numerator} of ${data.quoteToPayment.denominator} quoted requests have a bank-verified receipt.`,
              },
              {
                label: "Stalled proposals",
                value: data.stalledProposals,
                note: `All open quotes waiting on a customer for ${stalledDays}+ days. These are follow-ups, not confirmed cancellations.`,
              },
            ].map((m) => (
              <section className="ops-panel" key={m.label}>
                <p className="app-muted">{m.label}</p>
                <strong>{m.value}</strong>
                <p className="app-muted">{m.note}</p>
              </section>
            ))}
          </div>
          <section className="ops-panel">
            <h2>From request to gift</h2>
            <p className="app-muted mt-2">
              {data.cohortCount} real requests started in this period. Each row
              counts recorded milestones reached by those requests as of today;
              manually managed gifts can skip steps.
            </p>
            <div className="ops-conversion-bars">
              {data.milestones.map((m) => (
                <div key={m.key}>
                  <span>{m.label}</span>
                  <div aria-hidden="true">
                    <i
                      style={{
                        width: `${data.cohortCount ? (m.count / data.cohortCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <strong>{m.count}</strong>
                  <span>{percentage(m.count, data.cohortCount)}</span>
                </div>
              ))}
            </div>
            <div className="ops-conversion-notes">
              <p>
                <strong>{currency(data.verifiedPaise)}</strong> verified
                receipts belonging to this request cohort.
              </p>
              <p>
                <strong>{data.savedPrivateBriefs}</strong> private briefs
                currently saved but not submitted. Their contents stay private.
              </p>
            </div>
          </section>
          <section className="ops-panel">
            <div className="ops-section-head">
              <div>
                <h2>Where a little follow-up could help</h2>
                <p className="app-muted mt-2">
                  All open requests, including older requests outside the
                  selected cohort. A new exchange or published version restarts
                  the wait. Internal notes do not.
                </p>
              </div>
              <button
                className="app-button secondary"
                disabled={!rows.length}
                onClick={download}
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
            <div
              className="ops-follow-up-filters"
              role="group"
              aria-label="Follow-up filters"
            >
              {[
                ["all", `All (${data.followUps.length})`],
                ["proposals", `Proposals (${data.stalledProposals})`],
                ["Customer", `Waiting on customer (${data.waitingCustomer})`],
                ["Aarla", `Waiting on Aarla (${data.waitingAarla})`],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`app-button ${waiting === value ? "primary" : "secondary"}`}
                  aria-pressed={waiting === value}
                  onClick={() => setWaiting(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!rows.length ? (
              <p className="ops-conversion-empty">
                Nothing is waiting beyond this threshold in this view.
              </p>
            ) : (
              <div className="ops-follow-ups">
                {rows.slice(0, 50).map((r) => (
                  <article key={r.id}>
                    <div>
                      <h3>{r.title}</h3>
                      <p className="app-muted">{r.email}</p>
                      <p className="mt-2">
                        <span className="app-badge">{r.waiting}</span> ·{" "}
                        {r.days} days · {r.action}
                      </p>
                      <p className="app-muted mt-1">
                        Owner: {r.owner}
                        {r.quotePaise !== "0"
                          ? ` · Latest quote: ${currency(r.quotePaise)}`
                          : ""}
                      </p>
                    </div>
                    <button
                      className="app-button secondary"
                      onClick={() => onOpen(r.id, r.tab)}
                    >
                      Open request <ArrowUpRight size={15} />
                    </button>
                  </article>
                ))}
              </div>
            )}
            {rows.length > 50 && (
              <p className="app-muted mt-3">
                Showing the 50 longest waits. Export includes all {rows.length}{" "}
                matches.
              </p>
            )}
          </section>
          <p className="app-muted text-xs">
            Samples and demo accounts are excluded. Private drafts are counted
            only in the separate saved-brief total. Payment proof alone does not
            count as payment. Customer identity and gift details are not sent to
            Google.
          </p>
        </>
      ) : null}
    </div>
  );
}
