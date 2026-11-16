/* eslint-disable @next/next/no-img-element -- Private mockups use the customer session cookie. */
import Link from "next/link";
import { GiftSnapshot } from "@/components/customer/gift-workspace";
import type { GiftSelection } from "@/lib/customer/gift-workspace-model";
import type { OrderItem } from "@/lib/customer/pilot-model";
import { UPIPayment } from "@/components/customer/upi-payment";
import { saveRequestDates } from "../../dashboard-actions";
import { dateKey } from "@/lib/customer/dashboard-model";
import { CustomerStoryDetails } from "@/components/customer/story-details";
import { CustomerGiftBrief } from "@/components/customer/gift-brief";
import { notFound } from "next/navigation";
import { ownedProject } from "@/lib/customer/data";
import {
  stages,
  paymentSummary,
  money,
  safePaymentUrl,
} from "@/lib/customer/model";
import { requireCustomerAccount } from "@/lib/customer/session";
import { getSql } from "@/lib/database/client";
import { ActionForm } from "@/components/customer/action-form";
import {
  sendMessage,
  submitPayment,
  decideApproval,
  saveDeliveryAddress,
} from "../../actions";
export const dynamic = "force-dynamic";
const card = "rounded-3xl border border-border bg-paper p-6 md:p-8";
const input =
  "mt-2 w-full rounded-xl border border-border bg-background px-4 py-3";
function date(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireCustomerAccount();
  const { id } = await params;
  if (!process.env.DATABASE_URL) notFound();
  const project = await ownedProject(id, account.id);
  if (!project) notFound();
  const sql = getSql();
  const [events, messages, payments, approvals, giftSelections] =
    await Promise.all([
      sql<
        { id: string; title: string; body: string; created_at: string }[]
      >`SELECT * FROM customer_project_events WHERE project_id = ${id}::uuid ORDER BY created_at ASC`,
      sql<
        { id: string; sender: string; body: string; created_at: string }[]
      >`SELECT * FROM customer_project_messages WHERE project_id = ${id}::uuid ORDER BY created_at`,
      sql<
        {
          id: string;
          amount_paise: number;
          status: string;
          reference: string;
          has_evidence: boolean;
          created_at: string;
        }[]
      >`SELECT id,amount_paise,status,reference,created_at,evidence_data IS NOT NULL AS has_evidence FROM customer_payment_submissions WHERE project_id = ${id}::uuid ORDER BY created_at DESC`,
      sql<
        {
          id: string;
          title: string;
          kind: string;
          gift_selection_id: string | null;
          version: number;
          description: string;
          status: string;
          customer_response: string | null;
          amount_paise: number | null;
          has_image: boolean;
          items: OrderItem[] | null;
        }[]
      >`SELECT id,title,kind,version,description,status,customer_response,amount_paise,items,gift_selection_id,image_data IS NOT NULL AS has_image FROM customer_project_approvals WHERE project_id = ${id}::uuid ORDER BY created_at DESC`,
      sql<
        GiftSelection[]
      >`SELECT id,draft_version,snapshot FROM gyvft_gift_selections WHERE project_id=${id}::uuid ORDER BY created_at DESC,id DESC`,
    ]);
  const [address] =
    await sql`SELECT * FROM customer_delivery_addresses WHERE project_id=${id}::uuid`;
  const [upi] =
    await sql`SELECT upi_id,payee_name,qr_data IS NOT NULL AS has_qr FROM gyvft_customer_upi_settings WHERE singleton=true`;
  const upiId = project.upi_id || upi?.upi_id;
  const total =
    project.total_paise === null ? null : Number(project.total_paise);
  const paid = Number(project.paid_paise);
  const summary = total === null ? null : paymentSummary(total, paid);
  const paymentUrl = safePaymentUrl(project.razorpay_url);
  return (
    <>
      <Link href="/account" className="text-sm text-muted-text">
        ← All your stories
      </Link>
      <div className="my-8">
        <p className="text-xs uppercase tracking-[.2em] text-olive">
          {project.kind} ·{" "}
          {project.customer_type === "b2b"
            ? project.organisation_name
            : project.customer_type === "b2c"
              ? "Personal gifting"
              : "Your story"}
        </p>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl">
          {project.title}
        </h1>
        <p className="mt-4 text-muted-text">
          Started {date(project.created_at)}
          {project.target_date ? ` · Target ${date(project.target_date)}` : ""}
        </p>
      </div>
      <section className="mb-8 rounded-xl border border-border bg-paper p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl">
              Gift options & your workspace
            </h2>
            <p className="mt-2 text-sm text-muted-text">
              Explore curated hampers, build alternatives and select a gift for
              a quote.
            </p>
          </div>
          <Link
            href={`/account/projects/${id}/options`}
            className="rounded-lg bg-olive-dark px-5 py-3 text-sm text-white"
          >
            Explore gift options
          </Link>
        </div>
      </section>
      <section className="mb-8 rounded-3xl bg-olive-dark p-7 text-white">
        <p className="text-xs uppercase tracking-widest opacity-70">
          Where we are
        </p>
        <h2 className="mt-3 font-serif text-3xl">{stages[project.stage]}</h2>
        <p className="mt-3 opacity-90">{project.next_action}</p>
      </section>
      <div
        className={
          project.kind === "project"
            ? "grid items-start gap-7 lg:grid-cols-[1.6fr_1fr]"
            : "space-y-7"
        }
      >
        <div className="space-y-7">
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
          {approvals.length > 0 && (
            <section className={card}>
              <h2 className="font-serif text-2xl">For your approval</h2>
              <div className="mt-5 space-y-6">
                {approvals.map((a) => (
                  <article
                    key={a.id}
                    className="rounded-2xl border border-border p-5"
                  >
                    <p className="text-xs uppercase tracking-wider text-olive">
                      {a.kind === "proposal" ? "Quote" : "Production design"} ·
                      Version {a.version}
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
                        {a.customer_response ? ` — ${a.customer_response}` : ""}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
          <section className={card}>
            <h2 className="font-serif text-2xl">Updates & timeline</h2>
            <ol className="mt-6 space-y-6 border-l border-border pl-5">
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
          <section className={card}>
            <h2 className="font-serif text-2xl">Conversations</h2>
            <p className="mt-2 text-sm text-muted-text">
              A direct conversation with the GYVFT team about this story.
            </p>
            <div className="my-6 space-y-4">
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
        {project.kind === "project" && (
          <aside className="space-y-7">
            <section className={card}>
              <h2 className="font-serif text-2xl">Payments</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-text">
                Every order starts with a 50% advance. The remaining balance is
                due before dispatch.
              </p>
              {summary && total !== null ? (
                <>
                  <dl className="my-6 space-y-4 text-sm">
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
                              Transaction screenshot (PNG/JPEG/WebP, up to 2 MB)
                              <input
                                name="evidence"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                required
                                className={input}
                              />
                            </label>
                            <p className="text-xs leading-relaxed text-muted-text">
                              Your payment stays pending until our team verifies
                              receipt. Please don’t share your UPI PIN.
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
                <p className="mt-6 rounded-xl bg-surface p-4 text-sm">
                  We’ll share pricing after understanding your requirements.
                </p>
              )}
              {payments.length > 0 && (
                <div className="mt-6 space-y-3 border-t border-border pt-5">
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
            <section className={card}>
              <h2 className="font-serif text-2xl">The journey ahead</h2>
              <ol className="mt-5 space-y-3 text-sm">
                {stages.map((stage, i) => (
                  <li
                    key={stage}
                    className={
                      i === project.stage
                        ? "font-semibold text-olive-dark"
                        : "text-muted-text"
                    }
                  >
                    {i < project.stage ? "✓" : i === project.stage ? "●" : "○"}{" "}
                    {stage}
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        )}
      </div>
    </>
  );
}
