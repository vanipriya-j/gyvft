import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/database/client";
import { hashOpaqueToken, isOpaqueToken, newOpaqueToken } from "./password";
export type CustomerAccount = { id: string; email: string };
export const sessionCookie = "gyvft_customer_session";
export const claimCookie = "gyvft_enquiry_claim";
const duration = 7 * 24 * 60 * 60;
export const customerCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: duration,
};
export async function getCustomerAccount(): Promise<CustomerAccount | null> {
  if (!process.env.DATABASE_URL) return null;
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !isOpaqueToken(token)) return null;
  const rows = await getSql()<
    CustomerAccount[]
  >`SELECT a.id, a.email FROM gyvft_customer_sessions s JOIN gyvft_customer_accounts a ON a.id = s.account_id WHERE s.token_hash = ${hashOpaqueToken(token)} AND s.expires_at > now() AND a.is_active = true LIMIT 1`;
  return rows[0] ?? null;
}
export async function requireCustomerAccount() {
  const account = await getCustomerAccount();
  if (!account) redirect("/account/login");
  return account;
}
export async function createCustomerSession(accountId: string) {
  const jar = await cookies();
  const old = jar.get(sessionCookie)?.value;
  const token = newOpaqueToken();
  await getSql().begin(async (tx) => {
    if (old && isOpaqueToken(old))
      await tx`DELETE FROM gyvft_customer_sessions WHERE token_hash = ${hashOpaqueToken(old)}`;
    await tx`DELETE FROM gyvft_customer_sessions WHERE account_id = ${accountId}::uuid AND expires_at <= now()`;
    await tx`INSERT INTO gyvft_customer_sessions (token_hash, account_id, expires_at) VALUES (${hashOpaqueToken(token)}, ${accountId}::uuid, now() + interval '7 days')`;
  });
  jar.set(sessionCookie, token, customerCookieOptions);
}
export async function destroyCustomerSession() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token && isOpaqueToken(token))
    await getSql()`DELETE FROM gyvft_customer_sessions WHERE token_hash = ${hashOpaqueToken(token)}`;
  jar.set(sessionCookie, "", { ...customerCookieOptions, maxAge: 0 });
}
/** Link only enquiries proven by this browser's unguessable claim cookie, plus
 * explicitly requested fictional fixtures. Never claim real enquiries by email. */
export async function claimCustomerEnquiries(account: CustomerAccount) {
  const jar = await cookies();
  const claim = jar.get(claimCookie)?.value;
  if (claim && isOpaqueToken(claim)) {
    await getSql()`UPDATE customer_projects SET customer_account_id = ${account.id}::uuid, browser_claim_hash = NULL, browser_claim_expires_at = NULL WHERE customer_account_id IS NULL AND browser_claim_hash = ${hashOpaqueToken(claim)} AND browser_claim_expires_at > now() AND customer_email = ${account.email}`;
    jar.set(claimCookie, "", { ...customerCookieOptions, maxAge: 0 });
  }
  await getSql()`UPDATE customer_projects SET customer_account_id = ${account.id}::uuid WHERE customer_account_id IS NULL AND customer_email = ${account.email} AND submission_key IN ('gyvft-demo-v1-received','gyvft-demo-v1-review','gyvft-demo-v1-accepted') AND id IN ('d3e00000-0000-4000-8000-000000000001'::uuid,'d3e00000-0000-4000-8000-000000000002'::uuid,'d3e00000-0000-4000-8000-000000000003'::uuid)`;
}
