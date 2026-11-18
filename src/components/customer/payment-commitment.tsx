import { money } from "@/lib/customer/model";
import { paymentPlan } from "@/lib/customer/journey-model";
export function PaymentCommitment({
  total,
  paid,
  pending,
  approved = true,
}: {
  total: number;
  paid: number;
  pending: number;
  approved?: boolean;
}) {
  const p = paymentPlan(total, paid, pending);
  return (
    <section className="app-panel">
      <h2>Payment commitment</h2>
      <p className="app-step-title">
        {!p.outstanding
          ? "Paid in full."
          : pending
            ? `${money(pending)} submitted for verification.`
            : !approved
              ? `50% advance after approval: ${money(p.advance)}.`
              : p.now
                ? `Pay ${money(p.now)} now.`
                : `${money(p.paid)} payment verified.`}
      </p>
      <p className="mt-2">
        {p.outstanding > 0 &&
          (pending
            ? `Once confirmed, ${money(Math.max(0, p.outstanding - pending))} remains due before dispatch.`
            : p.now
              ? `The remaining ${money(p.later)} is due before dispatch.`
              : `Your remaining ${money(p.outstanding)} is due before dispatch.`)}
      </p>
      <p className="app-muted mt-2">
        {!p.outstanding
          ? "Nothing more is due."
          : pending
            ? "Allow up to 24 hours. Please don’t pay again while we check."
            : !approved
              ? "Approve the exact gift and quote first. No payment is needed yet."
              : "Only bank-confirmed payments count as received."}
      </p>
      <details className="app-note">
        <summary>View payment record</summary>
        <dl className="app-money">
          <div>
            <dt>Order total</dt>
            <dd>{money(total)}</dd>
          </div>
          <div>
            <dt>50% advance</dt>
            <dd>{money(p.advance)}</dd>
          </div>
          <div>
            <dt>Verified receipts</dt>
            <dd>{money(paid)}</dd>
          </div>
          {pending > 0 && (
            <div>
              <dt>Pending verification</dt>
              <dd>{money(pending)}</dd>
            </div>
          )}
          <div>
            <dt>Outstanding after verified receipts</dt>
            <dd>{money(p.outstanding)}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
