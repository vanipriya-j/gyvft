import "server-only";
import {
  exactStoryDate,
  type StoryRequest,
} from "@/lib/customer/story-request";
import { recordCustomerEvent } from "@/lib/customer/observability";
import { cookies } from "next/headers";
import { getSql } from "@/lib/database/client";
import {
  getCustomerAccount,
  claimCookie,
  customerCookieOptions,
} from "@/lib/customer/session";
import {
  hashOpaqueToken,
  newOpaqueToken,
  isOpaqueToken,
} from "@/lib/customer/password";
export async function captureCustomerEnquiry(input: {
  submissionKey: string;
  email: string;
  title: string;
  brief: string;
  leadId: string | null;
  storyDetails?: StoryRequest;
}) {
  if (!process.env.DATABASE_URL) return;
  const email = input.email.trim().toLowerCase();
  const account = await getCustomerAccount();
  const owner = account?.email === email ? account.id : null;
  let claimHash: string | null = null;
  if (!owner) {
    const jar = await cookies();
    let token = jar.get(claimCookie)?.value;
    if (!token || !isOpaqueToken(token)) {
      token = newOpaqueToken();
      jar.set(claimCookie, token, customerCookieOptions);
    }
    claimHash = hashOpaqueToken(token);
  }
  const sql = getSql();
  const inserted = input.storyDetails
    ? await sql`INSERT INTO customer_projects (submission_key, customer_email, title, brief, external_lead_id, customer_account_id, browser_claim_hash, browser_claim_expires_at, gift_brief, target_date)
      VALUES (${input.submissionKey}, ${email}, ${input.title}, ${input.brief}, ${input.leadId}, ${owner}::uuid, ${claimHash}, CASE WHEN ${claimHash}::text IS NULL THEN NULL ELSE now() + interval '7 days' END, ${sql.json(input.storyDetails)}, ${exactStoryDate(input.storyDetails)}::date) ON CONFLICT (submission_key) DO NOTHING RETURNING id`
    : await sql`INSERT INTO customer_projects (submission_key, customer_email, title, brief, external_lead_id, customer_account_id, browser_claim_hash, browser_claim_expires_at)
   VALUES (${input.submissionKey}, ${email}, ${input.title}, ${input.brief}, ${input.leadId}, ${owner}::uuid, ${claimHash}, CASE WHEN ${claimHash}::text IS NULL THEN NULL ELSE now() + interval '7 days' END) ON CONFLICT (submission_key) DO NOTHING RETURNING id`;
  if (inserted.length)
    await recordCustomerEvent("enquiry.created", {
      accountId: owner ?? undefined,
      metadata: { operation: "enquiry", status: 201 },
    });
}
