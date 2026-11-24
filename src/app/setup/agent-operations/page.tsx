"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import {
  operationsIntakeFile,
  operationsIntakeChecksum,
} from "@/lib/database/operations-intake-activation";
import {
  agentOperationsFile,
  agentOperationsChecksum,
  agentOperationsPrerequisites,
} from "@/lib/database/agent-operations-activation";
const updates = [
  { id: operationsIntakeFile, checksum: operationsIntakeChecksum },
  { id: agentOperationsFile, checksum: agentOperationsChecksum },
];
type Migration = { id: string; appliedAt: string | null };
export default function AgentOperationsSetup() {
  const [busy, setBusy] = useState(false),
    [approved, setApproved] = useState(false),
    [migrations, setMigrations] = useState<Migration[] | null>(null),
    [message, setMessage] = useState("");
  const secret = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const done = updates.every(
    (update) => !!migrations?.find((row) => row.id === update.id)?.appliedAt,
  );
  const missing = agentOperationsPrerequisites.filter(
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
          action: apply ? "agent-operations-migrate" : "status",
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
          ? result.applied?.length
            ? "Agent Operations is active. Existing customer and gift records were preserved."
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
        Activate agent Operations actions
      </h1>
      <p className="mt-3 text-muted-text">
        Enable the additional MCP actions, evidenced offline approvals and
        customer payment requests. Existing OAuth connections retain their
        original permissions until you reconnect.
      </p>
      <section className="mt-6 rounded-xl border border-border bg-paper p-5">
        <h2 className="font-medium">Review before applying</h2>
        <p className="mt-3 text-sm leading-relaxed">
          This applies only the two files below if pending: three private tables
          for customer intake, attachments and setup-email records, plus four
          private tables for agent action receipts, offline approval evidence
          and payment-request snapshots. It does not update, delete or backfill
          existing customer, password, gift or image records. Earlier required
          updates need separate review.
        </p>
        {updates.map((update) => (
          <div key={update.id} className="mt-3 border-t border-border pt-3">
            <a
              className="inline-flex min-h-11 items-center text-sm underline"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://github.com/vanipriya-j/gyvft/blob/main/supabase/migrations/${update.id}`}
            >
              Review the exact SQL ↗
            </a>
            <p className="break-all font-mono text-xs">{update.id}</p>
            <details className="mt-2 text-xs">
              <summary className="flex min-h-11 cursor-pointer items-center">
                Verified SQL checksum
              </summary>
              <p className="mt-2 break-all font-mono">
                SHA-256: {update.checksum}
              </p>
            </details>
            <p className="mt-2 text-sm">
              {migrations?.find((row) => row.id === update.id)?.appliedAt
                ? "Already applied · skipped"
                : "Pending status check"}
            </p>
          </div>
        ))}
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
              I approve running only the two Agent Operations updates described
              above.
            </label>
            <button
              type="button"
              className="app-button primary min-h-11"
              disabled={busy || !approved}
              onClick={() => void run(true)}
            >
              {busy && <LoaderCircle size={16} className="animate-spin" />}Apply
              Agent Operations updates
            </button>
          </>
        )}
        {done && (
          <p className="app-soft">
            Agent Operations is active.{" "}
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
