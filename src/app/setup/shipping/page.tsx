"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
const filename = "20261120000001_shipping.sql";
type Migration = { id: string; appliedAt: string | null };
export default function ShippingSetup() {
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [migrations, setMigrations] = useState<Migration[] | null>(null),
    [checked, setChecked] = useState(false);
  const secret = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const shipping = migrations?.find((m) => m.id === filename),
    earlier = migrations?.filter((m) => m.id < filename && !m.appliedAt) || [],
    done = !!shipping?.appliedAt;
  async function run(action: "status" | "shipping-migrate") {
    if (lock.current) return;
    lock.current = true;
    setBusy(action);
    setFailed(false);
    setMessage("");
    try {
      const r = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          secret: secret.current?.value,
          action,
          ...(action === "shipping-migrate" ? { confirm: true } : {}),
        }),
      });
      const body = await r.json();
      if (!r.ok || !body.ok)
        throw Error(
          body.message ||
            "The update could not be confirmed. Check status before trying again.",
        );
      if (body.migrations) {
        setMigrations(body.migrations);
        setChecked(true);
      } else setChecked(false);
      setMessage(
        action === "status"
          ? "Status checked. No database changes were made."
          : body.applied?.includes(filename)
            ? "Shipping update applied. Existing customer records were not changed."
            : body.applied?.length === 0
              ? "Shipping is already applied. No update was repeated."
              : body.message,
      );
      if (action === "shipping-migrate" && secret.current)
        secret.current.value = "";
    } catch (e) {
      setFailed(true);
      setChecked(false);
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not confirm the result. Check status before trying again.",
      );
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void run("status");
  }
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 md:py-12">
      <Link href="/operations" className="text-sm underline">
        ← Operations
      </Link>
      <h1 className="mt-5 font-serif text-3xl">Activate shipping</h1>
      <p className="mt-3 text-muted-text">
        Check the database first, then apply the shipping update you approved.
        This page runs one fixed SQL file.
      </p>
      <section className="mt-6 rounded-xl border border-border bg-paper p-5">
        <h2 className="font-semibold">Approved change</h2>
        <p className="mt-2 break-all font-mono text-xs">{filename}</p>
        <p className="mt-3 text-sm">
          Adds four shipping tables, indexes and access restrictions. It does
          not delete, reset or update existing customer records. The SQL is
          checked against its approved checksum before execution.
        </p>
        <a
          className="mt-3 inline-block text-sm underline"
          href="https://github.com/vanipriya-j/gyvft/blob/6a603757f9e60b975652e082e4043122722008de/supabase/migrations/20261120000001_shipping.sql"
          target="_blank"
          rel="noopener noreferrer"
        >
          Review the exact SQL ↗
        </a>
      </section>
      <form onSubmit={submit} className="mt-6" aria-busy={!!busy}>
        <label
          htmlFor="shipping-setup-secret"
          className="block text-sm font-medium"
        >
          Setup / Operations secret
        </label>
        <input
          ref={secret}
          id="shipping-setup-secret"
          name="secret"
          type="password"
          required
          minLength={11}
          maxLength={1024}
          autoComplete="off"
          className="mt-2 w-full rounded-lg border border-border bg-paper px-3 py-3"
          disabled={!!busy}
        />
        <p className="mt-2 text-xs text-muted-text">
          Use the existing SETUP_SECRET from Vercel. It stays in this tab and is
          sent only to GYVFT for authentication.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="relative min-h-11 rounded-lg border border-border bg-paper px-4 py-3 text-sm disabled:opacity-60"
            disabled={!!busy}
            aria-label="Check pending updates"
            aria-busy={busy === "status"}
          >
            <span className={busy === "status" ? "invisible" : ""}>
              Check pending updates
            </span>
            {busy === "status" && (
              <span className="absolute inset-0 flex items-center justify-center gap-2">
                <LoaderCircle className="animate-spin" size={16} />
                Checking…
              </span>
            )}
          </button>
          <button
            type="button"
            className="relative min-h-11 rounded-lg bg-action px-4 py-3 text-sm text-white disabled:opacity-50"
            disabled={
              !!busy || !checked || !shipping || done || earlier.length > 0
            }
            onClick={() => void run("shipping-migrate")}
            aria-label="Apply approved shipping update"
            aria-busy={busy === "shipping-migrate"}
          >
            <span className={busy === "shipping-migrate" ? "invisible" : ""}>
              Apply approved shipping update
            </span>
            {busy === "shipping-migrate" && (
              <span className="absolute inset-0 flex items-center justify-center gap-2">
                <LoaderCircle className="animate-spin" size={16} />
                Applying…
              </span>
            )}
          </button>
        </div>
      </form>
      <p
        role={failed ? "alert" : "status"}
        className={`mt-4 min-h-6 text-sm ${failed ? "text-action-text" : "text-muted-text"}`}
      >
        {message}
      </p>
      {checked && migrations && (
        <section className="mt-4 rounded-xl border border-border bg-paper p-5">
          <h2 className="font-semibold">
            {done
              ? "Shipping is active"
              : earlier.length
                ? "Earlier updates need review"
                : "Ready to apply shipping only"}
          </h2>
          {earlier.length > 0 ? (
            <>
              <p className="mt-2 text-sm">
                These earlier updates are not recorded as applied. This page
                will not run them or apply shipping until they are reviewed
                separately.
              </p>
              <ul className="mt-3 space-y-2 text-xs">
                {earlier.map((m) => (
                  <li className="break-all font-mono" key={m.id}>
                    {m.id}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm">
              {done
                ? "This update is recorded in migration history. Enter your Delhivery credentials in Operations when ready."
                : "All earlier customer updates are recorded. Only the approved shipping file will run, inside a database transaction."}
            </p>
          )}
          {done && (
            <Link
              href="/operations"
              className="mt-4 inline-block rounded-lg bg-olive-dark px-4 py-3 text-sm text-white"
            >
              Open Operations →
            </Link>
          )}
        </section>
      )}
    </main>
  );
}
