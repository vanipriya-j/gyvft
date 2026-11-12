import "server-only";
import { getSql } from "@/lib/database/client";
export async function captureCustomerEnquiry(input: {
  submissionKey: string;
  email: string;
  title: string;
  brief: string;
  leadId: string | null;
}) {
  if (!process.env.DATABASE_URL) return;
  await getSql()`INSERT INTO customer_projects (submission_key, customer_email, title, brief, external_lead_id)
 VALUES (${input.submissionKey}, ${input.email.trim().toLowerCase()}, ${input.title}, ${input.brief}, ${input.leadId})
 ON CONFLICT (submission_key) DO NOTHING`;
}
