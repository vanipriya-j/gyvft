import Link from "@/components/ui/navigation-link";
import { requireCustomerAccount } from "@/lib/customer/session";
import { tasteSuggestions } from "@/lib/customer/journeys";
import { reviewTaste } from "@/app/account/journey-actions";
import { ActionForm } from "@/components/customer/action-form";
export const dynamic = "force-dynamic";
export default async function TastesPage() {
  const a = await requireCustomerAccount(),
    suggestions = await tasteSuggestions(a.id);
  return (
    <>
      <Link className="app-button quiet" href="/account/profile">
        ← About me
      </Link>
      <div className="app-title">
        <div>
          <h1>Do these feel like you?</h1>
          <p>
            Suggestions from your own gift selections. You decide what belongs
            in your profile.
          </p>
        </div>
      </div>
      <section className="app-panel">
        {suggestions.length ? (
          suggestions.map((s) => (
            <article className="app-row" key={s.name}>
              <div>
                <h2>{s.name}</h2>
                <p className="app-muted">
                  Selected in {s.gifts} of your gifts. This is a choice pattern,
                  not an assumed personal taste.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ActionForm
                  label="Add to my interests"
                  action={reviewTaste.bind(null, s.name, true)}
                />
                <ActionForm
                  label="Dismiss suggestion"
                  action={reviewTaste.bind(null, s.name, false)}
                />
              </div>
            </article>
          ))
        ) : (
          <p className="app-muted">
            No repeated choice patterns yet. You can add your interests directly
            in About me.
          </p>
        )}
      </section>
    </>
  );
}
