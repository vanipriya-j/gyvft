"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
type Report = {
  ok: true;
  generatedAt: string;
  windowDays: number;
  health: { database: string; reporting: string };
  metrics: { key: string; label: string; value: number }[];
  byStatus: { stage: number; label: string; count: number }[];
  events: { type: string; count: number }[];
  recentErrors: {
    type: string;
    requestId?: string;
    code?: string;
    operation?: string;
    route?: string;
    status?: number;
    durationMs?: number;
    createdAt: string;
  }[];
};
const time = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
const card = "rounded-2xl border border-border bg-paper p-5 md:p-6";
export default function OperationsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const secret = useRef("");
  const locked = useRef(false);
  async function load(value: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: value }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(
          result.message || "Reporting could not load. Try again shortly.",
        );
        return false;
      }
      secret.current = value;
      setReport(result);
      return true;
    } catch {
      setMessage("We couldn’t reach reporting. Please try again shortly.");
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await load(String(new FormData(form).get("secret") ?? ""));
    if (ok) form.reset();
  }
  function lock() {
    secret.current = "";
    setReport(null);
    setMessage("");
  }
  function exportCsv() {
    if (!report) return;
    const quote = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["Metric", "Value", "Snapshot"],
      ...report.metrics.map((metric) => [
        metric.label,
        metric.value,
        report.generatedAt,
      ]),
    ];
    const blob = new Blob(
      [rows.map((row) => row.map(quote).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gyvft-operations-${report.generatedAt.slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:py-12">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-border pb-6">
        <div>
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[.2em] text-olive"
          >
            GYVFT
          </Link>
          <h1 className="mt-3 font-serif text-3xl md:text-4xl">Operations</h1>
          <p className="mt-2 text-sm text-muted-text">
            Operator-only analytics, reporting and application health.
          </p>
        </div>
        {report && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => load(secret.current)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Refresh
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50"
            >
              <Download size={16} />
              Export counts
            </button>
            <button
              type="button"
              onClick={lock}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50"
            >
              <LockKeyhole size={16} />
              Lock
            </button>
          </div>
        )}
      </header>
      {!report && (
        <section className="mx-auto mt-12 max-w-lg rounded-3xl border border-border bg-paper p-7 shadow-sm">
          <LockKeyhole className="text-olive" size={24} />
          <h2 className="mt-4 font-serif text-2xl">Unlock reporting</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-text">
            Use the operator setup secret configured in Vercel. Customer
            accounts do not grant reporting access.
          </p>
          <form onSubmit={unlock} className="mt-6">
            <label
              htmlFor="operations-secret"
              className="block text-sm font-medium"
            >
              Operator secret
            </label>
            <input
              id="operations-secret"
              name="secret"
              type="password"
              minLength={11}
              maxLength={1024}
              autoComplete="off"
              required
              disabled={busy}
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-olive focus:ring-2 focus:ring-olive/20"
            />
            <button
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-olive-dark px-5 py-3 text-white disabled:opacity-50"
            >
              {busy && <Loader2 size={17} className="animate-spin" />}
              {busy ? "Loading reporting…" : "Open reporting"}
            </button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-muted-text">
            The secret stays only in this tab’s memory while unlocked. It is
            never placed in the URL or browser storage.
          </p>
        </section>
      )}
      {message && (
        <p
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertCircle size={18} className="shrink-0" />
          {message}
          {report
            ? " The last successful snapshot is still displayed below."
            : ""}
        </p>
      )}
      {report && (
        <>
          <div className="my-6 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="inline-flex items-center gap-2 text-emerald-800">
              <CheckCircle2 size={17} />
              Database and reporting connected
            </p>
            <p className="text-xs text-muted-text">
              Snapshot {time(report.generatedAt)} IST
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {report.metrics.map((metric) => (
              <section key={metric.key} className={card}>
                <p className="min-h-10 text-xs leading-relaxed text-muted-text">
                  {metric.label}
                </p>
                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {metric.value.toLocaleString("en-IN")}
                </p>
              </section>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-text">
            Enquiry, project and request-funnel counts exclude the labelled demo
            fixtures. Account/session totals include all customer accounts.
            Event counts cover the last {report.windowDays} days.
          </p>
          <div className="mt-7 grid items-start gap-6 lg:grid-cols-2">
            <section className={card}>
              <h2 className="font-serif text-2xl">Enquiries by status</h2>
              <p className="mt-2 text-sm text-muted-text">
                Current real enquiry/project records.
              </p>
              {report.byStatus.length ? (
                <ul className="mt-5 divide-y divide-border">
                  {report.byStatus.map((row) => (
                    <li
                      key={row.stage}
                      className="flex justify-between gap-4 py-3 text-sm"
                    >
                      <span>{row.label}</span>
                      <strong className="tabular-nums">{row.count}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 text-sm text-muted-text">
                  No real enquiries have been recorded yet.
                </p>
              )}
            </section>
            <section className={card}>
              <h2 className="font-serif text-2xl">Application activity</h2>
              <p className="mt-2 text-sm text-muted-text">
                Recorded events over {report.windowDays} days.
              </p>
              {report.events.length ? (
                <ul className="mt-5 divide-y divide-border">
                  {report.events.map((row) => (
                    <li
                      key={row.type}
                      className="flex justify-between gap-4 py-3 text-sm"
                    >
                      <span className="break-all font-mono text-xs">
                        {row.type}
                      </span>
                      <strong className="tabular-nums">{row.count}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 text-sm text-muted-text">
                  No application events recorded in this window.
                </p>
              )}
            </section>
          </div>
          <section className={`${card} mt-7`}>
            <div className="flex items-center gap-3">
              <Activity size={20} className="text-olive" />
              <h2 className="font-serif text-2xl">Recent failures</h2>
            </div>
            <p className="mt-2 text-sm text-muted-text">
              Up to 30 recent sign-in, application and setup failures.
              Diagnostic identifiers help match deployment logs; request
              contents and credentials are excluded.
            </p>
            {report.recentErrors.length ? (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-text">
                      <th className="py-3 pr-4 font-medium">Time</th>
                      <th className="py-3 pr-4 font-medium">Event</th>
                      <th className="py-3 pr-4 font-medium">Diagnostic</th>
                      <th className="py-3 font-medium">Request ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.recentErrors.map((row, index) => (
                      <tr
                        key={`${row.requestId}-${index}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="whitespace-nowrap py-3 pr-4">
                          {time(row.createdAt)}
                        </td>
                        <td className="py-3 pr-4">
                          <p className="font-mono">{row.type}</p>
                          <p className="mt-1 text-muted-text">
                            {row.operation || row.route || "—"}
                          </p>
                        </td>
                        <td className="py-3 pr-4 font-mono">
                          {row.code ||
                            (row.status ? `HTTP ${row.status}` : "—")}
                        </td>
                        <td className="break-all py-3 font-mono text-muted-text">
                          {row.requestId || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-text">
                <CheckCircle2 size={17} className="text-emerald-700" />
                No failures recorded in this window.
              </div>
            )}
          </section>
          <p className="mt-6 text-xs text-muted-text">
            This dashboard reports stored application activity. External uptime
            alerting and Grafana/Vercel telemetry connections are configured
            separately.
          </p>
        </>
      )}
    </main>
  );
}
