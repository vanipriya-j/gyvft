import Link from "@/components/ui/navigation-link";
import { getCustomerAccount } from "@/lib/customer/session";
import { circleInvitation } from "@/lib/customer/circles";
import { AcceptCircleForm } from "@/components/customer/circle-controls";
import { profileFor } from "@/lib/customer/journeys";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your circle invitation · GYVFT",
  referrer: "no-referrer",
};
export default async function Invitation({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params,
    invite = await circleInvitation(token),
    a = await getCustomerAccount(),
    next = encodeURIComponent(`/account/circle-invitations/${token}`);
  if (!invite)
    return (
      <section className="app-panel mx-auto max-w-xl">
        <h1>This invitation is no longer available</h1>
        <p className="app-muted mt-3">
          It may have expired or been revoked. Ask the circle admin for a fresh
          invitation.
        </p>
        <Link className="app-button mt-4" href="/account/circles">
          Your circles →
        </Link>
      </section>
    );
  const profile = a ? await profileFor(a.id) : null;
  return (
    <section className="app-panel mx-auto max-w-xl">
      <span className="app-badge">A circle invitation</span>
      <h1 className="mt-4">You’re invited to {invite.circle_name}</h1>
      <p className="app-muted mt-3">
        Join as {invite.role === "admin" ? "an admin" : "a member"}, using{" "}
        {invite.email}. Your private gifts stay private.
      </p>
      {a?.email === invite.email ? (
        <AcceptCircleForm
          token={token}
          circleId={invite.circle_id}
          displayName={profile?.name || invite.display_name}
        />
      ) : (
        <>
          <p className="app-note mt-4">
            {a
              ? "You are signed in with a different email. Switch to the invited account to accept."
              : "Sign in or create an account with the invited email, then return here to accept."}
          </p>
          <Link
            className="app-button primary mt-4"
            href={`/account/login?next=${next}`}
          >
            {a ? "Switch account" : "Sign in to accept"}
          </Link>
        </>
      )}
    </section>
  );
}
