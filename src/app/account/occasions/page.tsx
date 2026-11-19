import Link from "@/components/ui/navigation-link";
import { randomUUID } from "node:crypto";
import { requireCustomerAccount } from "@/lib/customer/session";
import { occasionsFor, peopleFor } from "@/lib/customer/journeys";
import { OccasionForm } from "@/components/customer/people-forms";
import { nextOccasionDate, indiaToday } from "@/lib/customer/dashboard-model";
export const dynamic = "force-dynamic";
export default async function OccasionsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const a = await requireCustomerAccount(),
    { add } = await searchParams,
    [occasions, people] = await Promise.all([
      occasionsFor(a.id),
      peopleFor(a.id),
    ]),
    today = indiaToday();
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
          <OccasionForm id={randomUUID()} people={people} />
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
    </>
  );
}
