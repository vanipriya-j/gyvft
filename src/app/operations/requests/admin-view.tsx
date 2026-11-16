"use client";
import Link from "next/link";
import { GiftOptionsAdmin } from "@/components/customer/gift-options-admin";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { stages, money } from "@/lib/customer/model";
import type { pilotDetail } from "@/lib/customer/pilot-admin";
import type { OrderItem } from "@/lib/customer/pilot-model";
type Detail = Awaited<ReturnType<typeof pilotDetail>>;
const input =
  "mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2 text-sm";
const button =
  "rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50";
const card = "rounded-2xl border border-border bg-paper p-5";
async function imageData(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.size) return undefined;
  if (value.size > 2 * 1024 * 1024) throw Error("Use an image under 2 MB.");
  const bytes = new Uint8Array(await value.arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return { mime: value.type, data: btoa(binary) };
}
export function B2CAdmin({ initialId }: { initialId: string }) {
  const secret = useRef(""),
    running = useRef(false),
    retry = useRef<{ key: string; id: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<Detail["project"][]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [query, setQuery] = useState("");
  const [selectionId, setSelectionId] = useState("");
  const [shopify, setShopify] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([
    {
      name: "",
      quantity: 1,
      unit_paise: 0,
      item_type: "gift",
      personalisation: "",
    },
  ]);
  async function post(
    payload: Record<string, unknown>,
    candidate = secret.current,
  ) {
    const response = await fetch("/api/operations/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-setup-secret": candidate,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok || !data.ok)
      throw Error(
        data.message ||
          "This operation could not be confirmed. Refresh before retrying.",
      );
    return data;
  }
  async function list() {
    const data = await post({ op: "list", query });
    setRows(data.requests);
    setShopify(data.shopifyConfigured);
  }
  async function select(id: string) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("");
    try {
      setSelectionId("");
      setDetail(await post({ op: "detail", id }));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function perform(payload: Record<string, unknown>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("");
    const key = JSON.stringify(payload);
    if (retry.current?.key !== key)
      retry.current = { key, id: crypto.randomUUID() };
    try {
      const data = await post({ ...payload, request_id: retry.current.id });
      retry.current = null;
      setMessage(data.message || "Saved.");
      if (detail)
        setDetail(await post({ op: "detail", id: detail.project.id }));
      await list();
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  function form(action: (data: FormData) => Promise<void>) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        await action(data);
      } catch (e) {
        setMessage((e as Error).message);
      }
    };
  }
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("secret") || "");
    setBusy(true);
    try {
      const data = await post({ op: "list" }, value);
      secret.current = value;
      setRows(data.requests);
      setShopify(data.shopifyConfigured);
      setUnlocked(true);
      if (initialId) setDetail(await post({ op: "detail", id: initialId }));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function lock() {
    secret.current = "";
    retry.current = null;
    setUnlocked(false);
    setRows([]);
    setDetail(null);
    setMessage("");
  }
  async function preview(kind: string, id: string) {
    const response = await fetch(`/api/customer-assets/${kind}/${id}`, {
      headers: { "x-setup-secret": secret.current },
      cache: "no-store",
    });
    if (!response.ok) {
      setMessage("Image unavailable.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const p = detail?.project;
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/operations"
            className="text-xs uppercase tracking-widest text-olive"
          >
            GYVFT Operations
          </Link>
          <h1 className="mt-2 font-serif text-3xl">Customer desk</h1>
          <p className="mt-2 text-sm text-muted-text">
            B2C pilot · customer updates, approvals, payments and fulfilment
          </p>
        </div>
        {unlocked && (
          <div className="flex gap-2">
            <button
              disabled={busy}
              className={button}
              onClick={() => {
                void list();
              }}
            >
              Refresh list
            </button>
            <button disabled={busy} className={button} onClick={lock}>
              Lock
            </button>
            <button
              disabled={busy || !shopify}
              className={button}
              onClick={() => void perform({ op: "sync_customers" })}
            >
              Sync pending customers
            </button>
          </div>
        )}
      </header>
      {!unlocked ? (
        <form onSubmit={unlock} className={`${card} mx-auto mt-12 max-w-md`}>
          <h2 className="font-serif text-2xl">Operator access</h2>
          <label className="mt-4 block text-sm">
            Operator secret
            <input
              name="secret"
              type="password"
              required
              autoComplete="off"
              className={input}
            />
          </label>
          <button disabled={busy} className={`${button} mt-4`}>
            {busy ? "Opening…" : "Open customer desk"}
          </button>
          <p className="mt-3 text-xs text-muted-text">
            The secret stays in this tab’s memory. Customer logins cannot access
            this desk.
          </p>
        </form>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[300px_1fr]">
          <aside className={`${card} lg:sticky lg:top-5`}>
            <form
              onSubmit={(event) =>
                void form(async () => {
                  await list();
                })(event)
              }
            >
              <label className="text-sm">
                Find a request
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name or email"
                  className={input}
                />
              </label>
              <button disabled={busy} className={`${button} mt-2`}>
                Search
              </button>
            </form>
            <div className="mt-4 max-h-[65vh] space-y-1 overflow-y-auto">
              {rows.map((row) => (
                <button
                  key={row.id}
                  disabled={busy}
                  onClick={() => void select(row.id)}
                  className={`block w-full rounded-xl p-3 text-left ${p?.id === row.id ? "bg-surface" : "hover:bg-surface/60"}`}
                >
                  <span className="block text-sm font-medium">{row.title}</span>
                  <span className="mt-1 block break-all text-xs text-muted-text">
                    {row.customer_email}
                  </span>
                  <span className="mt-1 block text-xs text-olive">
                    {stages[row.stage as number]}
                  </span>
                </button>
              ))}
            </div>
            <details className="mt-5 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm">
                Direct UPI receiving account
              </summary>
              <form
                className="mt-3 space-y-3"
                onSubmit={(event) =>
                  void form(async (f) => {
                    await perform({
                      op: "upi_settings",
                      upi_id: f.get("upi_id"),
                      payee_name: f.get("payee_name"),
                      image: await imageData(f.get("image")),
                      confirmed_payee: f.get("confirmed_payee") === "on",
                    });
                  })(event)
                }
              >
                <label className="block text-sm">
                  UPI ID
                  <input name="upi_id" required className={input} />
                </label>
                <label className="block text-sm">
                  Payee name
                  <input name="payee_name" required className={input} />
                </label>
                <label className="block text-sm">
                  Merchant QR (PNG/JPEG/WebP, 2 MB)
                  <input
                    name="image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className={input}
                  />
                </label>
                <label className="flex gap-2 text-xs">
                  <input name="confirmed_payee" type="checkbox" />I checked that
                  this QR pays the same receiving account.
                </label>
                <button disabled={busy} className={button}>
                  Save UPI settings
                </button>
              </form>
            </details>
          </aside>
          <div className="min-w-0 space-y-5">
            {p && detail ? (
              <>
                <section className={card}>
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <p className="text-xs text-olive">
                        {p.customer_type || "Unclassified"} · {p.kind}
                      </p>
                      <h2 className="mt-2 font-serif text-2xl">{p.title}</h2>
                      <p className="mt-2 break-all text-sm text-muted-text">
                        {p.customer_email}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm">{stages[p.stage as number]}</p>
                      <p className="mt-2 text-sm">
                        Quote:{" "}
                        {p.total_paise
                          ? money(Number(p.total_paise))
                          : "Not converted"}
                      </p>
                      <p className="text-sm">
                        Verified: {money(Number(p.paid_paise))}
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 whitespace-pre-wrap text-sm leading-6">
                    {p.brief}
                  </p>
                  <p className="mt-3 text-xs text-muted-text">
                    Customer account:{" "}
                    {p.customer_account_id
                      ? "Connected"
                      : "Not connected yet; customer must sign up in the submission browser."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      disabled={busy || p.kind === "project"}
                      className={button}
                      onClick={() => void perform({ op: "convert", id: p.id })}
                    >
                      Convert approved quote to B2C order
                    </button>
                    <button
                      disabled={busy || !shopify || p.kind !== "project"}
                      className={button}
                      onClick={() =>
                        window.confirm(
                          "Confirm the approved quote, delivery address and verified receipts are correct. This creates or updates the live Shopify order and records verified payments; it does not charge the customer.",
                        ) &&
                        void perform({
                          op: "shopify_order",
                          id: p.id,
                          confirm_order: true,
                        })
                      }
                    >
                      {p.shopify_order_reference
                        ? "Sync Shopify order / verified payments"
                        : "Create Shopify order"}
                    </button>
                    <button
                      disabled={busy || !shopify || !p.customer_account_id}
                      className={button}
                      onClick={() =>
                        void perform({ op: "shopify_customer", id: p.id })
                      }
                    >
                      Sync Shopify customer
                    </button>
                  </div>
                  {!shopify && (
                    <p className="mt-3 text-xs text-muted-text">
                      Shopify connection needs SHOPIFY_ADMIN_ACCESS_TOKEN in
                      Vercel. Manual order reference entry is available below.
                    </p>
                  )}
                </section>
                <section className={card}>
                  <h3 className="font-medium">Customer conversation</h3>
                  <div className="my-4 max-h-72 space-y-3 overflow-y-auto">
                    {[...detail.messages].reverse().map((m) => (
                      <article key={m.id} className="rounded-xl bg-surface p-3">
                        <p className="text-xs text-muted-text">
                          {m.sender === "customer" ? "Customer" : "GYVFT team"}{" "}
                          · {new Date(m.created_at).toLocaleString("en-IN")}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm">
                          {m.body}
                        </p>
                      </article>
                    ))}
                  </div>
                  <form
                    onSubmit={(event) =>
                      void form(async (f) => {
                        await perform({
                          op: "reply",
                          id: p.id,
                          body: f.get("body"),
                        });
                      })(event)
                    }
                  >
                    <label className="block text-sm">
                      Reply to customer
                      <textarea
                        name="body"
                        required
                        maxLength={4000}
                        className={input}
                      />
                    </label>
                    <button disabled={busy} className={`${button} mt-3`}>
                      Send reply
                    </button>
                  </form>
                </section>
                <GiftOptionsAdmin
                  key={p.id}
                  projectId={p.id}
                  data={detail.workspace}
                  busy={busy}
                  perform={perform}
                  preview={preview}
                  onUseSelection={(s) => {
                    setSelectionId(s.id);
                    setItems(
                      s.snapshot.lines.map((l) => ({
                        name: l.name || "Gift item",
                        quantity: l.quantity * s.snapshot.recipients,
                        unit_paise: l.unit_paise || 0,
                        item_type: "gift",
                        personalisation: Object.values(l.variants).join(" · "),
                      })),
                    );
                    setMessage(
                      "Selection copied into the quote editor. Enter final prices, design/personalisation and packaging charges before publishing.",
                    );
                  }}
                />
                <section className={card}>
                  <h3 className="font-medium">
                    Publish a version for approval
                  </h3>
                  <form
                    className="mt-4 space-y-4"
                    onSubmit={(event) =>
                      void form(async (f) => {
                        await perform({
                          op: "publish",
                          id: p.id,
                          kind: f.get("kind"),
                          gift_selection_id: selectionId || null,
                          title: f.get("title"),
                          description: f.get("description"),
                          items,
                          image: await imageData(f.get("image")),
                        });
                      })(event)
                    }
                  >
                    {detail.workspace.selections.length > 0 && (
                      <label className="block text-sm">
                        Customer gift selection for this quote
                        <select
                          className={input}
                          value={selectionId}
                          onChange={(e) => setSelectionId(e.target.value)}
                        >
                          <option value="">Choose the latest selection</option>
                          {detail.workspace.selections.map((s, i) => (
                            <option key={s.id} value={s.id} disabled={i !== 0}>
                              {s.snapshot.label} · saved v{s.draft_version}
                              {i === 0 ? " · latest" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="block text-sm">
                      Version type
                      <select name="kind" className={input}>
                        <option value="proposal">
                          Priced proposal / quote
                        </option>
                        <option value="design">Design / mockup</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      Title
                      <input
                        name="title"
                        required
                        minLength={2}
                        maxLength={180}
                        className={input}
                      />
                    </label>
                    <label className="block text-sm">
                      Customer-visible description
                      <textarea
                        name="description"
                        required
                        maxLength={5000}
                        className={input}
                      />
                    </label>
                    <label className="block text-sm">
                      Mockup image (optional, under 2 MB)
                      <input
                        name="image"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className={input}
                      />
                    </label>
                    <fieldset>
                      <legend className="text-sm">
                        Quote line items · prices include applicable taxes (used
                        for proposals)
                      </legend>
                      <div className="mt-3 space-y-3">
                        {items.map((item, i) => (
                          <div
                            key={i}
                            className="grid gap-2 rounded-xl bg-surface p-3 sm:grid-cols-3"
                          >
                            <label className="text-xs">
                              Item
                              <input
                                value={item.name}
                                onChange={(e) =>
                                  setItems(
                                    items.map((v, n) =>
                                      n === i
                                        ? { ...v, name: e.target.value }
                                        : v,
                                    ),
                                  )
                                }
                                className={input}
                              />
                            </label>
                            <label className="text-xs">
                              Quantity
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  setItems(
                                    items.map((v, n) =>
                                      n === i
                                        ? {
                                            ...v,
                                            quantity: Number(e.target.value),
                                          }
                                        : v,
                                    ),
                                  )
                                }
                                className={input}
                              />
                            </label>
                            <label className="text-xs">
                              Unit price (₹)
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.unit_paise / 100}
                                onChange={(e) =>
                                  setItems(
                                    items.map((v, n) =>
                                      n === i
                                        ? {
                                            ...v,
                                            unit_paise: Math.round(
                                              Number(e.target.value) * 100,
                                            ),
                                          }
                                        : v,
                                    ),
                                  )
                                }
                                className={input}
                              />
                            </label>
                            <label className="text-xs">
                              Type
                              <select
                                value={item.item_type}
                                onChange={(e) =>
                                  setItems(
                                    items.map((v, n) =>
                                      n === i
                                        ? {
                                            ...v,
                                            item_type: e.target.value as
                                              "gift" | "fee",
                                          }
                                        : v,
                                    ),
                                  )
                                }
                                className={input}
                              >
                                <option value="gift">Gift / product</option>
                                <option value="fee">
                                  Delivery / other charge
                                </option>
                              </select>
                            </label>
                            <label className="text-xs sm:col-span-2">
                              Personalisation
                              <input
                                value={item.personalisation}
                                onChange={(e) =>
                                  setItems(
                                    items.map((v, n) =>
                                      n === i
                                        ? {
                                            ...v,
                                            personalisation: e.target.value,
                                          }
                                        : v,
                                    ),
                                  )
                                }
                                className={input}
                              />
                            </label>
                            {items.length > 1 && (
                              <button
                                type="button"
                                className="text-left text-xs underline"
                                onClick={() =>
                                  setItems(items.filter((_, n) => n !== i))
                                }
                              >
                                Remove item
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={items.length >= 50}
                        className={`${button} mt-3`}
                        onClick={() =>
                          setItems([
                            ...items,
                            {
                              name: "",
                              quantity: 1,
                              unit_paise: 0,
                              item_type: "gift",
                              personalisation: "",
                            },
                          ])
                        }
                      >
                        Add item
                      </button>
                    </fieldset>
                    <p className="text-sm">
                      Quote total:{" "}
                      {money(
                        items.reduce(
                          (n, i) => n + i.quantity * i.unit_paise,
                          0,
                        ),
                      )}
                    </p>
                    <button disabled={busy} className={button}>
                      Publish for approval
                    </button>
                  </form>
                  <div className="mt-5 space-y-3">
                    {detail.approvals.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border p-3 text-sm"
                      >
                        <strong>{a.title}</strong> · {a.kind} v{a.version} ·{" "}
                        {a.status}
                        {a.amount_paise && (
                          <p>{money(Number(a.amount_paise))}</p>
                        )}
                        {a.customer_response && (
                          <p className="mt-2 whitespace-pre-wrap">
                            Customer: {a.customer_response}
                          </p>
                        )}
                        {a.has_image && (
                          <button
                            type="button"
                            className="mt-2 underline"
                            onClick={() => void preview("approval", a.id)}
                          >
                            Preview mockup
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
                <section className={card}>
                  <h3 className="font-medium">
                    Payment verification · review within 24 hours
                  </h3>
                  <p className="mt-2 text-xs text-muted-text">
                    Check the receiving bank/provider, not just the screenshot.
                    Receipts stay pending until verified. An overdue review is
                    never auto-approved.
                  </p>
                  <div className="my-4 space-y-3">
                    {detail.payments.map((pay) => (
                      <div
                        key={pay.id}
                        className="rounded-xl border border-border p-3 text-sm"
                      >
                        <p>
                          {money(Number(pay.amount_paise))} · {pay.reference} ·{" "}
                          <strong>{pay.status}</strong>
                        </p>
                        <p className="mt-1 text-xs text-muted-text">
                          Submitted{" "}
                          {new Date(pay.created_at).toLocaleString("en-IN")} ·{" "}
                          {pay.status === "pending" &&
                          now - new Date(pay.created_at).getTime() > 86400000
                            ? "Review overdue"
                            : "Allow up to 24 hours for review"}
                        </p>
                        {pay.has_evidence && (
                          <button
                            className="mt-2 underline"
                            onClick={() => void preview("payment", pay.id)}
                          >
                            View transaction screenshot
                          </button>
                        )}
                        {pay.status === "pending" && (
                          <button
                            disabled={busy}
                            className={`${button} ml-3`}
                            onClick={() =>
                              void perform({
                                op: "reject_payment",
                                id: p.id,
                                reference: pay.reference,
                              })
                            }
                          >
                            Reject reference
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <form
                    className="space-y-3"
                    onSubmit={(event) =>
                      void form(async (f) => {
                        await perform({
                          op: "payment",
                          id: p.id,
                          reference: f.get("reference"),
                          amount_paise: Math.round(
                            Number(f.get("amount")) * 100,
                          ),
                          confirmed_receipt:
                            f.get("confirmed_receipt") === "on",
                        });
                      })(event)
                    }
                  >
                    <label className="block text-sm">
                      Reference to verify
                      <input
                        name="reference"
                        required
                        minLength={6}
                        className={input}
                      />
                    </label>
                    <label className="block text-sm">
                      Amount (₹, for manually entered receipts)
                      <input
                        type="number"
                        name="amount"
                        min="0.01"
                        step="0.01"
                        className={input}
                      />
                    </label>
                    <label className="flex gap-2 text-sm">
                      <input
                        name="confirmed_receipt"
                        type="checkbox"
                        required
                      />
                      I verified receipt and amount in the receiving
                      bank/provider.
                    </label>
                    <button disabled={busy} className={button}>
                      Verify and credit receipt
                    </button>
                  </form>
                </section>
                <section className={card}>
                  <h3 className="font-medium">
                    Payment / Shopify instructions
                  </h3>
                  <form
                    className="mt-4 space-y-3"
                    onSubmit={(event) =>
                      void form(async (f) => {
                        await perform({
                          op: "instructions",
                          id: p.id,
                          upi_id: f.get("upi_id"),
                          razorpay_url: f.get("razorpay_url"),
                          shopify_order_reference: f.get(
                            "shopify_order_reference",
                          ),
                        });
                      })(event)
                    }
                  >
                    <label className="block text-sm">
                      Order-specific UPI ID (blank uses receiving-account
                      default)
                      <input
                        name="upi_id"
                        defaultValue={p.upi_id || ""}
                        className={input}
                      />
                    </label>
                    <label className="block text-sm">
                      Optional Razorpay link
                      <input
                        name="razorpay_url"
                        defaultValue={p.razorpay_url || ""}
                        className={input}
                      />
                    </label>
                    <label className="block text-sm">
                      Manually created Shopify order reference
                      <input
                        name="shopify_order_reference"
                        defaultValue={p.shopify_order_reference || ""}
                        className={input}
                      />
                    </label>
                    <button disabled={busy} className={button}>
                      Save instructions
                    </button>
                  </form>
                </section>
                <section className={card}>
                  <h3 className="font-medium">Delivery details</h3>
                  {detail.address ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm">
                      {detail.address.recipient_name} · {detail.address.phone}
                      {"\n"}
                      {detail.address.address}
                      {"\n"}
                      {detail.address.city}, {detail.address.state}{" "}
                      {detail.address.postal_code}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-muted-text">
                      Customer has not saved a delivery address yet.
                    </p>
                  )}
                  <form
                    className="mt-4 space-y-3"
                    onSubmit={(event) =>
                      void form(async (f) => {
                        await perform({
                          op: "progress",
                          id: p.id,
                          stage: Number(f.get("stage")),
                          next_action: f.get("next_action"),
                          tracking_reference: f.get("tracking_reference"),
                          tracking_url: f.get("tracking_url"),
                        });
                      })(event)
                    }
                  >
                    <label className="block text-sm">
                      Progress
                      <select
                        name="stage"
                        defaultValue={p.stage}
                        className={input}
                      >
                        {[1, 2, 7, 8, 9, 10, 11].map((n) => (
                          <option key={n} value={n}>
                            {stages[n]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      Customer-visible next step
                      <textarea
                        name="next_action"
                        defaultValue={p.next_action}
                        required
                        className={input}
                      />
                    </label>
                    <label className="block text-sm">
                      Tracking reference
                      <input
                        name="tracking_reference"
                        defaultValue={p.tracking_reference || ""}
                        className={input}
                      />
                    </label>
                    <label className="block text-sm">
                      Tracking link
                      <input
                        name="tracking_url"
                        defaultValue={p.tracking_url || ""}
                        className={input}
                      />
                    </label>
                    <button disabled={busy} className={button}>
                      Publish progress
                    </button>
                  </form>
                </section>
                <section className={card}>
                  <h3 className="font-medium">Notification delivery</h3>
                  <p className="mt-3 text-sm">
                    {
                      detail.notifications.filter((n) => n.state !== "sent")
                        .length
                    }{" "}
                    recent notifications pending / failed
                  </p>
                  <button
                    disabled={busy}
                    className={`${button} mt-3`}
                    onClick={() =>
                      void perform({ op: "retry_notifications", id: p.id })
                    }
                  >
                    Retry pending notifications
                  </button>
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm">
                      Operator audit
                    </summary>
                    {detail.audit.map((a, i) => (
                      <p key={i} className="mt-2 text-xs text-muted-text">
                        {a.operation} ·{" "}
                        {new Date(a.created_at).toLocaleString("en-IN")}
                      </p>
                    ))}
                  </details>
                </section>
              </>
            ) : (
              <section className={`${card} py-16 text-center text-muted-text`}>
                Select a request to manage its customer-visible journey.
              </section>
            )}
          </div>
        </div>
      )}
      <div className="sticky bottom-3 z-10 mt-5" role="status">
        {(message || busy) && (
          <p className="rounded-xl border border-border bg-paper p-4 text-sm shadow-lg">
            {busy ? "Saving / loading…" : message}
          </p>
        )}
      </div>
    </main>
  );
}
