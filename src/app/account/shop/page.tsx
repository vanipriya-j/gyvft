import { isDemoAccount } from "@/lib/customer/demo-accounts";
import { SampleCheckout } from "@/components/customer/sample-checkout";
import { notFound } from "next/navigation";
import { requireCustomerAccount } from "@/lib/customer/session";
import { aarlaDestination } from "@/lib/customer/aarla-shop-model";
import { AarlaShop } from "@/components/customer/aarla-shop";
export const dynamic = "force-dynamic";
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const raw = (await searchParams).to || "/";
  let destination: string;
  try {
    destination = aarlaDestination(raw);
  } catch {
    notFound();
  }
  const account = await requireCustomerAccount(
    `/account/shop?to=${encodeURIComponent(destination)}`,
  );
  if (isDemoAccount(account.id)) return <SampleCheckout intent={null} saving />;
  return <AarlaShop destination={destination} email={account.email} />;
}
