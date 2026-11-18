import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireCustomerAccount } from "@/lib/customer/session";
import { peopleFor } from "@/lib/customer/journeys";
import { PersonForm } from "@/components/customer/people-forms";
export const dynamic = "force-dynamic";
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const account = await requireCustomerAccount(),
    people = await peopleFor(account.id),
    { add } = await searchParams;
  return (
    <>
      <div className="app-title">
        <div>
          <h1>Your people</h1>
          <p>The little details that make a gift feel like them.</p>
        </div>
        <Link className="app-button primary" href="/account/people?add=1">
          + Add a person
        </Link>
      </div>
      {add === "1" ? (
        <section className="app-panel">
          <h2>Someone worth knowing</h2>
          <PersonForm id={randomUUID()} />
          <Link className="app-button quiet" href="/account/people">
            Back to your people
          </Link>
        </section>
      ) : (
        <section className="app-panel">
          {people.length ? (
            people.map((p) => (
              <article className="app-row" key={p.id}>
                <div className="flex items-center gap-4">
                  <span className="app-avatar" aria-hidden>
                    {p.name
                      .split(" ")
                      .map((x) => x[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div>
                    <h2>
                      <Link href={`/account/people/${p.id}`}>{p.name}</Link>
                    </h2>
                    <p className="app-muted">
                      {p.relationship}
                      {p.linked_account_id ? " · Connected" : ""}
                    </p>
                  </div>
                </div>
                <Link className="app-button" href={`/account/people/${p.id}`}>
                  Get to know them →
                </Link>
              </article>
            ))
          ) : (
            <div className="app-empty">
              <h2>Who always makes you smile?</h2>
              <p className="app-muted mt-2">
                Keep a few notes about a loved one, or invite them to tell you
                what they enjoy.
              </p>
              <Link
                className="app-button primary mt-4"
                href="/account/people?add=1"
              >
                Add someone special
              </Link>
            </div>
          )}
        </section>
      )}
    </>
  );
}
