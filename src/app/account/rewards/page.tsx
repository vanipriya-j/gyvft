import { requireCustomerAccount } from "@/lib/customer/session";
import { RewardsWallet } from "@/components/customer/rewards-wallet";
export const dynamic = "force-dynamic";
export default async function RewardsPage() {
  const account = await requireCustomerAccount("/account/rewards");
  return <RewardsWallet email={account.email} />;
}
