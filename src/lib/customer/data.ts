import "server-only";
import { requireCustomerAccount } from "@/lib/customer/session";
import { uuidPattern } from "@/lib/customer/model";
import { getSql } from "@/lib/database/client";
export async function customerEmail() {
  return (await requireCustomerAccount()).email;
}
export type CustomerProject = {
  id: string;
  title: string;
  brief: string;
  gift_brief?: unknown;
  kind: string;
  customer_type: string | null;
  organisation_name: string | null;
  stage: number;
  next_action: string;
  target_date: string | null;
  total_paise: number | null;
  paid_paise: number;
  razorpay_url: string | null;
  upi_id: string | null;
  shopify_order_reference: string | null;
  created_at: string;
};
export async function projectsFor(accountId: string) {
  return getSql()<
    CustomerProject[]
  >`SELECT * FROM customer_projects WHERE customer_account_id = ${accountId}::uuid ORDER BY created_at DESC`;
}
export async function ownedProject(id: string, accountId: string) {
  if (!uuidPattern.test(id)) return null;
  const rows = await getSql()<
    CustomerProject[]
  >`SELECT * FROM customer_projects WHERE id = ${id}::uuid AND customer_account_id = ${accountId}::uuid`;
  return rows[0] ?? null;
}
