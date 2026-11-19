"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { demoAccounts } from "@/lib/customer/demo-accounts";
type Result = {
  ok: boolean;
  message: string;
  inserted?: number;
  reference?: string;
  counts?: {
    gifts: number;
    people: number;
    occasions: number;
    options: number;
    receipts: number;
  };
};
export default function DemoDataPage() {
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState<Result | null>(null),
    locked = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const form = event.currentTarget,
      data = new FormData(form);
    locked.current = true;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/operations/demo-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-secret": String(data.get("secret")),
        },
        body: JSON.stringify({
          password: String(data.get("password")),
          confirm: data.has("confirm"),
        }),
      });
      const next = await response.json();
      setResult(next);
      if (next.ok) form.reset();
    } catch {
      setResult({
        ok: false,
        message:
          "The connection was interrupted. The batch may still finish. You can safely retry: existing records and passwords will be preserved.",
      });
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5 md:px-6 md:py-8">
      <Link href="/operations" className="app-button quiet mb-5">
        ← Operations
      </Link>
      <p className="app-kicker">Operator tools</p>
      <h1 className="font-serif text-3xl">Four stories, ready to explore.</h1>
      <p className="mt-3 text-muted-text">
        Add fictional customer workspaces with profiles, recipients, upcoming
        occasions, curated visuals, quotes, conversations, past gifts and sample
        receipts.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {demoAccounts.map((a) => (
          <article key={a.id} className="app-panel">
            <h2>{a.name}</h2>
            <p>{a.scenario}</p>
            <p className="mt-2 break-all text-sm">{a.email}</p>
          </article>
        ))}
      </div>
      <p className="app-note mt-4">
        Organisation and community names are context labels in the current app.
        Verified organisations, circle membership and circle administration are
        not created by this tool. These +aliases are intended for the
        aarla@aarla.in Google Workspace inbox; receipt still depends on its mail
        routing.
      </p>
      <form onSubmit={submit} className="app-panel mt-5" aria-busy={busy}>
        <fieldset disabled={busy}>
          <legend className="font-serif text-xl">
            Add demo data explicitly
          </legend>
          <p className="app-note">
            This action inserts sample records into the existing schema. It
            preserves existing records and passwords, performs no migrations or
            deletion, and sends no emails or Shopify requests. Repeating it adds
            only missing sample records.
          </p>
          <label className="app-label mt-4">
            Operator secret
            <input
              className="app-input"
              type="password"
              name="secret"
              autoComplete="off"
              required
              maxLength={1024}
            />
          </label>
          <label className="app-label mt-3">
            Password for the new demo accounts
            <input
              className="app-input"
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </label>
          <p className="app-note">
            Use this password to sign in to each new demo account. If an account
            already exists, its password stays as it is.
          </p>
          <label className="app-check mt-4">
            <input type="checkbox" name="confirm" required />
            Add these four fictional accounts and their sample history.
          </label>
          <button className="app-button primary mt-4" type="submit">
            {busy ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Adding demo workspaces…
              </>
            ) : (
              "Add four demo accounts"
            )}
          </button>
        </fieldset>
      </form>
      {busy && (
        <p role="status" className="app-soft mt-4">
          Adding the sample history in one transaction. Please keep this page
          open.
        </p>
      )}
      {result && (
        <div className="app-soft mt-4" role={result.ok ? "status" : "alert"}>
          <p>{result.message}</p>
          {result.reference && (
            <p className="mt-2 break-all text-sm">
              Reference: {result.reference}
            </p>
          )}
          {result.counts && (
            <p className="mt-2">
              {result.counts.gifts} gifts · {result.counts.people} people ·{" "}
              {result.counts.occasions} occasions · {result.counts.options}{" "}
              curated options · {result.counts.receipts} fictional receipts
            </p>
          )}
          {result.ok && (
            <Link className="app-button mt-3" href="/account/login">
              Open customer sign-in →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
