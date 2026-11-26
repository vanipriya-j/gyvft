import Link from "@/components/ui/navigation-link";
import { randomUUID } from "node:crypto";
import { requireCustomerAccount } from "@/lib/customer/session";
import { occasionsFor, peopleFor } from "@/lib/customer/journeys";
import { circleOccasionsFor } from "@/lib/customer/circles";
import { OccasionForm } from "@/components/customer/people-forms";
import { nextOccasionDate, indiaToday } from "@/lib/customer/dashboard-model";
export const dynamic = "force-dynamic";
export default async function OccasionsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; draft?: string }>;
}) {
  const a = await requireCustomerAccount(),
    { add, draft } = await searchParams,
    [occasions, people] = await Promise.all([
      occasionsFor(a.id),
      peopleFor(a.id),
    ]),
    today = indiaToday();
  const shared = add === "1" ? [] : await circleOccasionsFor(a.id);
  return (
    <>
      <div className="app-title">
        <div>
          <h1>Occasions</h1>
          <p>For the people and moments you never want to miss.</p>
        </div>
        <Link className="app-button primary" href="/account/occasions?add=1">
          + Add an occasion
        </Link>
      </div>
      {add === "1" ? (
        <section className="app-panel">
          <h2>A day worth remembering</h2>
          <OccasionForm
            accountId={a.id}
            id={draft && /^[0-9a-f-]{36}$/i.test(draft) ? draft : randomUUID()}
            people={people}
          />
          <Link className="app-button quiet" href="/account/occasions">
            Back to occasions
          </Link>
        </section>
      ) : (
        <section className="app-panel">
          {occasions.length ? (
            occasions.map((o) => (
              <article className="app-row" key={o.id}>
                <div>
                  <p className="app-eyebrow">
                    {nextOccasionDate(o, today) || o.occasion_date}
                  </p>
                  <h2>
                    <Link href={`/account/occasions/${o.id}`}>{o.title}</Link>
                  </h2>
                  <p className="app-muted">
                    {o.relationship}
                    {o.repeats_annually ? " · Every year" : ""}
                  </p>
                </div>
                <div className="app-actions">
                  <Link
                    className="app-button primary"
                    href={`/account/gifts/new?occasion=${o.id}`}
                  >
                    Plan this gift
                  </Link>
                  <Link
                    className="app-button"
                    href={`/account/occasions/${o.id}`}
                  >
                    See the occasion
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="app-empty">
              <h2>How about adding a loved one’s special day?</h2>
              <p className="app-muted mt-2">
                A birthday, an anniversary or a little tradition. Keep it here
                so the next gift starts with a thought.
              </p>
              <Link
                className="app-button primary mt-4"
                href="/account/occasions?add=1"
              >
                Add a special day
              </Link>
            </div>
          )}
        </section>
      )}
      {!!shared.length && (
        <section className="app-panel mt-5">
          <h2>Within your circles</h2>
          {shared.map((o) => (
            <article className="app-row" key={o.id}>
              <div>
                <p className="app-eyebrow">
                  {nextOccasionDate(o, today) || o.occasion_date}
                </p>
                <h2>{o.title}</h2>
                <Link
                  className="app-button quiet"
                  href={`/account/circles/${o.circle_id}?tab=occasions`}
                >
                  {o.circle_name} →
                </Link>
              </div>
              <Link
                className="app-button primary"
                href={`/account/gifts/new?circle=${o.circle_id}&circle_occasion=${o.id}`}
              >
                Plan a gift
              </Link>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
