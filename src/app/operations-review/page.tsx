/* eslint-disable @next/next/no-img-element -- Full-resolution review captures must remain directly inspectable. */
import Link from "next/link";
import { publicAssetDimensions } from "@/lib/public-asset";
import { BrandLogo } from "@/components/public/BrandLogo";
export const metadata = {
  title: "Operations · review desk pack",
  robots: { index: false, follow: false },
};
const base = "https://www.gyvft.com";
const brief = `Review GYVFT’s current Operations dashboard and workspace frame: ${base}/operations-review.

This is the follow-up to the Revision 4 gifting-flow review. The pack contains actual application captures with fictional local acceptance-test data. It is a visual review pack, not an interactive copy of Operations. No operator password or customer data is required. The private working app is at ${base}/operations.

Assess hierarchy and first-fold usefulness, next-task clarity, trustworthy money/status labels, context-preserving drill-downs, desktop/mobile density, navigation consistency, keyboard focus and loading stability. Check whether the interface helps an operator identify what to do next without searching. Separate observed problems from behaviours you cannot verify from a capture.

Respect the agreed product decisions: individual-first gifting; 50% advance and balance before dispatch; submitted proof is pending until bank verification; production locks gift/artwork changes; Shopify holds the official customer-linked single custom-batch order. Private drafts and labelled samples are excluded from live dashboard totals. Requested delivery dates are not confirmed delivery promises. The sidebar is intentionally unboxed; active selection and keyboard focus must stay clear.

The reported toolbar shift and boxed/unboxed area headings have been corrected. Inspect the delayed-load captures and measured frame evidence. These automated checks establish geometry and backend behaviour, not human comprehension.

Scope this review to the dashboard and existing Operations frame. Richer analytics/exported reports, customer administration, named team roles and circle/organisation creation are next-phase design work. Flag a genuine release dependency separately rather than assuming these are already implemented.

Return: (1) blockers before a supported pilot, (2) important usability fixes, (3) optional polish, (4) things already working well. For each finding state the exact screen/control, evidence or uncertainty, user impact, severity and smallest concrete fix. Avoid proposing another redesign unless the evidence calls for it. End with five short first-time-operator tasks to test without prompting.`;
function Capture({
  name,
  src,
  description,
  mobile = false,
}: {
  name: string;
  src: string;
  description: string;
  mobile?: boolean;
}) {
  const dimensions = publicAssetDimensions(src);
  return (
    <figure className="mt-5">
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open full-resolution ${name}`}
      >
        <img
          src={src}
          width={dimensions?.width}
          height={dimensions?.height}
          alt={description}
          loading="lazy"
          className={`h-auto w-full rounded-lg border border-border ${mobile ? "max-w-[390px]" : ""}`}
        />
      </a>
      <figcaption className="mt-3 text-sm text-muted-text">
        {description}{" "}
        <a
          className="underline"
          href={src}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open full resolution ↗
        </a>
      </figcaption>
    </figure>
  );
}
export default function OperationsReview() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-6 text-ink md:px-8 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-border pb-6">
        <Link href="/" aria-label="GYVFT home">
          <BrandLogo height={28} className="h-7 w-[115px]" />
        </Link>
        <p className="text-sm text-muted-text">
          Review desk · 19 November 2026
        </p>
      </header>
      <section className="py-7">
        <p className="text-xs uppercase tracking-[.16em] text-olive">
          Actual application · new Operations dashboard
        </p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl">
          A clearer workday for every gift.
        </h1>
        <p className="mt-4 max-w-3xl leading-7 text-muted-text">
          This pack shows the current dashboard and the corrected navigation
          frame. Captures use fictional local records, never live customer
          information. Buttons inside the images are screenshots; the working
          application requires operator access.
        </p>
        <nav
          aria-label="Review sections"
          className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm"
        >
          {[
            ["desktop", "Desktop dashboard"],
            ["mobile", "Mobile dashboard"],
            ["transitions", "Loading & layout"],
            ["brief", "Review brief"],
          ].map(([id, name]) => (
            <a
              key={id}
              href={"#" + id}
              className="inline-flex min-h-11 items-center underline"
            >
              {name}
            </a>
          ))}
        </nav>
      </section>
      <section id="desktop" className="border-t border-border py-7">
        <h2 className="font-serif text-2xl">Desktop: work before decoration</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-text">
          Review the attention prompt, queue ownership, 24-hour payment checks,
          verified receipts, outstanding balance, pipeline and requested
          deliveries. Count summaries open their matching queue filters; task,
          payment and delivery rows open the corresponding gift.
        </p>
        <Capture
          name="desktop dashboard"
          src="/operations-review/dashboard-desktop.png"
          description="Desktop dashboard. The example gifts, payments and dates are fictional acceptance-test records."
        />
      </section>
      <section id="mobile" className="border-t border-border py-7">
        <h2 className="font-serif text-2xl">
          Mobile: priorities that still fit
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-text">
          The same records reflow into a compact overview. Assess the first
          fold, action prominence, wrapping, section order and effective touch
          targets.
        </p>
        <Capture
          name="mobile dashboard"
          src="/operations-review/dashboard-mobile.png"
          mobile
          description="Mobile dashboard at 390 CSS pixels. This is the application rendered with sample records."
        />
      </section>
      <section id="transitions" className="border-t border-border py-7">
        <h2 className="font-serif text-2xl">
          Loading without moving the workspace
        </h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-sm leading-6">
          <li>Progress paints below the toolbar, outside button layout.</li>
          <li>
            Every area uses the same unboxed page title, subtitle and content
            alignment. Borders group actual content.
          </li>
          <li>
            The unboxed navigation keeps a consistent size, active state and
            keyboard focus. Scrollbar space is stable.
          </li>
          <li>
            Delayed data reads were tested at 320, 390, 1024 and 1440 CSS
            pixels. Across 52 pending/loaded measurements, toolbar, navigation
            and heading movement was 0 CSS pixels.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          <a
            href="/operations-review/frame-evidence.json"
            className="inline-flex min-h-11 items-center text-olive underline"
          >
            Inspect the measured frame evidence ↗
          </a>
        </p>
        <Capture
          name="desktop loading state"
          src="/operations-review/loading-desktop.png"
          description="Customers while its data load is held open. The thin progress bar and content skeleton do not displace the toolbar or title."
        />
        <Capture
          name="mobile loading state"
          src="/operations-review/loading-mobile.png"
          mobile
          description="The same delayed-load state on mobile. Header actions remain in their reserved position."
        />
      </section>
      <section className="border-t border-border py-7">
        <h2 className="font-serif text-2xl">Review boundaries</h2>
        <div className="mt-4 grid gap-6 text-sm leading-6 md:grid-cols-2">
          <div>
            <h3 className="font-medium">Working in this release</h3>
            <p className="mt-2 text-muted-text">
              Live dashboard, request management, payment verification,
              customer/occasion lookup, permission review, existing application
              reports with money summary, and merchant settings. Five browser
              journeys and the regression suite passed; the production build was
              also checked.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Next design work</h3>
            <p className="mt-2 text-muted-text">
              Richer analytics and downloadable reports; customer administration
              and named team access/roles; individual-first circles and
              organisation flows. These are not represented as completed
              capabilities.
            </p>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-text">
          A first-time human usability session remains separate from these
          automated checks. The earlier{" "}
          <a className="underline" href="/design-review.html">
            Revision 4 prototype
          </a>{" "}
          covers the broader gifting flow; it is not the source for this new
          dashboard’s pixels or live data.
        </p>
      </section>
      <section id="brief" className="border-t border-border py-7">
        <h2 className="font-serif text-2xl">
          Copy-ready brief for the same review desk
        </h2>
        <blockquote className="mt-5 whitespace-pre-wrap border-l-2 border-olive pl-5 text-sm leading-7">
          {brief}
        </blockquote>
      </section>
      <footer className="flex flex-wrap gap-6 border-t border-border pt-6 text-sm text-muted-text">
        <Link
          className="inline-flex min-h-11 items-center underline"
          href="/operations"
        >
          Working Operations · owner access
        </Link>
        <Link
          className="inline-flex min-h-11 items-center underline"
          href="/account"
        >
          Customer application
        </Link>
        <span className="inline-flex min-h-11 items-center">
          No review decision has been recorded yet.
        </span>
      </footer>
    </main>
  );
}
