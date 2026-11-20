import { MomentUploader } from "@/components/customer/moment-uploader";
import { shipmentsForProject } from "@/lib/customer/shipping";
import { CustomerShipments } from "@/components/customer/shipments";
/* eslint-disable @next/next/no-img-element -- Session-protected gift media. */
import Link from "@/components/ui/navigation-link";
import { notFound } from "next/navigation";
import { requireCustomerAccount } from "@/lib/customer/session";
import { requestForAccount } from "@/lib/customer/request";
import {
  requestWorkflow,
  requestStateLabels,
  latestApproval,
} from "@/lib/customer/request-workflow";
import { dateKey } from "@/lib/customer/dashboard-model";
import { giftLocked } from "@/lib/customer/journey-model";
import { briefFromProject } from "@/lib/customer/journeys";
import { money, safePaymentUrl, stages } from "@/lib/customer/model";
import { GiftSnapshot } from "@/components/customer/gift-workspace";
import { GiftIntake } from "@/components/customer/gift-intake";
import { ActionForm } from "@/components/customer/action-form";
import {
  ConfirmForm,
  PhotoActions,
  GiftSectionSelect,
} from "@/components/customer/journey-controls";
import { PaymentCommitment } from "@/components/customer/payment-commitment";
import { CustomerStoryDetails } from "@/components/customer/story-details";
import { UPIPayment } from "@/components/customer/upi-payment";
import {
  sendMessage,
  submitPayment,
  decideApproval,
  saveDeliveryAddress,
  correctPaymentProof,
} from "../../actions";
import { saveRequestDates } from "../../dashboard-actions";
import { changeGiftVersion, feedbackForGift } from "../../journey-actions";
export const dynamic = "force-dynamic";
const day = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "Not set";
export default async function GiftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const account = await requireCustomerAccount(`/account/projects/${id}`),
    request = await requestForAccount(id, account.id);
  if (!request) notFound();
  const {
    project: p,
    approvals,
    payments,
    events,
    messages,
    giftSelections,
    options,
    address,
    upi,
    moments,
    changes,
  } = request;
  const q = latestApproval(approvals, "proposal"),
    sample = String(p.submission_key || "").startsWith("gyvft-demo-"),
    art = latestApproval(approvals, "design"),
    chosen = giftSelections[0],
    locked = giftLocked(p),
    brief = briefFromProject(p);
  const total = Number(q?.amount_paise || p.total_paise || 0),
    paid = Number(p.paid_paise),
    pending = payments
      .filter((x) => x.status === "pending")
      .reduce((n, x) => n + Number(x.amount_paise), 0);
  const currentQuote =
    q && (!chosen || q.gift_selection_id === chosen.id) ? q : null;
  const state = requestWorkflow({
    kind: p.kind,
    stage: p.stage,
    total,
    paid,
    approvals,
    selectionId: chosen?.id || null,
    visibleOptions: options.length,
    pendingPayment: pending > 0,
  });
  const requested = (await searchParams).view || "overview",
    view = requested === "details" ? "brief" : requested;
  const shipping =
    view === "delivery" ? await shipmentsForProject(id, account.id) : null;
  const sections = [
    ["overview", "Overview"],
    ["brief", "Brief"],
    ["options", "Options"],
    ["quote", "Quote & pay"],
    ["design", "Design"],
    ["delivery", "Delivery"],
    ["moments", "Moments"],
    ["messages", "Messages"],
    ["activity", "Activity"],
  ].map(([key, label]) => ({
    id: key,
    label,
    href: `/account/projects/${id}${key === "options" ? "/options" : key === "overview" ? "" : `?view=${key}`}`,
  }));
  const href = (v: string) =>
    `/account/projects/${id}${v === "options" ? "/options" : `?view=${v}`}`;
  if (p.is_draft || view === "edit")
    return (
      <GiftIntake
        id={id}
        initial={brief}
        email={account.email}
        submitted={!p.is_draft}
      />
    );
  const next: Record<string, [string, string, string]> = {
    options_ready: [
      "Your gift options are ready.",
      "Choose as it is, customise a copy or build an option of your own.",
      "options",
    ],
    quote_requested: [
      "Your chosen gift is with Aarla.",
      "We’re confirming the exact composition and final charges.",
      "options",
    ],
    quote_review: [
      "Your quote is ready.",
      "Check the exact gift and total before approving this version.",
      "quote",
    ],
    quote_changes: [
      "Your requested changes are with Aarla.",
      "We’ll publish a new version for you to review.",
      "quote",
    ],
    advance_due: [
      "Let’s get your gift underway.",
      "Your approved quote is ready for the 50% advance.",
      "quote",
    ],
    payment_review: [
      "Your payment is being checked.",
      "Allow up to 24 hours. Please don’t pay again while we verify receipt.",
      "quote",
    ],
    design_review: [
      "Your artwork is ready.",
      "Check spelling, names and placement before approving this version.",
      "design",
    ],
    balance_due: [
      "The finishing touches.",
      "The remaining balance is due before dispatch.",
      "quote",
    ],
    production_ready: [
      "Your gift is ready to be made.",
      "Your artwork is approved. Aarla will confirm the start of production.",
      "delivery",
    ],
    production: [
      "Your gifts are being made.",
      "Your approved gift and artwork are locked for production.",
      "delivery",
    ],
    dispatched: [
      "A little thought is on its way.",
      "Follow the dispatch and tracking details here.",
      "delivery",
    ],
    delivered: [
      "The gift is theirs. The memories are yours.",
      "Keep the celebration, the handover and the little moments here.",
      "moments",
    ],
    completed: [
      "A story worth remembering.",
      "Share how it felt, or build on this gift for another occasion.",
      "moments",
    ],
  };
  const current = next[state] || [
    requestStateLabels[state],
    p.next_action,
    "messages",
  ];
  function renderDecision(a: NonNullable<typeof q>) {
    if (sample)
      return (
        <p className="app-note">
          Fictional sample ·{" "}
          {a.status === "approved"
            ? "approved in this example"
            : "shown for review"}
          . No live approval or payment is requested.
        </p>
      );
    return (
      <div className="app-actions">
        {!locked && a.status === "pending" && (
          <ConfirmForm
            title={`Approve ${a.kind === "design" ? "artwork" : "quote"} v${a.version}?`}
            trigger={`Approve ${a.kind === "design" ? "artwork" : "quote"} v${a.version}`}
            label="Confirm approval"
            primary
            description={
              a.kind === "proposal"
                ? `${chosen?.snapshot.recipients || brief.recipients || "Your"} gifts · ${money(Number(a.amount_paise || 0))}. This approves the exact gift and published quote version.`
                : "Confirm spelling, names, placement and the exact production artwork."
            }
            action={decideApproval.bind(null, id, a.id)}
          >
            <input type="hidden" name="decision" value="approved" />
            <p>
              {a.kind === "proposal"
                ? `50% advance after approval; the remaining 50% is due before dispatch.`
                : "Once production starts, no changes can be made."}
            </p>
            <label className="app-check">
              <input type="checkbox" required />
              I’ve checked this version and approve it.
            </label>
          </ConfirmForm>
        )}
        {!locked && (a.kind === "design" || !p.shopify_order_reference) && (
          <ConfirmForm
            title={`Changes to ${a.kind === "design" ? "artwork" : "quote"} v${a.version}`}
            trigger="Request changes"
            label="Send change request"
            description="Your request stays attached to this exact version. Aarla will confirm the effect on price or timing."
            action={changeGiftVersion.bind(null, id, a.id)}
          >
            <label>
              What would you like to change?
              <textarea
                name="body"
                className="app-input"
                required
                maxLength={4000}
              />
            </label>
          </ConfirmForm>
        )}
      </div>
    );
  }
  return (
    <div className="app-stack">
      <div>
        <Link className="app-button quiet" href="/account/gifts">
          ← My gifts
        </Link>
        <div className="app-title">
          <h1>{p.title}</h1>
          <span
            className={`app-badge ${["quote_review", "design_review", "advance_due", "balance_due"].includes(state) ? "attention" : ""}`}
          >
            {requestStateLabels[state]}
          </span>
        </div>
        <div className="app-facts">
          <span>
            {chosen?.snapshot.recipients || brief.recipients || "Your"}{" "}
            recipients
          </span>
          <span>Occasion {day(p.occasion_date)}</span>
          <span>
            Delivery requested {day(p.delivery_date || p.target_date)}
          </span>
          {p.occasion_id && (
            <Link
              className="underline"
              href={`/account/occasions/${p.occasion_id}`}
            >
              Linked occasion
            </Link>
          )}
        </div>
        <nav className="app-tabs" aria-label="Gift sections">
          {sections.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              scroll={false}
              aria-current={view === s.id ? "page" : undefined}
            >
              {s.label}
              {(s.id === "quote" &&
                ["quote_review", "advance_due", "balance_due"].includes(
                  state,
                )) ||
              (s.id === "design" && state === "design_review")
                ? " •"
                : ""}
            </Link>
          ))}
        </nav>
        <GiftSectionSelect value={view} sections={sections} />
      </div>
      {locked && ["brief", "quote", "design"].includes(view) && (
        <div className="app-soft">
          <strong>Production has started.</strong>
          <p>
            Changes to this gift and artwork are no longer possible. You can
            still message us for support.
          </p>
        </div>
      )}
      {view === "overview" && (
        <>
          <div className="app-grid">
            <div className="app-stack">
              <section className="app-panel">
                <p className="app-eyebrow">Your next step</p>
                <h2>{current[0]}</h2>
                <p className="app-muted">{current[1]}</p>
                <Link
                  className="app-button primary mt-4"
                  href={href(current[2])}
                >
                  {current[2] === "options"
                    ? "Review options"
                    : current[2] === "quote"
                      ? "Quote & payment"
                      : current[2] === "design"
                        ? "Review artwork"
                        : current[2] === "moments"
                          ? "Keep the moment"
                          : current[2] === "delivery"
                            ? "Track delivery"
                            : "Message Aarla"}{" "}
                  →
                </Link>
              </section>
              <section className="app-panel">
                <h2>Your story</h2>
                <p className="whitespace-pre-wrap">{p.brief}</p>
                <Link className="app-button quiet mt-3" href={href("brief")}>
                  Brief & recipients →
                </Link>
              </section>
            </div>
            <section className="app-panel">
              <h2>
                {chosen ? "Your chosen gift" : "A thought becoming a gift"}
              </h2>
              {art?.has_image || q?.has_image || options[0]?.has_image ? (
                <img
                  className="app-image"
                  src={`/api/customer-assets/${art?.has_image || q?.has_image ? "approval" : "gift-option"}/${art?.has_image ? art.id : q?.has_image ? q.id : options[0].id}`}
                  alt="Gift visual shared by Aarla"
                />
              ) : (
                <img
                  className="app-image"
                  src="/images/gyvft/homepage/02-gifts-keepsakes.png"
                  alt="A thoughtful gift, ready to become someone’s story"
                />
              )}
              {chosen && (
                <div className="mt-3">
                  <GiftSnapshot document={chosen.snapshot} />
                </div>
              )}
            </section>
          </div>
          <section className="app-panel">
            <h2>Latest update</h2>
            <p>{events.at(-1)?.title || "Your story is with Aarla."}</p>
            <p className="app-muted mt-2">
              {events.at(-1)?.body || p.next_action}
            </p>
            <Link className="app-button quiet mt-3" href={href("activity")}>
              View activity →
            </Link>
          </section>
        </>
      )}
      {view === "brief" && (
        <div className="app-grid">
          <div className="app-stack">
            <section className="app-panel">
              <h2>Your story</h2>
              <p className="whitespace-pre-wrap">{p.brief}</p>
              {brief.recipient_notes && (
                <p className="mt-3 whitespace-pre-wrap">
                  {brief.recipient_notes}
                </p>
              )}
              {brief.likes && <p className="mt-3">Likes: {brief.likes}</p>}
              {brief.avoid && <p className="mt-3">Avoid: {brief.avoid}</p>}
              {brief.individuals?.map((r, i) => (
                <div key={i} className="app-soft mt-3">
                  <strong>{r.name || `Recipient ${i + 1}`}</strong>
                  <p>{r.likes}</p>
                  <p className="app-muted">{r.avoid && `Avoid: ${r.avoid}`}</p>
                </div>
              ))}
              {brief.message && (
                <p className="mt-3">What it should say: {brief.message}</p>
              )}
              {brief.budget && (
                <p className="mt-3">
                  Budget: ₹{brief.budget}{" "}
                  {brief.budget_basis === "total" ? "total" : "per recipient"}
                </p>
              )}
              <CustomerStoryDetails value={p.gift_brief} />
              {!locked && !q && (
                <Link className="app-button mt-4" href={href("edit")}>
                  Edit brief
                </Link>
              )}
              {p.person_id && (
                <Link
                  className="app-button quiet"
                  href={`/account/people/${p.person_id}`}
                >
                  About the recipient →
                </Link>
              )}
            </section>
          </div>
          <section className="app-panel">
            <h2>Occasion & delivery</h2>
            <p className="app-muted">
              The day you’re celebrating and the day gifts need to arrive can be
              different.
            </p>
            {!locked ? (
              <ActionForm
                label="Save dates"
                action={saveRequestDates.bind(null, id)}
              >
                <label className="app-label">
                  Occasion date
                  <input
                    className="app-input"
                    type="date"
                    name="occasion_date"
                    defaultValue={
                      p.occasion_date ? dateKey(p.occasion_date) || "" : ""
                    }
                  />
                </label>
                <label className="app-label">
                  Requested delivery date
                  <input
                    className="app-input"
                    type="date"
                    name="delivery_date"
                    defaultValue={
                      p.delivery_date ? dateKey(p.delivery_date) || "" : ""
                    }
                  />
                </label>
              </ActionForm>
            ) : (
              <p className="mt-3">
                Occasion {day(p.occasion_date)} · Delivery requested{" "}
                {day(p.delivery_date)}
              </p>
            )}
          </section>
        </div>
      )}
      {view === "quote" && (
        <div className="app-quote">
          <div className="app-stack">
            {currentQuote ? (
              <>
                <section className="app-panel">
                  <div className="app-title">
                    <h2>Your exact gift</h2>
                    <span className="app-badge">
                      Quote v{q!.version} · {q!.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  {chosen ? (
                    <GiftSnapshot document={chosen.snapshot} />
                  ) : (
                    <p>{q!.description}</p>
                  )}
                </section>
                <section className="app-panel">
                  <h2>{q!.title}</h2>
                  <p className="app-muted whitespace-pre-wrap">
                    {q!.description}
                  </p>
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>Item / charge</th>
                        <th>Quantity</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q!.items?.map((x, i) => (
                        <tr key={i}>
                          <td>
                            {x.name}
                            {x.personalisation && (
                              <small className="block">
                                {x.personalisation}
                              </small>
                            )}
                          </td>
                          <td>{x.quantity}</td>
                          <td>{money(x.quantity * x.unit_paise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between mt-4">
                    <strong>Total · taxes included</strong>
                    <strong>{money(total)}</strong>
                  </div>
                  {renderDecision(q!)}
                  <p className="app-note">
                    Standard product printing is included. Individual
                    names/messages cost extra when listed. One design direction
                    and a minor change are complimentary above ₹4,000; for
                    smaller orders, let’s talk. Packaging and delivery are
                    charged as listed.
                  </p>
                </section>
              </>
            ) : (
              <section className="app-panel">
                <h2>Your quote is taking shape</h2>
                <p>
                  Choose a starting option, or request a quote for your chosen
                  gift.
                </p>
                <Link
                  className="app-button primary mt-4"
                  href={href("options")}
                >
                  Review options
                </Link>
              </section>
            )}
            {currentQuote?.status === "approved" &&
              !sample &&
              p.kind === "project" &&
              paid < total && (
                <section className="app-panel">
                  <h2>
                    {pending
                      ? "Your payment is under review"
                      : paid < Math.ceil(total / 2)
                        ? "Pay the advance"
                        : "Pay the balance"}
                  </h2>
                  {pending ? (
                    <p>
                      Please don’t pay again while we check your proof. Allow up
                      to 24 hours.
                    </p>
                  ) : (
                    <>
                      {safePaymentUrl(p.razorpay_url) && (
                        <a
                          className="app-button olive"
                          href={safePaymentUrl(p.razorpay_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open secure payment link
                        </a>
                      )}
                      {p.upi_id || upi?.upi_id ? (
                        <UPIPayment
                          id={id}
                          upiId={p.upi_id || upi.upi_id}
                          payee={upi?.payee_name || "Aarla"}
                          amount={
                            paid < Math.ceil(total / 2)
                              ? Math.ceil(total / 2) - paid
                              : total - paid
                          }
                          hasQR={
                            !!upi?.has_qr &&
                            (!p.upi_id || p.upi_id === upi.upi_id)
                          }
                        />
                      ) : (
                        <p className="app-muted">
                          The team will share receiving instructions here.
                          Message us if you’re ready to pay.
                        </p>
                      )}
                      <ActionForm
                        action={submitPayment.bind(null, id)}
                        label="Submit payment proof"
                      >
                        <label className="app-label">
                          Amount paid (₹)
                          <input
                            className="app-input"
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={(total - paid) / 100}
                            name="amount"
                            defaultValue={
                              (paid < Math.ceil(total / 2)
                                ? Math.ceil(total / 2) - paid
                                : total - paid) / 100
                            }
                            required
                          />
                        </label>
                        <label className="app-label">
                          UPI / payment transaction reference
                          <input
                            className="app-input"
                            name="reference"
                            required
                            minLength={6}
                            maxLength={100}
                          />
                        </label>
                        <label className="app-label">
                          Screenshot (PNG, JPEG or WebP, up to 2 MB)
                          <input
                            className="app-input"
                            name="evidence"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            required
                          />
                        </label>
                        <p className="app-note">
                          Uploading proof does not mark money as received. We
                          verify the actual receipt. Never share your UPI PIN.
                        </p>
                      </ActionForm>
                    </>
                  )}
                </section>
              )}
          </div>
          <aside className="app-stack">
            {total > 0 && (
              <PaymentCommitment
                total={total}
                paid={paid}
                pending={pending}
                approved={currentQuote?.status === "approved"}
              />
            )}
            <section className="app-panel">
              <h2>Payment record</h2>
              {payments.length ? (
                payments.map((x) => (
                  <article className="app-row" key={x.id}>
                    <div>
                      <strong>{money(Number(x.amount_paise))}</strong>
                      <p className="app-muted break-all">
                        {x.reference} ·{" "}
                        {x.status === "pending"
                          ? "Awaiting verification · up to 24 hours"
                          : x.status === "verified"
                            ? "Verified in bank"
                            : "Needs clarification"}
                      </p>
                      {["pending", "rejected"].includes(x.status) && (
                        <ConfirmForm
                          title="Correct payment proof"
                          trigger="Correct my submission"
                          label="Save corrected proof"
                          description="Update this submission only. Don’t pay again if money has already left your account."
                          action={correctPaymentProof.bind(null, id, x.id)}
                        >
                          <label>
                            Amount paid (₹)
                            <input
                              className="app-input"
                              name="amount"
                              type="number"
                              min="0.01"
                              step="0.01"
                              defaultValue={Number(x.amount_paise) / 100}
                              required
                            />
                          </label>
                          <label>
                            Transaction reference
                            <input
                              className="app-input"
                              name="reference"
                              defaultValue={x.reference}
                              required
                              minLength={6}
                              maxLength={100}
                            />
                          </label>
                          <label>
                            Corrected screenshot
                            <input
                              className="app-input"
                              name="evidence"
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              required
                            />
                          </label>
                        </ConfirmForm>
                      )}
                      {x.has_evidence && (
                        <a
                          className="app-button quiet"
                          href={`/api/customer-assets/payment/${x.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Your screenshot
                        </a>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p className="app-muted">No payment submitted.</p>
              )}
            </section>
            <details className="app-panel">
              <summary>Quote version history</summary>
              {approvals
                .filter((x) => x.kind === "proposal")
                .map((a) => (
                  <div key={a.id} className="app-note">
                    <strong>
                      v{a.version} · {a.title}
                    </strong>
                    <p>
                      {a.status.replaceAll("_", " ")} ·{" "}
                      {money(Number(a.amount_paise || 0))}
                    </p>
                    <p>{a.description}</p>
                  </div>
                ))}
            </details>
            {changes
              .filter((c) => c.kind === "proposal")
              .map((c) => (
                <section className="app-panel" key={c.id}>
                  <h3>
                    Changes to quote v{c.version} · {c.status}
                  </h3>
                  <p className="mt-2">{c.body}</p>
                </section>
              ))}
          </aside>
        </div>
      )}
      {view === "design" && (
        <div className="app-grid">
          <section className="app-panel">
            <h2>
              {art
                ? `${art.title} · v${art.version}`
                : "Artwork follows your chosen gift"}
            </h2>
            {art ? (
              <>
                {art.has_image && (
                  <a
                    href={`/api/customer-assets/approval/${art.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      className="app-image"
                      style={{ objectFit: "contain" }}
                      src={`/api/customer-assets/approval/${art.id}`}
                      alt={`Production artwork version ${art.version}`}
                    />
                  </a>
                )}
                <p className="whitespace-pre-wrap mt-3">{art.description}</p>
                <span className="app-badge mt-3">
                  {art.status.replaceAll("_", " ")}
                </span>
                {renderDecision(art)}
              </>
            ) : (
              <p className="app-muted">
                Once the quote and advance are confirmed, we’ll share the exact
                production artwork here for your approval.
              </p>
            )}
          </section>
          <aside className="app-panel">
            <h2>Before you approve</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Check names, messages and spelling.</li>
              <li>Check colour, placement and the shared design.</li>
              <li>Approval refers to this exact version.</li>
              <li>No gift or artwork changes after production starts.</li>
            </ul>
            {changes
              .filter((c) => c.kind === "design")
              .map((c) => (
                <div className="app-note" key={c.id}>
                  <strong>
                    Artwork v{c.version} · {c.status}
                  </strong>
                  <p>{c.body}</p>
                </div>
              ))}
          </aside>
        </div>
      )}
      {view === "delivery" && (
        <div className="app-grid">
          {shipping?.plan && (
            <CustomerShipments projectId={id} initial={shipping} />
          )}
          <section className="app-panel">
            <h2>{stages[p.stage]}</h2>
            <p className="app-muted">{p.next_action}</p>
            <dl className="app-money">
              <div>
                <dt>Requested delivery</dt>
                <dd>{day(p.delivery_date || p.target_date)}</dd>
              </div>
              <div>
                <dt>Occasion</dt>
                <dd>{day(p.occasion_date)}</dd>
              </div>
              <div>
                <dt>Official order</dt>
                <dd>{p.shopify_order_reference || "Not yet created"}</dd>
              </div>
              {!shipping?.plan && p.tracking_reference && (
                <div>
                  <dt>Tracking reference</dt>
                  <dd>{p.tracking_reference}</dd>
                </div>
              )}
            </dl>
            {!shipping?.plan &&
              p.tracking_url &&
              /^https:\/\//.test(p.tracking_url) && (
                <a
                  className="app-button primary"
                  href={p.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Track delivery →
                </a>
              )}
            <p className="app-note">
              Requested dates are preferences until the team confirms them. Full
              verified payment is due before dispatch or collection.
            </p>
          </section>
          {!shipping?.plan && (
            <section className="app-panel">
              <h2>Delivery address</h2>
              {p.stage >= 9 || !!p.shopify_order_reference ? (
                <p className="whitespace-pre-wrap">
                  {address
                    ? [
                        address.recipient_name,
                        address.address,
                        address.city,
                        address.state,
                        address.postal_code,
                        address.phone,
                      ].join("\n")
                    : "Contact the team for delivery details."}
                </p>
              ) : (
                <ActionForm
                  action={saveDeliveryAddress.bind(null, id)}
                  label="Save delivery address"
                >
                  <div className="app-fields">
                    {[
                      ["recipient_name", "Recipient name"],
                      ["phone", "Phone"],
                      ["address", "Address"],
                      ["city", "City"],
                      ["state", "State"],
                      ["postal_code", "PIN code"],
                    ].map(([key, label]) => (
                      <label
                        className={`app-label ${key === "address" ? "full" : ""}`}
                        key={key}
                      >
                        {label}
                        <input
                          className="app-input"
                          name={key}
                          defaultValue={address?.[key] || ""}
                          required
                          maxLength={key === "address" ? 1500 : 120}
                          pattern={
                            key === "postal_code" ? "[0-9]{6}" : undefined
                          }
                        />
                      </label>
                    ))}
                  </div>
                </ActionForm>
              )}
            </section>
          )}
        </div>
      )}
      {view === "moments" &&
        (p.stage < 10 ? (
          <section className="app-panel">
            <h2>The best part is still to come.</h2>
            <p className="app-muted">
              After delivery, keep photos of the handover, celebration or
              someone enjoying their gift.
            </p>
            <Link className="app-button primary mt-4" href={href("delivery")}>
              Track your gift
            </Link>
          </section>
        ) : (
          <>
            <div className="app-grid">
              <section className="app-panel">
                <h2>How did it feel?</h2>
                <ActionForm
                  label="Save my feedback"
                  action={feedbackForGift.bind(null, id)}
                >
                  <label className="app-label">
                    Your rating
                    <select
                      className="app-input"
                      name="rating"
                      defaultValue={moments.testimonial?.rating || ""}
                      required
                    >
                      <option value="">Choose a rating</option>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "star" : "stars"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="app-label">
                    Your experience
                    <textarea
                      className="app-input"
                      name="body"
                      required
                      maxLength={2000}
                      defaultValue={moments.testimonial?.body}
                    />
                  </label>
                  <label className="app-check">
                    <input
                      name="public_permission"
                      type="checkbox"
                      defaultChecked={moments.testimonial?.public_permission}
                    />
                    Aarla may feature this testimonial publicly, using my first
                    name
                  </label>
                  <p className="app-note">
                    Private by default. Uncheck and save to withdraw public
                    permission.
                  </p>
                </ActionForm>
              </section>
              <section className="app-panel">
                <h2>Keep the moment</h2>
                <MomentUploader projectId={id} />
              </section>
            </div>
            <section className="app-panel">
              <h2>Your moments</h2>
              <div className="app-gallery">
                {moments.photos.map((photo) => (
                  <figure key={photo.id}>
                    <img
                      src={`/api/customer-assets/moment/${photo.id}`}
                      alt={photo.caption || photo.kind}
                    />
                    <figcaption className="app-muted mt-2">
                      {photo.caption || photo.kind}
                      <span className="block mt-1">
                        {photo.public_permission
                          ? "Public use permitted"
                          : "Private · you and Aarla"}
                      </span>
                    </figcaption>
                    <PhotoActions
                      id={photo.id}
                      caption={photo.caption || photo.kind}
                      permitted={photo.public_permission}
                    />
                  </figure>
                ))}
              </div>
              {!moments.photos.length && (
                <p className="app-muted">
                  The unwrapping, a room full of gifts or a new favourite mug.
                  Add your first photo above.
                </p>
              )}
            </section>
            {p.occasion_id && (
              <div className="app-soft">
                <h3>Same occasion. A new story next year.</h3>
                <Link
                  className="app-button quiet"
                  href={`/account/occasions/${p.occasion_id}`}
                >
                  See this occasion’s history →
                </Link>
              </div>
            )}
          </>
        ))}
      {view === "messages" && (
        <section className="app-panel">
          <h2>A conversation with Aarla</h2>
          <p className="app-muted">All the details, kept with your gift.</p>
          <div className="my-4">
            {messages.map((m) => (
              <article className="app-row" key={m.id}>
                <div>
                  <strong>{m.sender === "customer" ? "You" : "Aarla"}</strong>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="app-muted">{day(m.created_at)}</p>
                </div>
              </article>
            ))}
          </div>
          <ActionForm action={sendMessage.bind(null, id)} label="Send message">
            <label className="app-label">
              Your message
              <textarea
                className="app-input"
                name="body"
                maxLength={4000}
                required
              />
            </label>
          </ActionForm>
        </section>
      )}
      {view === "activity" && (
        <section className="app-panel">
          <h2>Your gift, step by step</h2>
          {request.briefRevisions.length > 0 && (
            <details className="app-note">
              <summary>Brief version history</summary>
              {request.briefRevisions.map((r) => (
                <article className="app-note" key={r.version}>
                  <strong>
                    Brief v{r.version} · {day(r.created_at)}
                  </strong>
                  <p className="whitespace-pre-wrap">{r.document.story}</p>
                </article>
              ))}
            </details>
          )}
          <ol className="app-timeline mt-4">
            {events.toReversed().map((e) => (
              <li key={e.id}>
                <strong>{e.title}</strong>
                <p className="app-muted whitespace-pre-wrap mt-1">{e.body}</p>
                <p className="app-muted mt-2">{day(e.created_at)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
