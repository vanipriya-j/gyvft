"use client";
import { useState, type FormEvent } from "react";
import type {
  GiftOption,
  GiftSelection,
  SavedGiftDraft,
  GiftContent,
  GiftPricing,
} from "@/lib/customer/gift-workspace-model";
import { GiftSnapshot, IndicativePrice } from "./gift-workspace";
const input =
  "mt-1 w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm";
const button =
  "rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50";
const blank = (): GiftContent => ({
  key: crypto.randomUUID(),
  name: "",
  quantity: 1,
  unit_paise: null,
});
export function GiftOptionsAdmin({
  projectId,
  data,
  busy,
  perform,
  preview,
  onUseSelection,
}: {
  projectId: string;
  data: {
    options: GiftOption[];
    drafts: SavedGiftDraft[];
    selections: GiftSelection[];
  };
  busy: boolean;
  perform: (p: Record<string, unknown>) => Promise<boolean | undefined>;
  preview: (kind: string, id: string) => Promise<void>;
  onUseSelection: (s: GiftSelection) => void;
}) {
  const [contents, setContents] = useState<GiftContent[]>([
      { key: "first", name: "", quantity: 1, unit_paise: null },
    ]),
    [mode, setMode] = useState<GiftPricing["mode"]>("none"),
    [error, setError] = useState("");
  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      const pic = f.get("image");
      if (!(pic instanceof File) || !pic.size || pic.size > 2 * 1024 * 1024)
        throw Error("Add one hamper photo or mock-up under 2 MB.");
      const bytes = new Uint8Array(await pic.arrayBuffer());
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      const price = (v: FormDataEntryValue | null) =>
        v === null || v === "" ? null : Math.round(Number(v) * 100);
      const pricing = {
        mode,
        basis: f.get("basis") || "per_set",
        quantity: Number(f.get("quantity") || 1),
        low_paise: mode === "none" ? null : price(f.get("low")),
        high_paise: mode === "range" ? price(f.get("high")) : null,
        packaging_included: f.get("packaging") === "on",
      };
      const ok = await perform({
        op: "publish_gift_option",
        id: projectId,
        title: f.get("title"),
        description: f.get("description") || "",
        contents,
        pricing,
        image: { mime: pic.type, data: btoa(binary) },
      });
      if (ok) {
        form.reset();
        setContents([blank()]);
        setMode("none");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="rounded-xl border border-border bg-paper p-5">
      <h3 className="font-serif text-2xl">
        Gift options & customer selections
      </h3>
      <p className="mt-2 text-sm text-muted-text">
        Publish one hamper image with manually entered contents. No Shopify
        product is required. Published contents and indicative prices stay
        unchanged; Show/Hide only changes visibility. Publish a new option to
        revise one.
      </p>
      <form onSubmit={publish} className="mt-5 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <legend className="font-medium">Publish a curated option</legend>
          <label className="block text-sm">
            Option title
            <input
              name="title"
              required
              minLength={2}
              maxLength={160}
              className={input}
              placeholder="Option A — A little festive warmth"
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea name="description" maxLength={2000} className={input} />
          </label>
          <label className="block text-sm">
            Hamper photo or visual mock-up
            <input
              type="file"
              name="image"
              required
              accept="image/png,image/jpeg,image/webp"
              className={input}
            />
          </label>
          <p className="text-xs text-muted-text">
            One image under 2 MB. Artwork is selected later; label reference
            imagery clearly in the description.
          </p>
          <div>
            <p className="text-sm font-medium">
              Contents · quantities per recipient
            </p>
            {contents.map((c, i) => (
              <div
                key={c.key}
                className="my-3 grid gap-2 sm:grid-cols-[1fr_90px_auto]"
              >
                <label className="text-xs">
                  Product / item
                  <input
                    required
                    minLength={2}
                    maxLength={160}
                    value={c.name}
                    className={input}
                    onChange={(e) =>
                      setContents((cs) =>
                        cs.map((v, n) =>
                          n === i ? { ...v, name: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
                <label className="text-xs">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={c.quantity}
                    className={input}
                    onChange={(e) =>
                      setContents((cs) =>
                        cs.map((v, n) =>
                          n === i
                            ? { ...v, quantity: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className={button + " self-end"}
                  disabled={contents.length === 1}
                  onClick={() =>
                    setContents((cs) => cs.filter((_, n) => n !== i))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className={button}
              disabled={contents.length >= 40}
              onClick={() => setContents((cs) => [...cs, blank()])}
            >
              Add content item
            </button>
          </div>
          <label className="block text-sm">
            Price display
            <select
              aria-label="Price display"
              className={input}
              value={mode}
              onChange={(e) => setMode(e.target.value as GiftPricing["mode"])}
            >
              <option value="none">No price shown · price on request</option>
              <option value="indicative">Indicative price</option>
              <option value="range">Price range</option>
            </select>
          </label>
          {mode !== "none" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  {mode === "range" ? "From (₹)" : "Indicative amount (₹)"}
                  <input
                    name="low"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    className={input}
                  />
                </label>
                {mode === "range" && (
                  <label className="text-sm">
                    To (₹)
                    <input
                      name="high"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      className={input}
                    />
                  </label>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Price basis
                  <select name="basis" className={input}>
                    <option value="per_set">Per gift set</option>
                    <option value="order">Whole order</option>
                  </select>
                </label>
                <label className="text-sm">
                  Based on how many gift sets?
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    max="10000"
                    defaultValue={1}
                    required
                    className={input}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="packaging" type="checkbox" />
                Packaging is included in this estimate
              </label>
              <p className="text-xs text-muted-text">
                Enter tax-inclusive amounts. Delivery is always separate at
                actuals. This is an estimate, not a quote for approval.
              </p>
            </>
          )}
          <button className={button + " bg-action text-white"} disabled={busy}>
            {busy ? "Saving…" : "Publish gift option"}
          </button>
          <p role="alert" className="text-sm">
            {error}
          </p>
        </fieldset>
      </form>
      <div className="mt-6 space-y-4">
        {data.options.map((o) => (
          <article key={o.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <h4 className="font-medium">{o.title}</h4>
              <button
                type="button"
                role="switch"
                aria-label={`Show ${o.title}`}
                aria-checked={!o.hidden}
                disabled={busy}
                className={button}
                onClick={() =>
                  void perform({
                    op: "gift_visibility",
                    id: projectId,
                    option_id: o.id,
                    kind: "curated",
                    hidden: !o.hidden,
                  })
                }
              >
                {o.hidden ? "Hidden — show" : "Shown — hide"}
              </button>
            </div>
            <ul className="my-3 text-sm">
              {o.contents.map((c) => (
                <li key={c.key}>
                  {c.quantity} × {c.name}
                </li>
              ))}
            </ul>
            <IndicativePrice pricing={o.pricing} />
            <button
              type="button"
              className="mt-3 text-sm underline"
              onClick={() => void preview("gift-option", o.id)}
            >
              Preview hamper image
            </button>
          </article>
        ))}
      </div>
      <h4 className="mb-3 mt-7 font-serif text-xl">
        Customer’s saved selections
      </h4>
      {!data.selections.length && (
        <p className="text-sm text-muted-text">
          The customer hasn’t selected a gift for quoting yet.
        </p>
      )}
      {data.selections.map((s, i) => (
        <article
          key={s.id}
          className="mb-4 rounded-lg border border-border p-4"
        >
          <h5 className="mb-3 font-medium">
            {s.snapshot.label} · version {s.draft_version}{" "}
            {i === 0 ? "· latest selection" : ""}
          </h5>
          <GiftSnapshot document={s.snapshot} />
          <p className="mt-3 text-xs text-muted-text">
            {s.quoted
              ? "A quote is linked to this saved selection."
              : "Awaiting quote."}{" "}
            Later customer drafts do not alter these details.
          </p>
          <button
            type="button"
            className={button + " mt-3"}
            disabled={busy || i !== 0}
            onClick={() => onUseSelection(s)}
          >
            Use this selection in quote
          </button>
        </article>
      ))}
      <details className="mt-5">
        <summary className="text-sm">
          Customer drafts ({data.drafts.length})
        </summary>
        {data.drafts.map((d) => (
          <div key={d.id} className="my-4">
            <h5 className="font-medium">
              {d.document.label}
              {d.hidden ? " · hidden" : ""}
            </h5>
            <GiftSnapshot document={d.document} />
          </div>
        ))}
      </details>
    </section>
  );
}
