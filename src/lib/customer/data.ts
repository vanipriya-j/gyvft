import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth/session";
import { hasSupabasePublishableConfig } from "@/lib/supabase/keys";
import { uuidPattern } from "@/lib/customer/model";
import { getSql } from "@/lib/database/client";
export async function customerEmail() {
  if (!hasSupabasePublishableConfig()) redirect("/account/login");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at)
    redirect("/account/login");
  return user.email.trim().toLowerCase();
}
export type CustomerProject = {
  id: string;
  title: string;
  brief: string;
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
export async function projectsFor(email: string) {
  return getSql()<
    CustomerProject[]
  >`SELECT * FROM customer_projects WHERE customer_email = ${email} ORDER BY created_at DESC`;
}
export async function ownedProject(id: string, email: string) {
  if (!uuidPattern.test(id)) return null;
  const rows = await getSql()<
    CustomerProject[]
  >`SELECT * FROM customer_projects WHERE id = ${id}::uuid AND customer_email = ${email}`;
  return rows[0] ?? null;
}
