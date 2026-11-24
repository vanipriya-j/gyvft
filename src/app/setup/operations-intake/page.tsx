"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import {
  operationsIntakeFile,
  operationsIntakeChecksum,
  operationsIntakePrerequisites,
} from "@/lib/database/operations-intake-activation";
type Migration = { id: string; appliedAt: string | null };
export default function OperationsIntakeSetup() {
  const [busy, setBusy] = useState(false),
    [approved, setApproved] = useState(false),
    [migrations, setMigrations] = useState<Migration[] | null>(null),
    [message, setMessage] = useState("");
  const secret = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const done = !!migrations?.find((row) => row.id === operationsIntakeFile)
    ?.appliedAt;
  const missing = operationsIntakePrerequisites.filter(
    (id) => !migrations?.find((row) => row.id === id)?.appliedAt,
  );
  async function run(apply = false) {
    if (
      lock.current ||
      (apply && (!approved || !migrations || missing.length || done))
    )
      return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: secret.current?.value,
          action: apply ? "operations-intake-migrate" : "status",
          ...(apply ? { confirm: true } : {}),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw Error(
          result.message ||
            "The update could not be confirmed. Check status before retrying.",
        );
      setMigrations(result.migrations || null);
      setMessage(
        apply
          ? result.applied?.includes(operationsIntakeFile)
            ? "Operations intake is active. Existing customer and gift records were preserved."
            : "This update was already applied. Nothing was repeated."
          : "Status checked. No database changes were made.",
      );
      if (apply) {
        setApproved(false);
        if (secret.current) secret.current.value = "";
      }
    } catch (error) {
      setMigrations(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Check status before retrying.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run();
  }
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 md:py-12">
      <Link
        href="/operations"
        className="inline-flex min-h-11 items-center text-sm underline"
      >
        ← Operations
      </Link>
      <h1 className="mt-4 font-serif text-3xl">
        Activate Operations customer intake
      </h1>
      <p className="mt-3 text-muted-text">
        Let your team add a customer, record their requirement and send a secure
        account-setup email when ready.
      </p>
      <section className="mt-6 rounded-xl border border-border bg-paper p-5">
        <h2 className="font-medium">Review before applying</h2>
        <p className="mt-3 text-sm leading-relaxed">
          This one update adds three private tables for intake save records,
          requirement attachments and setup-email delivery records. It does not
          update, delete or backfill any existing customer, password, gift or
          image record. It applies no other pending migration.
        </p>
        <a
          className="mt-3 inline-flex min-h-11 items-center text-sm underline"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://github.com/vanipriya-j/gyvft/blob/main/supabase/migrations/${operationsIntakeFile}`}
        >
          Review the exact SQL ↗
        </a>
        <p className="break-all font-mono text-xs">{operationsIntakeFile}</p>
        <details className="mt-3 text-xs">
          <summary className="flex min-h-11 cursor-pointer items-center">
            Verified SQL checksum
          </summary>
          <p className="mt-2 break-all font-mono">
            SHA-256: {operationsIntakeChecksum}
          </p>
        </details>
      </section>
      <form className="mt-6 space-y-4" onSubmit={check} aria-busy={busy}>
        <label className="block text-sm font-medium">
          Setup / Operations secret
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-paper px-3 py-3"
            ref={secret}
            type="password"
            minLength={11}
            maxLength={1024}
            required
            autoComplete="off"
            disabled={busy}
          />
        </label>
        <button className="app-button min-h-11" disabled={busy}>
          {busy && <LoaderCircle size={16} className="animate-spin" />}Check
          status
        </button>
        {migrations && !done && missing.length > 0 && (
          <p className="text-sm">
            Earlier updates need separate review: {missing.join(", ")}. This
            page will not run them.
          </p>
        )}
        {migrations && !done && !missing.length && (
          <>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={approved}
                onChange={(event) => setApproved(event.target.checked)}
                disabled={busy}
              />
              I approve running only the Operations intake update described
              above.
            </label>
            <button
              type="button"
              className="app-button primary min-h-11"
              disabled={busy || !approved}
              onClick={() => void run(true)}
            >
              {busy && <LoaderCircle size={16} className="animate-spin" />}Apply
              Operations intake update
            </button>
          </>
        )}
        {done && (
          <p className="app-soft">
            Operations intake is active.{" "}
            <Link href="/operations" className="underline">
              Return to Operations
            </Link>
            .
          </p>
        )}
        <p role="status" className="min-h-5 text-sm">
          {message}
        </p>
      </form>
    </main>
  );
}
