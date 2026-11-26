import Link from "@/components/ui/navigation-link";
import { DemoCheckoutButton } from "./demo-checkout-button";
import type { DemoRewardState } from "@/lib/customer/demo-rewards-model";
const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount / 100);
export function SampleCheckout({
  intent,
  saving,
}: {
  intent: DemoRewardState["coupons"][number] | null;
  saving: boolean;
}) {
  const subtotal = Math.max(150000, intent?.minimum_paise || 0),
    discount = saving
      ? Math.floor(subtotal * 0.05)
      : (intent?.points || 0) * 100;
  return (
    <div className="app-stack mx-auto max-w-2xl pb-20 md:pb-0">
      <Link className="app-button quiet" href="/account/rewards">
        ← Your sample rewards
      </Link>
      <div className="app-title">
        <div>
          <p className="app-eyebrow">Aarla · sample checkout</p>
          <h1>Try the handoff.</h1>
          <p>A fictional basket to show how your benefit works.</p>
        </div>
      </div>
      <section className="app-panel">
        <h2>Illustrated keepsakes & a personal note</h2>
        <dl className="mt-5 grid grid-cols-[1fr_auto] gap-x-5 gap-y-4 text-sm">
          <dt>Sample merchandise</dt>
          <dd>{money(subtotal)}</dd>
          <dt>
            {saving
              ? "Your 5% saving"
              : intent?.kind === "points"
                ? `${intent.points} points`
                : "Your occasion offer"}
          </dt>
          <dd>−{money(discount)}</dd>
          <dt className="border-t border-border pt-4 font-semibold">
            Sample total to pay
          </dt>
          <dd className="border-t border-border pt-4 font-semibold">
            {money(subtotal - discount)}
          </dd>
        </dl>
        <p className="app-note">
          This is a demonstration. No payment is collected, no real coupon is
          created and nothing is sent to Shopify. A real Aarla checkout
          calculates tax and delivery.
        </p>
        {intent?.state === "active" ? (
          <DemoCheckoutButton intent={intent.id} />
        ) : intent ? (
          <p className="mt-4 text-sm">
            {intent.state === "redeemed"
              ? "This sample checkout is complete."
              : "This sample coupon has expired. Return to your wallet to try another."}
          </p>
        ) : (
          <Link className="app-button primary mt-5" href="/account/rewards">
            Back to your sample wallet
          </Link>
        )}
        {!saving && (
          <p className="mt-3 text-xs text-muted-text">
            Only this benefit applies. This sample redemption earns no new
            points.
          </p>
        )}
      </section>
    </div>
  );
}
