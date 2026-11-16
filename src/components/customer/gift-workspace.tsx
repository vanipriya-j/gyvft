"use client";
/* eslint-disable @next/next/no-img-element -- Private hamper photos are served through an ownership-checked endpoint. */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import {
  Milk,
  Coffee,
  Image as ImageIcon,
  Shirt,
  Magnet,
  Gift,
  ArrowLeft,
  ArrowRight,
  Move,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  catalogue,
  kidsSizes,
  packagingChoices,
  emptyGiftDraft,
  giftEstimate,
  type GiftDraft,
  type GiftOption,
  type SavedGiftDraft,
  type GiftSelection,
  type GiftPricing,
} from "@/lib/customer/gift-workspace-model";
import { money } from "@/lib/customer/model";
import {
  saveWorkspaceDraft,
  submitWorkspaceQuote,
  toggleGiftOption,
} from "@/app/account/projects/[id]/options/actions";
const button =
  "rounded-lg border border-border px-4 py-2.5 text-sm disabled:opacity-50";
const primary = button + " bg-olive-dark text-white";
const field =
  "mt-1 w-full rounded-lg border border-border bg-paper px-3 py-2.5";
const icons = {
  bottle: Milk,
  dabara: Coffee,
  frame: ImageIcon,
  tee: Shirt,
  magnet: Magnet,
};
type Data = {
  options: GiftOption[];
  drafts: SavedGiftDraft[];
  selections: GiftSelection[];
};
export function IndicativePrice({ pricing }: { pricing: GiftPricing }) {
  if (pricing.mode === "none")
    return <p className="text-sm text-muted-text">Price on request</p>;
  return (
    <div className="space-y-1 text-sm">
      <p>
        {pricing.mode === "range"
          ? `${money(pricing.low_paise!)}–${money(pricing.high_paise!)}`
          : `Around ${money(pricing.low_paise!)}`}{" "}
        {pricing.basis === "per_set" ? "per gift set" : "for the order"}{" "}
        <span className="text-xs text-muted-text">· Indicative</span>
      </p>
      <p className="text-xs text-muted-text">
        Based on {pricing.quantity} gift sets · applicable taxes included
      </p>
      <p className="text-xs text-muted-text">
        Packaging {pricing.packaging_included ? "included" : "additional"}.
        Delivery separate at actuals.
      </p>
    </div>
  );
}
export function GiftSnapshot({ document }: { document: GiftDraft }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        {document.recipients} recipients · quantities below are per recipient
      </p>
      <ul className="divide-y divide-border">
        {document.lines.map((l) => (
          <li className="py-2" key={l.key}>
            {l.quantity} × {l.name}
            <span className="block text-xs text-muted-text">
              {Object.values(l.variants).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      <p>
        Design:{" "}
        {document.design === "custom"
          ? "Custom design requested"
          : document.design === "suggested"
            ? "Shared design direction requested"
            : "Existing product designs"}
      </p>
      {document.design_notes && (
        <p className="whitespace-pre-wrap">{document.design_notes}</p>
      )}
      {document.personalisation && (
        <p className="whitespace-pre-wrap">
          Personalisation: {document.personalisation}
        </p>
      )}
      <p>Packaging: {document.packaging}</p>
      {document.notes && (
        <p className="whitespace-pre-wrap">{document.notes}</p>
      )}
      {document.extra_budget_paise !== null && (
        <p>
          Requested addition: within {money(document.extra_budget_paise)} per
          recipient · {document.extra_idea}
        </p>
      )}
    </div>
  );
}
export function GiftWorkspace({
  projectId,
  initial,
  readOnly,
}: {
  projectId: string;
  initial: Data;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [options, setOptions] = useState(initial.options),
    [drafts, setDrafts] = useState(initial.drafts),
    [selections, setSelections] = useState(initial.selections);
  const [screen, setScreen] = useState<"options" | "workspace">("options"),
    [showHidden, setShowHidden] = useState(false),
    [active, setActive] = useState<SavedGiftDraft | null>(null),
    [doc, setDoc] = useState<GiftDraft>(emptyGiftDraft()),
    [step, setStep] = useState(0),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(false);
  const [product, setProduct] = useState<string | null>(null),
    [editKey, setEditKey] = useState<string | null>(null),
    [variants, setVariants] = useState<Record<string, string>>({}),
    [undo, setUndo] = useState<GiftDraft[]>([]);
  const draftRows = useRef(initial.drafts);
  const track = useRef<HTMLDivElement>(null),
    opLock = useRef(false),
    saveTask = useRef<Promise<SavedGiftDraft | null> | null>(null),
    versions = useRef(new Map(initial.drafts.map((d) => [d.id, d.version]))),
    saved = useRef(
      new Map(initial.drafts.map((d) => [d.id, JSON.stringify(d.document)])),
    );
  const live = useRef({ active, doc });
  useLayoutEffect(() => {
    live.current = { active, doc };
  }, [active, doc]);
  function edit(next: GiftDraft) {
    setUndo((u) => [...u.slice(-9), doc]);
    setDoc(next);
  }
  async function persist(): Promise<SavedGiftDraft | null> {
    if (saveTask.current) {
      await saveTask.current;
      return persist();
    }
    const state = live.current;
    if (!state.active || readOnly) return null;
    const hash = JSON.stringify(state.doc);
    if (saved.current.get(state.active.id) === hash)
      return {
        ...state.active,
        version: versions.current.get(state.active.id)!,
        document: state.doc,
      };
    setSaving(true);
    const task = (async () => {
      try {
        const result = await saveWorkspaceDraft(
          projectId,
          state.active!.id,
          versions.current.get(state.active!.id) || 0,
          state.doc,
        );
        if (!result.ok) {
          setMessage(result.message);
          setSaveError(true);
          return null;
        }
        versions.current.set(result.draft.id, result.draft.version);
        saved.current.set(result.draft.id, hash);
        const row = {
          ...result.draft,
          hidden:
            draftRows.current.find((d) => d.id === result.draft.id)?.hidden ||
            false,
        };
        draftRows.current = [
          row,
          ...draftRows.current.filter((d) => d.id !== row.id),
        ];
        setDrafts(draftRows.current);
        setSaveError(false);
        return result.draft;
      } catch {
        setMessage(
          "The save could not be confirmed. Reload to check your saved draft before retrying.",
        );
        setSaveError(true);
        return null;
      } finally {
        setSaving(false);
        saveTask.current = null;
      }
    })();
    saveTask.current = task;
    return task;
  }
  useEffect(() => {
    if (!active || readOnly || saveError) return;
    const t = setTimeout(() => void persist(), 800);
    return () =>
      clearTimeout(
        t,
      ); /* persist reads the current draft and serialises writes; avoid stale closures. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, active, readOnly, saveError]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (
        live.current.active &&
        saved.current.get(live.current.active.id) !==
          JSON.stringify(live.current.doc)
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    const leave = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (
        !link ||
        link.target === "_blank" ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const url = new URL(link.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        !live.current.active ||
        saved.current.get(live.current.active.id) ===
          JSON.stringify(live.current.doc)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void persist().then((row) => {
        if (row) router.push(url.pathname + url.search + url.hash);
      });
    };
    document.addEventListener("click", leave, true);
    return () => document.removeEventListener("click", leave, true);
    // persist reads live draft/version refs; the route identity is fixed for this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
  async function act(fn: () => Promise<void>) {
    if (opLock.current) return;
    opLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch {
      setMessage(
        "We could not confirm that action. Reload to check before retrying.",
      );
    } finally {
      opLock.current = false;
      setBusy(false);
    }
  }
  async function switchDraft(row: SavedGiftDraft) {
    await act(async () => {
      if (active && !(await persist())) return;
      setActive(row);
      setDoc(row.document);
      setUndo([]);
      setScreen("workspace");
      setStep(0);
    });
  }
  async function create(from?: GiftOption, copy?: GiftDraft) {
    await act(async () => {
      if (active && !activeQuoted && !(await persist())) return;
      if (draftRows.current.length >= 12) {
        setMessage("You can keep up to 12 alternatives for this request.");
        return;
      }
      const count = Math.max(options.length, 2) + draftRows.current.length;
      const label =
        count < 26
          ? `Option ${String.fromCharCode(65 + count)}`
          : `Your option ${draftRows.current.length + 1}`;
      let next = copy ? structuredClone(copy) : emptyGiftDraft(label);
      next.label = label;
      if (from) {
        next = {
          ...next,
          based_on: from.id,
          recipients: from.pricing.quantity,
          lines: from.contents.map((item) => ({
            key: crypto.randomUUID(),
            source: {
              kind: "curated" as const,
              optionId: from.id,
              key: item.key,
            },
            name: item.name,
            unit_paise: item.unit_paise,
            quantity: item.quantity,
            variants: {},
          })),
        };
      }
      const row = {
        id: crypto.randomUUID(),
        version: 0,
        document: next,
        updated_at: new Date().toISOString(),
        hidden: false,
      };
      setActive(row);
      setDoc(next);
      setScreen("workspace");
      setStep(0);
      setUndo([]);
      setSaveError(false);
    });
  }
  async function goOptions() {
    await act(async () => {
      if (active && !(await persist())) return;
      setScreen("options");
    });
  }
  async function visibility(
    id: string,
    kind: "curated" | "draft",
    hidden: boolean,
  ) {
    await act(async () => {
      const r = await toggleGiftOption(projectId, id, kind, hidden);
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      if (kind === "curated")
        setOptions((os) => os.map((o) => (o.id === id ? { ...o, hidden } : o)));
      else {
        draftRows.current = draftRows.current.map((d) =>
          d.id === id ? { ...d, hidden } : d,
        );
        setDrafts(draftRows.current);
      }
    });
  }
  function addProduct(id: string, key?: string) {
    const p = catalogue.find((p) => p.id === id);
    if (!p || readOnly) return;
    const fields = p.fields as Record<string, readonly string[]>;
    if (!Object.keys(fields).length) {
      edit({
        ...doc,
        lines: [
          ...doc.lines,
          {
            key: crypto.randomUUID(),
            source: { kind: "catalogue", id },
            quantity: 1,
            name: p.name,
            unit_paise: null,
            variants: {},
          },
        ],
      });
      return;
    }
    setProduct(id);
    setEditKey(key || null);
    setVariants(
      key
        ? doc.lines.find((l) => l.key === key)!.variants
        : Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0]])),
    );
  }
  function confirmProduct(e: FormEvent) {
    e.preventDefault();
    const p = catalogue.find((p) => p.id === product)!;
    const line = {
      key: editKey || crypto.randomUUID(),
      source: { kind: "catalogue" as const, id: p.id },
      quantity: 1,
      name: p.name,
      unit_paise: null,
      variants,
    };
    edit({
      ...doc,
      lines: editKey
        ? doc.lines.map((l) =>
            l.key === editKey ? { ...line, quantity: l.quantity } : l,
          )
        : [...doc.lines, line],
    });
    setProduct(null);
  }
  async function requestQuote() {
    await act(async () => {
      const row = await persist();
      if (!row) return;
      const r = await submitWorkspaceQuote(
        projectId,
        row.id,
        row.version,
        crypto.randomUUID(),
      );
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      setSelections((ss) => [
        { ...r.selection, quoted: false },
        ...ss.filter((s) => s.id !== r.selection.id),
      ]);
      setMessage(
        "Your selected gift is with GYVFT. We’ll confirm availability and send a separate itemised quote.",
      );
    });
  }
  const estimate = giftEstimate(doc),
    source = options.find((o) => o.id === doc.based_on),
    itemProduct = catalogue.find((p) => p.id === product),
    latest = selections[0];
  const activeQuoted = selections.some(
    (s) => s.draft_id === active?.id && s.quoted,
  );
  const disabled = readOnly || busy;
  const hiddenCount =
    options.filter((o) => o.hidden).length +
    drafts.filter((d) => d.hidden).length;
  return (
    <div className="space-y-7">
      <p role="status" className="text-sm text-muted-text">
        {message}
      </p>
      {readOnly && (
        <p className="rounded-lg bg-surface p-4 text-sm">
          {initial.options.length
            ? "Options remain available for reference."
            : "This request is read-only."}{" "}
          Message the team to discuss changes.
        </p>
      )}
      {screen === "options" ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl">Your gift options</h2>
              <p className="mt-2 text-muted-text">
                Explore our curated hampers, or build an option of your own.
              </p>
            </div>
            <button
              className={primary}
              disabled={disabled}
              onClick={() => void create()}
            >
              Build my option
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            Show hidden options{hiddenCount ? ` (${hiddenCount})` : ""}
          </label>
          <div className="grid gap-7 md:grid-cols-2">
            {options
              .filter((o) => showHidden || !o.hidden)
              .map((o, index) => (
                <article
                  key={o.id}
                  className="min-w-0 border-b border-border pb-6"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-serif text-2xl">{o.title}</h3>
                    <Visibility
                      hidden={o.hidden}
                      disabled={disabled}
                      change={() => void visibility(o.id, "curated", !o.hidden)}
                    />
                  </div>
                  {o.has_image && (
                    <img
                      src={`/api/customer-assets/gift-option/${o.id}`}
                      alt={`${o.title} hamper visual`}
                      className="aspect-[4/3] w-full rounded-lg object-contain bg-surface"
                    />
                  )}
                  <p className="my-4 whitespace-pre-wrap text-sm text-muted-text">
                    {o.description}
                  </p>
                  <h4 className="text-xs uppercase tracking-widest text-olive">
                    Contents · per recipient
                  </h4>
                  <ul className="my-3 space-y-2 text-sm">
                    {o.contents.map((l) => (
                      <li key={l.key} className="flex justify-between gap-3">
                        <span>{l.name}</span>
                        <span>× {l.quantity}</span>
                      </li>
                    ))}
                  </ul>
                  <IndicativePrice pricing={o.pricing} />
                  <button
                    className={button + " mt-5"}
                    disabled={disabled}
                    onClick={() => void create(o)}
                  >
                    Make my own from {String.fromCharCode(65 + index)}
                  </button>
                </article>
              ))}
            {drafts
              .filter((d) => showHidden || !d.hidden)
              .map((d) => (
                <article
                  key={d.id}
                  className="rounded-lg border border-border p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-serif text-2xl">
                      {d.document.label} · yours
                    </h3>
                    <Visibility
                      hidden={d.hidden}
                      disabled={disabled}
                      change={() => void visibility(d.id, "draft", !d.hidden)}
                    />
                  </div>
                  <p className="my-3 text-sm text-muted-text">
                    {selections.some((s) => s.draft_id === d.id && s.quoted)
                      ? "Quote published · customise as a new alternative"
                      : d.document.based_on
                        ? "Customised alternative · awaiting revised estimate"
                        : "Your own option · estimate to be confirmed"}
                  </p>
                  <GiftSnapshot document={d.document} />
                  <button
                    className={button + " mt-4"}
                    disabled={disabled}
                    onClick={() =>
                      void (selections.some(
                        (s) => s.draft_id === d.id && s.quoted,
                      )
                        ? create(undefined, d.document)
                        : switchDraft(d))
                    }
                  >
                    {selections.some((s) => s.draft_id === d.id && s.quoted)
                      ? "Customise as a new option"
                      : "Open workspace"}
                  </button>
                  <button
                    className={button + " ml-2 mt-4"}
                    disabled={disabled}
                    onClick={() => void create(undefined, d.document)}
                  >
                    Create an alternative
                  </button>
                </article>
              ))}
          </div>
          {!options.length && !drafts.length && (
            <p className="rounded-lg bg-surface p-5 text-sm">
              GYVFT hasn’t published options yet. You can start your own option
              now.
            </p>
          )}
          {hiddenCount > 0 && !showHidden && (
            <p className="text-sm text-muted-text">
              Hidden options are saved. Turn on “Show hidden options” to restore
              them.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              className={button}
              onClick={() => void goOptions()}
              disabled={busy}
            >
              ← Back to options
            </button>
            <span className="flex items-center gap-2 text-xs text-muted-text">
              {saving && <LoaderCircle size={15} className="animate-spin" />}
              {saving
                ? "Saving…"
                : saveError
                  ? "Save needs attention"
                  : "Draft changes save automatically"}
              <button
                className="underline"
                disabled={disabled || saving || activeQuoted}
                onClick={() => void persist()}
              >
                Save now
              </button>
            </span>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <h2 className="font-serif text-2xl">Our options</h2>
              {options
                .filter((o) => !o.hidden || showHidden)
                .map((o) => (
                  <article key={o.id} className="border-b border-border pb-4">
                    {o.has_image && (
                      <img
                        className="mb-2 aspect-[4/3] w-full rounded-lg object-contain"
                        src={`/api/customer-assets/gift-option/${o.id}`}
                        alt={o.title}
                      />
                    )}
                    <h3 className="font-serif text-lg">{o.title}</h3>
                    <button
                      className={button + " mt-2"}
                      disabled={disabled}
                      onClick={() => void create(o)}
                    >
                      Start an alternative
                    </button>
                  </article>
                ))}
              <button
                className={primary}
                disabled={disabled}
                onClick={() => void create()}
              >
                Create my own option
              </button>
            </aside>
            <section className="min-w-0">
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="font-serif text-2xl">Your workspace</h2>
                <button
                  className={button}
                  disabled={disabled || !undo.length}
                  onClick={() => {
                    setDoc(undo[undo.length - 1]);
                    setUndo((u) => u.slice(0, -1));
                  }}
                >
                  Undo
                </button>
              </div>
              <nav
                aria-label="Build your gift"
                className="my-5 flex flex-wrap gap-2"
              >
                {["Products", "Design", "Packaging", "Review"].map(
                  (name, i) => (
                    <button
                      key={name}
                      className={button + (step === i ? " bg-surface" : "")}
                      aria-current={step === i ? "step" : undefined}
                      onClick={() => setStep(i)}
                    >
                      {i + 1}. {name}
                    </button>
                  ),
                )}
              </nav>
              {source && (
                <div className="mb-5 rounded-lg bg-surface p-4 text-sm">
                  <p>Based on {source.title} · original option unchanged</p>
                  <p className="my-2 font-medium">
                    Awaiting revised estimate · changes will be requoted
                  </p>
                  <details>
                    <summary>Original price reference</summary>
                    <IndicativePrice pricing={source.pricing} />
                  </details>
                </div>
              )}
              {activeQuoted && (
                <div className="mb-4 rounded-lg bg-surface p-4 text-sm">
                  This option has a published quote and stays unchanged.{" "}
                  <button
                    className="underline"
                    disabled={disabled}
                    onClick={() => void create(undefined, doc)}
                  >
                    Create an alternative to customise it
                  </button>
                </div>
              )}
              <fieldset
                disabled={disabled || activeQuoted}
                className="min-w-0 space-y-5"
              >
                <legend className="sr-only">Edit your gift option</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Option name
                    <input
                      className={field}
                      value={doc.label}
                      maxLength={60}
                      onChange={(e) => edit({ ...doc, label: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    Number of recipients
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      className={field}
                      value={doc.recipients}
                      onChange={(e) =>
                        edit({ ...doc, recipients: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                {step === 0 && (
                  <>
                    <div
                      className="min-w-0 rounded-xl border border-dashed border-border p-4 md:p-5"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!disabled)
                          addProduct(
                            e.dataTransfer.getData("application/gyvft-product"),
                          );
                      }}
                    >
                      <h3 className="font-serif text-2xl">
                        {doc.label} · make it yours
                      </h3>
                      <p className="mt-1 text-xs text-muted-text">
                        Quantities are per recipient. Drag products here or use
                        Choose & add.
                      </p>
                      {!doc.lines.length && (
                        <div className="my-5 rounded-lg bg-surface p-8 text-center">
                          <Move className="mx-auto mb-3" />
                          <h4 className="font-serif text-xl">
                            Your gift starts here
                          </h4>
                          <p className="mt-2 text-sm">
                            Pick products from the carousel below.
                          </p>
                        </div>
                      )}
                      <div className="my-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {doc.lines.map((l) => {
                          const Icon =
                            l.source.kind === "catalogue"
                              ? icons[l.source.id as keyof typeof icons] || Gift
                              : Gift;
                          return (
                            <article key={l.key} className="min-w-0">
                              <div className="grid h-28 place-items-center rounded-lg bg-surface">
                                <Icon size={40} strokeWidth={1.3} />
                              </div>
                              <h4 className="mt-2 text-sm">{l.name}</h4>
                              <p className="mt-1 text-xs text-muted-text">
                                {Object.values(l.variants).join(" · ")}
                              </p>
                              <label className="mt-2 block text-xs">
                                Per recipient
                                <input
                                  className={field}
                                  type="number"
                                  min="1"
                                  max="1000"
                                  value={l.quantity}
                                  onChange={(e) =>
                                    edit({
                                      ...doc,
                                      lines: doc.lines.map((v) =>
                                        v.key === l.key
                                          ? {
                                              ...v,
                                              quantity: Number(e.target.value),
                                            }
                                          : v,
                                      ),
                                    })
                                  }
                                />
                              </label>
                              {l.source.kind === "catalogue" &&
                                l.source.id !== "magnet" && (
                                  <button
                                    className="mt-2 text-xs underline"
                                    type="button"
                                    onClick={() =>
                                      addProduct(
                                        l.source.kind === "catalogue"
                                          ? l.source.id
                                          : "",
                                        l.key,
                                      )
                                    }
                                  >
                                    Product options
                                  </button>
                                )}
                              <button
                                type="button"
                                className="ml-3 mt-2 text-xs underline"
                                onClick={() =>
                                  edit({
                                    ...doc,
                                    lines: doc.lines.filter(
                                      (v) => v.key !== l.key,
                                    ),
                                  })
                                }
                              >
                                Remove
                              </button>
                            </article>
                          );
                        })}
                      </div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-serif text-xl">
                          Pick your products
                        </h4>
                        <div className="flex gap-2">
                          {[-1, 1].map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={button}
                              aria-label={
                                n < 0 ? "Previous products" : "Next products"
                              }
                              onClick={() =>
                                track.current?.scrollBy({
                                  left: n * 280,
                                  behavior: window.matchMedia(
                                    "(prefers-reduced-motion: reduce)",
                                  ).matches
                                    ? "instant"
                                    : "smooth",
                                })
                              }
                            >
                              {n < 0 ? (
                                <ArrowLeft size={16} />
                              ) : (
                                <ArrowRight size={16} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div
                        ref={track}
                        className="flex max-w-full gap-3 overflow-x-auto pb-3"
                      >
                        {catalogue.map((p) => {
                          const Icon = icons[p.id];
                          return (
                            <article
                              key={p.id}
                              draggable={!disabled}
                              onDragStart={(e) =>
                                e.dataTransfer.setData(
                                  "application/gyvft-product",
                                  p.id,
                                )
                              }
                              className="flex w-32 shrink-0 flex-col items-center gap-2 rounded-lg border border-border p-3 text-center"
                            >
                              <Icon size={34} strokeWidth={1.3} />
                              <h5 className="text-sm">{p.name}</h5>
                              <p className="text-xs text-muted-text">
                                Price in your quote
                              </p>
                              <button
                                type="button"
                                className={button + " mt-auto px-2 text-xs"}
                                onClick={() => addProduct(p.id)}
                              >
                                Choose & add
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                    <p className="rounded-lg bg-surface p-4 text-sm">
                      <strong>Keep a little aside for packaging.</strong>
                      <br />
                      Packaging is additional and depends on your hamper’s size
                      and your choice. Delivery is separate, at actuals.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        Add a little more · budget per recipient (₹)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={field}
                          value={
                            doc.extra_budget_paise === null
                              ? ""
                              : doc.extra_budget_paise / 100
                          }
                          onChange={(e) =>
                            edit({
                              ...doc,
                              extra_budget_paise:
                                e.target.value === ""
                                  ? null
                                  : Math.round(Number(e.target.value) * 100),
                            })
                          }
                        />
                      </label>
                      <label className="text-sm">
                        What would you like to add?
                        <input
                          className={field}
                          maxLength={500}
                          placeholder="Something useful within ₹50"
                          value={doc.extra_idea}
                          onChange={(e) =>
                            edit({ ...doc, extra_idea: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <p className="text-xs text-muted-text">
                      We’ll recommend suitable additions within this budget.
                      Nothing is added automatically.
                    </p>
                  </>
                )}
                {step === 1 && (
                  <>
                    <label className="block text-sm">
                      Design approach
                      <select
                        className={field}
                        value={doc.design}
                        onChange={(e) =>
                          edit({
                            ...doc,
                            design: e.target.value as GiftDraft["design"],
                          })
                        }
                      >
                        <option value="existing">
                          Keep existing product designs
                        </option>
                        <option value="suggested">
                          Ask for a shared design direction
                        </option>
                        <option value="custom">Request a custom design</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      Design notes
                      <textarea
                        className={field}
                        rows={4}
                        maxLength={2000}
                        value={doc.design_notes}
                        onChange={(e) =>
                          edit({ ...doc, design_notes: e.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      Individual names or messages
                      <textarea
                        className={field}
                        rows={3}
                        maxLength={2000}
                        value={doc.personalisation}
                        onChange={(e) =>
                          edit({ ...doc, personalisation: e.target.value })
                        }
                      />
                    </label>
                    <p className="text-sm text-muted-text">
                      Standard product printing is included in product prices.
                      Individual names/messages are additional per personalised
                      print. For orders above ₹4,000 excluding delivery, one
                      shared design direction and a minor change are
                      complimentary; smaller orders: let’s discuss. Final design
                      details and charges are confirmed in the quote.
                    </p>
                  </>
                )}
                {step === 2 && (
                  <>
                    <label className="block text-sm">
                      Packaging preference
                      <select
                        className={field}
                        value={doc.packaging}
                        onChange={(e) =>
                          edit({
                            ...doc,
                            packaging: e.target.value as GiftDraft["packaging"],
                          })
                        }
                      >
                        {packagingChoices.map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <p className="text-sm text-muted-text">
                      Packaging charges depend on your hamper’s size and will be
                      confirmed separately in the quote. Delivery is at actuals.
                    </p>
                    <label className="block text-sm">
                      Anything else we should know?
                      <textarea
                        className={field}
                        rows={3}
                        maxLength={2000}
                        value={doc.notes}
                        onChange={(e) =>
                          edit({ ...doc, notes: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {step === 3 && (
                  <div className="rounded-lg border border-border p-5">
                    <h3 className="mb-4 font-serif text-2xl">
                      Review {doc.label}
                    </h3>
                    <GiftSnapshot document={doc} />
                    <p className="my-4 text-sm text-muted-text">
                      Applicable taxes are included in the formal quote.
                      Products, custom design, personalisation, packaging and
                      delivery will be confirmed before approval. No payment is
                      taken now.
                    </p>
                    <button
                      className={primary}
                      disabled={!doc.lines.length || saving}
                      onClick={() => void requestQuote()}
                    >
                      Select this option & request quote
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                  <p className="text-sm">
                    {estimate.unknown
                      ? "Product estimate awaiting confirmation"
                      : `Product estimate ${money(estimate.perRecipient)} / recipient · ${money(estimate.total)} total`}
                    <span className="block text-xs text-muted-text">
                      Packaging, additional personalisation and delivery
                      confirmed separately.
                    </span>
                  </p>
                  {step < 3 && (
                    <button
                      className={primary}
                      disabled={!doc.lines.length}
                      onClick={() => setStep((s) => s + 1)}
                    >
                      Continue to {["Design", "Packaging", "Review"][step]} →
                    </button>
                  )}
                </div>
              </fieldset>
            </section>
          </div>
        </>
      )}
      {latest && (
        <section className="rounded-xl border-2 border-olive p-5">
          <div className="mb-4 flex flex-wrap justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-olive">
                Your selected gift
              </p>
              <h2 className="mt-2 font-serif text-2xl">
                {latest.snapshot.label}
              </h2>
            </div>
            <p className="text-sm">
              {latest.quoted
                ? "Quote published · review it in your request"
                : "Selected for quote · awaiting GYVFT"}
            </p>
          </div>
          <GiftSnapshot document={latest.snapshot} />
          <p className="mt-4 text-xs text-muted-text">
            Saved version {latest.draft_version}. Later experiments do not
            change this selection.
          </p>
          <a
            className="mt-3 inline-block text-sm underline"
            href={`/account/projects/${projectId}`}
          >
            View request, quotes & messages →
          </a>
        </section>
      )}
      <Dialog.Root
        open={product !== null}
        onOpenChange={(v) => {
          if (!v) setProduct(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-paper p-6">
            <div className="flex items-center justify-between">
              <Dialog.Title className="font-serif text-2xl">
                {itemProduct?.name}
              </Dialog.Title>
              <Dialog.Close aria-label="Close product options">
                <X size={20} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="my-3 text-sm text-muted-text">
              Choose the product details. Design and personalisation come next.
            </Dialog.Description>
            <form onSubmit={confirmProduct} className="space-y-4">
              {Object.entries(itemProduct?.fields || {}).map(([k, v]) => {
                const choices =
                  k === "Size" && product === "tee" && variants.For === "Kids"
                    ? kidsSizes
                    : (v as readonly string[]);
                return (
                  <label key={k} className="block text-sm">
                    {k}
                    <select
                      className={field}
                      aria-label={k}
                      value={variants[k] || choices[0]}
                      onChange={(e) =>
                        setVariants((old) => ({
                          ...old,
                          [k]: e.target.value,
                          ...(product === "tee" && k === "For"
                            ? {
                                Size:
                                  e.target.value === "Kids"
                                    ? kidsSizes[0]
                                    : "S",
                              }
                            : {}),
                        }))
                      }
                    >
                      {choices.map((choice) => (
                        <option key={choice}>{choice}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
              <button className={primary} type="submit">
                {editKey ? "Update product" : `Add to ${doc.label}`}
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
function Visibility({
  hidden,
  disabled,
  change,
}: {
  hidden: boolean;
  disabled: boolean;
  change: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!hidden}
      aria-label="Show option"
      disabled={disabled}
      onClick={change}
      className="flex shrink-0 items-center gap-2 text-xs disabled:opacity-50"
    >
      <span
        className={
          "relative block h-5 w-9 rounded-full " +
          (hidden ? "bg-border" : "bg-olive")
        }
      >
        <span
          className={
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform " +
            (hidden ? "left-0.5" : "left-0.5 translate-x-4")
          }
        />
      </span>
      {hidden ? "Hidden" : "Shown"}
    </button>
  );
}
