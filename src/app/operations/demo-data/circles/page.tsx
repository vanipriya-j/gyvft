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
  corrected?: number;
  accounts?: { id: string; email: string; circles: number }[];
};
export default function CompleteCircles() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState<Result | null>(null),
    lock = useRef(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    const f = new FormData(e.currentTarget);
    lock.current = true;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/operations/demo-circles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-secret": String(f.get("secret")),
        },
        body: JSON.stringify({ confirm: f.has("confirm") }),
      });
      const next = await r.json();
      setResult(next);
      if (next.ok) router.refresh();
    } catch {
      setResult({
        ok: false,
        message:
          "The connection was interrupted. Check Circles before retrying; existing passwords and membership choices are preserved.",
      });
    } finally {
      lock.current = false;
      setBusy(false);
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
              untouched occasion labels.
            </label>
            <button
              className="app-button primary app-pending-button mt-4"
              aria-label="Complete demo circles"
              aria-busy={busy}
              disabled={busy || !hydrated}
            >
              <span style={{ visibility: busy ? "hidden" : "visible" }}>
                Complete demo circles
              </span>
              {busy && (
                <span className="app-button-pending" aria-hidden>
                  <LoaderCircle size={16} className="app-spinner" />
                  Working…
                </span>
              )}
            </button>
          </fieldset>
        </form>
        {result && (
          <div className="app-soft mt-4" role={result.ok ? "status" : "alert"}>
            <p>{result.message}</p>
            {result.corrected !== undefined && (
              <p className="mt-2">
                {result.corrected} untouched occasion contexts corrected.
              </p>
            )}
            {result.accounts?.map((a) => (
              <p className="mt-2 break-all" key={a.id}>
                {a.email} · {a.circles} active circles
              </p>
            ))}
            {result.ok && (
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
