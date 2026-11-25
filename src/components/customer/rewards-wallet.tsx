"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "@/components/ui/navigation-link";
import { ArrowUpRight, Gift, LoaderCircle, Sparkles } from "lucide-react";
import { celebrationWindow } from "@/lib/rewards/policy";
type Coupon = {
  id: string;
  kind: string;
  code: string;
  points: number;
  minimum_paise: number;
  state: string;
  expires_at: string;
};
type Wallet = {
  available: number;
  pending: number;
  reserved: number;
  debt: number;
  spent: number;
  history: {
    kind: string;
    points: number;
    detail: string;
    created_at: string;
  }[];
  coupons: Coupon[];
  dates: {
    birthday: string | null;
    anniversary: string | null;
    consent: boolean;
  } | null;
};
type View = {
  installed: boolean;
  enabled: boolean;
  verified: boolean;
  wallet: Wallet | null;
};
const rupees = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
export function RewardsWallet({ email }: { email: string }) {
  const [data, setData] = useState<View | null>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [points, setPoints] = useState(100),
    [proof, setProof] = useState(""),
    [birthday, setBirthday] = useState(""),
    [anniversary, setAnniversary] = useState(""),
    [consent, setConsent] = useState(false);
  const lock = useRef(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/customer/rewards", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok || !d.ok)
      throw Error(d.error?.message || "Your rewards could not load.");
    setData(d);
    setBirthday(d.wallet?.dates?.birthday || "");
    setAnniversary(d.wallet?.dates?.anniversary || "");
    setConsent(d.wallet?.dates?.consent || false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const token =
      new URLSearchParams(location.hash.slice(1)).get("verify") ||
      sessionStorage.getItem("gyvft-reward-proof");
    if (location.hash) history.replaceState(null, "", location.pathname);
    fetch("/api/customer/rewards", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.ok)
          throw Error(d.error?.message || "Your rewards could not load.");
        return d;
      })
      .then((d) => {
        if (controller.signal.aborted) return;
        setData(d);
        setBirthday(d.wallet?.dates?.birthday || "");
        setAnniversary(d.wallet?.dates?.anniversary || "");
        setConsent(d.wallet?.dates?.consent || false);
        if (token) setProof(token);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setMessage(e.message);
      });
    return () => controller.abort();
  }, []);
  async function command(op: string, body: Record<string, unknown> = {}) {
    if (lock.current) return;
    lock.current = true;
    setBusy(op);
    setMessage("");
    try {
      const response = await fetch("/api/customer/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...body }),
        signal: AbortSignal.timeout(60000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw Error(result.error?.message || "Please try again.");
      if (result.redirectUrl) {
        location.assign(result.redirectUrl);
        return;
      }
      setMessage(result.message || "Saved.");
      if (op === "confirm-email") {
        setProof("");
        sessionStorage.removeItem("gyvft-reward-proof");
      }
      await load();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not complete this request.",
      );
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  const wallet = data?.wallet,
    active = wallet?.coupons.find(
      (c) =>
        c.kind === "points" &&
        ["creating", "active", "uncertain"].includes(c.state),
    );
  const minimum = active ? Number(active.minimum_paise) / 100 : points * 4;
  const dateSubmit = (e: FormEvent) => {
    e.preventDefault();
    void command("dates", {
      birthday: birthday || null,
      anniversary: anniversary || null,
      consent,
    });
  };
  return (
    <div className="app-stack pb-20 md:pb-0">
      <div className="app-title">
        <div>
          <p className="text-xs uppercase tracking-[.16em] text-olive-dark">
            A little more, every time
          </p>
          <h1>Your Aarla rewards</h1>
          <p>Good things come back around.</p>
        </div>
        <Link className="app-button" href="/account/shop">
          Shop with your 5% saving <ArrowUpRight size={16} />
        </Link>
      </div>
      <div aria-live="polite" className="min-h-6 text-sm">
        {busy && (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle
              size={16}
              className="animate-spin motion-reduce:animate-none"
            />
            One moment…
          </span>
        )}
        {message && <p role="status">{message}</p>}
      </div>
      {!data ? (
        <section className="app-panel min-h-80" aria-busy="true">
          <p>Opening your rewards…</p>
          <button
            className="app-button mt-5"
            onClick={() => void load().catch((e) => setMessage(e.message))}
          >
            Try again
          </button>
        </section>
      ) : !data.installed ? (
        <section className="app-panel">
          <Gift className="text-olive-dark" />
          <h2 className="mt-4">Something to look forward to.</h2>
          <p>
            Rewards are being prepared. Your existing Aarla saving is ready
            whenever you shop.
          </p>
        </section>
      ) : (
        <>
          {!data.verified ? (
            <section className="app-panel max-w-2xl">
              <Sparkles className="text-olive-dark" />
              <h2 className="mt-4">Make your rewards yours.</h2>
              <p>
                Confirm <span className="break-all">{email}</span> to connect
                your own Aarla purchases. No extra account at Aarla is needed.
              </p>
              <button
                className="app-button primary mt-5"
                disabled={!!busy}
                onClick={() =>
                  void command(
                    proof ? "confirm-email" : "verify-email",
                    proof ? { token: proof } : {},
                  )
                }
              >
                {proof ? "Confirm email" : "Email me a secure link"}
              </button>
            </section>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
                <section className="app-panel bg-surface">
                  <p className="text-sm text-olive-dark">
                    Ready for your next good thing
                  </p>
                  <p className="my-3 font-serif text-6xl">
                    {wallet?.available.toLocaleString("en-IN") || 0}
                    <span className="ml-3 font-sans text-base">points</span>
                  </p>
                  <p>
                    {rupees(wallet?.available || 0)} to put towards Aarla retail
                    gifts.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-6 border-t border-border pt-4 text-sm">
                    <span>
                      {wallet?.pending || 0} pending
                      <span className="block text-xs text-muted-text">
                        14-day earning hold
                      </span>
                    </span>
                    <span>
                      {wallet?.reserved || 0} reserved
                      <span className="block text-xs text-muted-text">
                        Checkout not yet confirmed
                      </span>
                    </span>
                  </div>
                  {!!wallet?.reserved && (
                    <button
                      className="app-button mt-4"
                      disabled={!!busy}
                      onClick={() => void command("refresh")}
                    >
                      Check Aarla checkout
                    </button>
                  )}
                  {!!wallet?.debt && (
                    <p className="mt-4 text-sm">
                      A returned order adjusted your balance by {wallet.debt}{" "}
                      points. New earnings will cover this first.
                    </p>
                  )}
                </section>
                <section className="app-panel">
                  <h2>Put your points to work.</h2>
                  <p>
                    1 point = ₹1. Use points for up to 25% of an order’s
                    merchandise subtotal. Pay the rest at Aarla.
                  </p>
                  <label className="mt-5 block text-sm">
                    Points to use
                    <input
                      className="app-input mt-2 w-full"
                      type="number"
                      min={1}
                      max={wallet?.available || 1}
                      step={1}
                      value={active ? active.points : points}
                      disabled={!!active || !!busy}
                      onChange={(e) => setPoints(Number(e.target.value))}
                    />
                  </label>
                  <p className="mt-2 text-sm">
                    {rupees(active ? active.points : points)} off · minimum
                    merchandise subtotal {rupees(minimum)}
                  </p>
                  <button
                    className="app-button primary mt-4"
                    disabled={
                      !!busy ||
                      !data.enabled ||
                      (!active &&
                        (!Number.isInteger(points) ||
                          points < 1 ||
                          points > (wallet?.available || 0)))
                    }
                    onClick={() =>
                      void command("redeem", {
                        kind: "points",
                        points: active ? active.points : points,
                      })
                    }
                  >
                    {active
                      ? "Continue with reserved points"
                      : "Use points at Aarla"}{" "}
                    <ArrowUpRight size={16} />
                  </button>
                  <p className="mt-3 text-xs text-muted-text">
                    One use, valid for 24 hours. Applies to eligible retail
                    products. Points stay reserved until Shopify confirms use;
                    unused points return after an expiry check unless the points
                    themselves have expired.
                  </p>
                  {!data.enabled && (
                    <p className="mt-3 text-sm">
                      New rewards are temporarily paused. Your wallet is safe.
                    </p>
                  )}
                </section>
              </div>
              <section className="app-panel">
                <div className="flex items-start gap-3">
                  <Gift className="shrink-0 text-olive-dark" />
                  <div>
                    <h2>Your days deserve a little extra.</h2>
                    <p>
                      Your own birthday and anniversary can bring ₹150 off a
                      ₹1,500+ retail purchase, once per occasion each year.
                    </p>
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium underline">
                    Your own occasion dates
                  </summary>
                  <form
                    onSubmit={dateSubmit}
                    className="mt-5 grid gap-4 md:grid-cols-2"
                  >
                    <label>
                      Your birthday{" "}
                      <span className="text-xs text-muted-text">(MM-DD)</span>
                      <input
                        className="app-input mt-2 w-full"
                        placeholder="08-24"
                        pattern="[0-9]{2}-[0-9]{2}"
                        value={birthday}
                        onChange={(e) => setBirthday(e.target.value)}
                        maxLength={5}
                      />
                    </label>
                    <label>
                      Your anniversary{" "}
                      <span className="text-xs text-muted-text">(MM-DD)</span>
                      <input
                        className="app-input mt-2 w-full"
                        placeholder="11-15"
                        pattern="[0-9]{2}-[0-9]{2}"
                        value={anniversary}
                        onChange={(e) => setAnniversary(e.target.value)}
                        maxLength={5}
                      />
                    </label>
                    <div className="md:col-span-2">
                      <label className="app-check min-h-11">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                        />
                        Use my own dates for occasion offers. I can switch this
                        off.
                      </label>
                    </div>
                    <div>
                      <button className="app-button" disabled={!!busy}>
                        Save my dates
                      </button>
                    </div>
                  </form>
                  <p className="mt-3 text-xs text-muted-text">
                    For verified customers with a completed retail purchase.
                    Opens 7 days before your day and closes 7 days after. Dates
                    are fixed for 12 months after an offer is issued.
                  </p>
                </details>
                <div className="app-actions mt-4">
                  {(["birthday", "anniversary"] as const).map((kind) => {
                    let window = null;
                    try {
                      window = celebrationWindow(wallet?.dates?.[kind] || "");
                    } catch {}
                    return wallet?.dates?.consent && window ? (
                      <button
                        className="app-button primary"
                        key={kind}
                        disabled={!!busy || !data.enabled}
                        onClick={() =>
                          void command("redeem", { kind, points: 150 })
                        }
                      >
                        Use my {kind} offer
                      </button>
                    ) : null;
                  })}
                </div>
              </section>
              <section className="app-panel">
                <h2>Your rewards activity</h2>
                {!wallet?.history.length ? (
                  <p className="app-muted">
                    Your completed Aarla purchases will appear here after
                    syncing.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {wallet.history.map((entry, index) => (
                      <li
                        key={index}
                        className="flex justify-between gap-4 py-3 text-sm"
                      >
                        <span>
                          {entry.detail}
                          <time className="block text-xs text-muted-text">
                            {new Date(entry.created_at).toLocaleDateString(
                              "en-IN",
                              { timeZone: "Asia/Kolkata" },
                            )}
                          </time>
                        </span>
                        <span className="shrink-0">
                          {entry.points > 0 ? "+" : ""}
                          {entry.points} pts
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
          <section className="app-panel">
            <h2>One good benefit at a time.</h2>
            <p className="text-sm">
              Choose your 5% saving, points or an occasion offer. Benefits
              cannot be combined.
            </p>
            <details className="mt-3">
              <summary className="min-h-11 cursor-pointer py-3 text-sm underline">
                How earning and redemption work
              </summary>
              <p className="text-sm">
                Earn 1 point per ₹50 of eligible retail spend after discounts,
                excluding GST, shipping and gift cards. Points unlock after 14
                days and expire 12 months later. Choose your regular 5% saving,
                points redemption or an occasion offer. Benefits cannot be
                combined, and an order using rewards or an occasion offer earns
                no points. Custom quotes and wholesale purchases are outside
                this programme.
              </p>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
