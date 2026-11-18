import Link from "next/link";
import { requireCustomerAccount } from "@/lib/customer/session";
import { profileFor } from "@/lib/customer/journeys";
import { ProfileForm } from "@/components/customer/people-forms";
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const a = await requireCustomerAccount(),
    profile = await profileFor(a.id);
  return (
    <>
      <div className="app-title">
        <div>
          <h1>A little about you</h1>
          <p>Good gifts start with knowing someone. You deserve that too.</p>
        </div>
      </div>
      <div className="app-grid">
        <section className="app-panel">
          <h2>Your profile</h2>
          <ProfileForm profile={profile} />
        </section>
        <aside className="app-stack">
          <section className="app-panel">
            <h2>Your account</h2>
            <p>{a.email}</p>
            <div className="app-actions">
              <Link className="app-button" href="/account/login?mode=forgot">
                Password & access
              </Link>
              <Link className="app-button" href="/account?view=payments">
                Payments & receipts
              </Link>
            </div>
          </section>
          <section className="app-panel">
            <h2>Your people, your choices</h2>
            <p className="app-muted">
              Private notes help you give well. Accepted invitations let people
              share their own tastes with you.
            </p>
            <Link className="app-button quiet mt-3" href="/account/people">
              Your people →
            </Link>
            <Link className="app-button quiet" href="/account/profile/tastes">
              Review gifting preferences →
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
