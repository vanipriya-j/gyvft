"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import {
  optionImagesFile,
  optionImagesChecksum,
  optionImagesPrerequisites,
  agentProposalsFile,
  agentProposalsChecksum,
} from "@/lib/database/option-images-activation";
type Migration = { id: string; appliedAt: string | null };

export function ProposalSetup({ agent = false }: { agent?: boolean }) {
  const files = agent
    ? [optionImagesFile, agentProposalsFile]
    : [optionImagesFile];
  const title = agent
    ? "Activate the GPT proposal workspace"
    : "Activate option image galleries";
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [approved, setApproved] = useState(false),
    [migrations, setMigrations] = useState<Migration[] | null>(null);
  const secret = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const done =
    !!migrations &&
    files.every((id) => !!migrations.find((m) => m.id === id)?.appliedAt);
  const missing = optionImagesPrerequisites.filter(
    (id) => !migrations?.find((m) => m.id === id)?.appliedAt,
  );
  async function run(apply = false) {
    if (
      lock.current ||
      (apply && (!approved || !migrations || done || missing.length))
    )
      return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          secret: secret.current?.value,
          action: apply
            ? agent
              ? "agent-proposals-migrate"
              : "option-images-migrate"
            : "status",
          ...(apply ? { confirm: true } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw Error(
          data.message ||
            "The update could not be confirmed. Check status before retrying.",
        );
      setMigrations(data.migrations || null);
      setMessage(
        apply
          ? data.applied?.some((id: string) => files.includes(id))
            ? agent
              ? "The agent workspace is ready. Enable GPT connections in Operations settings next."
              : "Image galleries are active. Existing options and images were preserved."
            : data.applied?.length === 0
              ? "This update is already applied. Nothing was repeated."
              : data.message
          : "Status checked. No database changes were made.",
      );
      if (apply) {
        setApproved(false);
        if (secret.current) secret.current.value = "";
      }
    } catch (error) {
      setFailed(true);
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
      <h1 className="mt-4 font-serif text-3xl">{title}</h1>
      <p className="mt-3 text-muted-text">
        Add up to six photos or mock-ups to each new gift option. Check the
        database first, then explicitly approve{" "}
        {agent ? "these two updates" : "this one update"}.
      </p>
      <section className="mt-6 rounded-xl border border-border bg-paper p-5">
        <h2 className="font-semibold">Review before applying</h2>
        {agent && (
          <p className="mt-3 text-sm leading-relaxed">
            Also adds private draft revisions and revocable OAuth grants.
            Existing option covers are preserved; empty images are allowed only
            on private drafts. No existing customer data is deleted or
            backfilled. GPT connections start switched off.
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed">
          Creates one private table for extra option images, its index and
          access restrictions. Existing options keep their cover image. It does
          not update, delete or backfill customer or image records, and it does
          not run any other pending migration.
        </p>
        <a
          className="mt-3 inline-flex min-h-11 items-center text-sm underline"
          href={`https://github.com/vanipriya-j/gyvft/blob/main/supabase/migrations/${optionImagesFile}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Review the SQL ↗
        </a>
        <p className="mt-2 break-all font-mono text-xs">{optionImagesFile}</p>
        <details className="mt-3 text-xs">
          <summary className="flex min-h-11 cursor-pointer items-center">
            Verified SQL checksum
          </summary>
          <p className="mt-2 break-all font-mono">
            SHA-256: {optionImagesChecksum}
          </p>
        </details>
        {agent && (
          <div className="mt-3 text-xs">
            <a
              className="inline-flex min-h-11 items-center underline"
              href={`https://github.com/vanipriya-j/gyvft/blob/main/supabase/migrations/${agentProposalsFile}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Review agent workspace SQL ↗
            </a>
            <p className="break-all font-mono">{agentProposalsFile}</p>
            <p className="mt-2 break-all font-mono">
              SHA-256: {agentProposalsChecksum}
            </p>
          </div>
        )}
      </section>
      <form onSubmit={check} className="mt-6 space-y-4" aria-busy={busy}>
        <label className="block text-sm font-medium">
          Setup / Operations secret
          <input
            ref={secret}
            type="password"
            required
            minLength={11}
            maxLength={1024}
            autoComplete="off"
            disabled={busy}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-paper px-3 py-3"
          />
        </label>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-paper px-4 py-3 text-sm disabled:opacity-50"
          disabled={busy}
        >
          {busy && <LoaderCircle size={16} className="animate-spin" />}Check
          status
        </button>
        {migrations && !done && missing.length > 0 && (
          <p className="text-sm">
            The gift workspace updates must be reviewed first. This page will
            not run them: {missing.join(", ")}
          </p>
        )}
        {migrations && !done && !missing.length && (
          <>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
                disabled={busy}
              />
              I approve running only the{" "}
              {agent ? "two proposal workspace updates" : "option-image update"}{" "}
              described above.
            </label>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-4 py-3 text-sm text-white disabled:opacity-50"
              disabled={busy || !approved}
              onClick={() => void run(true)}
            >
              {busy && <LoaderCircle size={16} className="animate-spin" />}Apply
              {agent ? "proposal workspace updates" : "option-image update"}
            </button>
          </>
        )}
        {done && (
          <Link
            href="/operations/requests"
            className="inline-flex min-h-11 items-center rounded-lg bg-olive-dark px-4 py-3 text-sm text-white"
          >
            {agent
              ? "Agent workspace is ready · Open Operations →"
              : "Image galleries are active · Open requests →"}
          </Link>
        )}
      </form>
      <p
        role={failed ? "alert" : "status"}
        className={`mt-4 min-h-6 text-sm ${failed ? "text-action-text" : "text-muted-text"}`}
      >
        {message}
      </p>
    </main>
  );
}
