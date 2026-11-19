import { randomUUID } from "node:crypto";
import { ActionForm } from "./action-form";
import { circleCommandAction } from "@/app/account/circles/actions";
import type {
  CircleOccasion,
  CircleRecipient,
} from "@/lib/customer/circle-model";
export function RecipientFields({
  circleId,
  recipient: r,
}: {
  circleId: string;
  recipient?: CircleRecipient;
}) {
  return (
    <ActionForm
      action={circleCommandAction.bind(null, circleId)}
      label={r ? "Save recipient" : "Add recipient"}
    >
      <input type="hidden" name="op" value="recipient" />
      <input type="hidden" name="recipient_id" value={r?.id || randomUUID()} />
      <div className="app-fields mt-3">
        <label className="app-label">
          Name
          <input
            className="app-input"
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={r?.name}
          />
        </label>
        <label className="app-label">
          Email · optional
          <input
            className="app-input"
            name="email"
            type="email"
            defaultValue={r?.email}
          />
        </label>
      </div>
      <label className="app-label mt-3">
        About them
        <textarea
          className="app-input"
          name="about"
          rows={2}
          maxLength={2000}
          defaultValue={r?.about}
        />
      </label>
      <div className="app-fields mt-3">
        <label className="app-label">
          Likes & interests
          <input
            className="app-input"
            name="likes"
            maxLength={1000}
            defaultValue={r?.likes}
          />
        </label>
        <label className="app-label">
          Best to avoid
          <input
            className="app-input"
            name="avoid"
            maxLength={1000}
            defaultValue={r?.avoid}
          />
        </label>
      </div>
      <p className="app-note mt-3">
        Recipient notes are visible to this circle’s admins. Adding a recipient
        does not create an account or grant membership.
      </p>
    </ActionForm>
  );
}
export function CircleOccasionFields({
  circleId,
  occasion: o,
}: {
  circleId: string;
  occasion?: CircleOccasion;
}) {
  return (
    <ActionForm
      action={circleCommandAction.bind(null, circleId)}
      label={o ? "Save occasion" : "Share occasion"}
    >
      <input type="hidden" name="op" value="occasion" />
      <input type="hidden" name="occasion_id" value={o?.id || randomUUID()} />
      <div className="app-fields mt-3">
        <label className="app-label">
          What are we celebrating?
          <input
            className="app-input"
            name="title"
            required
            minLength={2}
            maxLength={160}
            defaultValue={o?.title}
          />
        </label>
        <label className="app-label">
          Occasion date
          <input
            className="app-input"
            name="occasion_date"
            type="date"
            required
            defaultValue={o?.occasion_date}
          />
        </label>
      </div>
      <label className="app-label mt-3">
        A little context
        <textarea
          className="app-input"
          name="description"
          rows={2}
          maxLength={2000}
          defaultValue={o?.description}
        />
      </label>
      <label className="app-check mt-3">
        <input
          type="checkbox"
          name="repeats_annually"
          defaultChecked={o?.repeats_annually}
        />
        Happens every year
      </label>
      <label className="app-check mt-3">
        <input type="checkbox" name="publish" required />
        Show this occasion to accepted members of this circle.
      </label>
    </ActionForm>
  );
}
