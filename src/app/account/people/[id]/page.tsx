import Link from "@/components/ui/navigation-link";
import { notFound } from "next/navigation";
import { requireCustomerAccount } from "@/lib/customer/session";
import { peopleFor, occasionsFor } from "@/lib/customer/journeys";
import { PersonForm } from "@/components/customer/people-forms";
import { InviteControls } from "@/components/customer/journey-controls";
export const dynamic = "force-dynamic";
export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const a = await requireCustomerAccount(),
    { id } = await params,
    { edit } = await searchParams;
  const [people, occasions] = await Promise.all([
      peopleFor(a.id),
      occasionsFor(a.id),
    ]),
    p = people.find((x) => x.id === id);
  if (!p) notFound();
  return (
    <>
      <Link className="app-button quiet" href="/account/people">
        ← Your people
      </Link>
      <div className="app-title mt-3">
        <div>
          <h1>{p.name}</h1>
          <p>{p.relationship || "Someone who matters"}</p>
        </div>
        <Link
          className="app-button primary"
          href={`/account/gifts/new?person=${p.id}`}
        >
          Plan a gift
        </Link>
      </div>
      {edit === "1" ? (
        <section className="app-panel">
          <h2>Your private notes</h2>
          <PersonForm accountId={a.id} id={id} person={p} />
        </section>
      ) : (
        <div className="app-grid">
          <div className="app-stack">
            <section className="app-panel">
              <h2>What {p.name} shared</h2>
              {p.shared_about || p.shared_interests ? (
                <>
                  <p className="whitespace-pre-wrap">{p.shared_about}</p>
                  <p className="mt-3">
                    Enjoys: {p.shared_interests || "Not added"}
                  </p>
                  {p.shared_avoid && (
                    <p className="mt-2">Avoid: {p.shared_avoid}</p>
                  )}
                </>
              ) : (
                <p className="app-muted">
                  {p.linked_account_id
                    ? "They’ve connected. Their profile is currently private or hasn’t been filled in yet."
                    : "Invite them to share the things they enjoy, in their own words."}
                </p>
              )}
              <p className="app-note">
                They control what they share. Your own notes stay separate.
              </p>
            </section>
            <section className="app-panel">
              <h2>Your private notes</h2>
              <p className="whitespace-pre-wrap">
                {p.about ||
                  "A favourite place, a small habit, a shared memory…"}
              </p>
              <p className="mt-3">Enjoys: {p.likes || "Not added"}</p>
              <p className="mt-2">Avoid: {p.avoid || "Not added"}</p>
              <Link className="app-button quiet mt-3" href={`?edit=1`}>
                Edit your notes
              </Link>
            </section>
          </div>
          <div className="app-stack">
            <section className="app-panel">
              <h2>Make the next gift personal</h2>
              <p className="app-muted">
                {p.email ||
                  "Add their email in your notes to send an invitation."}
              </p>
              {p.email && !p.linked_account_id && <InviteControls id={id} />}
            </section>
            <section className="app-panel">
              <h2>Their special days</h2>
              {occasions
                .filter((o) => o.person_id === id)
                .map((o) => (
                  <p className="mt-3" key={o.id}>
                    <Link
                      className="underline"
                      href={`/account/occasions/${o.id}`}
                    >
                      {o.title}
                    </Link>{" "}
                    · {o.occasion_date}
                  </p>
                ))}
              <Link
                className="app-button quiet mt-3"
                href="/account/occasions?add=1"
              >
                Add an occasion →
              </Link>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
