"use client";
import Link from "@/components/ui/navigation-link";
import { useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { demoAccounts } from "@/lib/customer/demo-accounts";
type Result = {
  ok: boolean;
  message: string;
  reference?: string;
  checkOnly?: boolean;
  diagnostic?: {
    code: string;
    operation: string;
    table?: string;
    column?: string;
    constraint?: string;
  };
  corrected?: number;
  accounts?: { id: string; email: string; circles: number }[];
};
export default function CompleteCircles() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [mode, setMode] = useState<"check" | "save" | null>(null),
    [result, setResult] = useState<Result | null>(null),
    lock = useRef(false);
  const busy = mode !== null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(e.currentTarget, false);
  }
  async function run(form: HTMLFormElement, checkOnly: boolean) {
    if (lock.current) return;
    const f = new FormData(form);
    if (!String(f.get("secret") || "").trim()) {
      setResult({ ok: false, message: "Enter the Operations secret first." });
      return;
    }

    lock.current = true;
    setMode(checkOnly ? "check" : "save");
    setResult(null);
    try {
      const r = await fetch("/api/operations/demo-circles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-secret": String(f.get("secret")),
        },
        body: JSON.stringify({
          confirm: checkOnly || f.has("confirm"),
          ...(checkOnly ? { check_only: true } : {}),
        }),
      });
      const next = await r.json();
      setResult(next);
      if (next.ok && !next.checkOnly) router.refresh();
    } catch {
      setResult({
        ok: false,
        message:
          "The connection was interrupted. Check Circles before retrying; existing passwords and membership choices are preserved.",
      });
    } finally {
      lock.current = false;
      setMode(null);
    }
  }
  return (
    <main className="mx-auto max-w-3xl w-full px-4 py-5">
      <Link className="app-button quiet mb-4" href="/operations">
        ← Operations
      </Link>
      <div className="app-title">
        <div>
          <h1>Complete the demo circles</h1>
          <p>
            Connect the existing fictional accounts to family, company, alumni,
            book-club and neighbourhood circles.
          </p>
        </div>
      </div>
      <section className="app-panel">
        <h2>What this completes</h2>
        <p className="app-muted mt-3">
          Adds five circles with accepted memberships, recipients, shared
          occasions and links to known sample gifts. It also corrects unchanged
          sample occasion labels such as a book-club anniversary incorrectly
          labelled “Alumni network”.
        </p>
        <p className="app-note">
          This does not create accounts, change passwords, run migrations,
          delete records or send invitations. Existing membership changes, dates
          and edited occasion notes are preserved.
        </p>
        <div className="app-actions mt-4">
          {demoAccounts.map((a) => (
            <span className="app-badge" key={a.id}>
              {a.shortName}
            </span>
          ))}
        </div>
        <form method="post" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy || !hydrated}>
            <label className="app-label mt-4">
              Operator secret
              <input
                className="app-input"
                name="secret"
                type="password"
                autoComplete="off"
                maxLength={1024}
                required
              />
            </label>
            <label className="app-check mt-4">
              <input name="confirm" type="checkbox" required />
              Complete only these four fictional workspaces and correct their
              untouched occasion labels. The check tests the same writes and
              rolls them back.
            </label>
            <button
              className="app-button app-pending-button mt-4 mr-3"
              aria-busy={mode === "check"}
              aria-label="Check without saving"
              type="button"
              disabled={busy || !hydrated}
              onClick={(e) => {
                const form = e.currentTarget.form;
                if (form) void run(form, true);
              }}
            >
              <span
                style={{ visibility: mode === "check" ? "hidden" : "visible" }}
              >
                Check without saving
              </span>
              {mode === "check" && (
                <span className="app-button-pending" aria-hidden>
                  <LoaderCircle size={16} className="app-spinner" />
                  Checking…
                </span>
              )}
            </button>
            <button
              className="app-button primary app-pending-button mt-4"
              aria-label="Complete demo circles"
              aria-busy={mode === "save"}
              disabled={busy || !hydrated}
            >
              <span
                style={{ visibility: mode === "save" ? "hidden" : "visible" }}
              >
                Complete demo circles
              </span>
              {mode === "save" && (
                <span className="app-button-pending" aria-hidden>
                  <LoaderCircle size={16} className="app-spinner" />
                  Working…
                </span>
              )}
            </button>
          </fieldset>
        </form>
        {result && (
          <div
            className="app-soft mt-4"
            role={result.ok ? "status" : "alert"}
            aria-label="Demo circle result"
          >
            <p>{result.message}</p>
            {result.diagnostic && (
              <p className="mt-2">
                <strong>{result.diagnostic.operation}</strong> ·{" "}
                {result.diagnostic.code}
                {result.diagnostic.table
                  ? ` · Table: ${result.diagnostic.table}`
                  : ""}
                {result.diagnostic.column
                  ? ` · Column: ${result.diagnostic.column}`
                  : ""}
                {result.diagnostic.constraint
                  ? ` · Constraint: ${result.diagnostic.constraint}`
                  : ""}
              </p>
            )}
            {result.reference && (
              <p className="mt-2">
                Reference: <code>{result.reference}</code>
              </p>
            )}
            {result.corrected !== undefined && (
              <p className="mt-2">
                {result.corrected} untouched occasion contexts{" "}
                {result.checkOnly ? "would be corrected" : "corrected"}.
              </p>
            )}
            {result.accounts?.map((a) => (
              <p className="mt-2 break-all" key={a.id}>
                {a.email} · {a.circles}{" "}
                {result.checkOnly
                  ? "circles after completion (not saved)"
                  : "active circles"}
              </p>
            ))}
            {result.ok && !result.checkOnly && (
              <Link className="app-button mt-4" href="/account/circles">
                Open your circles →
              </Link>
            )}
          </div>
        )}
      </section>
      <Link className="app-button quiet mt-4" href="/operations/demo-data">
        Need to create the four demo accounts first? →
      </Link>
    </main>
  );
}
