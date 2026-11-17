/* eslint-disable @next/next/no-img-element -- Private mockups use the customer session cookie. */
import Link from "next/link";
import { CalendarDays, Package, Users } from "lucide-react";
import { RequestNavigation } from "@/components/customer/request-navigation";
import { RequestVisual } from "@/components/customer/request-visual";
import {
  requestWorkflow,
  requestStateLabels,
  latestApproval,
  type RequestWorkflow,
} from "@/lib/customer/request-workflow";
import { storyRequestSchema } from "@/lib/customer/story-request";
import styles from "@/components/customer/request.module.css";
import { GiftSnapshot } from "@/components/customer/gift-workspace";
import { UPIPayment } from "@/components/customer/upi-payment";
import { saveRequestDates } from "../../dashboard-actions";
import { dateKey } from "@/lib/customer/dashboard-model";
import { CustomerStoryDetails } from "@/components/customer/story-details";
import { CustomerGiftBrief } from "@/components/customer/gift-brief";
import { notFound } from "next/navigation";
import { requestForAccount } from "@/lib/customer/request";
import {
  stages,
  paymentSummary,
  money,
  safePaymentUrl,
} from "@/lib/customer/model";
import { requireCustomerAccount } from "@/lib/customer/session";
import { ActionForm } from "@/components/customer/action-form";
import {
  sendMessage,
  submitPayment,
  decideApproval,
  saveDeliveryAddress,
} from "../../actions";
export const dynamic = "force-dynamic";
const card = styles.card;
const input =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base";
function date(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const account = await requireCustomerAccount();
  const { id } = await params;
  const request = await requestForAccount(id, account.id);
  if (!request) notFound();
  const {
    project,
    events,
    messages,
    payments,
    approvals,
    giftSelections,
    options,
    address,
    upi,
  } = request;
  const upiId = project.upi_id || upi?.upi_id;
  const total =
    project.total_paise === null ? null : Number(project.total_paise);
  const paid = Number(project.paid_paise);
  const summary = total === null ? null : paymentSummary(total, paid);
  const paymentUrl = safePaymentUrl(project.razorpay_url);
  const requestedView = (await searchParams).view;
  const view = [
    "overview",
    "quote",
    "activity",
    "messages",
    "details",
  ].includes(requestedView || "")
    ? requestedView!
    : "overview";
  const href = (name: string) =>
    `/account/projects/${id}${name === "overview" ? "" : `?view=${name}`}`;
  const state = requestWorkflow({
    kind: project.kind,
    stage: project.stage,
    total: total || 0,
    paid,
    approvals,
    selectionId: giftSelections[0]?.id || null,
    visibleOptions: options.length,
    pendingPayment: payments.some((p) => p.status === "pending"),
  });
  const demo = String(project.submission_key || "").startsWith("gyvft-demo-");
  const parsedBrief = storyRequestSchema.safeParse(project.gift_brief);
  const quantity = giftSelections[0]?.snapshot.recipients
    ? `${giftSelections[0].snapshot.recipients} recipients`
    : parsedBrief.success
      ? parsedBrief.data.quantity_range
      : null;
  const latestDesign = latestApproval(approvals, "design");
  const quoteVersion = latestApproval(approvals, "proposal");
  const latestQuote =
    !giftSelections.length ||
    quoteVersion?.gift_selection_id === giftSelections[0].id
      ? quoteVersion
      : null;
  const selectedOption = options.find(
    (o) => o.id === giftSelections[0]?.snapshot.based_on,
  );
  const visualApproval =
    project.kind === "project" && latestDesign?.has_image
      ? latestDesign
      : latestQuote?.has_image
        ? latestQuote
        : null;
  const visualOption = selectedOption || options[0];
  const visual = visualApproval
    ? {
        src: `/api/customer-assets/approval/${visualApproval.id}`,
        label: `${visualApproval.kind === "design" ? "Production design" : "Quote preview"} · v${visualApproval.version}`,
        alt: visualApproval.title,
      }
    : visualOption
      ? {
          src: `/api/customer-assets/gift-option/${visualOption.id}`,
          label: giftSelections.length
            ? `Reference · ${visualOption.title}`
            : visualOption.title,
          alt: visualOption.title,
        }
      : null;
  const latestMessage = [...messages]
    .reverse()
    .find((m) => m.sender !== "customer");
  const copy: Record<
    RequestWorkflow,
    {
      title: string;
      body: string;
      view: string;
      action: string;
      active: boolean;
    }
  > = {
    curation: {
      title: stages[project.stage] || "We’re shaping your gift",
      body: project.next_action,
      view: "messages",
      action: "Message the team",
      active: false,
    },
    options_ready: {
      title: `${options.length} ${options.length === 1 ? "direction" : "directions"}, made for your story.`,
      body: "Explore the hampers and their contents. Choose a direction, mix ideas or build an option of your own.",
      view: "options",
      action: "Review your options",
      active: true,
    },
    quote_requested: {
      title: "Your chosen gift is with us.",
      body: "We’re confirming the composition and final price. Your saved selection stays attached to the quote.",
      view: "options",
      action: "View your selected gift",
      active: false,
    },
    quote_review: {
      title: "Your quote is ready to review.",
      body: "Check the selected gift, itemised prices and agreed charges before approving this version.",
      view: "quote",
      action: "Review quote",
      active: true,
    },
    quote_changes: {
      title: "We’re revising your quote.",
      body: "The team has your requested changes. Your next quote will appear as a new version.",
      view: "quote",
      action: "View quote & feedback",
      active: false,
    },
    quote_approved: {
      title: "Your quote is approved.",
      body: "The team will confirm your order and share instructions for the 50% advance.",
      view: "quote",
      action: "View approved quote",
      active: false,
    },
    advance_due: {
      title: `Start your order with ${money(summary?.advanceDue || 0)}.`,
      body: "A 50% advance starts the order. Upload your payment screenshot and reference for verification within 24 hours.",
      view: "quote",
      action: "Pay advance",
      active: true,
    },
    payment_review: {
      title: "Your payment is being checked.",
      body: "Allow up to 24 hours for the team to verify receipt. You can follow its status under Quote & payment.",
      view: "quote",
      action: "View payment status",
      active: false,
    },
    design_review: {
      title: "Your design is ready.",
      body: "Review the artwork and personalisation. Production starts after your design approval and verified advance.",
      view: "quote",
      action: "Review design",
      active: true,
    },
    design_changes: {
      title: "Your design changes are with us.",
      body: "The team is preparing a revised version for your approval.",
      view: "quote",
      action: "View design & feedback",
      active: false,
    },
    design_in_progress: {
      title: "Your gift is taking shape.",
      body: project.next_action,
      view: "messages",
      action: "Message the team",
      active: false,
    },
    production: {
      title: "Your gifts are being made.",
      body: project.next_action,
      view: "activity",
      action: "View latest updates",
      active: false,
    },
    balance_due: {
      title: `Your balance is ${money(summary?.balance || 0)}.`,
      body: "Your gifts are being checked and packed. The remaining payment must be verified before dispatch.",
      view: "quote",
      action: "Pay balance",
      active: true,
    },
    packing: {
      title: "The finishing touches.",
      body: project.next_action,
      view: "details",
      action: "View delivery details",
      active: false,
    },
    dispatched: {
      title: "Your gifts are on their way.",
      body: project.next_action,
      view: "details",
      action: "View delivery details",
      active: false,
    },
    delivered: {
      title: "A little thought, delivered.",
      body: project.next_action,
      view: "messages",
      action: "Talk to the team",
      active: false,
    },
    completed: {
      title: "A story worth remembering.",
      body: project.next_action,
      view: "messages",
      action: "Talk to the team",
      active: false,
    },
  };
  const current = copy[state];
  const actionHref =
    current.view === "options"
      ? `/account/projects/${id}/options`
      : href(current.view);
  return (
    <div className={styles.workspace}>
      <Link href="/account?view=requests" className={styles.back}>
        ← My gifts
      </Link>
      <header className={styles.header}>
        <h1>{project.title}</h1>
        <span className={styles.status}>
          {demo ? "Sample · " : ""}
          {state === "curation"
            ? stages[project.stage]
            : requestStateLabels[state]}
        </span>
      </header>
      <div className={styles.facts}>
        {quantity && (
          <span>
            <Users aria-hidden="true" />
            {quantity}
          </span>
        )}
        <span>
          <CalendarDays aria-hidden="true" />
          Occasion ·{" "}
          {project.occasion_date ? date(project.occasion_date) : "Not set"}
        </span>
        <span>
          <Package aria-hidden="true" />
          Delivery requested ·{" "}
          {project.delivery_date
            ? date(project.delivery_date)
            : project.target_date
              ? date(project.target_date)
              : "Not set"}
        </span>
        <Link href={href("details")}>Edit details</Link>
      </div>
      <RequestNavigation id={id} view={view} optionCount={options.length} />
      {demo && (
        <p className={styles.sample}>
          Sample request · no payment or order will be created.
        </p>
      )}
      {view === "overview" && (
        <>
          <div className={styles.overview}>
            <RequestVisual
              key={visual?.src || "inspiration"}
              contain={Boolean(visualApproval)}
              src={visual?.src || null}
              alt={visual?.alt || "Gifting inspiration"}
              label={
                visual?.label ||
                "Gifting inspiration · your preview will appear here"
              }
            />
            <section className={`${card} ${styles.actionPanel}`}>
              <p className={styles.eyebrow}>
                {current.active && !demo ? "Your turn" : "Where we are"}
              </p>
              <h2>{current.title}</h2>
              <p className={styles.muted}>{current.body}</p>
              <Link
                className={
                  current.active && !demo ? styles.primary : styles.link
                }
                href={demo ? href("details") : actionHref}
              >
                {demo ? "Explore sample details" : current.action} →
              </Link>
              <div className={styles.next}>
                <strong>
                  {project.kind === "enquiry"
                    ? "After you choose"
                    : "Your order"}
                </strong>
                <p>
                  {project.kind === "enquiry"
                    ? "We’ll confirm your final quote. A 50% advance starts the order."
                    : `Verified payments: ${money(paid)}${total !== null ? ` of ${money(total)}` : ""}.`}
                </p>
              </div>
            </section>
          </div>
          <div className={styles.lower}>
            <section className={card}>
              <h2>Your brief, at a glance</h2>
              <p className={`${styles.muted} ${styles.excerpt}`}>
                {project.brief || "We’ll work with you to shape the details."}
              </p>
              <Link className={styles.link} href={href("details")}>
                View the full brief & delivery details →
              </Link>
            </section>
            <section className={card}>
              <h2>Latest from GYVFT</h2>
              <p className={`${styles.muted} ${styles.excerpt}`}>
                {latestMessage?.body ||
                  "Have a question or something to add? Your conversation with the team stays here."}
              </p>
              {latestMessage && (
                <p className={styles.meta}>
                  {date(latestMessage.created_at)} · GYVFT team
                </p>
              )}
              <Link className={styles.link} href={href("messages")}>
                {latestMessage ? "Reply to the team" : "Message the team"} →
              </Link>
            </section>
          </div>
        </>
      )}
      {view === "details" && (
        <div className={styles.detailGrid}>
          <section className={card}>
            <h2 className="font-serif text-2xl">Your brief</h2>
            <p className="mt-4 whitespace-pre-wrap leading-relaxed text-muted-text">
              {project.brief || "We’ll work with you to shape the details."}
            </p>
            {project.shopify_order_reference && (
              <p className="mt-5 text-sm">
                Order reference: {project.shopify_order_reference}
              </p>
            )}
          </section>
          {project.tracking_reference && (
            <section className={card}>
              <h2 className="font-serif text-2xl">Delivery tracking</h2>
              <p className="mt-3 text-sm">{project.tracking_reference}</p>
              {project.tracking_url && (
                <a
                  href={project.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm underline"
                >
                  Track delivery ↗
                </a>
              )}
            </section>
          )}
          <section className={card}>
            <h2 className="font-serif text-2xl">Occasion & delivery</h2>
            <p className="mt-3 text-sm leading-6 text-muted-text">
              The day you are celebrating and the day you need the gifts can be
              different. Add your preferences here after submitting the brief.
              GYVFT will confirm delivery feasibility.
            </p>
            <ActionForm
              action={saveRequestDates.bind(null, id)}
              label="Save dates"
            >
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  Occasion date
                  <input
                    type="date"
                    name="occasion_date"
                    defaultValue={dateKey(project.occasion_date) || ""}
                    className={input}
                  />
                </label>
                <label className="block text-sm">
                  Requested delivery date
                  <input
                    type="date"
                    name="delivery_date"
                    defaultValue={dateKey(project.delivery_date) || ""}
                    className={input}
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-muted-text">
                Leave a date blank to clear it. Your original brief target is
                preserved separately.
              </p>
            </ActionForm>
          </section>
          {project.kind === "project" && (
            <section className={card}>
              <h2 className="font-serif text-2xl">
                Where should we send your gifts?
              </h2>
              {project.stage >= 9 ? (
                <div className="mt-4 text-sm leading-6">
                  <p>{address?.recipient_name}</p>
                  <p>{address?.address}</p>
                  <p>
                    {address?.city}, {address?.state} {address?.postal_code}
                  </p>
                  <p className="mt-3 text-muted-text">
                    Your gifts have been dispatched. Message the team if you
                    need help with delivery.
                  </p>
                </div>
              ) : (
                <ActionForm
                  action={saveDeliveryAddress.bind(null, id)}
                  label="Save delivery details"
                >
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {[
                      ["recipient_name", "Recipient name"],
                      ["phone", "Phone"],
                      ["address", "Full delivery address"],
                      ["city", "City"],
                      ["state", "State"],
                      ["postal_code", "PIN code"],
                    ].map(([name, label]) => (
                      <label key={name} className="block text-sm">
                        {label}
                        <input
                          name={name}
                          defaultValue={address?.[name] || ""}
                          required
                          maxLength={name === "address" ? 1500 : 120}
                          className={input}
                        />
                      </label>
                    ))}
                  </div>
                </ActionForm>
              )}
            </section>
          )}
          <CustomerStoryDetails value={project.gift_brief} />
          <CustomerGiftBrief value={project.gift_brief} />
        </div>
      )}
      {view === "quote" && (
        <div className={styles.quoteGrid}>
          <div className="space-y-4">
            {approvals.length > 0 && (
              <section className={card}>
                <h2 className="font-serif text-2xl">For your approval</h2>
                <div className="mt-5 space-y-4">
                  {approvals.map((a) => (
                    <article
                      key={a.id}
                      className="rounded-xl border border-border p-4"
                    >
                      <p className="text-xs uppercase tracking-wider text-olive">
                        {a.kind === "proposal" ? "Quote" : "Production design"}{" "}
                        · Version {a.version}
                      </p>
                      <h3 className="mt-2 font-medium">{a.title}</h3>
                      <p className="my-4 whitespace-pre-wrap text-sm text-muted-text">
                        {a.description}
                      </p>
                      {a.gift_selection_id &&
                        giftSelections.find(
                          (s) => s.id === a.gift_selection_id,
                        ) && (
                          <details className="mb-4 rounded-lg bg-surface p-4">
                            <summary className="text-sm">
                              Your selected gift for this quote
                            </summary>
                            <GiftSnapshot
                              document={
                                giftSelections.find(
                                  (s) => s.id === a.gift_selection_id,
                                )!.snapshot
                              }
                            />
                          </details>
                        )}
                      {a.items?.length ? (
                        <ul
                          aria-label="Quote items"
                          className="mb-4 divide-y divide-border text-sm"
                        >
                          {a.items.map((item, index) => (
                            <li key={index} className="py-3">
                              <div className="flex justify-between gap-3">
                                <span>
                                  {item.quantity} × {item.name}
                                </span>
                                <span>
                                  {money(item.quantity * item.unit_paise)}
                                </span>
                              </div>
                              {item.personalisation && (
                                <p className="mt-1 text-xs text-muted-text">
                                  {item.personalisation}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {a.amount_paise && (
                        <p className="mb-3 font-medium">
                          Quoted total (applicable taxes included):{" "}
                          {money(Number(a.amount_paise))}
                        </p>
                      )}
                      {a.has_image && (
                        <a
                          href={`/api/customer-assets/approval/${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={`/api/customer-assets/approval/${a.id}`}
                            alt={`${a.title} mockup · version ${a.version}`}
                            className="mb-4 max-h-96 w-full rounded-xl object-contain"
                          />
                        </a>
                      )}
                      {a.status === "pending" &&
                      (a.kind !== "proposal" ||
                        !giftSelections.length ||
                        a.gift_selection_id === giftSelections[0].id) &&
                      !approvals.some(
                        (newer) =>
                          newer.kind === a.kind && newer.version > a.version,
                      ) ? (
                        <ActionForm
                          action={decideApproval.bind(null, id, a.id)}
                          label="Send decision"
                        >
                          <label className="block text-sm">
                            Your decision
                            <select
                              name="decision"
                              className={input}
                              required
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Choose a decision
                              </option>
                              <option value="approved">
                                Approve this version
                              </option>
                              <option value="changes_requested">
                                Request changes
                              </option>
                            </select>
                          </label>
                          <label className="mt-3 block text-sm">
                            Comments (required for changes)
                            <textarea
                              name="response"
                              rows={3}
                              maxLength={4000}
                              className={input}
                            />
                          </label>
                          <p className="mt-3 text-xs text-muted-text">
                            Your decision applies to this version only.
                          </p>
                        </ActionForm>
                      ) : (
                        <p className="text-sm">
                          {a.status === "approved"
                            ? "Approved"
                            : a.status === "pending"
                              ? "Superseded by a newer version"
                              : "Changes requested"}
                          {a.customer_response
                            ? ` — ${a.customer_response}`
                            : ""}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
            {!approvals.length && (
              <section className={card}>
                <h2>Your quote will appear here</h2>
                <p className={styles.muted}>
                  Once you’ve chosen a direction, we’ll confirm its contents and
                  final price for your approval.
                </p>
                <Link
                  href={`/account/projects/${id}/options`}
                  className={styles.link}
                >
                  Explore your options →
                </Link>
              </section>
            )}
          </div>
          {project.kind === "project" && (
            <aside>
              <section className={card}>
                <h2 className="font-serif text-2xl">Payments</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-text">
                  Every order starts with a 50% advance. The remaining balance
                  is due before dispatch.
                </p>
                {summary && total !== null ? (
                  <>
                    <dl className="my-4 space-y-4 text-sm">
                      <div className="flex justify-between">
                        <dt>Agreed total</dt>
                        <dd>{money(total)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>50% advance</dt>
                        <dd>{money(summary.advance)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Verified payments</dt>
                        <dd>{money(paid)}</dd>
                      </div>
                      <div className="flex justify-between border-t border-border pt-4 font-semibold">
                        <dt>Balance remaining</dt>
                        <dd>{money(summary.balance)}</dd>
                      </div>
                    </dl>
                    {summary.advanceDue > 0 && (
                      <p className="mb-5 rounded-xl bg-surface p-3 text-sm">
                        Advance due: {money(summary.advanceDue)}
                      </p>
                    )}
                    {summary.balance > 0 && (
                      <>
                        {paymentUrl && (
                          <a
                            href={paymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-full bg-olive-dark px-5 py-3 text-center text-sm text-white"
                          >
                            Pay securely with Razorpay ↗
                          </a>
                        )}
                        {upiId && (
                          <div className="mt-5">
                            <p className="text-sm">
                              Pay directly with GPay or another UPI app
                            </p>
                            <p className="my-3 break-all rounded-xl bg-surface p-3 font-medium">
                              {upiId}
                            </p>
                            <UPIPayment
                              id={id}
                              upiId={upiId}
                              payee={upi?.payee_name || "GYVFT"}
                              amount={
                                summary.advanceDue > 0
                                  ? summary.advanceDue
                                  : summary.balance
                              }
                              hasQR={
                                Boolean(upi?.has_qr) &&
                                (!project.upi_id ||
                                  project.upi_id === upi?.upi_id)
                              }
                            />
                            <ActionForm
                              action={submitPayment.bind(null, id)}
                              label="Submit payment reference"
                            >
                              <label className="block text-sm">
                                Amount paid (₹)
                                <input
                                  name="amount"
                                  type="number"
                                  min="0.01"
                                  max="99999999.99"
                                  step="0.01"
                                  required
                                  className={input}
                                />
                              </label>
                              <label className="block text-sm">
                                UPI transaction reference
                                <input
                                  name="reference"
                                  required
                                  minLength={6}
                                  maxLength={100}
                                  className={input}
                                />
                              </label>
                              <label className="mt-3 block text-sm">
                                Transaction screenshot (PNG/JPEG/WebP, up to 2
                                MB)
                                <input
                                  name="evidence"
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  required
                                  className={input}
                                />
                              </label>
                              <p className="text-xs leading-relaxed text-muted-text">
                                Your payment stays pending until our team
                                verifies receipt. Please don’t share your UPI
                                PIN.
                              </p>
                            </ActionForm>
                          </div>
                        )}
                        {!paymentUrl && !upiId && (
                          <p className="text-sm text-muted-text">
                            Our team will share payment instructions here.
                          </p>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="mt-4 rounded-xl bg-surface p-4 text-sm">
                    We’ll share pricing after understanding your requirements.
                  </p>
                )}
                {payments.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-border pt-5">
                    <h3 className="text-sm font-medium">Submitted payments</h3>
                    {payments.map((p) => (
                      <p key={p.id} className="break-all text-sm">
                        {money(Number(p.amount_paise))} · {p.reference}
                        <span className="block text-xs text-muted-text">
                          Submitted {date(p.created_at)}
                        </span>
                        {p.has_evidence && (
                          <a
                            href={`/api/customer-assets/payment/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs underline"
                          >
                            View your screenshot
                          </a>
                        )}
                        <span className="block text-xs text-muted-text">
                          {p.status === "pending"
                            ? "Pending verification · allow up to 24 hours"
                            : p.status === "verified"
                              ? "Verified"
                              : "Could not verify — please contact us"}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          )}
        </div>
      )}
      {view === "activity" && (
        <div className={styles.reading}>
          <section className={card}>
            <h2 className="font-serif text-2xl">Updates & timeline</h2>
            <ol className="mt-4 space-y-4 border-l border-border pl-5">
              <li>
                <p className="font-medium">Enquiry received</p>
                <p className="text-xs text-muted-text">
                  {date(project.created_at)}
                </p>
              </li>
              {events.map((e) => (
                <li key={e.id}>
                  <p className="font-medium">{e.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-text">
                    {e.body}
                  </p>
                  <p className="mt-2 text-xs text-muted-text">
                    {date(e.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
      {view === "messages" && (
        <div className={styles.reading}>
          <section className={card}>
            <h2 className="font-serif text-2xl">Conversations</h2>
            <p className="mt-2 text-sm text-muted-text">
              A direct conversation with the GYVFT team about this story.
            </p>
            <div className="my-4 space-y-4">
              {messages.length ? (
                messages.map((m) => (
                  <article
                    key={m.id}
                    className={`rounded-2xl p-4 ${m.sender === "customer" ? "ml-5 bg-surface" : "mr-5 border border-border"}`}
                  >
                    <p className="text-xs font-medium">
                      {m.sender === "customer" ? "You" : "GYVFT team"} ·{" "}
                      {date(m.created_at)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {m.body}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-muted-text">
                  Have a question or something to add? Leave a message here.
                </p>
              )}
            </div>
            <ActionForm
              action={sendMessage.bind(null, id)}
              label="Send message"
            >
              <label className="text-sm font-medium">
                Your message
                <textarea
                  name="body"
                  className={input}
                  rows={4}
                  maxLength={4000}
                  required
                />
              </label>
            </ActionForm>
          </section>
        </div>
      )}
    </div>
  );
}
