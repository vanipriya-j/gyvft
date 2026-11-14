"use server";
import { uuidPattern } from "@/lib/customer/model";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { customerEmail, ownedProject } from "@/lib/customer/data";
import { getSql } from "@/lib/database/client";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { createSupabaseServerClient } from "@/lib/auth/session";
export async function signOut() {
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/account/login");
}
export async function sendMessage(id: string, data: FormData) {
  const email = await customerEmail();
  if (!(await ownedProject(id, email))) throw new Error("Project unavailable");
  assertPublicFormRateLimit({
    ip: email,
    formKey: "customer-write",
    limit: 30,
    windowMs: 60000,
  });
  const body = String(data.get("body") ?? "").trim();
  if (!body || body.length > 4000)
    return { ok: false, message: "Message must contain 1–4000 characters." };
  await getSql()`INSERT INTO customer_project_messages (project_id, sender, body) SELECT id, 'customer', ${body} FROM customer_projects WHERE id = ${id}::uuid AND customer_email = ${email}`;
  revalidatePath(`/account/projects/${id}`);
  return { ok: true, message: "Your message has been saved." };
}
export async function submitPayment(id: string, data: FormData) {
  const email = await customerEmail();
  if (!(await ownedProject(id, email))) throw new Error("Project unavailable");
  assertPublicFormRateLimit({
    ip: email,
    formKey: "customer-write",
    limit: 30,
    windowMs: 60000,
  });
  const reference = String(data.get("reference") ?? "").trim();
  const amountText = String(data.get("amount") ?? "");
  if (
    !/^\d{1,8}(\.\d{1,2})?$/.test(amountText) ||
    reference.length < 6 ||
    reference.length > 100
  )
    return {
      ok: false,
      message: "Enter a valid amount and payment reference.",
    };
  const amount = Math.round(Number(amountText) * 100);
  if (amount <= 0) return { ok: false, message: "Enter a positive amount." };
  await getSql()`INSERT INTO customer_payment_submissions (project_id, amount_paise, reference) SELECT id, ${amount}, ${reference} FROM customer_projects WHERE id = ${id}::uuid AND customer_email = ${email} ON CONFLICT (project_id, reference) DO NOTHING`;
  revalidatePath(`/account/projects/${id}`);
  return {
    ok: true,
    message: "Payment reference recorded. Awaiting team verification.",
  };
}

export async function decideApproval(
  id: string,
  approvalId: string,
  data: FormData,
) {
  const email = await customerEmail();
  if (!(await ownedProject(id, email)) || !uuidPattern.test(approvalId))
    throw new Error("Approval unavailable");
  assertPublicFormRateLimit({
    ip: email,
    formKey: "customer-write",
    limit: 30,
    windowMs: 60000,
  });
  const decision = String(data.get("decision") ?? "");
  const response = String(data.get("response") ?? "").trim();
  if (
    !["approved", "changes_requested"].includes(decision) ||
    response.length > 4000 ||
    (decision === "changes_requested" && !response)
  )
    return { ok: false, message: "Please describe the changes you need." };
  const rows = await getSql()`WITH decision AS (
  UPDATE customer_project_approvals a SET status = ${decision}, customer_response = ${response}, decided_at = now()
  FROM customer_projects p WHERE a.id = ${approvalId}::uuid AND a.project_id = p.id AND p.id = ${id}::uuid
   AND p.customer_email = ${email} AND a.status = 'pending'
   AND NOT EXISTS (SELECT 1 FROM customer_project_approvals newer WHERE newer.project_id = a.project_id AND newer.kind = a.kind AND newer.version > a.version)
  RETURNING a.project_id, a.title, a.version
 ) INSERT INTO customer_project_events (project_id, title, body)
 SELECT project_id, title || ' · v' || version || ${decision === "approved" ? " approved" : " — changes requested"}, ${response} FROM decision RETURNING id`;
  revalidatePath(`/account/projects/${id}`);
  return {
    ok: rows.length > 0,
    message: rows.length
      ? "Your decision has been recorded."
      : "This version has already received a decision. Refresh to see the latest.",
  };
}
