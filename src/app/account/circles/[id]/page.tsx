import Link from "@/components/ui/navigation-link";
import { notFound } from "next/navigation";
import { Users, CalendarDays, Gift, ShieldCheck } from "lucide-react";
import { requireCustomerAccount } from "@/lib/customer/session";
import { circleForAccount } from "@/lib/customer/circles";
import { CircleError, circleCategories } from "@/lib/customer/circle-model";
import { circleCommandAction } from "../actions";
import { ActionForm } from "@/components/customer/action-form";
import { ConfirmForm } from "@/components/customer/journey-controls";
import { CircleInviteForm } from "@/components/customer/circle-controls";
import {
  RecipientFields,
  CircleOccasionFields,
} from "@/components/customer/circle-fields";
export const dynamic = "force-dynamic";
const Hidden = ({ op }: { op: string }) => (
  <input type="hidden" name="op" value={op} />
);
export default async function CirclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; offset?: string; invite?: string }>;
}) {
  const a = await requireCustomerAccount(),
    { id } = await params,
    q = await searchParams;
  const offset = Math.max(0, Math.min(10000, Number(q.offset) || 0));
  const data = await circleForAccount(id, a.id, offset).catch((e) => {
    if (e instanceof CircleError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { circle: c, organisation: org } = data,
    isOwner = c.owner_account_id === a.id,
    isAdmin = c.role === "admin",
    active = !c.archived_at,
    tab = ["people", "occasions", "settings"].includes(q.tab || "")
      ? q.tab!
      : "overview",
    action = circleCommandAction.bind(null, id),
    base = `/account/circles/${id}`;
  const inviteRecipient = q.invite
    ? data.recipients.find((r) => r.id === q.invite)
    : undefined;
  return (
    <>
      <Link className="app-button quiet mb-3" href="/account/circles">
        ← Your circles
      </Link>
      <div className="app-title">
        <div>
          <div className="app-actions mb-2">
            <span className="app-badge">
              {c.archived_at ? "Archived" : circleCategories[c.category]}
            </span>
            <span className="text-xs text-muted-text">
              {isOwner ? "Owner" : isAdmin ? "Admin" : "Member"}
            </span>
          </div>
          <h1>{c.name}</h1>
          <p>
            {c.description || "A little thought for the people in your circle."}
          </p>
        </div>
        {active && (
          <Link
            className="app-button primary"
            href={`/account/gifts/new?circle=${id}`}
          >
            + Create a gift
          </Link>
        )}
      </div>
      {c.archived_at && (
        <div className="app-soft mb-4" role="status">
          This circle is archived. Its history is preserved.
          {isOwner && (
            <ActionForm action={action} label="Restore circle">
              <Hidden op="restore" />
            </ActionForm>
          )}
        </div>
      )}
      <nav className="app-tabs circle-tabs" aria-label="Circle sections">
        {["overview", "people", "occasions", "settings"].map((t) => (
          <Link
            key={t}
            href={`${base}?tab=${t}`}
            aria-current={tab === t ? "page" : undefined}
          >
            {t === "people"
              ? `People (${c.member_count})`
              : t === "occasions"
                ? `Occasions (${data.occasions.length})`
                : t[0].toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </nav>
      {tab === "overview" && (
        <>
          <div className="circles-overview">
            <section className="app-panel">
              <div className="app-actions">
                <Users size={20} />
                <h2>Your people, connected</h2>
              </div>
              <p className="app-muted mt-3">
                {c.member_count} accepted{" "}
                {c.member_count === 1 ? "member" : "members"}
                {isAdmin
                  ? ` · ${c.recipient_count} ${c.recipient_count === 1 ? "recipient" : "recipients"}`
                  : ""}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {data.members.slice(0, 6).map((m) => (
                  <span className="app-badge" key={m.account_id}>
                    {m.display_name}
                    {m.is_owner ? " · Owner" : ""}
                  </span>
                ))}
              </div>
              <Link
                className="app-button olive mt-4"
                href={`${base}?tab=people`}
              >
                {isAdmin ? "Manage people" : "Meet your circle"} →
              </Link>
            </section>
            <section className="app-panel">
              <div className="app-actions">
                <CalendarDays size={20} />
                <h2>Something to look forward to</h2>
              </div>
              {data.occasions.slice(0, 3).map((o) => (
                <div className="app-row" key={o.id}>
                  <div>
                    <h3>{o.title}</h3>
                    <p className="app-note">
                      {new Date(
                        o.occasion_date + "T00:00:00Z",
                      ).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      })}
                      {o.repeats_annually ? " · Every year" : ""}
                    </p>
                  </div>
                  {active && (
                    <Link
                      className="app-button"
                      href={`/account/gifts/new?circle=${id}&circle_occasion=${o.id}`}
                    >
                      Plan a gift →
                    </Link>
                  )}
                </div>
              ))}
              {!data.occasions.length && (
                <p className="app-muted mt-3">
                  A birthday, a team milestone, a reunion. What’s coming up?
                </p>
              )}
              <Link
                className="app-button quiet mt-4"
                href={`${base}?tab=occasions`}
              >
                {isAdmin ? "Add or manage occasions" : "All occasions"} →
              </Link>
            </section>
          </div>
          <section className="app-panel mt-5">
            <div className="app-actions">
              <Gift size={20} />
              <h2>Your gifts for this circle</h2>
            </div>
            <p className="app-note mt-2">
              Only your own gifts appear here. Other members cannot see your
              briefs, quotes or payments.
            </p>
            {data.gifts.map((g) => (
              <div className="app-row" key={g.id}>
                <Link href={`/account/projects/${g.id}`}>{g.title}</Link>
                <Link
                  className="app-button quiet"
                  href={`/account/projects/${g.id}`}
                >
                  Open gift →
                </Link>
              </div>
            ))}
            {!data.gifts.length && (
              <p className="app-muted mt-4">
                Start with one person or celebrate everyone together.
              </p>
            )}
          </section>
          {org && (
            <section className="app-soft mt-5">
              <div className="app-actions">
                <ShieldCheck size={20} />
                <h2>{org.name}</h2>
                <span className="app-badge">
                  {org.verification_state === "verified"
                    ? "Verified organisation"
                    : org.verification_state === "needs_review"
                      ? "Details need review"
                      : "Not yet verified"}
                </span>
              </div>
              <p className="app-note mt-2">
                {org.domain} · Organisation verification is a GYVFT team check.
                It does not automatically add people or reveal their profiles.
              </p>
            </section>
          )}
        </>
      )}
      {tab === "people" && (
        <>
          <section className="app-panel">
            <h2>Members</h2>
            <p className="app-note mt-2">
              People who accepted an invitation. Profile details appear only
              when that person chooses to share with this circle.
            </p>
            {data.members.map((m) => (
              <article className="app-row circle-member" key={m.account_id}>
                <div className="min-w-0">
                  <h3>
                    {m.display_name}{" "}
                    <span className="app-badge">
                      {m.is_owner
                        ? "Owner"
                        : m.role === "admin"
                          ? "Admin"
                          : "Member"}
                    </span>
                    {m.account_id === a.id && (
                      <span className="app-note"> · You</span>
                    )}
                  </h3>
                  {m.email && (
                    <p className="app-note break-all mt-1">{m.email}</p>
                  )}
                  {m.about && <p className="app-muted mt-2">{m.about}</p>}
                  {m.interests && (
                    <p className="app-note mt-1">Enjoys: {m.interests}</p>
                  )}
                  {m.avoid && (
                    <p className="app-note mt-1">Best to avoid: {m.avoid}</p>
                  )}
                  {!m.share_profile && m.account_id !== a.id && (
                    <p className="app-note mt-1">Profile kept private</p>
                  )}
                </div>
                {active && isAdmin && !m.is_owner && m.account_id !== a.id && (
                  <div className="app-actions">
                    {isOwner && (
                      <ConfirmForm
                        title={`Make ${m.display_name} the owner?`}
                        trigger="Make owner"
                        description="They will control ownership and admin access. You will remain an admin."
                        action={action}
                        label="Transfer ownership"
                      >
                        <Hidden op="transfer" />
                        <input
                          type="hidden"
                          name="account_id"
                          value={m.account_id}
                        />
                      </ConfirmForm>
                    )}
                    {isOwner && (
                      <ConfirmForm
                        title={`Change ${m.display_name}’s access`}
                        trigger="Change access"
                        description="Admins can invite members, manage recipients and publish occasions. Only the owner can change admin roles."
                        action={action}
                        label="Save access"
                      >
                        <Hidden op="role" />
                        <input
                          type="hidden"
                          name="account_id"
                          value={m.account_id}
                        />
                        <label className="app-label mt-3">
                          Access
                          <select
                            className="app-input"
                            name="role"
                            defaultValue={m.role}
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        </label>
                      </ConfirmForm>
                    )}
                    {(isOwner || m.role === "member") && (
                      <ConfirmForm
                        title={`Remove ${m.display_name} from this circle?`}
                        trigger="Remove"
                        description="Their private account and gifts remain intact. They lose access to this circle and its shared occasions."
                        action={action}
                        label="Remove member"
                      >
                        <Hidden op="remove" />
                        <input
                          type="hidden"
                          name="account_id"
                          value={m.account_id}
                        />
                      </ConfirmForm>
                    )}
                  </div>
                )}
              </article>
            ))}
            <div className="app-actions mt-3">
              {offset > 0 && (
                <Link
                  className="app-button"
                  href={`${base}?tab=people&offset=${Math.max(0, offset - 25)}`}
                >
                  Previous members
                </Link>
              )}
              {offset + 25 < data.memberPage.total && (
                <Link
                  className="app-button"
                  href={`${base}?tab=people&offset=${offset + 25}`}
                >
                  More members
                </Link>
              )}
            </div>
          </section>
          {active && isAdmin && (
            <>
              <div className="mt-5">
                <CircleInviteForm
                  key={inviteRecipient?.id || "general"}
                  id={id}
                  owner={isOwner}
                  recipient={
                    inviteRecipient
                      ? {
                          id: inviteRecipient.id,
                          name: inviteRecipient.name,
                          email: inviteRecipient.email,
                        }
                      : undefined
                  }
                  emailConfigured={!!process.env.RESEND_API_KEY}
                />
              </div>
              {!!data.invitations.length && (
                <section className="app-panel mt-5">
                  <h2>Pending invitations</h2>
                  {data.invitations.map((i) => (
                    <div className="app-row" key={i.id}>
                      <div>
                        <h3>{i.display_name}</h3>
                        <p className="app-note break-all">
                          {i.email} · {i.role} ·{" "}
                          {i.expired
                            ? "Expired"
                            : `Expires ${new Date(i.expires_at).toLocaleDateString("en-IN")}`}
                        </p>
                      </div>
                      {(isOwner || i.role === "member") && (
                        <ConfirmForm
                          title="Revoke this invitation?"
                          trigger="Revoke"
                          description="The invitation link will stop working. You can create a new one later."
                          action={action}
                          label="Revoke invitation"
                        >
                          <Hidden op="revoke_invitation" />
                          <input
                            type="hidden"
                            name="invitation_id"
                            value={i.id}
                          />
                        </ConfirmForm>
                      )}
                    </div>
                  ))}
                </section>
              )}
              <section className="app-panel mt-5">
                <h2>Recipients</h2>
                <p className="app-note mt-2">
                  People you gift to, whether or not they have joined GYVFT.
                  Notes in this section are for circle admins.
                </p>
                {data.recipients.map((r) => (
                  <details className="circle-recipient" key={r.id}>
                    <summary className="circle-summary">
                      <span>{r.name}</span>
                      <span className="app-note">
                        {r.linked_account_id
                          ? "Connected account"
                          : "Recipient"}{" "}
                        · Edit
                      </span>
                    </summary>
                    <RecipientFields circleId={id} recipient={r} />
                    <div className="app-actions mt-3">
                      {r.email && !r.linked_account_id && (
                        <Link
                          className="app-button olive"
                          href={`${base}?tab=people&invite=${r.id}`}
                        >
                          Invite to join
                        </Link>
                      )}
                      <ConfirmForm
                        title={`Archive ${r.name}?`}
                        trigger="Archive recipient"
                        description="Their notes are retained. Pending invitations linked to this recipient will stop working."
                        action={action}
                        label="Archive recipient"
                      >
                        <Hidden op="archive_recipient" />
                        <input type="hidden" name="recipient_id" value={r.id} />
                      </ConfirmForm>
                    </div>
                  </details>
                ))}
                <details className="circle-recipient">
                  <summary className="circle-summary">
                    + Add a recipient
                  </summary>
                  <RecipientFields circleId={id} />
                </details>
              </section>
            </>
          )}
        </>
      )}
      {tab === "occasions" && (
        <>
          <section className="app-panel">
            <h2>Occasions you share</h2>
            <p className="app-note mt-2">
              Visible to accepted members of this circle. Your personal calendar
              is not shared automatically.
            </p>
            {data.occasions.map((o) => (
              <article className="circle-recipient" key={o.id}>
                <div className="app-row">
                  <div>
                    <h3>{o.title}</h3>
                    <p className="app-note">
                      {new Date(
                        o.occasion_date + "T00:00:00Z",
                      ).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                      {o.repeats_annually ? " · Every year" : ""}
                    </p>
                    {o.description && (
                      <p className="app-muted mt-2">{o.description}</p>
                    )}
                  </div>
                  {active && (
                    <Link
                      className="app-button primary"
                      href={`/account/gifts/new?circle=${id}&circle_occasion=${o.id}`}
                    >
                      Create a gift →
                    </Link>
                  )}
                </div>
                {active && isAdmin && (
                  <details>
                    <summary className="circle-summary">Edit occasion</summary>
                    <CircleOccasionFields circleId={id} occasion={o} />
                    <ConfirmForm
                      title="Archive this occasion?"
                      trigger="Archive occasion"
                      description="It will stop appearing in the circle and upcoming occasions. Existing gifts stay intact."
                      action={action}
                      label="Archive occasion"
                    >
                      <Hidden op="archive_occasion" />
                      <input type="hidden" name="occasion_id" value={o.id} />
                    </ConfirmForm>
                  </details>
                )}
              </article>
            ))}
            {!data.occasions.length && (
              <p className="app-muted mt-4">
                What’s the next moment worth celebrating?
              </p>
            )}
          </section>
          {active && isAdmin && (
            <section className="app-panel mt-5">
              <h2>Add a shared occasion</h2>
              <CircleOccasionFields circleId={id} />
            </section>
          )}
        </>
      )}
      {tab === "settings" && (
        <div className="circles-overview">
          <section className="app-panel">
            <h2>You in this circle</h2>
            <ActionForm action={action} label="Save my preferences">
              <Hidden op="profile" />
              <label className="app-label mt-3">
                Display name
                <input
                  className="app-input"
                  name="display_name"
                  defaultValue={c.display_name}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>
              <label className="app-check mt-4">
                <input
                  type="checkbox"
                  name="share_profile"
                  defaultChecked={c.share_profile}
                />
                Share my profile and interests with accepted members of this
                circle.
              </label>
              <p className="app-note mt-3">
                You can turn this off at any time. Your private people notes and
                gifts are never included.
              </p>
              <Link className="app-button quiet mt-2" href="/account/profile">
                Edit my profile →
              </Link>
            </ActionForm>
            {!isOwner && (
              <div className="mt-5">
                <ConfirmForm
                  title="Leave this circle?"
                  trigger="Leave circle"
                  description="You will lose access to shared occasions. Your own gifts and account remain yours. An admin can invite you back."
                  action={action}
                  successHref="/account/circles"
                  label="Leave circle"
                >
                  <Hidden op="leave" />
                </ConfirmForm>
              </div>
            )}
          </section>
          {active && isAdmin && (
            <section className="app-panel">
              <h2>Circle details</h2>
              <ActionForm action={action} label="Save circle">
                <Hidden op="update" />
                <label className="app-label mt-3">
                  Circle name
                  <input
                    className="app-input"
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={c.name}
                  />
                </label>
                <label className="app-label mt-3">
                  About this circle
                  <textarea
                    className="app-input"
                    name="description"
                    maxLength={2000}
                    rows={3}
                    defaultValue={c.description}
                  />
                </label>
                {org && isOwner && (
                  <>
                    <h3 className="mt-5">Organisation</h3>
                    <p className="app-note mt-2">
                      Updating these details resets verification for a new team
                      check.
                    </p>
                    <label className="app-label mt-3">
                      Organisation name
                      <input
                        className="app-input"
                        name="organisation_name"
                        defaultValue={org.name}
                        required
                      />
                    </label>
                    <label className="app-label mt-3">
                      Website
                      <input
                        className="app-input"
                        name="website"
                        type="url"
                        defaultValue={org.website}
                        required
                      />
                    </label>
                    <label className="app-label mt-3">
                      Work email domain
                      <input
                        className="app-input"
                        name="domain"
                        defaultValue={org.domain}
                        required
                      />
                    </label>
                  </>
                )}
              </ActionForm>
            </section>
          )}
          {active && isOwner && (
            <section className="app-panel">
              <h2>Ownership & history</h2>
              <p className="app-note mt-3">
                You can transfer ownership to an accepted member. The new owner
                can change admin access and archive this circle.
              </p>
              <Link className="app-button mt-4" href={`${base}?tab=people`}>
                Choose a new owner from People →
              </Link>
              <div className="mt-4">
                <ConfirmForm
                  title="Archive this circle?"
                  trigger="Archive circle"
                  description="Members can still read its history. New invitations, shared occasions and gifts from this circle will pause. You can restore it later."
                  action={action}
                  label="Archive circle"
                >
                  <Hidden op="archive" />
                  <label className="app-check mt-3">
                    <input type="checkbox" name="confirm" required />I
                    understand pending invitations will be revoked.
                  </label>
                </ConfirmForm>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
