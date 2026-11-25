"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { reportCsv } from "@/lib/customer/conversion-model";
import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
type Post = (
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<Record<string, unknown>>;
type Review = {
  id: string;
  email: string;
  updated_at: string;
  reason: string;
  eligible_paise: number;
};
type Desk = {
  installed: boolean;
  settings?: {
    enabled: boolean;
    collection_id: string | null;
    last_sync_at: string | null;
    last_error: string | null;
    sync_until: string | null;
  };
  totals?: { orders: number; review: number; historical: number };
  wallets?: { wallets: number; verified: number };
  liability?: { points: number; reserved: number };
  review?: Review[];
  uncertain?: { id: string; kind: string; state: string; points: number }[];
  imports?: {
    id: string;
    state: string;
    order_count: number;
    points: number;
  }[];
};
export function RewardsDesk({ post }: { post: Post }) {
  const [data, setData] = useState<Desk | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [collection, setCollection] = useState(""),
    [enabled, setEnabled] = useState(false),
    [preview, setPreview] = useState<{
      id: string;
      order_count: number;
      points: number;
      fingerprint: string;
      wallets: {
        customerId: string;
        email: string;
        orders: number;
        eligiblePaise: number;
        points: number;
      }[];
    } | null>(null),
    [approved, setApproved] = useState(false);
  const lock = useRef(false);
  const accept = useCallback((result: Record<string, unknown>) => {
    const value = result as unknown as Desk;
    setData(value);
    setCollection(value.settings?.collection_id || "");
    setEnabled(value.settings?.enabled || false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    post({ op: "status" }, controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) accept(r);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setMessage(e.message);
      });
    return () => controller.abort();
  }, [post, accept]);
  async function run(op: string, extra: Record<string, unknown> = {}) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const r = await post({ op, ...extra });
      accept(r);
      const result = r.result as Record<string, unknown> | undefined;
      if (op === "preview") {
        setPreview(result as typeof preview);
        setApproved(false);
      } else if (op === "apply") {
        setPreview(null);
        setApproved(false);
      } else if (["sync", "review"].includes(op)) {
        setPreview(null);
        setApproved(false);
      }
      setMessage(
        String(
          result?.message ||
            (op === "sync"
              ? `${result?.processed || 0} orders checked. ${result?.more ? "More remain — run the next batch." : "Scan complete."}`
              : op === "preview"
                ? "Preview ready. No points were credited."
                : op === "apply"
                  ? "Reviewed opening points applied once."
                  : op === "reconcile"
                    ? `${result?.checked || 0} coupons checked.`
                    : "Updated."),
        ),
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not complete. Refresh before retrying.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function exportPreview() {
    if (!preview) return;
    const csv = reportCsv([
      [
        "Shopify customer",
        "Email",
        "Historical orders",
        "Eligible merchandise INR",
        "Opening points",
      ],
      ...preview.wallets.map((w) => [
        w.customerId,
        w.email,
        w.orders,
        (w.eligiblePaise / 100).toFixed(2),
        w.points,
      ]),
    ]);
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `gyvft-opening-${preview.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function review(e: FormEvent<HTMLFormElement>, row: Review) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value = String(form.get("amount"));
    const amount = Number(value);
    if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(amount)) {
      setMessage("Enter the eligible amount as a number, such as 1000.00.");
      (
        e.currentTarget.elements.namedItem("amount") as HTMLInputElement
      )?.focus();
      return;
    }
    void run("review", {
      id: row.id,
      version: new Date(row.updated_at).toISOString(),
      eligiblePaise: Math.round(amount * 100),
      reason: String(form.get("reason")),
    });
  }
  return (
    <div className="app-stack">
      <div className="app-title">
        <div>
          <p className="text-xs uppercase tracking-[.16em] text-olive-dark">
            D2C · Aarla checkout
          </p>
          <h1>Rewards</h1>
          <p>A clear view of what customers earn, reserve and use.</p>
        </div>
        <button
          className="app-button"
          disabled={busy}
          onClick={() => void run("status")}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      <div className="min-h-7" role="status" aria-live="polite">
        {busy && (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle
              size={16}
              className="animate-spin motion-reduce:animate-none"
            />
            Working…
          </span>
        )}
        {message && <p className="text-sm">{message}</p>}
      </div>
      {!data ? (
        <section className="app-panel min-h-60" aria-busy="true">
          Loading rewards…
        </section>
      ) : !data.installed ? (
        <section className="app-panel">
          <h2>One additive setup, then you’re ready.</h2>
          <p>
            Rewards tables are not installed. Existing customer entries are
            untouched.
          </p>
          <Link className="app-button mt-4" href="/setup/rewards">
            Review rewards setup
          </Link>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Orders checked", data.totals?.orders],
              ["Need review", data.totals?.review],
              ["Wallets", data.wallets?.wallets],
              ["Verified owners", data.wallets?.verified],
            ].map(([label, n]) => (
              <section key={label} className="app-panel">
                <p className="text-sm text-muted-text">{label}</p>
                <p className="mt-2 font-serif text-3xl">{n || 0}</p>
              </section>
            ))}
          </div>
          <section className="app-panel">
            <p className="mb-5 text-sm text-olive-dark">
              Posted rewards liability: ₹
              {(data.liability?.points || 0).toLocaleString("en-IN")} ·{" "}
              {data.liability?.reserved || 0} points reserved in checkout
            </p>
            <h2>Programme & retail eligibility</h2>
            <p>
              2% earning · 14-day hold · 12-month expiry · points cover up to
              25% of merchandise subtotal. No combining benefits or earning on
              redemption orders.
            </p>
            <form
              className="mt-5 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run("settings", {
                  enabled,
                  collection: collection.trim() || null,
                });
              }}
            >
              <label>
                Aarla retail collection ID
                <input
                  className="app-input mt-2 w-full"
                  placeholder="gid://shopify/Collection/123456789"
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                />
              </label>
              <p className="text-xs text-muted-text">
                Choose an existing collection containing only eligible D2C
                products. Keep custom quote and wholesale products out of it.
                Coupons apply to this collection only.
              </p>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Enable new reward coupons
              </label>
              <div>
                <button className="app-button primary" disabled={busy}>
                  Save programme settings
                </button>
              </div>
            </form>
          </section>
          <section className="app-panel">
            <h2>Shopify sync</h2>
            <p>
              Daily at 9:15 am IST. Large scans continue from a saved
              checkpoint; run further batches here during the initial import.
            </p>
            <p className="mt-3 text-sm">
              {data.settings?.last_sync_at
                ? `Last completed: ${new Date(data.settings.last_sync_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
                : "No complete scan yet."}
              {data.settings?.sync_until ? " · Scan in progress" : ""}
            </p>
            {data.settings?.last_error && (
              <p role="alert" className="mt-3 text-sm">
                {data.settings.last_error}
              </p>
            )}
            <div className="app-actions mt-4">
              <button
                className="app-button primary"
                disabled={busy}
                onClick={() => void run("sync")}
              >
                Scan next batch
              </button>
              <button
                className="app-button"
                disabled={busy}
                onClick={() => void run("reconcile")}
              >
                Check reserved coupons
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-text">
              Sync mirrors orders and reconciles already-authorised earning.
              Historical purchases are not credited by scanning.
            </p>
          </section>
          <section className="app-panel">
            <h2>Historical opening points</h2>
            <p>
              {data.totals?.historical || 0} historical orders have no
              allocation approval. Preview includes purchases past the 14-day
              hold, excludes unresolved orders and keeps an exact snapshot for
              your confirmation.
            </p>
            <button
              className="app-button mt-4"
              disabled={
                busy ||
                !!data.settings?.sync_until ||
                !data.settings?.last_sync_at
              }
              onClick={() => void run("preview")}
            >
              Preview opening allocation
            </button>
            {preview && (
              <div className="mt-5 rounded-xl border border-border bg-surface p-4">
                <p className="font-serif text-2xl">
                  {preview.points.toLocaleString("en-IN")} points ·{" "}
                  {preview.order_count} orders
                </p>
                <p className="mt-2 text-sm">
                  No points have been credited. Changing or resyncing an order
                  invalidates this preview.
                </p>
                <button
                  type="button"
                  className="app-button mt-4"
                  onClick={exportPreview}
                >
                  Download full customer preview
                </button>
                <ul className="mt-3 divide-y divide-border">
                  {preview.wallets.slice(0, 10).map((w) => (
                    <li
                      key={w.customerId}
                      className="flex justify-between gap-3 py-2 text-sm"
                    >
                      <span className="break-all">
                        {w.email}
                        <span className="block text-xs text-muted-text">
                          {w.orders} orders
                        </span>
                      </span>
                      <span className="shrink-0">{w.points} points</span>
                    </li>
                  ))}
                </ul>
                {preview.wallets.length > 10 && (
                  <p className="text-xs text-muted-text">
                    Showing 10 of {preview.wallets.length} customers. Review the
                    full download before applying.
                  </p>
                )}
                <label className="my-4 flex min-h-11 items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                  />
                  I approve this exact opening allocation to customer wallets.
                </label>
                <button
                  className="app-button primary"
                  disabled={busy || !approved || preview.order_count === 0}
                  onClick={() =>
                    void run("apply", {
                      id: preview.id,
                      fingerprint: preview.fingerprint,
                      confirm: true,
                    })
                  }
                >
                  Apply reviewed opening points
                </button>
              </div>
            )}
          </section>
          <section className="app-panel">
            <h2>Orders needing review</h2>
            <p>
              Manual sales are not automatically wholesale. Confirm retail
              status and the retained merchandise value after discounts,
              excluding GST, shipping and gift cards. Enter ₹0 to exclude an
              order.
            </p>
            {!data.review?.length ? (
              <p className="mt-4 text-sm text-olive-dark">
                No unresolved orders in this view.
              </p>
            ) : (
              <div className="mt-5 divide-y divide-border">
                {data.review.map((row) => (
                  <form
                    key={row.id}
                    onSubmit={(e) => review(e, row)}
                    className="grid gap-3 py-5 md:grid-cols-2"
                  >
                    <div className="md:col-span-2">
                      <p className="break-all font-medium">
                        {row.email || "Identity missing"}
                      </p>
                      <p className="text-xs text-muted-text">
                        Order {row.id.split("/").at(-1)} · {row.reason}
                      </p>
                    </div>
                    <label className="text-sm">
                      Approved eligible amount (₹)
                      <input
                        className="app-input mt-2 w-full"
                        name="amount"
                        inputMode="decimal"
                        required
                        placeholder="0.00"
                      />
                    </label>
                    <label className="text-sm">
                      Reason / evidence reference
                      <input
                        className="app-input mt-2 w-full"
                        name="reason"
                        minLength={8}
                        maxLength={500}
                        required
                      />
                    </label>
                    <div>
                      <button
                        className="app-button"
                        disabled={busy || !row.email}
                      >
                        Save review
                      </button>
                    </div>
                  </form>
                ))}
              </div>
            )}
          </section>
          {!!data.uncertain?.length && (
            <section className="app-panel">
              <h2>Coupon checks pending</h2>
              <p className="text-sm">
                Reserved points remain protected until Shopify confirms use or
                expiry.
              </p>
              <ul>
                {data.uncertain.map((c) => (
                  <li key={c.id} className="py-2 text-sm">
                    {c.kind} · {c.points} points · {c.state}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="app-panel">
            <Sparkles size={20} className="text-olive-dark" />
            <h2 className="mt-3">Occasion offers</h2>
            <p className="text-sm">
              Birthday and own anniversary: ₹150 off ₹1,500+, once per occasion
              per year, within seven days either side. Verified prior retail
              buyers only. Customers manage their own dates and opt-in. Physical
              gifts can be added later.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
