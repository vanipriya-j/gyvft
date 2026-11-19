import Link from "@/components/ui/navigation-link";
import { Users, Plus, ArrowUpRight } from "lucide-react";
import { requireCustomerAccount } from "@/lib/customer/session";
import { circlesForAccount, circlesReady } from "@/lib/customer/circles";
import { circleCategories } from "@/lib/customer/circle-model";
export const dynamic = "force-dynamic";
export default async function CirclesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const a = await requireCustomerAccount(),
    p = await searchParams;
  if (!(await circlesReady()))
    return (
      <section className="app-panel">
        <h1>Circles</h1>
        <p className="app-muted mt-3">
          Your circles will be available after GYVFT approves and applies the
          Circles database update.
        </p>
        <p className="app-note mt-2">
          Opening this page does not run migrations.
        </p>
      </section>
    );
  const circles = await circlesForAccount(a.id, p.archived === "1");
  return (
    <>
      <div className="app-title">
        <div>
          <h1>Your circles</h1>
          <p>
            Family, colleagues, your favourite people. A place for every
            connection.
          </p>
        </div>
        <Link className="app-button primary" href="/account/circles/new">
          <Plus size={16} />
          Create a circle
        </Link>
      </div>
      <div className="app-actions mb-4">
        <Link
          className="app-button quiet"
          href={
            p.archived === "1"
              ? "/account/circles"
              : "/account/circles?archived=1"
          }
        >
          {p.archived === "1"
            ? "Show active circles"
            : "Include archived circles"}
        </Link>
        <Link className="app-button quiet" href="/account/people">
          Your private people notes →
        </Link>
      </div>
      {circles.length ? (
        <div className="circles-grid">
          {circles.map((c) => (
            <article className="app-panel circle-card" key={c.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="circle-symbol">
                  <Users size={22} />
                </span>
                <span className="app-badge">
                  {c.archived_at ? "Archived" : circleCategories[c.category]}
                </span>
              </div>
              <h2 className="mt-4">
                <Link href={`/account/circles/${c.id}`}>{c.name}</Link>
              </h2>
              <p className="app-muted mt-2 line-clamp-2">
                {c.description || "Good things begin with the people you know."}
              </p>
              <p className="app-note mt-3">
                {c.member_count} {c.member_count === 1 ? "member" : "members"} ·{" "}
                {c.owner_account_id === a.id
                  ? "You own this circle"
                  : c.role === "admin"
                    ? "You’re an admin"
                    : "You’re a member"}
              </p>
              <Link
                className="app-button olive mt-4"
                href={`/account/circles/${c.id}`}
              >
                Open circle
                <ArrowUpRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <section className="app-panel circle-empty">
          <span className="circle-symbol">
            <Users size={28} />
          </span>
          <h2 className="mt-4">Who makes up your world?</h2>
          <p className="app-muted mt-2">
            Start with your family, a team or a community. Add an occasion,
            invite people in, and make the next gift feel personal.
          </p>
          <Link className="app-button primary mt-5" href="/account/circles/new">
            Create your first circle
          </Link>
        </section>
      )}
      <p className="app-note mt-5">
        Membership is by invitation. Sharing a profile is optional. Your gifts,
        quotes, payments and private notes stay yours.
      </p>
    </>
  );
}
