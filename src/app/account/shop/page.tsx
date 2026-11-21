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
  return <AarlaShop destination={destination} email={account.email} />;
}
