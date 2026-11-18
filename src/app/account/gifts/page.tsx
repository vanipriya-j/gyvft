import Link from "next/link";
import { requireCustomerAccount } from "@/lib/customer/session";
import { getSql } from "@/lib/database/client";
import { stages } from "@/lib/customer/model";
export const dynamic = "force-dynamic";
export default async function GiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const a = await requireCustomerAccount(),
    { q = "", status = "all" } = await searchParams;
  const rows =
    await getSql()`SELECT p.id,p.title,p.kind,p.is_draft,p.stage,p.created_at,p.delivery_date::text,p.next_action,(SELECT count(*)::int FROM gyvft_gift_options o WHERE o.project_id=p.id AND NOT o.operator_hidden) AS options FROM customer_projects p WHERE p.customer_account_id=${a.id}::uuid AND p.title ILIKE ${"%" + q.slice(0, 120) + "%"} AND (${status}='all' OR (${status}='drafts' AND p.is_draft) OR (${status}='delivered' AND p.stage>=10) OR (${status}='active' AND NOT p.is_draft AND p.stage<10)) ORDER BY p.created_at DESC LIMIT 200`;
  return (
    <>
      <div className="app-title">
        <div>
          <h1>My gifts</h1>
          <p>Every thought, from the first idea to their doorstep.</p>
        </div>
        <Link className="app-button primary" href="/account/gifts/new">
          + Start a new gift
        </Link>
      </div>
      <form className="app-toolbar">
        <label>
          Find a gift
          <input
            className="app-input"
            name="q"
            defaultValue={q}
            placeholder="Gift name"
          />
        </label>
        <label>
          Status
          <select className="app-input" name="status" defaultValue={status}>
            <option value="all">All gifts</option>
            <option value="active">In progress</option>
            <option value="drafts">Private drafts</option>
            <option value="delivered">Delivered</option>
          </select>
        </label>
        <button className="app-button">Find gifts</button>
      </form>
      <div className="app-panel">
        {rows.length ? (
          rows.map((p) => (
            <article className="app-row" key={p.id}>
              <div>
                <span className="app-badge">
                  {p.is_draft
                    ? "Private draft"
                    : Number(p.options) > 0 && p.kind === "enquiry"
                      ? "Options ready"
                      : stages[Number(p.stage)]}
                </span>
                <h2 className="mt-2">
                  <Link href={`/account/projects/${p.id}`}>{p.title}</Link>
                </h2>
                <p className="app-muted">
                  {p.is_draft
                    ? "Only you can see this draft."
                    : p.delivery_date
                      ? `Delivery requested ${p.delivery_date}`
                      : p.next_action}
                </p>
              </div>
              <Link
                className="app-button"
                href={`/account/projects/${p.id}${p.is_draft ? "?view=edit" : ""}`}
              >
                {p.is_draft ? "Continue draft" : "Open gift"} →
              </Link>
            </article>
          ))
        ) : (
          <div className="app-empty">
            <h2>A little thought can start something lovely.</h2>
            <p className="app-muted mt-2">
              A birthday, a thank-you or just because. Tell us who you’re
              thinking of.
            </p>
            <Link className="app-button primary mt-4" href="/account/gifts/new">
              Start your first gift
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
