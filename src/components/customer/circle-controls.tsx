"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRouter } from "next/navigation";
import { LoaderCircle, Copy, Link2 } from "lucide-react";
import {
  createCircleAction,
  inviteCircleAction,
  acceptCircleAction,
  type CircleActionResult,
} from "@/app/account/circles/actions";
import {
  circleCategories,
  institutionalCategories,
  type CircleCategory,
} from "@/lib/customer/circle-model";
function Busy({ pending, label }: { pending: boolean; label: string }) {
  const hydrated = useHydrated();
  return (
    <button
      className="app-button primary app-pending-button"
      disabled={pending || !hydrated}
      aria-busy={pending}
      aria-label={label}
    >
      <span style={{ visibility: pending ? "hidden" : "visible" }}>
        {label}
      </span>
      {pending && (
        <span className="app-button-pending" aria-hidden>
          <LoaderCircle size={16} className="app-spinner" />
          Working…
        </span>
      )}
    </button>
  );
}
function Result({ result }: { result: CircleActionResult | null }) {
  return result ? (
    <p className="app-soft mt-4" role={result.ok ? "status" : "alert"}>
      {result.message}
    </p>
  ) : null;
}
export function CreateCircleForm({
  id,
  displayName,
}: {
  id: string;
  displayName: string;
}) {
  const [category, setCategory] = useState<CircleCategory>("family"),
    [result, setResult] = useState<CircleActionResult | null>(null),
    [pending, start] = useTransition(),
    lock = useRef(false),
    router = useRouter();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    const data = new FormData(e.currentTarget);
    lock.current = true;
    start(async () => {
      try {
        const r = await createCircleAction(id, data);
        setResult(r);
        if (r.ok && r.id) router.push(`/account/circles/${r.id}`);
      } catch {
        setResult({
          ok: false,
          message:
            "We couldn’t confirm creation. Retry with the same form to check safely.",
        });
      } finally {
        lock.current = false;
      }
    });
  }
  return (
    <form onSubmit={submit} className="app-panel" aria-busy={pending}>
      <fieldset disabled={pending}>
        <div className="app-fields">
          <label className="app-label">
            Circle name
            <input
              className="app-input"
              name="name"
              minLength={2}
              maxLength={120}
              required
              placeholder="Our family, a team, a community…"
            />
          </label>
          <label className="app-label">
            Kind of circle
            <select
              className="app-input"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as CircleCategory)}
            >
              {Object.entries(circleCategories).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="app-label mt-4">
          A little about this circle
          <textarea
            className="app-input"
            name="description"
            maxLength={2000}
            rows={3}
          />
        </label>
        <label className="app-label mt-4">
          Your name in this circle
          <input
            className="app-input"
            name="display_name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={displayName}
          />
        </label>
        {institutionalCategories.has(category) && (
          <div className="app-soft mt-5">
            <h2>Organisation details</h2>
            <p className="app-note">
              These details support a simple team check. A domain match does not
              verify an organisation or automatically add members.
            </p>
            <label className="app-label mt-3">
              Organisation name
              <input
                className="app-input"
                name="organisation_name"
                required
                minLength={2}
                maxLength={160}
              />
            </label>
            <div className="app-fields mt-3">
              <label className="app-label">
                Website
                <input
                  className="app-input"
                  name="website"
                  type="url"
                  required
                  placeholder="https://company.com"
                />
              </label>
              <label className="app-label">
                Work email domain
                <input
                  className="app-input"
                  name="domain"
                  required
                  placeholder="company.com"
                />
              </label>
            </div>
          </div>
        )}
        <p className="app-note mt-4">
          You’ll own and administer this private circle. People join by
          accepting an invitation. Their profiles and your private gifts stay
          under their existing sharing controls.
        </p>
        <div className="app-actions mt-5">
          <Busy pending={pending} label="Create circle" />
        </div>
      </fieldset>
      <Result result={result} />
    </form>
  );
}
export function CircleInviteForm({
  id,
  owner,
  recipient,
  emailConfigured,
}: {
  id: string;
  owner: boolean;
  recipient?: { id: string; name: string; email: string };
  emailConfigured: boolean;
}) {
  const [result, setResult] = useState<CircleActionResult | null>(null),
    [pending, start] = useTransition(),
    lock = useRef(false);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    const data = new FormData(e.currentTarget);
    lock.current = true;
    start(async () => {
      try {
        setResult(await inviteCircleAction(id, data));
      } catch {
        setResult({
          ok: false,
          message:
            "We couldn’t confirm this invitation. Check pending invitations before retrying.",
        });
      } finally {
        lock.current = false;
      }
    });
  }
  return (
    <form className="app-panel" onSubmit={submit} aria-busy={pending}>
      <h2>Invite someone in</h2>
      <p className="app-note">
        No account is created for them. They join using this email, then choose
        what to share.
      </p>
      <fieldset disabled={pending}>
        <input type="hidden" name="recipient_id" value={recipient?.id || ""} />
        <div className="app-fields mt-3">
          <label className="app-label">
            Their name
            <input
              className="app-input"
              name="display_name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={recipient?.name}
            />
          </label>
          <label className="app-label">
            Invitation email
            <input
              className="app-input"
              type="email"
              name="email"
              required
              defaultValue={recipient?.email}
            />
          </label>
        </div>
        <label className="app-label mt-3">
          Access
          <select className="app-input" name="role">
            <option value="member">Member</option>
            {owner && <option value="admin">Admin</option>}
          </select>
        </label>
        <label className="app-check mt-3">
          <input type="checkbox" name="replace" />
          Replace any existing invitation for this email; its old link will stop
          working.
        </label>
        <label className="app-check mt-3">
          <input
            type="checkbox"
            name="send_email"
            disabled={!emailConfigured}
          />
          Also email the invitation
          {!emailConfigured ? " · email is not configured" : ""}
        </label>
        <div className="app-actions mt-4">
          <Busy pending={pending} label="Create invitation" />
        </div>
      </fieldset>
      <Result result={result} />
      {result?.url && (
        <div className="app-soft mt-4">
          <label className="app-label">
            Invitation link
            <input
              className="app-input"
              value={result.url}
              readOnly
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button
            type="button"
            className="app-button mt-3"
            onClick={() =>
              navigator.clipboard
                .writeText(result.url!)
                .then(() =>
                  setResult({ ...result, message: "Invitation link copied." }),
                )
                .catch(() =>
                  setResult({
                    ...result,
                    message: "Select and copy the invitation link.",
                  }),
                )
            }
          >
            <Copy size={16} />
            Copy invitation link
          </button>
          <p className="app-note">
            <Link2 size={14} className="inline" /> Only the invited email can
            accept this link.
          </p>
        </div>
      )}
    </form>
  );
}
export function AcceptCircleForm({
  token,
  displayName,
  circleId,
}: {
  token: string;
  displayName: string;
  circleId: string;
}) {
  const [result, setResult] = useState<CircleActionResult | null>(null),
    [pending, start] = useTransition(),
    lock = useRef(false),
    router = useRouter();
  return (
    <form
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (lock.current) return;
        const data = new FormData(e.currentTarget);
        lock.current = true;
        start(async () => {
          try {
            const r = await acceptCircleAction(token, data);
            setResult(r);
            if (r.ok) router.push(`/account/circles/${r.id || circleId}`);
          } catch {
            setResult({
              ok: false,
              message:
                "This invitation could not be accepted. Please try again.",
            });
          } finally {
            lock.current = false;
          }
        });
      }}
    >
      <fieldset disabled={pending}>
        <label className="app-label mt-4">
          Your name in this circle
          <input
            className="app-input"
            name="display_name"
            defaultValue={displayName}
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label className="app-check mt-4">
          <input type="checkbox" name="share_profile" />
          Share my profile and interests with accepted members of this circle.
        </label>
        <p className="app-note">
          Sharing is optional and can be turned off at any time. Circle admins
          can see your account email to manage access. Your private gifts and
          personal notes are not shared.
        </p>
        <div className="app-actions mt-4">
          <Busy pending={pending} label="Accept invitation" />
        </div>
      </fieldset>
      <Result result={result} />
    </form>
  );
}
