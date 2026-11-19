"use client";
/* eslint-disable @next/next/no-img-element -- Private images require the viewer's session cookie. */
import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Cake,
  Heart,
  Gift,
  Users,
  CalendarDays,
} from "lucide-react";
import type { RequestRow, Upcoming } from "@/lib/customer/dashboard-model";
import type { AarlaProduct } from "@/lib/customer/catalogue";
import { money, stages } from "@/lib/customer/model";
export type Mockup = {
  id: string;
  project_id: string;
  title: string;
  kind: string;
  version: number;
};
function Rail({
  title,
  kicker,
  children,
  action,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.2em] text-olive">
            {kicker}
          </p>
          <h2 className="mt-1 font-serif text-2xl">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <button
            className="hidden rounded-full border border-border bg-paper p-2 sm:block"
            aria-label={`Previous ${title}`}
            onClick={() =>
              ref.current?.scrollBy({
                left: -ref.current.clientWidth * 0.85,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              })
            }
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="hidden rounded-full border border-border bg-paper p-2 sm:block"
            aria-label={`Next ${title}`}
            onClick={() =>
              ref.current?.scrollBy({
                left: ref.current.clientWidth * 0.85,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              })
            }
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3"
        role="region"
        aria-label={title}
      >
        {children}
      </div>
    </section>
  );
}
function EventArt({ title }: { title: string }) {
  const Icon = /birthday/i.test(title)
    ? Cake
    : /annivers|wedding/i.test(title)
      ? Heart
      : /team|annual|visit|family/i.test(title)
        ? Users
        : Gift;
  return (
    <div className="relative flex h-full min-h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-paper via-surface to-background">
      <div className="absolute -right-5 -top-8 h-40 w-40 rounded-full border-[20px] border-white/20" />
      <div className="absolute -bottom-16 left-0 h-40 w-40 rounded-full border border-white/50" />
      <Icon size={54} strokeWidth={1} className="relative text-olive-dark/70" />
    </div>
  );
}
const tile =
  "w-full shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-paper";
export function CustomerVisuals({
  requests,
  mockups,
  upcoming,
  products,
  offers,
  onOccasions,
}: {
  requests: RequestRow[];
  mockups: Mockup[];
  upcoming: Upcoming[];
  products: AarlaProduct[];
  offers: AarlaProduct[];
  onOccasions: () => void;
}) {
  const real = requests.filter((r) => !r.demo);
  const active = (real.length ? real : requests)
    .filter((r) => r.stage < 10)
    .slice(0, 8);
  function productRail(items: AarlaProduct[]) {
    return (
      <Rail
        kicker="New finds & offers"
        title="Coming up at Aarla"
        action={
          <a
            href="https://aarla.in/collections/all"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
          >
            Explore Aarla ↗
          </a>
        }
      >
        {items.map((p) => (
          <a
            href={p.href}
            key={p.id}
            target="_blank"
            rel="noopener noreferrer"
            className={tile}
          >
            <div className="relative aspect-[4/3] bg-surface">
              <Image
                src={p.image}
                alt={p.title}
                fill
                sizes="340px"
                className="object-cover"
              />
              {p.comparePaise && (
                <span className="absolute left-3 top-3 rounded-full bg-paper px-3 py-1 text-xs">
                  {Math.floor(
                    ((p.comparePaise - p.pricePaise) / p.comparePaise) * 100,
                  )}
                  % off
                </span>
              )}
            </div>
            <div className="p-4">
              <h3 className="line-clamp-2 min-h-12 font-serif text-xl leading-6">
                {p.title}
              </h3>
              <p className="mt-3 text-sm">
                {money(p.pricePaise)}{" "}
                {p.comparePaise && (
                  <del className="ml-2 text-xs text-muted-text">
                    {money(p.comparePaise)}
                  </del>
                )}
              </p>
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-olive px-4 py-2 text-xs text-olive-dark">
                View at Aarla <ArrowRight size={13} />
              </p>
            </div>
          </a>
        ))}
      </Rail>
    );
  }
  return (
    <div className="grid min-w-0 items-start gap-7 lg:grid-cols-3">
      {active.length > 0 ? (
        <Rail kicker="Your stories, coming to life" title="Gifts taking shape">
          {active.map((r) => {
            const mock = mockups.find((m) => m.project_id === r.id);
            return (
              <Link
                href={`/account/projects/${r.id}`}
                key={r.id}
                className={tile}
              >
                <div className="aspect-[16/10] overflow-hidden bg-surface">
                  {mock ? (
                    <img
                      src={`/api/customer-assets/approval/${mock.id}`}
                      alt={`${r.title} · ${mock.kind} version ${mock.version}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <EventArt
                      title={
                        r.occasion === "Not specified" ? r.title : r.occasion
                      }
                    />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-[10px] uppercase tracking-widest text-olive">
                    {mock ? `${mock.kind} · v${mock.version}` : "Your request"}
                    {r.demo ? " · DEMO" : ""}
                  </p>
                  <h3 className="mt-2 line-clamp-2 font-serif text-xl leading-6">
                    {r.title}
                  </h3>
                  <p className="mt-3 inline-block rounded-full bg-surface px-2.5 py-1 text-xs">
                    {stages[r.stage]}
                  </p>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-text">
                    {r.nextAction}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-action px-4 py-2 text-xs text-white">
                    Open your story <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            );
          })}
        </Rail>
      ) : (
        <Rail kicker="Your stories, coming to life" title="Gifts taking shape">
          <Link href="/account/gifts/new" className={tile + " block p-6"}>
            <Gift size={36} strokeWidth={1} />
            <h3 className="mt-5 font-serif text-2xl">
              Who are you gifting next?
            </h3>
            <p className="mt-3 text-sm text-muted-text">
              Start with a person, a moment or a little idea.
            </p>
            <span className="mt-5 inline-block rounded-lg bg-action px-4 py-2 text-sm text-white">
              Start a new gift
            </span>
          </Link>
        </Rail>
      )}
      <Rail
        kicker="For the people and moments that matter"
        title="Upcoming occasions"
        action={
          <button onClick={onOccasions} className="shrink-0 text-xs underline">
            Add a date
          </button>
        }
      >
        {upcoming
          .filter((o) => o.kind === "occasion")
          .slice(0, 10)
          .map((o) => (
            <article
              key={o.id}
              className="w-full shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-paper"
            >
              <div className="h-40 overflow-hidden">
                {o.image ? (
                  <img
                    src={o.image}
                    alt={`${o.title} occasion`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <EventArt title={o.title} />
                )}
              </div>
              <div className="p-4">
                <p className="flex items-center gap-1.5 text-xs text-olive">
                  <CalendarDays size={13} />
                  {new Date(o.date + "T00:00:00Z").toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                  {o.annual ? " · yearly" : ""}
                </p>
                <h3 className="mt-2 font-serif text-xl">{o.title}</h3>
                <p className="mt-3 text-xs text-muted-text">
                  A little thought goes a long way.
                </p>
                <Link
                  href={o.href || "/account/gifts/new"}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-action px-4 py-2 text-xs text-white"
                >
                  {o.href ? "Plan this gift" : "Find a gift"}{" "}
                  <ArrowRight size={13} />
                </Link>
              </div>
            </article>
          ))}
        {!upcoming.some((o) => o.kind === "occasion") && (
          <button
            onClick={onOccasions}
            className="flex min-h-56 w-full flex-col items-start justify-center rounded-2xl border border-dashed border-olive/40 bg-surface/60 p-6 text-left"
          >
            <Cake size={32} strokeWidth={1} className="text-olive" />
            <span className="mt-4 font-serif text-2xl">
              Whose day is coming up?
            </span>
            <span className="mt-2 text-sm text-muted-text">
              Save a birthday, a visit or a celebration. Add a person’s photo or
              event artwork when you have one.
            </span>
            <span className="mt-4 text-sm underline">Add an occasion</span>
          </button>
        )}
      </Rail>
      {products.length > 0 || offers.length > 0 ? (
        productRail([
          ...new Map([...products, ...offers].map((p) => [p.id, p])).values(),
        ])
      ) : (
        <section className="rounded-2xl bg-surface p-6">
          <h2 className="font-serif text-2xl">Coming up at Aarla</h2>
          <p className="mt-2 text-sm text-muted-text">
            Explore the latest collections, books and gifts at Aarla.
          </p>
          <a
            href="https://aarla.in/collections/all"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm underline"
          >
            Explore Aarla ↗
          </a>
        </section>
      )}
      {(products.length > 0 || offers.length > 0) && (
        <p className="text-xs text-muted-text lg:col-span-3">
          Explore and checkout at Aarla. Prices and availability are confirmed
          there.
        </p>
      )}
    </div>
  );
}
