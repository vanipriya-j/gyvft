"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  rewardsFile,
  rewardsChecksum,
} from "@/lib/database/rewards-activation";
export default function RewardsSetup() {
  const secret = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [checked, setChecked] = useState(false),
    [installed, setInstalled] = useState(false),
    [approved, setApproved] = useState(false),
    [message, setMessage] = useState("");
  async function run(apply = false) {
    if (lock.current || (apply && (!approved || !checked || installed))) return;
    lock.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: secret.current?.value,
          action: apply ? "rewards-migrate" : "rewards-status",
          ...(apply ? { confirm: true } : {}),
        }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw Error(data.message || "Check status before retrying.");
      setChecked(true);
      setInstalled(
        !!data.migrations?.find(
          (r: { id: string; appliedAt: string | null }) => r.id === rewardsFile,
        )?.appliedAt,
      );
      setMessage(
        apply
          ? "Rewards tables installed. The programme remains off until you enable it in Operations."
          : "Status checked. No changes made.",
      );
      setApproved(false);
    } catch (e) {
      setChecked(false);
      setMessage(
        e instanceof Error ? e.message : "Check status before retrying.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link
        className="inline-flex min-h-11 items-center underline"
        href="/operations/rewards"
      >
        ← Operations rewards
      </Link>
      <h1 className="mt-5 font-serif text-3xl">Review rewards activation</h1>
      <p className="mt-4">
        This adds private rewards tables only. It does not delete customer
        entries, change prices, issue coupons or allocate historical points.
        Builds and deployment never run it.
      </p>
      <p className="mt-5 break-all text-sm">
        File: {rewardsFile}
        <br />
        SHA-256: {rewardsChecksum}
      </p>
      <a
        className="mt-3 inline-flex min-h-11 items-center underline"
        href={`https://github.com/vanipriya-j/gyvft/blob/codex/d2c-rewards/supabase/migrations/${rewardsFile}`}
        target="_blank"
        rel="noreferrer"
      >
        Review exact SQL
      </a>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void run();
        }}
        className="mt-6"
      >
        <label>
          Operations setup secret
          <input
            ref={secret}
            type="password"
            required
            autoComplete="off"
            className="mt-2 block min-h-11 w-full rounded-lg border border-border px-3"
          />
        </label>
        <button
          disabled={busy}
          className="mt-4 min-h-11 rounded-lg border border-border px-4"
        >
          {busy ? "Checking…" : "Check installation status"}
        </button>
      </form>
      {checked && !installed && (
        <div className="mt-6 rounded-xl border border-border p-5">
          <label className="flex min-h-11 items-start gap-3">
            <input
              className="mt-1"
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            I reviewed and approve only this exact additive rewards SQL.
          </label>
          <button
            type="button"
            disabled={busy || !approved}
            onClick={() => void run(true)}
            className="mt-4 min-h-11 rounded-lg bg-red px-4 text-white disabled:opacity-50"
          >
            Apply rewards SQL
          </button>
        </div>
      )}
      {installed && (
        <p className="mt-5">
          Rewards tables are installed. Continue in Operations.
        </p>
      )}
      <p role="status" className="mt-5 min-h-8">
        {message}
      </p>
    </main>
  );
}
