"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { demoAccounts } from "@/lib/customer/demo-accounts";
type Result = {
  ok: boolean;
  message: string;
  inserted?: number;
  reference?: string;
  counts?: {
    circles: number;
    circleMemberships: number;
    gifts: number;
    people: number;
    occasions: number;
    options: number;
    receipts: number;
  };
};
export default function DemoDataPage() {
  const router = useRouter();
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
      if (next.ok) router.refresh();
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
      <Link
        className="app-button olive mt-4"
        href="/operations/demo-data/circles"
      >
        Already have the four demo accounts? Complete their circles →
      </Link>
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
        Five real circles include family, company, alumni, book club and
        neighbourhood membership. The fictional company remains unverified. Only
        these known fictional gifts receive circle links. Existing passwords and
        membership choices are preserved. Invitations are not sent.
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
              {result.counts.circles} circles ·{" "}
              {result.counts.circleMemberships} memberships ·{" "}
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
