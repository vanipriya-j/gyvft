import "server-only";
import type { CustomerAccount } from "@/lib/customer/session";
import { getSql, withTransaction } from "@/lib/database/client";
import { isDemoAccount } from "@/lib/customer/demo-accounts";
import {
  hashOpaqueToken,
  isOpaqueToken,
  newOpaqueToken,
} from "@/lib/customer/password";
import { syncShopifyCustomer } from "@/lib/customer/shopify";
import { sendNotificationEmail } from "@/services/notifications/transports";
import { AppError } from "@/lib/errors/app-error";
import { rewardConflict, rewardSettings } from "./store";
import { REWARD_CUSTOMER, rewardsShopify } from "@/services/shopify/rewards";
export async function verifiedRewardCustomer(account: CustomerAccount) {
  await rewardSettings();
  if (isDemoAccount(account.id))
    throw new AppError("FORBIDDEN", "Sample accounts cannot use real rewards.");
  const [wallet] =
    await getSql()`SELECT customer_id FROM gyvft_reward_wallets WHERE account_id=${account.id}::uuid AND verified_email=${account.email} AND email=${account.email} AND verified_at IS NOT NULL`;
  if (!wallet)
    throw rewardConflict("Verify your email to connect your Aarla rewards.");
  return String(wallet.customer_id);
}
export async function sendRewardVerification(account: CustomerAccount) {
  await rewardSettings();
  if (isDemoAccount(account.id))
    throw new AppError(
      "FORBIDDEN",
      "Sample accounts cannot send real verification emails.",
    );
  const token = newOpaqueToken();
  await withTransaction(async (tx) => {
    await tx`SELECT id FROM gyvft_customer_accounts WHERE id=${account.id}::uuid FOR UPDATE`;
    const [recent] =
      await tx`SELECT created_at FROM gyvft_reward_verifications WHERE account_id=${account.id}::uuid AND created_at>now()-interval '5 minutes' LIMIT 1`;
    if (recent)
      throw new AppError(
        "RATE_LIMITED",
        "Check your email or wait five minutes before requesting another link.",
      );
    await tx`INSERT INTO gyvft_reward_verifications(token_hash,account_id,email,expires_at) VALUES(${hashOpaqueToken(token)},${account.id}::uuid,${account.email},now()+interval '1 hour')`;
  });
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://www.gyvft.com"
      : "http://localhost:3000");
  const url = new URL("/rewards/verify", origin);
  url.hash = `verify=${token}`;
  try {
    await sendNotificationEmail({
      id: hashOpaqueToken(token),
      to: account.email,
      subject: "Connect your Aarla rewards to GYVFT",
      text: `Confirm your email in GYVFT to connect your own Aarla rewards. This link expires in one hour.\n\n${url.href}\n\nSign in to the same GYVFT account, then select Confirm email. If you did not request this, ignore this email.`,
    });
  } catch {
    throw new AppError(
      "INTEGRATION_ERROR",
      "We could not confirm the verification email. Please try again after five minutes.",
    );
  }
  return {
    message: "Verification email accepted. Check your inbox and spam folder.",
  };
}
export async function confirmRewardVerification(
  account: CustomerAccount,
  token: string,
) {
  await rewardSettings();
  if (isDemoAccount(account.id) || !isOpaqueToken(token))
    throw rewardConflict("Invalid verification link.");
  const sql = getSql();
  const [proof] =
    await sql`SELECT token_hash FROM gyvft_reward_verifications WHERE token_hash=${hashOpaqueToken(token)} AND account_id=${account.id}::uuid AND email=${account.email} AND used_at IS NULL AND expires_at>now()`;
  if (!proof)
    throw rewardConflict(
      "This verification link expired or belongs to another account.",
    );
  const customer = await syncShopifyCustomer(account.id);
  if (!customer)
    throw rewardConflict("Aarla customer connection is not ready.");
  const data = await rewardsShopify<{
    customer: {
      id: string;
      defaultEmailAddress: { emailAddress: string } | null;
    } | null;
  }>(REWARD_CUSTOMER, { id: customer });
  if (
    data.customer?.defaultEmailAddress?.emailAddress.toLowerCase() !==
    account.email
  )
    throw rewardConflict("Your Aarla customer email needs review.");
  await withTransaction(async (tx) => {
    const [used] =
      await tx`UPDATE gyvft_reward_verifications SET used_at=now() WHERE token_hash=${hashOpaqueToken(token)} AND account_id=${account.id}::uuid AND email=${account.email} AND used_at IS NULL AND expires_at>now() RETURNING token_hash`;
    if (!used) throw rewardConflict("This link has already been used.");
    const [wallet] =
      await tx`INSERT INTO gyvft_reward_wallets(customer_id,email,account_id,verified_email,verified_at) VALUES(${customer},${account.email},${account.id}::uuid,${account.email},now()) ON CONFLICT(customer_id) DO UPDATE SET account_id=excluded.account_id,verified_email=excluded.verified_email,verified_at=excluded.verified_at,email=excluded.email WHERE gyvft_reward_wallets.account_id IS NULL OR gyvft_reward_wallets.account_id=excluded.account_id RETURNING customer_id`;
    if (!wallet)
      throw rewardConflict(
        "This Aarla wallet is already connected to another account. Contact GYVFT.",
      );
  });
  return { message: "Email confirmed. Your Aarla rewards are connected." };
}
