import { notFound } from "next/navigation";
import { requireCustomerAccount } from "@/lib/customer/session";
import { isDemoAccount, readDemoRewards } from "@/lib/customer/demo-rewards";
import { SampleCheckout } from "@/components/customer/sample-checkout";
export const dynamic = "force-dynamic";
export default async function DemoCheckout({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; benefit?: string }>;
}) {
  const account = await requireCustomerAccount("/account/rewards"),
    q = await searchParams;
  if (!isDemoAccount(account.id)) notFound();
  const state = await readDemoRewards(account),
    intent = q.intent ? state.coupons.find((c) => c.id === q.intent) : null,
    saving = !q.intent && q.benefit === "saving";
  if (!intent && !saving) notFound();
  return <SampleCheckout intent={intent || null} saving={saving} />;
}
