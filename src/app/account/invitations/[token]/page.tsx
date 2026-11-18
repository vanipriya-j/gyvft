import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerAccount } from "@/lib/customer/session";
import { invitationFor } from "@/lib/customer/journeys";
import { acceptPersonInvitation } from "@/app/account/journey-actions";
import { ActionForm } from "@/components/customer/action-form";
export const dynamic = "force-dynamic";
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params,
    invite = await invitationFor(token);
  if (!invite) notFound();
  const account = await getCustomerAccount();
  if (invite.invitation_accepted_at)
    return (
      <section className="app-panel mx-auto max-w-lg">
        <h1>
          {account?.id === invite.linked_account_id
            ? "You’re connected."
            : "This invitation has been accepted."}
        </h1>
        <p className="mt-4">You control what you share in your profile.</p>
        <Link className="app-button primary mt-4" href="/account/profile">
          Edit my profile
        </Link>
      </section>
    );
  return (
    <section className="app-panel mx-auto max-w-lg">
      <p className="app-eyebrow">A thoughtful connection</p>
      <h1>{invite.inviter} would love to know you better.</h1>
      <p className="mt-4">
        Share a little about what you enjoy, so the next gift feels like you.
        Accept using {invite.email}.
      </p>
      <p className="app-note">
        Your profile stays private until you choose to share it. Your inviter’s
        personal notes are separate and remain private to them.
      </p>
      {account ? (
        <>
          <ActionForm
            action={async () => {
              "use server";
              return acceptPersonInvitation(token);
            }}
            label="Accept invitation"
          >
            <p className="mt-4">Signed in as {account.email}</p>
          </ActionForm>
          <Link className="app-button quiet mt-4" href="/account/profile">
            Edit what I share →
          </Link>
        </>
      ) : (
        <Link
          className="app-button primary mt-4"
          href={`/account/login?next=${encodeURIComponent(`/account/invitations/${token}`)}`}
        >
          Sign in or create an account
        </Link>
      )}
    </section>
  );
}
