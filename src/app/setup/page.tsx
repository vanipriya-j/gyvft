"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type Readiness = {
  hasSetupSecret: boolean;
  hasDatabaseUrl: boolean;
  ready: boolean;
};
type Migration = { id: string; appliedAt: string | null };
export default function SetupPage() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [migrations, setMigrations] = useState<Migration[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/setup", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setReadiness)
      .catch(() =>
        setMessage("Couldn’t load setup readiness. Refresh to try again."),
      );
  }, []);
  async function submit(data: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: data.get("secret"),
          action: data.get("action"),
          confirm: data.get("confirm") === "on",
        }),
      });
      const result = await response.json();
      setMessage(
        result.message ||
          "Request could not complete. Check status before retrying.",
      );
      if (result.ok) setMigrations(result.migrations);
    } catch {
      setMessage(
        "Request interrupted. Check migration status before running again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 md:py-20">
      <Link
        href="/"
        className="text-sm font-semibold tracking-widest text-olive"
      >
        GYVFT
      </Link>
      <h1 className="mt-5 font-serif text-4xl">Database setup</h1>
      <p className="mt-4 leading-relaxed text-muted-text">
        Initialize or update the GYVFT database using the setup secret
        configured in Vercel. No Studio or customer login is needed.
      </p>
      <section className="mt-8 rounded-3xl border border-border bg-paper p-6">
        <h2 className="font-serif text-2xl">Before you start</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted-text">
          <li>
            Set <code>DATABASE_URL</code> to your Supabase database connection
            string in the GYVFT Vercel project.
          </li>
          <li>
            Set <code>SETUP_SECRET</code> to a separate random secret of at
            least 32 characters. This is not your customer or Studio password.
          </li>
          <li>
            Redeploy that environment, return here, and enter the same setup
            secret.
          </li>
        </ol>
        <div
          className="mt-5 space-y-2 border-t border-border pt-4 text-sm"
          aria-live="polite"
        >
          {readiness ? (
            <>
              <p>
                DATABASE_URL:{" "}
                {readiness.hasDatabaseUrl ? "Configured" : "Missing"}
              </p>
              <p>
                SETUP_SECRET:{" "}
                {readiness.hasSetupSecret
                  ? "Configured"
                  : "Missing or shorter than 32 characters"}
              </p>
            </>
          ) : (
            <p>Checking configuration…</p>
          )}
        </div>
      </section>
      <form
        action={submit}
        className="mt-6 rounded-3xl border border-border bg-paper p-6"
      >
        <label className="block text-sm font-medium">
          Setup secret
          <input
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
            name="secret"
            type="password"
            autoComplete="off"
            minLength={32}
            maxLength={1024}
            required
          />
        </label>
        <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed">
          <input className="mt-1" name="confirm" type="checkbox" />
          Apply pending migrations to this deployment’s database. Already
          applied migrations are skipped.
        </label>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            name="action"
            value="status"
            disabled={busy || !readiness?.ready}
            className="rounded-full border border-border px-5 py-3 text-sm disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Check migrations"}
          </button>
          <button
            name="action"
            value="migrate"
            disabled={busy || !readiness?.ready}
            className="rounded-full bg-olive-dark px-5 py-3 text-sm text-white disabled:opacity-50"
          >
            Run pending migrations
          </button>
        </div>
        <p
          role="status"
          className="mt-5 text-sm leading-relaxed text-muted-text"
        >
          {message}
        </p>
        <p className="mt-5 text-xs leading-relaxed text-muted-text">
          This applies database changes only. It does not create staff accounts
          or demo data. The secret is not stored in this browser. Remove
          SETUP_SECRET from Vercel and redeploy when setup access is no longer
          needed.
        </p>
      </form>
      {migrations && (
        <section className="mt-6 rounded-3xl border border-border bg-paper p-6">
          <h2 className="font-serif text-2xl">Migration status</h2>
          <p className="mt-2 text-sm text-muted-text">
            {migrations.filter((m) => !m.appliedAt).length} pending ·{" "}
            {migrations.filter((m) => m.appliedAt).length} applied
          </p>
          <ul className="mt-4 divide-y divide-border">
            {migrations.map((m) => (
              <li className="py-3" key={m.id}>
                <p className="break-all font-mono text-xs">{m.id}</p>
                <p className="mt-1 text-xs text-muted-text">
                  {m.appliedAt ? "Applied" : "Pending"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
