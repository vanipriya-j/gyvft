import Link from "next/link";
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
import { sendMessage, submitPayment, decideApproval } from "../../actions";
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
  const [events, messages, payments, approvals] = await Promise.all([
    sql<
      { id: string; title: string; body: string; created_at: string }[]
    >`SELECT * FROM customer_project_events WHERE project_id = ${id}::uuid ORDER BY created_at ASC`,
    sql<
      { id: string; sender: string; body: string; created_at: string }[]
    >`SELECT * FROM customer_project_messages WHERE project_id = ${id}::uuid ORDER BY created_at`,
    sql<
      { id: string; amount_paise: number; status: string; reference: string }[]
    >`SELECT * FROM customer_payment_submissions WHERE project_id = ${id}::uuid ORDER BY created_at DESC`,
    sql<
      {
        id: string;
        title: string;
        kind: string;
        version: number;
        description: string;
        status: string;
        customer_response: string | null;
      }[]
    >`SELECT * FROM customer_project_approvals WHERE project_id = ${id}::uuid ORDER BY created_at DESC`,
  ]);
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
                      {a.kind} · Version {a.version}
                    </p>
                    <h3 className="mt-2 font-medium">{a.title}</h3>
                    <p className="my-4 whitespace-pre-wrap text-sm text-muted-text">
                      {a.description}
                    </p>
                    {a.status === "pending" &&
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
                      {project.upi_id && (
                        <div className="mt-5">
                          <p className="text-sm">
                            Pay directly with GPay or another UPI app
                          </p>
                          <p className="my-3 break-all rounded-xl bg-surface p-3 font-medium">
                            {project.upi_id}
                          </p>
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
                            <p className="text-xs leading-relaxed text-muted-text">
                              Your payment stays pending until our team verifies
                              receipt. Please don’t share your UPI PIN.
                            </p>
                          </ActionForm>
                        </div>
                      )}
                      {!paymentUrl && !project.upi_id && (
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
                        {p.status === "pending"
                          ? "Awaiting verification"
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
