"use client";
import { useHydrated } from "@/hooks/use-hydrated";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGiftBrief } from "@/app/account/journey-actions";
import type { GiftBrief } from "@/lib/customer/journey-model";
const labels = [
  "Your story",
  "The occasion",
  "The recipients",
  "What it should say",
  "Your budget",
  "Where & when",
  "Review & send",
];
export function GiftIntake({
  id,
  initial = {},
  email,
  submitted = false,
}: {
  id: string;
  initial?: Partial<GiftBrief>;
  email: string;
  submitted?: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [giftId] = useState(id);
  const [step, setStep] = useState(0),
    [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    [brief, setBrief] = useState<GiftBrief>({
      title: "",
      story: "",
      occasion: "Birthday",
      audience: "One person",
      recipients: 1,
      recipient_notes: "",
      individuals: [],
      likes: "",
      avoid: "",
      message: "",
      formats: "A curated hamper",
      budget: "",
      budget_basis: "per_recipient",
      delivery_date: "",
      city: "",
      phone: "",
      occasion_id: null,
      person_id: null,
      ...initial,
    });
  const update = (key: keyof GiftBrief, value: unknown) =>
    setBrief((b) => ({ ...b, [key]: value }));
  const field = (
    key: keyof GiftBrief,
    label: string,
    opts: {
      area?: boolean;
      type?: string;
      min?: number;
      max?: number;
      required?: boolean;
    } = {},
  ) => (
    <label className="app-label">
      {label}
      {opts.area ? (
        <textarea
          className="app-input"
          rows={3}
          value={String(brief[key] || "")}
          maxLength={key === "story" ? 20000 : 5000}
          required={opts.required}
          minLength={key === "story" ? 40 : undefined}
          onChange={(e) => update(key, e.target.value)}
        />
      ) : (
        <input
          className="app-input"
          type={opts.type || "text"}
          value={String(brief[key] ?? "")}
          min={opts.min}
          max={opts.max}
          required={opts.required}
          onChange={(e) =>
            update(
              key,
              key === "recipients" ? Number(e.target.value) : e.target.value,
            )
          }
        />
      )}
    </label>
  );
  async function save(draft: boolean) {
    start(async () => {
      const r = await saveGiftBrief(giftId, brief, draft);
      setMessage(r.message);
      if (r.ok && "id" in r) {
        router.push(`/account/projects/${r.id}${draft ? "?view=edit" : ""}`);
        router.refresh();
      }
    });
  }
  return (
    <div className="app-stack">
      <div className="app-title">
        <div>
          <p className="app-eyebrow">A little thought begins here</p>
          <h1>{initial.title ? "Shape your gift" : "Start a new gift"}</h1>
          <p>Tell us about the people and the moment. We’ll do the curating.</p>
        </div>
        {!submitted && (
          <button
            className="app-button"
            type="button"
            disabled={pending || !hydrated}
            onClick={() => void save(true)}
          >
            Save private draft
          </button>
        )}
      </div>
      <p className="app-muted">
        Step {step + 1} of 7 · {labels[step]}
      </p>
      <form
        className="app-panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 6) setStep((s) => s + 1);
          else void save(false);
        }}
      >
        <h2>{labels[step]}</h2>
        {step === 0 && (
          <>
            {field("title", "Give this gift a name", { required: true })}
            {field("story", "Tell us the story", {
              area: true,
              required: true,
            })}
            <p className="app-muted mt-2">
              A memory, a thank-you or what you hope this gift will make them
              feel. At least 40 characters.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            {field("occasion", "What are you celebrating?", { required: true })}
            <p className="app-note">
              You can record the occasion date separately after sending your
              brief. Delivery can be earlier.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <label className="app-label">
              Who are the gifts for?
              <select
                className="app-input"
                value={brief.audience}
                onChange={(e) => update("audience", e.target.value)}
              >
                {["One person", "One group", "Separate individuals"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            {field("recipients", "How many recipients?", {
              type: "number",
              min: 1,
              max: 10000,
              required: true,
            })}
            {field(
              "recipient_notes",
              "Describe them — names, relationships or the group",
              { area: true },
            )}
            {brief.audience === "Separate individuals" && (
              <div className="app-stack mt-4">
                {brief.individuals.map((person, i) => (
                  <fieldset key={i} className="app-soft">
                    <legend>Recipient {i + 1}</legend>
                    {(["name", "likes", "avoid"] as const).map((key) => (
                      <label className="app-label" key={key}>
                        {key === "name"
                          ? "Name"
                          : key === "likes"
                            ? "Likes and interests"
                            : "Anything to avoid"}
                        <input
                          className="app-input"
                          value={person[key]}
                          onChange={(e) =>
                            update(
                              "individuals",
                              brief.individuals.map((p, n) =>
                                n === i ? { ...p, [key]: e.target.value } : p,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                    <button
                      className="app-button quiet"
                      type="button"
                      onClick={() =>
                        update(
                          "individuals",
                          brief.individuals.filter((_, n) => n !== i),
                        )
                      }
                    >
                      Remove recipient {i + 1}
                    </button>
                  </fieldset>
                ))}
                <button
                  className="app-button"
                  type="button"
                  disabled={brief.individuals.length >= 50}
                  onClick={() =>
                    update("individuals", [
                      ...brief.individuals,
                      { name: "", likes: "", avoid: "" },
                    ])
                  }
                >
                  Add another recipient
                </button>
              </div>
            )}
            {field("likes", "Shared likes & interests", { area: true })}
            {field("avoid", "Anything to avoid", { area: true })}
          </>
        )}
        {step === 3 && (
          <>
            {field("message", "What should the gift communicate?", {
              area: true,
            })}
            {field("formats", "Any products or formats in mind?")}
            <p className="app-muted mt-2">
              It can speak about you, the recipient or the occasion. It’s fine
              to leave product choices to us.
            </p>
          </>
        )}
        {step === 4 && (
          <>
            {field("budget", "Budget or range (₹)", { required: true })}
            <label className="app-label">
              Is that per recipient or for the whole gift?
              <select
                className="app-input"
                value={brief.budget_basis}
                onChange={(e) => update("budget_basis", e.target.value)}
              >
                <option value="per_recipient">Per recipient</option>
                <option value="total">Total budget</option>
              </select>
            </label>
            <p className="app-note">
              Packaging depends on hamper size and your choice. Keep a little
              aside; delivery is separate at actuals. Taxes will be included in
              your quote.
            </p>
          </>
        )}
        {step === 5 && (
          <>
            {field("delivery_date", "Requested delivery date", {
              type: "date",
            })}
            {field("city", "Delivery city", { required: true })}
            <p className="app-muted mt-2">
              This is your requested date. Aarla will confirm feasibility.
            </p>
          </>
        )}
        {step === 6 && (
          <>
            <div className="app-soft">
              <h3>{brief.title}</h3>
              <p className="mt-2 whitespace-pre-wrap">{brief.story}</p>
              <p className="mt-2">
                {brief.recipients} recipients · {brief.occasion}
              </p>
              <p>
                ₹{brief.budget}{" "}
                {brief.budget_basis === "total" ? "total" : "per recipient"} ·{" "}
                {brief.city}
              </p>
              <p>
                {brief.delivery_date
                  ? `Delivery requested ${brief.delivery_date}`
                  : "Delivery date to discuss"}
              </p>
            </div>
            {field("phone", "Phone / WhatsApp", { required: true })}
            <p className="app-muted mt-3">
              Your account: {email}. This request stays private to you and the
              Aarla team. Sending it does not approve a quote or place an order.
            </p>
          </>
        )}
        <div className="app-actions">
          <button
            className="app-button"
            type="button"
            disabled={pending || !hydrated || step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </button>
          <button
            className="app-button primary"
            disabled={pending || !hydrated}
          >
            {pending
              ? "Saving…"
              : step === 6
                ? submitted
                  ? "Send updated brief"
                  : "Send my story"
                : `Continue to ${labels[step + 1].toLowerCase()}`}
          </button>
        </div>
        <p role={message ? "status" : undefined} className="app-muted mt-3">
          {message}
        </p>
      </form>
    </div>
  );
}
