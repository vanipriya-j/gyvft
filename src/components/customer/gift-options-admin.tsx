"use client";
/* eslint-disable @next/next/no-img-element -- Local previews use optimised data URLs. */
import { useRef, useState, type FormEvent } from "react";
import { ImagePlus, LoaderCircle, X, Check } from "lucide-react";
import {
  MAX_OPTION_IMAGES,
  optionGallery,
} from "@/lib/customer/option-image-model";
import {
  prepareOptionImage,
  type PreparedOptionImage,
} from "@/lib/customer/option-image-upload";
import type {
  GiftOption,
  GiftSelection,
  SavedGiftDraft,
  GiftContent,
  GiftPricing,
} from "@/lib/customer/gift-workspace-model";
import { GiftSnapshot, IndicativePrice } from "./gift-workspace";
import {
  optionImportExample,
  parseOptionImport,
  type ImportedOption,
} from "@/lib/customer/option-import";
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
const emptyPrice = () => ({
  low: "",
  high: "",
  basis: "per_set",
  quantity: "1",
  packaging: false,
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
    optionImagesReady?: boolean;
    optionDraftsReady?: boolean;
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
    [error, setError] = useState(""),
    [images, setImages] = useState<PreparedOptionImage[]>([]),
    [preparing, setPreparing] = useState(false),
    [publishing, setPublishing] = useState(false),
    [dragging, setDragging] = useState(false),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [priceFields, setPriceFields] = useState(emptyPrice),
    [importText, setImportText] = useState(""),
    [importError, setImportError] = useState(""),
    [imported, setImported] = useState<ImportedOption | null>(null);
  const [editingDraft, setEditingDraft] = useState<GiftOption | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const processing = useRef(false),
    submitting = useRef(false);
  const imageLimit = data.optionImagesReady ? MAX_OPTION_IMAGES : 1;
  const savedImages = editingDraft ? optionGallery(editingDraft) : [];
  const savedImageCount = savedImages.length;
  const disabled = busy || preparing || publishing;
  async function addImages(files: File[]) {
    if (!files.length || processing.current || submitting.current || busy)
      return;
    setError("");
    if (savedImageCount + images.length + files.length > imageLimit) {
      const remaining = imageLimit - savedImageCount - images.length;
      setError(
        remaining > 0
          ? `Add up to ${remaining} more ${remaining === 1 ? "image" : "images"}. Each option can have ${imageLimit}.`
          : images.length
            ? `This option already has ${imageLimit} images. Remove a newly selected image before adding another.`
            : `All ${imageLimit} images are already saved. Create a new option for a different set of images.`,
      );
      return;
    }
    processing.current = true;
    setPreparing(true);
    try {
      const prepared: PreparedOptionImage[] = [];
      for (const file of files) prepared.push(await prepareOptionImage(file));
      setImages((current) => [...current, ...prepared]);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Images could not be prepared. Please try again.",
      );
    } finally {
      processing.current = false;
      setPreparing(false);
    }
  }
  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (processing.current || submitting.current || busy) return;
    setError("");
    const form = e.currentTarget,
      f = new FormData(form);
    const draft =
      !!editingDraft ||
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
        "draft";
    try {
      if (!images.length && !draft)
        throw Error("Add at least one photo or mock-up for this option.");
      submitting.current = true;
      setPublishing(true);
      const price = (v: FormDataEntryValue | null) =>
        v === null || v === "" ? null : Math.round(Number(v) * 100);
      const pricing = {
        mode,
        basis: priceFields.basis,
        quantity: Number(priceFields.quantity || 1),
        low_paise: mode === "none" ? null : price(f.get("low")),
        high_paise: mode === "range" ? price(f.get("high")) : null,
        packaging_included: priceFields.packaging,
      };
      const ok = await perform({
        op: draft ? "save_option_draft" : "publish_gift_option",
        id: projectId,
        title: f.get("title"),
        description: f.get("description") || "",
        contents,
        pricing,
        images: images.map(({ mime, data }) => ({ mime, data })),
        ...(editingDraft
          ? {
              option_id: editingDraft.id,
              expected_version: editingDraft.draft_version || 1,
            }
          : {}),
      });
      if (ok) {
        form.reset();
        setContents([blank()]);
        setMode("none");
        setImages([]);
        setTitle("");
        setDescription("");
        setPriceFields(emptyPrice());
        setImported(null);
        setImportText("");
        setImportError("");
        setEditingDraft(null);
      } else {
        setError(
          "This option wasn’t confirmed. Your entries are still here; check the desk message before retrying.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setPublishing(false);
    }
  }
  return (
    <section className="rounded-xl border border-border bg-paper p-5">
      <h3 className="font-serif text-2xl">
        Gift options & customer selections
      </h3>
      <p className="mt-2 text-sm text-muted-text">
        Bring each option to life with photos or mock-ups and its contents.
        Published contents and indicative prices stay unchanged; Show/Hide only
        changes visibility. Publish a new option to revise one.
      </p>
      <details className="mt-5 rounded-xl border border-border bg-background p-4">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">
          Quick fill · paste JSON or labelled text
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-muted-text">
          Use JSON from GPT, or Title:, Description:, Items:, Price:, Price
          basis:, Sets: and Packaging: labels. Prices are in rupees. Review the
          result before applying it; images stay in place.
        </p>
        <label className="mt-3 block text-sm">
          Option data
          <textarea
            aria-label="Option data"
            className={input + " min-h-40 font-mono text-xs"}
            value={importText}
            maxLength={12000}
            disabled={disabled}
            onChange={(e) => {
              setImportText(e.target.value);
              setImported(null);
              setImportError("");
            }}
            placeholder={
              "Title: Team appreciation kit\nDescription: Made for your team.\nItems:\n- 1 x Branded T-shirt\n- 1 x Journal\n- 1 x Water bottle\nPrice: unpriced"
            }
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={button + " min-h-11"}
            disabled={disabled || !importText.trim()}
            onClick={() => {
              try {
                setImported(parseOptionImport(importText));
                setImportError("");
              } catch (error) {
                setImported(null);
                setImportError(
                  error instanceof Error
                    ? error.message
                    : "Check the pasted option.",
                );
              }
            }}
          >
            Review import
          </button>
          <button
            type="button"
            className={button + " min-h-11"}
            disabled={disabled}
            onClick={() => {
              setImportText(optionImportExample);
              setImported(null);
              setImportError("");
            }}
          >
            Use JSON example
          </button>
        </div>
        {importError && (
          <p role="alert" className="mt-3 text-sm text-action-text">
            {importError}
          </p>
        )}
        {imported && (
          <section
            className="mt-4 rounded-lg border border-olive bg-paper p-4"
            aria-label="Import preview"
          >
            <h4 className="font-medium">{imported.title}</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {imported.description}
            </p>
            <ul className="my-3 text-sm">
              {imported.contents.map((item) => (
                <li key={item.key}>
                  {item.quantity} × {item.name}
                </li>
              ))}
            </ul>
            <IndicativePrice pricing={imported.pricing} />
            <p className="mt-2 text-xs text-muted-text">
              Applying replaces the text, items and price fields in this form.
              It does not publish the option.
            </p>
            <button
              type="button"
              className={button + " mt-3 min-h-11 bg-action text-white"}
              disabled={disabled}
              onClick={() => {
                setTitle(imported.title);
                setDescription(imported.description);
                setContents(
                  imported.contents.map((item) => ({
                    ...item,
                    key: crypto.randomUUID(),
                  })),
                );
                setMode(imported.pricing.mode);
                setPriceFields({
                  low:
                    imported.pricing.low_paise == null
                      ? ""
                      : String(imported.pricing.low_paise / 100),
                  high:
                    imported.pricing.high_paise == null
                      ? ""
                      : String(imported.pricing.high_paise / 100),
                  basis: imported.pricing.basis,
                  quantity: String(imported.pricing.quantity),
                  packaging: imported.pricing.packaging_included,
                });
                setImported(null);
              }}
            >
              Apply to form
            </button>
          </section>
        )}
      </details>
      <form ref={formRef} onSubmit={publish} className="mt-5 space-y-4">
        <fieldset disabled={disabled} className="space-y-4">
          <legend className="font-medium">
            {editingDraft
              ? "Edit a private option draft"
              : "Create a curated option"}
          </legend>
          {editingDraft && (
            <div className="rounded-lg border border-olive bg-background p-3">
              <p className="text-sm font-medium">
                Editing private draft · version{" "}
                {editingDraft.draft_version || 1}
              </p>
              <p className="mt-1 text-xs text-muted-text">
                Save your changes, then review the draft below before
                publishing.
              </p>
              <button
                type="button"
                className={button + " mt-2 min-h-11"}
                onClick={() => {
                  setEditingDraft(null);
                  setTitle("");
                  setDescription("");
                  setContents([blank()]);
                  setMode("none");
                  setPriceFields(emptyPrice());
                  setImages([]);
                }}
              >
                Cancel editing
              </button>
            </div>
          )}
          <label className="block text-sm">
            Option title
            <input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={2}
              maxLength={160}
              className={input}
              placeholder="Option A — A little festive warmth"
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea
              name="description"
              aria-label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              className={input}
            />
          </label>
          <div
            className={`rounded-xl border-2 p-4 outline-none focus-visible:ring-2 focus-visible:ring-olive ${dragging ? "border-olive bg-olive-light" : "border-border bg-background"}`}
            role="group"
            aria-label="Drop or paste option images"
            tabIndex={0}
            aria-disabled={disabled}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) {
                event.preventDefault();
                if (!disabled) setDragging(true);
              }
            }}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void addImages(Array.from(event.dataTransfer.files));
            }}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.files).filter(
                (file) => file.type.startsWith("image/"),
              );
              if (files.length) {
                event.preventDefault();
                void addImages(files);
              }
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Photos & mock-ups</p>
              <span className="text-xs text-muted-text">
                {savedImageCount + images.length} / {imageLimit}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-text">
              The cover appears first. Add close-ups, packaging or other views.
              Images are optimised for viewing.
            </p>
            <p className="mt-2 text-sm">
              Drop images here, choose files below, or click here and paste with
              ⌘V / Ctrl+V.
            </p>
            {savedImageCount > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-text">
                  {savedImageCount} saved images are preserved, including the
                  current cover. New images are added after them.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {savedImages.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      className={button + " min-h-11"}
                      onClick={() => void preview(image.kind, image.id)}
                    >
                      Preview saved{" "}
                      {index === 0 ? "cover" : `image ${index + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((image, index) => (
                  <div
                    key={image.key}
                    className={`relative rounded-lg border bg-paper p-2 ${index === 0 ? "border-olive" : "border-border"}`}
                  >
                    <img
                      src={`data:${image.mime};base64,${image.data}`}
                      alt={image.name}
                      className="aspect-[4/3] w-full rounded object-contain"
                    />
                    <p className="mt-2 truncate text-xs" title={image.name}>
                      {image.name}
                    </p>
                    <button
                      type="button"
                      className={`mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded-md border px-2 text-xs ${index === 0 ? "border-olive bg-olive-light" : "border-border"}`}
                      aria-pressed={index === 0}
                      aria-label={`${savedImageCount ? "Move first" : "Make cover"}: ${image.name}, image ${index + 1}`}
                      disabled={index === 0 || disabled}
                      onClick={() =>
                        setImages((current) => [
                          current[index],
                          ...current.filter((_, n) => n !== index),
                        ])
                      }
                    >
                      {index === 0 ? (
                        <>
                          <Check size={14} />
                          {savedImageCount ? "First new image" : "Cover"}
                        </>
                      ) : savedImageCount ? (
                        "Move first"
                      ) : (
                        "Make cover"
                      )}
                    </button>
                    <button
                      type="button"
                      className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-paper/95"
                      aria-label={`Remove ${image.name}, image ${index + 1}`}
                      disabled={disabled}
                      onClick={() =>
                        setImages((current) =>
                          current.filter((item) => item.key !== image.key),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="mt-4 block text-sm">
              <span className="mb-2 flex items-center gap-2">
                <ImagePlus size={16} />
                {images.length ? "Add more images" : "Add photos or mock-ups"}
              </span>
              <input
                type="file"
                name="images"
                multiple={imageLimit > 1}
                disabled={
                  disabled || savedImageCount + images.length >= imageLimit
                }
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  event.target.value = "";
                  void addImages(files);
                }}
                accept="image/png,image/jpeg,image/webp"
                className={input}
              />
            </label>
            <p className="mt-2 text-xs text-muted-text">
              PNG, JPEG or WebP · up to 10 MB each. Label reference imagery
              clearly in the description.
            </p>
            <p role="status" className="mt-2 text-sm" aria-live="polite">
              {preparing && (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle size={16} className="animate-spin" />
                  Preparing images…
                </span>
              )}
            </p>
            {!data.optionImagesReady && (
              <p className="mt-2 text-xs text-muted-text">
                Single-image publishing is available.{" "}
                <a href="/setup/option-images" className="underline">
                  Activate image galleries
                </a>{" "}
                to add up to {MAX_OPTION_IMAGES}.
              </p>
            )}
          </div>
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
                    value={priceFields.low}
                    onChange={(e) =>
                      setPriceFields((p) => ({ ...p, low: e.target.value }))
                    }
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
                      value={priceFields.high}
                      onChange={(e) =>
                        setPriceFields((p) => ({ ...p, high: e.target.value }))
                      }
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
                  <select
                    name="basis"
                    value={priceFields.basis}
                    onChange={(e) =>
                      setPriceFields((p) => ({ ...p, basis: e.target.value }))
                    }
                    className={input}
                  >
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
                    value={priceFields.quantity}
                    onChange={(e) =>
                      setPriceFields((p) => ({
                        ...p,
                        quantity: e.target.value,
                      }))
                    }
                    required
                    className={input}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="packaging"
                  type="checkbox"
                  checked={priceFields.packaging}
                  onChange={(e) =>
                    setPriceFields((p) => ({
                      ...p,
                      packaging: e.target.checked,
                    }))
                  }
                />
                Packaging is included in this estimate
              </label>
              <p className="text-xs text-muted-text">
                Enter tax-inclusive amounts. Delivery is always separate at
                actuals. This is an estimate, not a quote for approval.
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {data.optionDraftsReady && !editingDraft && (
              <button
                className={button + " min-h-11"}
                value="draft"
                disabled={disabled}
              >
                Save private draft
              </button>
            )}
            <button
              className={button + " min-h-11 bg-action text-white"}
              value={editingDraft ? "draft" : "publish"}
              disabled={disabled}
            >
              {preparing
                ? "Preparing images…"
                : busy || publishing
                  ? "Saving option…"
                  : editingDraft
                    ? "Save draft changes"
                    : "Publish gift option"}
            </button>
          </div>
          <p role="alert" className="text-sm">
            {error}
          </p>
        </fieldset>
      </form>
      <div className="mt-6 space-y-4">
        {data.options
          .filter((o) => !o.published)
          .map((o) => (
            <article
              key={o.id}
              className="rounded-xl border border-olive bg-background p-4"
            >
              <span className="app-badge">
                Private draft · version {o.draft_version || 1}
              </span>
              <h4 className="mt-3 font-medium">{o.title}</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {o.description}
              </p>
              <ul className="my-3 text-sm">
                {o.contents.map((c) => (
                  <li key={c.key}>
                    {c.quantity} × {c.name}
                  </li>
                ))}
              </ul>
              <IndicativePrice pricing={o.pricing} />
              <div className="mt-3 flex flex-wrap gap-2">
                {optionGallery(o).map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    className={button + " min-h-11"}
                    onClick={() => void preview(image.kind, image.id)}
                  >
                    Preview {index === 0 ? "cover" : `image ${index + 1}`}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-text">
                The customer cannot see this draft. Publishing makes it visible
                and sends the option-ready notification.
              </p>
              <button
                type="button"
                className={button + " mt-3 min-h-11"}
                disabled={disabled}
                onClick={() => {
                  setEditingDraft(o);
                  setTitle(o.title);
                  setDescription(o.description);
                  setContents(o.contents);
                  setMode(o.pricing.mode);
                  setPriceFields({
                    low:
                      o.pricing.low_paise == null
                        ? ""
                        : String(o.pricing.low_paise / 100),
                    high:
                      o.pricing.high_paise == null
                        ? ""
                        : String(o.pricing.high_paise / 100),
                    basis: o.pricing.basis,
                    quantity: String(o.pricing.quantity),
                    packaging: o.pricing.packaging_included,
                  });
                  setImages([]);
                  setImported(null);
                  formRef.current
                    ?.querySelector<HTMLInputElement>('input[name="title"]')
                    ?.focus();
                }}
              >
                Edit draft
              </button>
              <button
                type="button"
                className={button + " mt-3 min-h-11 bg-action text-white"}
                disabled={disabled || !o.has_image}
                onClick={() =>
                  void perform({
                    op: "publish_option_draft",
                    id: projectId,
                    option_id: o.id,
                    expected_version: o.draft_version || 1,
                  })
                }
              >
                Publish reviewed draft
              </button>
              {!o.has_image && (
                <p className="mt-2 text-xs text-muted-text">
                  Edit this draft to add an image before publishing.
                </p>
              )}
            </article>
          ))}
        {data.options
          .filter((o) => o.published)
          .map((o) => (
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
              <div
                className="mt-3 flex flex-wrap gap-2"
                aria-label={`Preview images for ${o.title}`}
              >
                {optionGallery(o).map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    className={button + " min-h-11"}
                    onClick={() => void preview(image.kind, image.id)}
                  >
                    {index === 0
                      ? "Preview cover"
                      : `Preview image ${index + 1}`}
                  </button>
                ))}
              </div>
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
