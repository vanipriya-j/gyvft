import { PrivateDetailsForm } from "./private-details-form";
import { privateDetailsVersion } from "@/lib/customer/private-details";
import type { Person, Occasion, Profile } from "@/lib/customer/journey-model";
export function PersonForm({
  accountId,
  id,
  person,
}: {
  accountId: string;
  id: string;
  person?: Person;
}) {
  return (
    <PrivateDetailsForm
      accountId={accountId}
      kind="person"
      id={id}
      version={privateDetailsVersion("person", person)}
      isNew={!person}
      successHref={`/account/people/${id}`}
      label="Save person"
    >
      <div className="app-fields">
        {(["name", "relationship", "email"] as const).map((k) => (
          <label className="app-label" key={k}>
            {k === "name"
              ? "Their name"
              : k === "relationship"
                ? "Relationship"
                : "Email for an optional invitation"}
            <input
              className="app-input"
              name={k}
              type={k === "email" ? "email" : "text"}
              defaultValue={person?.[k]}
              required={k === "name"}
              maxLength={k === "email" ? 254 : 120}
            />
          </label>
        ))}
      </div>
      {(["about", "likes", "avoid"] as const).map((k) => (
        <label className="app-label" key={k}>
          {k === "about"
            ? "Write a little about them"
            : k === "likes"
              ? "Likes and interests"
              : "Anything to avoid"}
          <textarea
            className="app-input"
            name={k}
            defaultValue={person?.[k]}
            maxLength={k === "about" ? 2000 : 1000}
          />
        </label>
      ))}
      <p className="app-note">
        These are your private notes. An invitation lets them share their own
        profile separately.
      </p>
    </PrivateDetailsForm>
  );
}
export function ProfileForm({
  accountId,
  profile,
}: {
  accountId: string;
  profile: Profile;
}) {
  return (
    <PrivateDetailsForm
      accountId={accountId}
      kind="profile"
      id={accountId}
      version={privateDetailsVersion("profile", profile)}
      label="Save my profile"
    >
      {(["name", "about", "interests", "avoid"] as const).map((k) => (
        <label className="app-label" key={k}>
          {k === "name"
            ? "Your name"
            : k === "about"
              ? "A little about you"
              : k === "interests"
                ? "Things you enjoy"
                : "Anything to avoid"}
          {k === "name" ? (
            <input
              className="app-input"
              name={k}
              defaultValue={profile[k]}
              required
              maxLength={120}
            />
          ) : (
            <textarea
              className="app-input"
              name={k}
              defaultValue={profile[k]}
              maxLength={k === "about" ? 2000 : 1000}
            />
          )}
        </label>
      ))}
      <label className="app-check">
        <input
          type="checkbox"
          name="share_profile"
          defaultChecked={profile.share_profile}
        />
        Share my profile with people whose invitations I’ve accepted
      </label>
      <p className="app-note">
        Your profile is private by default. Turn sharing off at any time; this
        also stops connected people from reading it.
      </p>
    </PrivateDetailsForm>
  );
}
export function OccasionForm({
  accountId,
  id,
  occasion,
  people,
}: {
  accountId: string;
  id: string;
  occasion?: Occasion;
  people: Person[];
}) {
  return (
    <PrivateDetailsForm
      accountId={accountId}
      kind="occasion"
      id={id}
      version={privateDetailsVersion("occasion", occasion)}
      isNew={!occasion}
      successHref={`/account/occasions/${id}`}
      label="Save occasion"
    >
      <div className="app-fields">
        <label className="app-label">
          Occasion name
          <input
            className="app-input"
            name="title"
            defaultValue={occasion?.title}
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label className="app-label">
          Occasion date
          <input
            className="app-input"
            name="occasion_date"
            type="date"
            defaultValue={occasion?.occasion_date}
            required
          />
        </label>
        <label className="app-label">
          Who is it for? (optional)
          <select
            className="app-input"
            name="person_id"
            defaultValue={occasion?.person_id || ""}
          >
            <option value="">Choose later</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="app-label">
          Relationship / circle (optional)
          <input
            className="app-input"
            name="relationship"
            defaultValue={occasion?.relationship}
            maxLength={100}
          />
        </label>
      </div>
      <label className="app-check">
        <input
          type="checkbox"
          name="repeats_annually"
          defaultChecked={occasion?.repeats_annually}
        />
        This occasion returns every year
      </label>
      <label className="app-label">
        A note for next time
        <textarea
          className="app-input"
          name="notes"
          defaultValue={occasion?.notes}
          maxLength={2000}
        />
      </label>
      <p className="app-note">
        The occasion date and requested gift delivery date are separate. This
        stays in your private calendar.
      </p>
    </PrivateDetailsForm>
  );
}
