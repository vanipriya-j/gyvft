"use client";
/* eslint-disable @next/next/no-img-element -- Private previews require session cookies; feed images are already validated. */
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  X,
} from "lucide-react";
import type { CustomerHome, HomeSection } from "@/lib/customer/home";
import type { Page, SavedIdea } from "@/lib/customer/home-model";
import { money } from "@/lib/customer/model";
import styles from "./home.module.css";
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
type Sections = CustomerHome["sections"];
type Product = NonNullable<
  Extract<Sections["aarla"], { status: "ready" }>
>["data"]["items"][number];
type Card = NonNullable<
  Extract<Sections["gifts"], { status: "ready" }>
>["data"]["items"][number];
type Occasion = NonNullable<
  Extract<Sections["occasions"], { status: "ready" }>
>["data"]["items"][number];
async function getSection(name: string, offset = 0, limit = 6) {
  const response = await fetch(
    `/api/customer/home?section=${name}&offset=${offset}&limit=${limit}`,
    { cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw Error(result.error?.message || "Please try again shortly.");
  return result.data.sections[name];
}
function useCarousel<T>(name: string, initial?: HomeSection<Page<T>>) {
  const [cache, setCache] = useState(
    () =>
      new Map<number, T>(
        initial?.status === "ready"
          ? initial.data.items.map((item, i) => [initial.data.offset + i, item])
          : [],
      ),
  );
  const [total, setTotal] = useState(
      initial?.status === "ready" ? initial.data.total : 0,
    ),
    [index, setIndex] = useState(0),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function move(direction: number) {
    if (pending || total < 2) return;
    const target = (index + direction + total) % total;
    if (cache.has(target)) {
      setIndex(target);
      setError("");
      return;
    }
    setPending(true);
    setError("");
    try {
      const section = await getSection(name, target, 1);
      if (section?.status !== "ready")
        throw Error("This section couldn’t load. Please try again.");
      setTotal(section.data.total);
      if (section.data.items[0]) {
        setCache((previous) =>
          new Map(previous).set(target, section.data.items[0]),
        );
        setIndex(target);
      } else {
        setCache(new Map());
        setIndex(0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  return {
    item: cache.get(index) || null,
    total,
    index,
    pending,
    error,
    move,
  };
}
function Pager({
  name,
  carousel,
}: {
  name: string;
  carousel: {
    total: number;
    index: number;
    pending: boolean;
    move: (direction: number) => void;
  };
}) {
  if (carousel.total < 2) return null;
  return (
    <div className={styles.pager}>
      <button
        disabled={carousel.pending}
        aria-label={`Previous ${name}`}
        onClick={() => carousel.move(-1)}
      >
        <ChevronLeft size={19} />
      </button>
      <span className={styles.live} aria-live="polite">
        {name} {carousel.index + 1} of {carousel.total}
      </span>
      {carousel.pending && (
        <LoaderCircle size={14} className="animate-spin" aria-label="Loading" />
      )}
      <button
        disabled={carousel.pending}
        aria-label={`Next ${name}`}
        onClick={() => carousel.move(1)}
      >
        <ChevronRight size={19} />
      </button>
    </div>
  );
}
type PlaceholderKind = "gift" | "occasion" | "aarla";
const placeholderPhotos = {
  gift: {
    src: "/images/gyvft/homepage/02-gifts-keepsakes.png",
    alt: "Gifting inspiration: a thoughtful gift shared with a loved one",
    className: styles.giftPhoto,
  },
  occasion: {
    src: "/images/gyvft/homepage/05-celebrate.png",
    alt: "Celebration inspiration: family sharing a special moment",
    className: styles.occasionPhoto,
  },
  aarla: {
    src: "/images/gyvft/homepage/04-merchandise-kits.png",
    alt: "Aarla gifting inspiration with a printed tote and bottle",
    className: styles.cataloguePhoto,
  },
};
function PlaceholderPhoto({
  kind,
  label,
  wide = false,
}: {
  kind: PlaceholderKind;
  label?: string;
  wide?: boolean;
}) {
  const photo = placeholderPhotos[kind];
  return (
    <span
      className={`${styles.placeholderPhoto} ${photo.className}`}
      data-placeholder-kind={kind}
    >
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={
          wide
            ? "(max-width:1023px) 100vw, 40vw"
            : "(max-width:1023px) 105px, 40vw"
        }
      />
      {label && <span className={styles.placeholderLabel}>{label}</span>}
    </span>
  );
}
function SafeImage({
  src,
  alt,
  lazy = false,
  fallback = "gift",
}: {
  fallback?: PlaceholderKind;
  src: string;
  alt: string;
  lazy?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <PlaceholderPhoto kind={fallback} label="Image unavailable" />;
  // Public catalogue images use the existing same-origin optimizer and CSP.
  // Private asset routes require the browser cookie, so those stay native.
  return src.startsWith("https://") ? (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width:1023px) 105px, 30vw"
      onError={() => setFailed(true)}
    />
  ) : (
    <img
      src={src}
      alt={alt}
      loading={lazy ? "lazy" : undefined}
      ref={(image) => {
        // A private image may fail before React attaches its error listener.
        if (image?.complete && image.naturalWidth === 0) setFailed(true);
      }}
      onError={() => setFailed(true)}
    />
  );
}
function Missing({
  section,
  empty,
  href,
  label,
  media,
}: {
  media?: PlaceholderKind;
  section?: { status: string };
  empty: string;
  href: string;
  label: string;
}) {
  const router = useRouter();
  const ready = section?.status === "ready";
  return (
    <>
      {media && (
        <div className={styles.missingMedia}>
          <PlaceholderPhoto kind={media} label="Inspiration" wide />
        </div>
      )}
      <div className={styles.empty}>
        <h3>{ready ? empty : "Temporarily unavailable"}</h3>
        {!ready ? (
          <>
            <p>
              {section?.status === "setup_required"
                ? "GYVFT is finishing an update to this feature."
                : "Your information couldn’t load. Please try again."}
            </p>
            <button className={styles.retry} onClick={() => router.refresh()}>
              Try again
            </button>
          </>
        ) : (
          <Link href={href} className={styles.link}>
            {label} →
          </Link>
        )}
      </div>
    </>
  );
}
async function writeSaved(
  kind: "story" | "product",
  id: string,
  saved: boolean,
) {
  const response = await fetch("/api/customer/saved-ideas", {
    method: saved ? "PUT" : "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, id }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw Error(
      result.error?.message || "Your idea couldn’t be saved. Please try again.",
    );
}
function SaveButton({
  id,
  kind,
  title,
  saved,
  onSaved,
  icon = false,
}: {
  id: string;
  kind: "story" | "product";
  title: string;
  saved: boolean;
  onSaved: (saved: boolean) => void;
  icon?: boolean;
}) {
  const [active, setActive] = useState(saved),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function save() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await writeSaved(kind, id, !active);
      setActive(!active);
      onSaved(!active);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button
        className={icon ? styles.bookmark : styles.link}
        aria-label={`${active ? "Remove saved" : "Save"} ${title}`}
        aria-pressed={active}
        disabled={pending}
        onClick={save}
      >
        {pending ? (
          <LoaderCircle size={16} className="animate-spin" />
        ) : (
          <Bookmark size={16} fill={active ? "currentColor" : "none"} />
        )}
        {!icon && (active ? "Saved" : "Save this direction")}
      </button>
      {error && (
        <p role="status" className={icon ? styles.imageError : styles.feedback}>
          {error}
        </p>
      )}
    </>
  );
}
function SavedList({
  items,
  remove,
  onRemoved,
}: {
  items: SavedIdea[];
  remove?: boolean;
  onRemoved?: () => void;
}) {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function unsave(item: SavedIdea) {
    if (busy) return;
    setBusy(item.id);
    try {
      await writeSaved(item.kind, item.id, false);
      onRemoved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className={styles.savedList}>
        {items.map((item) => (
          <div className={styles.savedItem} key={item.kind + item.id}>
            <Image src={item.image} alt="" width={52} height={58} />
            <a
              href={item.href}
              target={item.kind === "product" ? "_blank" : undefined}
              rel={item.kind === "product" ? "noopener noreferrer" : undefined}
            >
              {item.title}
              <small>
                {item.kind === "product"
                  ? "Saved at Aarla · price and availability confirmed there"
                  : "Story inspiration"}
              </small>
            </a>
            {remove && (
              <button
                disabled={!!busy}
                onClick={() => unsave(item)}
                aria-label={`Remove ${item.title}`}
              >
                {busy === item.id ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <X size={16} />
                )}
              </button>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className={styles.feedback} role="status">
          {error}
        </p>
      )}
    </>
  );
}
export function HomeDashboard({ data }: { data: CustomerHome }) {
  const { sections } = data;
  const gifts = useCarousel<Card>("gifts", sections.gifts),
    occasions = useCarousel<Occasion>("occasions", sections.occasions),
    products = useCarousel<Product>("aarla", sections.aarla);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(sections.saved),
    [savedError, setSavedError] = useState("");
  async function refreshSaved() {
    try {
      setSaved(await getSection("saved"));
      setSavedError("");
    } catch {
      setSavedError("Your idea was saved. Reload to refresh the list.");
    }
  }
  const gift = gifts.item,
    occasion = occasions.item,
    product = products.item,
    idea =
      sections.inspiration?.status === "ready"
        ? sections.inspiration.data
        : null,
    payment =
      sections.payments?.status === "ready" ? sections.payments.data : null;
  return (
    <div className={styles.home}>
      <div className={styles.welcome}>
        <h1>A little thought. A lasting connection.</h1>
        <p>For your people, your plans, and the moments coming up.</p>
      </div>
      <h1 className="sr-only lg:hidden">Your gifting space</h1>
      <div className={styles.rails}>
        <section aria-label="Gifts taking shape">
          <div className={styles.heading}>
            <h2>
              Gifts taking shape{" "}
              {sections.gifts?.status === "ready" && (
                <span className={styles.count}>({gifts.total})</span>
              )}
            </h2>
            <Link href="/tell-your-story" className={styles.new}>
              + <span className={styles.mobileText}>New gift</span>
              <span className={styles.desktopText}>Start a new gift</span>
            </Link>
          </div>
          <article className={styles.card} aria-busy={gifts.pending}>
            {gift ? (
              <>
                <div className={styles.giftMain}>
                  <div className={styles.media}>
                    {gift.image ? (
                      <SafeImage
                        key={gift.image}
                        src={gift.image}
                        alt={`Preview of ${gift.title}`}
                      />
                    ) : (
                      <PlaceholderPhoto
                        kind="gift"
                        label="Gifting inspiration"
                      />
                    )}
                  </div>
                  <div className={styles.giftCopy}>
                    <span className={styles.status}>
                      {gift.demo ? "Sample · " : ""}
                      {gift.action.kind === "options"
                        ? `${gift.visibleOptionCount} ${gift.visibleOptionCount === 1 ? "option" : "options"} ready`
                        : gift.stageLabel}
                    </span>
                    <h3>{gift.title}</h3>
                    <p className={styles.meta}>
                      {gift.quantityRange
                        ? `Quantity range: ${gift.quantityRange}`
                        : ""}
                      {gift.quantityRange && gift.requestedDeliveryDate
                        ? " · "
                        : ""}
                      {gift.requestedDeliveryDate
                        ? `Delivery requested ${dateLabel(gift.requestedDeliveryDate)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className={styles.action}>
                  <Link
                    href={gift.action.href}
                    className={
                      gift.action.requiresAction ? styles.primary : styles.link
                    }
                  >
                    {gift.action.label} →
                  </Link>
                </div>
              </>
            ) : (
              <Missing
                section={sections.gifts}
                media="gift"
                empty="Your next story starts here."
                href="/tell-your-story"
                label="Start a new gift"
              />
            )}
            <Pager name="gift" carousel={gifts} />
          </article>
          <div className={styles.railNotes}>
            {gifts.error && (
              <p role="status" className={styles.feedback}>
                {gifts.error}
              </p>
            )}
            {gift?.demo && (
              <p className={styles.sample}>
                Sample request · no payment or order will be created.
              </p>
            )}
          </div>
        </section>
        <section aria-label="Upcoming occasions">
          <div className={styles.heading}>
            <h2>
              Upcoming occasions{" "}
              {sections.occasions?.status === "ready" && (
                <span className={styles.count}>({occasions.total})</span>
              )}
            </h2>
          </div>
          <article className={styles.card} aria-busy={occasions.pending}>
            {occasion ? (
              <>
                <div className={styles.occasionMedia}>
                  {occasion.image ? (
                    <SafeImage
                      key={occasion.image}
                      src={occasion.image}
                      alt="Saved occasion photo"
                      fallback="occasion"
                    />
                  ) : (
                    <PlaceholderPhoto
                      kind="occasion"
                      label="Occasion inspiration"
                    />
                  )}
                </div>
                <div className={styles.occasionBody}>
                  <div className={styles.date}>
                    <span>
                      {new Date(
                        occasion.date + "T00:00:00Z",
                      ).toLocaleDateString("en-IN", {
                        month: "short",
                        timeZone: "UTC",
                      })}
                    </span>
                    <strong>{Number(occasion.date.slice(-2))}</strong>
                  </div>
                  <div>
                    <h3>{occasion.title}</h3>
                    <p className={styles.meta}>
                      {occasion.daysAway === 0
                        ? "Today"
                        : `In ${occasion.daysAway} ${occasion.daysAway === 1 ? "day" : "days"}`}
                      {occasion.annual ? " · Yearly" : ""}
                    </p>
                  </div>
                </div>
                <div className={styles.action}>
                  <Link href={occasion.action.href} className={styles.link}>
                    {occasion.action.label} →
                  </Link>
                </div>
              </>
            ) : sections.occasions?.status === "ready" ? (
              <div className={styles.occasionPrompt}>
                <div className={styles.promptVisual}>
                  <PlaceholderPhoto kind="occasion" />
                </div>
                <div className={styles.promptCopy}>
                  <h3>Whose special day is coming up?</h3>
                  <p>
                    Save a birthday or anniversary for someone you care about.
                  </p>
                  <Link
                    href="/account?view=occasions&add=1"
                    className={styles.link}
                  >
                    Add a special day →
                  </Link>
                </div>
              </div>
            ) : (
              <Missing
                section={sections.occasions}
                media="occasion"
                empty=""
                href="/account?view=occasions&add=1"
                label="Add a special day"
              />
            )}
            <Pager name="occasion" carousel={occasions} />
          </article>
          <div className={styles.railNotes}>
            {occasions.error && (
              <p role="status" className={styles.feedback}>
                {occasions.error}
              </p>
            )}
          </div>
        </section>
        <section aria-label="Coming up at Aarla">
          <div className={styles.heading}>
            <h2>Coming up at Aarla</h2>
          </div>
          <article className={styles.card} aria-busy={products.pending}>
            {product ? (
              <div className={styles.productMain}>
                <div className={styles.productMedia}>
                  <SafeImage
                    key={product.image}
                    fallback="aarla"
                    src={product.image}
                    alt={product.title}
                  />
                  {sections.aarla?.status === "ready" &&
                    sections.aarla.data.savingAvailable && (
                      <SaveButton
                        key={product.id}
                        kind="product"
                        id={product.id}
                        title={product.title}
                        saved={overrides[product.id] ?? product.saved}
                        onSaved={(active) => {
                          setOverrides((previous) => ({
                            ...previous,
                            [product.id]: active,
                          }));
                          void refreshSaved();
                        }}
                        icon
                      />
                    )}
                </div>
                <div className={styles.productMeta}>
                  <h3>{product.title}</h3>
                  <p className={styles.meta}>
                    {money(product.pricePaise)}
                    {product.comparePaise && (
                      <>
                        <span className="sr-only"> · Previously </span>{" "}
                        <s>{money(product.comparePaise)}</s>
                      </>
                    )}
                  </p>
                  <a
                    className={styles.link}
                    href={product.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Explore at Aarla →
                    <span className="sr-only"> (new tab)</span>
                  </a>
                </div>
              </div>
            ) : (
              <Missing
                section={sections.aarla}
                media="aarla"
                empty="A little more inspiration awaits."
                href="https://aarla.in"
                label="Explore Aarla"
              />
            )}
            <Pager name="Aarla find" carousel={products} />
          </article>
          <div className={styles.railNotes}>
            {products.error && (
              <p role="status" className={styles.feedback}>
                {products.error}
              </p>
            )}
          </div>
        </section>
      </div>
      <div className={styles.extra}>
        <h2>A thought for your next story</h2>
        <p>Keep an idea close. The right occasion will come.</p>
        <div className={styles.inspirationGrid}>
          <article className={styles.editorial}>
            {idea ? (
              <>
                <img src={idea.image} alt={idea.alt} loading="lazy" />
                <div>
                  <h3>{idea.title}</h3>
                  <p>{idea.summary}</p>
                  <div className={styles.saveRow}>
                    <SaveButton
                      kind="story"
                      id={idea.id}
                      title={idea.title}
                      saved={idea.saved}
                      onSaved={refreshSaved}
                    />
                    <Link className={styles.link} href={idea.href}>
                      Read story →
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <Missing
                section={sections.inspiration}
                empty="Discover your next direction."
                href="/stories"
                label="Explore stories"
              />
            )}
          </article>
          <aside className={styles.savedPanel}>
            {saved?.status === "ready" && saved.data.total === 0 && (
              <div className={styles.savedPlaceholder}>
                <Image
                  src="/images/gyvft/homepage/06-remember.png"
                  alt="Three generations sharing favourite family photographs"
                  fill
                  sizes="(min-width: 1024px) 35vw, 100vw"
                />
              </div>
            )}
            <div className={styles.savedBody}>
              <h3>
                Your saved ideas{" "}
                {saved?.status === "ready" && (
                  <span className={styles.count}>({saved.data.total})</span>
                )}
              </h3>
              {saved?.status === "ready" && saved.data.items.length ? (
                <SavedList items={saved.data.items.slice(0, 2)} />
              ) : (
                <p className={styles.meta}>
                  {saved?.status === "ready"
                    ? "Find something they’d love. Save it for their next special day."
                    : "Your saved ideas couldn’t load right now."}
                </p>
              )}
              <Link
                className={styles.link}
                href={
                  saved?.status === "ready" && saved.data.total === 0
                    ? "/account?view=ideas"
                    : "/account?view=saved"
                }
              >
                {saved?.status === "ready" && saved.data.total === 0
                  ? "Explore ideas →"
                  : "See all saved ideas →"}
              </Link>
              {savedError && (
                <p role="status" className={styles.feedback}>
                  {savedError}
                </p>
              )}
            </div>
          </aside>
        </div>
        <div className={styles.paymentSummary}>
          <h3>Payments & receipts</h3>
          {payment ? (
            <>
              <div>
                <strong>{money(payment.paidThisFinancialYearPaise)}</strong>
                <small>
                  Paid this financial year · {payment.financialYear.label}
                </small>
              </div>
              <div>
                <p>
                  {payment.pendingVerificationGiftCount
                    ? `${payment.pendingVerificationGiftCount} payment verification pending`
                    : payment.dueGiftCount
                      ? `${payment.dueGiftCount} ${payment.dueGiftCount === 1 ? "gift needs" : "gifts need"} a payment`
                      : "No payment due right now."}
                </p>
                <small>
                  {payment.completedGifts} completed gifts · All time
                </small>
              </div>
              <Link className={styles.link} href="/account?view=payments">
                View payments & receipts →
              </Link>
            </>
          ) : (
            <p className={styles.meta}>
              Your payments couldn’t load.{" "}
              <Link href="/account?view=payments" className={styles.link}>
                View payments →
              </Link>
            </p>
          )}
        </div>
      </div>
      <p className={styles.notice}>
        Explore and check out at Aarla. Prices and availability are confirmed
        there.
      </p>
    </div>
  );
}
export function SavedIdeasPage({ data }: { data: CustomerHome }) {
  const [section, setSection] = useState(data.sections.saved),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function load(
    offset = section?.status === "ready" ? section.data.offset : 0,
  ) {
    setPending(true);
    try {
      setSection(await getSection("saved", offset, 20));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className={`${styles.home} ${styles.savedPage}`}>
      <h1>Your saved ideas</h1>
      {section?.status === "ready" ? (
        <>
          <SavedList
            items={section.data.items}
            remove
            onRemoved={() => load()}
          />
          {section.data.total === 0 && (
            <p className={styles.meta}>
              Save stories and Aarla finds from Home. Your ideas will be waiting
              here.
            </p>
          )}
          <div className={styles.pager}>
            <button
              aria-label="Previous saved ideas"
              disabled={pending || section.data.offset === 0}
              onClick={() => load(Math.max(0, section.data.offset - 20))}
            >
              <ChevronLeft />
            </button>
            <span className={styles.meta}>{section.data.total} saved</span>
            <button
              aria-label="Next saved ideas"
              disabled={pending || section.data.nextOffset === null}
              onClick={() => load(section.data.nextOffset || 0)}
            >
              <ChevronRight />
            </button>
          </div>
        </>
      ) : (
        <Missing
          section={section}
          empty="Keep a little inspiration."
          href="/account"
          label="Explore Home"
        />
      )}
      {error && (
        <p role="status" className={styles.feedback}>
          {error}
        </p>
      )}
    </section>
  );
}
export function PaymentsPage({ data }: { data: CustomerHome }) {
  const [section, setSection] = useState(data.sections.payments),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function load(offset: number) {
    setPending(true);
    try {
      setSection(await getSection("payments", offset, 20));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  const p = section?.status === "ready" ? section.data : null;
  return (
    <section className={`${styles.home} ${styles.ledger}`}>
      <h1>Payments & receipts</h1>
      {p ? (
        <>
          <div className={styles.ledgerSummary}>
            <p>Paid this financial year · {p.financialYear.label}</p>
            <strong>{money(p.paidThisFinancialYearPaise)}</strong>
            <p className={styles.meta}>
              Verified payments only.{" "}
              {p.pendingVerificationGiftCount > 0
                ? `${p.pendingVerificationGiftCount} gift payment(s) awaiting verification.`
                : "Pending or rejected payment proofs are excluded."}
            </p>
          </div>
          <p className={styles.meta}>
            Payment acknowledgements · All time. Tax invoices are provided
            separately by the team.
          </p>
          {p.receipts.total ? (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Gift</th>
                    <th>Verified</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {p.receipts.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={r.href} className="underline">
                          {r.title}
                        </Link>
                      </td>
                      <td>
                        {r.verifiedAt
                          ? new Date(r.verifiedAt).toLocaleDateString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })
                          : "Date not recorded"}
                      </td>
                      <td className="whitespace-nowrap">
                        {money(r.amountPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.pager}>
                <button
                  aria-label="Previous payments"
                  disabled={pending || p.receipts.offset === 0}
                  onClick={() => load(Math.max(0, p.receipts.offset - 20))}
                >
                  <ChevronLeft />
                </button>
                <button
                  aria-label="Next payments"
                  disabled={pending || p.receipts.nextOffset === null}
                  onClick={() => load(p.receipts.nextOffset || 0)}
                >
                  <ChevronRight />
                </button>
              </div>
            </>
          ) : (
            <p>
              No verified payments yet. Payment instructions appear inside your
              gift when its quote is approved.
            </p>
          )}
        </>
      ) : (
        <Missing
          section={section}
          empty="Your payment history"
          href="/account"
          label="Back to Home"
        />
      )}
      {error && (
        <p className={styles.feedback} role="status">
          {error}
        </p>
      )}
    </section>
  );
}
