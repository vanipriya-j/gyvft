"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import type { MigrationProgress } from "@/lib/database/migration-progress";
type Readiness = {
  hasSetupSecret: boolean;
  hasDatabaseUrl: boolean;
  ready: boolean;
};
type Migration = { id: string; appliedAt: string | null };
type Result = {
  ok: boolean;
  message: string;
  migrations?: Migration[];
  applied?: string[];
  diagnostic?: { code: string; filename?: string };
};
export default function SetupPage() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [readinessError, setReadinessError] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    fetch("/api/setup", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setReadiness)
      .catch(() => setReadinessError(true));
  }, []);
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(timer);
      window.removeEventListener("beforeunload", warn);
    };
  }, [busy]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    setElapsed(0);
    locked.current = true;
    setBusy(true);
    setResult(null);
    setProgress(null);
    const form = event.currentTarget;
    let finalResult: Result | null = null;
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: new FormData(form).get("secret"),
          action: "migrate",
          confirm: true,
          stream: true,
        }),
      });
      if (
        response.headers
          .get("content-type")
          ?.includes("application/x-ndjson") &&
        response.body
      ) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const consume = (line: string) => {
          if (!line.trim()) return;
          const event = JSON.parse(line);
          if (event.type === "progress") setProgress(event.progress);
          if (event.type === "result") finalResult = event.result;
        };
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newline;
            while ((newline = buffer.indexOf("\n")) >= 0) {
              consume(buffer.slice(0, newline));
              buffer = buffer.slice(newline + 1);
            }
          }
          buffer += decoder.decode();
          if (buffer.trim()) consume(buffer);
        } finally {
          reader.releaseLock();
        }
      } else {
        finalResult = await response.json();
      }
      if (!finalResult) throw new Error("Connection interrupted");
      setResult(finalResult);
      if (finalResult.ok) form.reset();
    } catch {
      setResult({
        ok: false,
        message:
          "The connection was interrupted. The database may still be finishing. Wait a minute before trying again; completed updates will be skipped.",
      });
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const phase =
    progress?.phase === "checking"
      ? 0
      : progress?.phase === "applying"
        ? 1
        : progress?.phase === "committing"
          ? 2
          : -1;
  const pending = result?.migrations?.filter((m) => !m.appliedAt).length ?? 0;
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 md:py-16">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[.2em] text-olive"
        >
          GYVFT
        </Link>
        <span className="inline-flex items-center gap-2 text-xs text-muted-text">
          <ShieldCheck size={16} />
          Secure setup
        </span>
      </div>
      <h1 className="mt-10 font-serif text-4xl md:text-5xl">
        Let’s get GYVFT ready.
      </h1>
      <p className="mt-4 max-w-lg leading-relaxed text-muted-text">
        Enter your setup secret once. We’ll prepare the customer portal so
        customers can sign in and see their enquiries.
      </p>
      <section className="mt-8 rounded-3xl border border-border bg-paper p-6 shadow-sm md:p-8">
        <div className="grid gap-3 border-b border-border pb-6 sm:grid-cols-2">
          {[
            ["Database settings", readiness?.hasDatabaseUrl],
            ["Setup secret", readiness?.hasSetupSecret],
          ].map(([label, ready]) => (
            <div
              key={String(label)}
              className="flex items-center gap-2 text-sm"
            >
              {!readiness ? (
                <Loader2 size={17} className="animate-spin text-muted-text" />
              ) : ready ? (
                <CheckCircle2 size={17} className="text-emerald-700" />
              ) : (
                <AlertCircle size={17} className="text-amber-700" />
              )}
              <span>{label}</span>
              <span className="ml-auto text-xs text-muted-text">
                {!readiness ? "Checking…" : ready ? "Configured" : "Missing"}
              </span>
            </div>
          ))}
        </div>
        {readinessError && (
          <p role="alert" className="mt-5 text-sm text-amber-800">
            We couldn’t check the configuration. Refresh this page to try again.
          </p>
        )}
        {readiness && !readiness.ready && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
          >
            Set DATABASE_URL and a SETUP_SECRET of at least 11 characters in
            GYVFT’s Vercel environment, then redeploy.
          </p>
        )}
        <form onSubmit={submit} className="mt-6" aria-busy={busy}>
          <fieldset
            disabled={busy || result?.ok === true}
            className="disabled:opacity-60"
          >
            <label className="block text-sm font-medium" htmlFor="setup-secret">
              Your setup secret
            </label>
            <input
              id="setup-secret"
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-olive focus:ring-2 focus:ring-olive/20"
              name="secret"
              type="password"
              autoComplete="off"
              minLength={11}
              maxLength={1024}
              required
              placeholder="The value you saved in Vercel"
            />
            <p className="mt-2 text-xs text-muted-text">
              This is your SETUP_SECRET, separate from your login password.
            </p>
          </fieldset>
          <p className="mt-5 text-sm leading-relaxed text-muted-text">
            Setup applies only customer-portal updates. Existing campaigns,
            contacts and other business tables are left unchanged.
          </p>
          <button
            disabled={busy || !readiness?.ready || result?.ok === true}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-olive-dark px-6 py-3.5 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Setup in progress…
              </>
            ) : result?.ok ? (
              <>
                <CheckCircle2 size={18} />
                Setup complete
              </>
            ) : result ? (
              "Try setup again"
            ) : (
              "Start setup"
            )}
          </button>
        </form>
        {busy && (
          <section
            className="mt-7 rounded-2xl border border-border bg-background p-5"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium">
                {progress ? "Preparing your database" : "Connecting securely…"}
              </h2>
              <span className="text-xs tabular-nums text-muted-text">
                {elapsed}s elapsed
              </span>
            </div>
            <ol className="mt-5 space-y-4">
              {[
                "Check database and find pending updates",
                "Apply database updates",
                "Save and confirm",
              ].map((label, i) => (
                <li className="flex items-center gap-3 text-sm" key={label}>
                  {i < phase ? (
                    <CheckCircle2
                      size={18}
                      className="shrink-0 text-emerald-700"
                    />
                  ) : i === phase ? (
                    <Loader2
                      size={18}
                      className="shrink-0 animate-spin text-olive"
                    />
                  ) : (
                    <Circle size={18} className="shrink-0 text-muted-text/40" />
                  )}
                  <span
                    className={i === phase ? "font-medium" : "text-muted-text"}
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>
            {progress?.phase === "applying" && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-sm">
                  Running update {progress.completed + 1} of {progress.total}
                </p>
                <p className="mt-2 break-all font-mono text-xs text-muted-text">
                  {progress.filename}
                </p>
              </div>
            )}
            <p className="mt-5 text-xs leading-relaxed text-muted-text">
              Keep this tab open. There’s no need to click again. Updates are
              saved together when the final step completes.
            </p>
            {elapsed >= 45 && (
              <p className="mt-3 text-xs text-muted-text">
                This is taking longer than usual. We’re still waiting for the
                server’s result.
              </p>
            )}
          </section>
        )}
        {!busy && result && (
          <section
            className={`mt-7 rounded-2xl border p-5 ${result.ok ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}
            role={result.ok ? "status" : "alert"}
          >
            <div className="flex items-start gap-3">
              {result.ok ? (
                <CheckCircle2 className="shrink-0 text-emerald-700" size={23} />
              ) : (
                <AlertCircle className="shrink-0 text-amber-700" size={23} />
              )}
              <div className="min-w-0">
                <h2 className="font-serif text-2xl">
                  {result.ok ? "Your database is ready." : "Setup stopped."}
                </h2>
                <p className="mt-2 break-words text-sm leading-relaxed text-muted-text">
                  {result.message}
                </p>
                {result.diagnostic && (
                  <p className="mt-4 break-all rounded-lg bg-white/70 p-3 font-mono text-xs">
                    {result.diagnostic.filename || "Database check"} ·{" "}
                    {result.diagnostic.code}
                  </p>
                )}
              </div>
            </div>
            {result.ok && (
              <Link
                href="/account"
                className="mt-5 inline-block text-sm font-medium underline"
              >
                Go to My GYVFT →
              </Link>
            )}
          </section>
        )}
      </section>
      {result?.ok && result.migrations && (
        <details className="mt-6 rounded-2xl border border-border bg-paper p-5">
          <summary className="cursor-pointer text-sm font-medium">
            View migration history · {result.migrations.length - pending}{" "}
            applied{pending ? ` · ${pending} pending` : ""}
          </summary>
          <ul className="mt-4 divide-y divide-border">
            {result.migrations.map((m) => (
              <li key={m.id} className="py-3">
                <p className="break-all font-mono text-xs">{m.id}</p>
                <p className="mt-1 text-xs text-muted-text">
                  {m.appliedAt ? "Applied" : "Pending"}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="mt-7 text-sm text-muted-text">
        <summary className="cursor-pointer">
          Need help with Vercel settings?
        </summary>
        <ol className="mt-4 list-decimal space-y-3 pl-5 leading-relaxed">
          <li>
            In the GYVFT Vercel project, set DATABASE_URL to your Supabase
            database connection string.
          </li>
          <li>
            Set a separate SETUP_SECRET with at least 11 characters, then
            redeploy.
          </li>
          <li>
            Return here and use the same setup secret. No Studio account is
            required.
          </li>
        </ol>
      </details>
      <p className="mt-8 text-xs leading-relaxed text-muted-text">
        Setup adds the customer tables and three labelled DEMO enquiries for
        aarla@aarla.in. Create your customer account after setup. Keep the
        operator secret configured to use setup and app reports; it is never
        saved in browser storage.
      </p>
    </main>
  );
}
