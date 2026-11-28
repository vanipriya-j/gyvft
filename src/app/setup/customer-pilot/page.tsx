"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import {
  pilotCohortSchema,
  type PilotCustomer,
  type PilotPreview,
} from "@/lib/rewards/pilot-model";

type Row = {
  customer: PilotCustomer;
  preview?: PilotPreview;
  result?: string;
  error?: string;
};
export default function CustomerPilotSetup() {
  const secret = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const [rows, setRows] = useState<Row[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [approved, setApproved] = useState(false),
    [ready, setReady] = useState(false);
  async function post(payload: Record<string, unknown>) {
    const response = await fetch("/api/operations/customer-pilot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-setup-secret": secret.current?.value || "",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    if (!response.ok || !data.ok)
      throw Error(data.message || "Check the test status before retrying.");
    return data.result;
  }
  async function load(file: File | undefined) {
    if (!file || lock.current) return;
    setReady(false);
    setApproved(false);
    setRows([]);
    try {
      if (file.size > 32768)
        throw Error("Use a customer JSON file under 32 KB.");
      const customers = pilotCohortSchema.parse(JSON.parse(await file.text()));
      setRows(customers.map((customer) => ({ customer })));
      setMessage(
        `${customers.length} customers loaded locally. Check before applying.`,
      );
    } catch {
      setMessage(
        "Use the supplied JSON list: up to 20 distinct customers with Shopify ID, email and name.",
      );
    }
  }
  async function run(apply = false) {
    if (lock.current || !rows.length || (apply && (!approved || !ready)))
      return;
    lock.current = true;
    setBusy(true);
    setMessage("Checking connection…");
    let next: Row[] = rows.map((row) => ({ ...row, error: undefined }));
    try {
      await post({ op: "status" });
      if (!apply) {
        setReady(false);
        setApproved(false);
        next = next.map((row) => ({ customer: row.customer }));
      }
      for (let i = 0; i < next.length; i++) {
        const row = next[i];
        if (apply && row.result) continue;
        setMessage(
          `${apply ? "Applying" : "Checking"} ${i + 1} of ${next.length}: ${row.customer.name}`,
        );
        try {
          if (apply) {
            const result = await post({
              op: "apply",
              customer: row.customer,
              id: row.preview!.id,
              fingerprint: row.preview!.fingerprint,
              confirm: true,
            });
            row.result = `${result.alreadyApplied ? "Already saved" : "Saved"} · ${result.createdAccount ? "account created" : "account preserved"} · ${result.points} points credited`;
          } else
            row.preview = await post({ op: "preview", customer: row.customer });
        } catch (e) {
          row.error = e instanceof Error ? e.message : "Could not complete.";
          // Stop on uncertainty. Previously completed customers remain visible and are skipped on retry.
          next[i] = row;
          setRows([...next]);
          throw e;
        }
        next[i] = row;
        setRows([...next]);
      }
      if (!apply) setReady(true);
      setMessage(
        apply
          ? "Selected customers saved. No invitations or welcome bonuses were sent. Customers verify their email before using rewards."
          : "Check passed. Each test transaction was rolled back; no records or credits were saved. Review the results below.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not complete.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const points = rows.reduce((sum, r) => sum + (r.preview?.points || 0), 0);
  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl px-5 py-10">
      <Link
        href="/operations/rewards"
        className="inline-flex min-h-11 items-center underline"
      >
        ← Operations rewards
      </Link>
      <h1 className="mt-5 font-serif text-3xl">Customer & rewards test</h1>
      <p className="mt-4 max-w-2xl">
        Prepare the selected customers’ accounts and rewards from their Aarla
        orders. Existing passwords and profiles are preserved. Check first, then
        apply the reviewed results.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        This uses existing tables. It does not run migrations, send invitations,
        add a 50-point bonus, enable the programme or create Shopify coupons.
        Review orders stay uncredited unless they already have an exact-version
        Operations review.
      </p>
      <form
        className="mt-6 grid max-w-xl gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void run();
        }}
      >
        <label>
          Operations setup secret
          <input
            ref={secret}
            type="password"
            required
            autoComplete="off"
            disabled={busy}
            onChange={() => {
              setReady(false);
              setApproved(false);
            }}
            className="mt-2 block min-h-11 w-full rounded-lg border border-border px-3"
          />
        </label>
        <label>
          Selected customers JSON
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => void load(e.target.files?.[0])}
            className="mt-2 block min-h-11 w-full"
          />
        </label>
        <button
          disabled={busy || !rows.length}
          className="min-h-11 rounded-lg border border-border px-4 disabled:opacity-50"
        >
          Check selected customers · no changes saved
        </button>
      </form>
      <div
        role="status"
        aria-live="polite"
        className="my-5 flex min-h-12 items-center gap-3"
      >
        {busy && (
          <LoaderCircle
            aria-hidden="true"
            className="size-5 shrink-0 animate-spin"
          />
        )}
        {message}
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="p-4 text-left">
              {rows.length} selected customers · {points} proposed available
              points. Recent purchases remain pending for 14 days after payment.
            </caption>
            <thead>
              <tr>
                {["Customer", "Account", "Orders", "Rewards", "Result"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="border-t border-border p-3"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.customer.shopifyCustomerId}>
                  <th
                    scope="row"
                    className="border-t border-border p-3 font-normal"
                  >
                    {row.customer.name}
                    <span className="block text-muted-foreground">
                      {row.customer.email}
                    </span>
                  </th>
                  <td className="border-t border-border p-3">
                    {row.preview
                      ? row.preview.account === "create"
                        ? "Create account"
                        : "Preserve existing"
                      : "Not checked"}
                  </td>
                  <td className="border-t border-border p-3">
                    {row.preview && (
                      <>
                        {row.preview.orders} total · {row.preview.review.length}{" "}
                        review · {row.preview.excluded} excluded
                        {row.preview.review.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer">
                              Review reasons
                            </summary>
                            <ul>
                              {row.preview.review.map((r) => (
                                <li key={r.id}>
                                  {r.id.split("/").at(-1)}: {r.reason}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </>
                    )}
                  </td>
                  <td className="border-t border-border p-3">
                    {row.preview && (
                      <>
                        {row.preview.points} available ·{" "}
                        {row.preview.pendingPoints} pending
                        {!row.preview.enabled && (
                          <span className="block">Programme remains off.</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="border-t border-border p-3">
                    {row.error ||
                      row.result ||
                      (row.preview
                        ? "Check rolled back; nothing saved"
                        : "Waiting")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ready && (
        <div className="mt-6 max-w-2xl rounded-xl border border-border p-5">
          <label className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              checked={approved}
              disabled={busy}
              onChange={(e) => setApproved(e.target.checked)}
              className="mt-1"
            />
            I reviewed these customers and approve creating missing accounts and
            allocating only their eligible order rewards.
          </label>
          <button
            disabled={busy || !approved || rows.every((r) => r.result)}
            onClick={() => void run(true)}
            className="mt-4 min-h-11 rounded-lg bg-red px-5 text-white disabled:opacity-50"
          >
            Apply reviewed customers & rewards
          </button>
          <p className="mt-3 text-sm">
            Each customer saves atomically. If the run stops, retry to continue;
            confirmed saves are skipped and uncertain retries reuse the same
            apply key.
          </p>
        </div>
      )}
    </main>
  );
}
