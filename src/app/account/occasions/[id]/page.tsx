import Link from "@/components/ui/navigation-link";
import { notFound } from "next/navigation";
import { requireCustomerAccount } from "@/lib/customer/session";
import { occasionsFor, peopleFor } from "@/lib/customer/journeys";
import { getSql } from "@/lib/database/client";
import { OccasionForm } from "@/components/customer/people-forms";
import { stages, money } from "@/lib/customer/model";
export const dynamic = "force-dynamic";
export default async function OccasionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const a = await requireCustomerAccount(),
    { id } = await params,
    { edit } = await searchParams,
    [occasions, people] = await Promise.all([
      occasionsFor(a.id),
      peopleFor(a.id),
    ]),
    o = occasions.find((x) => x.id === id);
  if (!o) notFound();
  const gifts =
    await getSql()`SELECT id,title,stage,paid_paise,created_at FROM customer_projects WHERE occasion_id=${id}::uuid AND customer_account_id=${a.id}::uuid ORDER BY created_at DESC`;
  return (
    <>
      <Link className="app-button quiet" href="/account/occasions">
        ← Occasions
      </Link>
      <div className="app-title mt-3">
        <div>
          <h1>{o.title}</h1>
          <p>
            {o.occasion_date} ·{" "}
            {o.repeats_annually
              ? "Returns every year"
              : o.relationship || "A special moment"}
          </p>
        </div>
        <Link
          className="app-button primary"
          href={`/account/gifts/new?occasion=${id}`}
        >
          Plan a gift for this occasion
        </Link>
      </div>
      {edit === "1" ? (
        <section className="app-panel">
          <h2>Edit occasion</h2>
          <OccasionForm id={id} occasion={o} people={people} />
        </section>
      ) : (
        <div className="app-grid">
          <section className="app-panel">
            <h2>The story so far</h2>
            {gifts.length ? (
              gifts.map((g) => (
                <article className="app-row" key={g.id}>
                  <div>
                    <p className="app-eyebrow">
                      {new Date(g.created_at).getFullYear()}
                    </p>
                    <h3>
                      <Link href={`/account/projects/${g.id}`}>{g.title}</Link>
                    </h3>
                    <p className="app-muted">
                      {stages[Number(g.stage)]} · {money(Number(g.paid_paise))}{" "}
                      verified payments
                    </p>
                    <Link
                      className="app-button quiet"
                      href={`/account/gifts/new?occasion=${id}&repeat=${g.id}`}
                    >
                      Build on this gift →
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="app-empty">
                <h3>Your first gift for this occasion starts here.</h3>
                <p className="app-muted mt-2">
                  Next year, you’ll have the details and memories to build on.
                </p>
              </div>
            )}
          </section>
          <aside className="app-stack">
            <section className="app-panel">
              <h2>A note for next time</h2>
              <p className="whitespace-pre-wrap">
                {o.notes || "What would make this day feel like them?"}
              </p>
              {o.person_id && (
                <Link
                  className="app-button quiet mt-3"
                  href={`/account/people/${o.person_id}`}
                >
                  About the recipient →
                </Link>
              )}
              <Link className="app-button quiet mt-3" href="?edit=1">
                Edit this occasion
              </Link>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
