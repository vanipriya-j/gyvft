import { B2CAdmin } from "./admin-view";
import { uuidPattern } from "@/lib/customer/model";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request } = await searchParams;
  return (
    <B2CAdmin initialId={request && uuidPattern.test(request) ? request : ""} />
  );
}
