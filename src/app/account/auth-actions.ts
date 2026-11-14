"use server";
import { z } from "zod";
import { getSql } from "@/lib/database/client";
import {
  hashCustomerPassword,
  verifyCustomerPassword,
  newOpaqueToken,
  hashOpaqueToken,
  isOpaqueToken,
} from "@/lib/customer/password";
import {
  claimCustomerEnquiries,
  createCustomerSession,
} from "@/lib/customer/session";
import {
  limitCustomerAuth,
  customerAccountError,
} from "@/lib/customer/accounts";
import { sendPublicResendEmail } from "@/services/email/public-resend";
import { escapeHtml } from "@/lib/security/sanitize";
import { recordCustomerEvent } from "@/lib/customer/observability";
import { logger } from "@/lib/logging/logger";
export type CustomerAuthResult = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(8).max(128);
const genericCredentials =
  "We couldn’t sign you in. Check your email and password.";
export async function registerCustomerAction(
  data: FormData,
): Promise<CustomerAuthResult> {
  const email = emailSchema.safeParse(data.get("email"));
  const password = passwordSchema.safeParse(data.get("password"));
  if (!email.success || !password.success)
    return {
      ok: false,
      message: "Enter a valid email and a password of 8–128 characters.",
    };
  try {
    await limitCustomerAuth("register", email.data);
    const passwordHash = await hashCustomerPassword(password.data);
    const rows = await getSql()<
      { id: string; email: string }[]
    >`INSERT INTO gyvft_customer_accounts (email, password_hash) VALUES (${email.data}, ${passwordHash}) ON CONFLICT (email) DO NOTHING RETURNING id, email`;
    if (!rows[0])
      return {
        ok: false,
        message:
          "We couldn’t create this account. Try signing in or use Forgot password.",
      };
    await recordCustomerEvent("account.created", {
      accountId: rows[0].id,
      metadata: { route: "/account/login", operation: "register", status: 201 },
    });
    await claimCustomerEnquiries(rows[0]);
    await createCustomerSession(rows[0].id);
    await recordCustomerEvent("session.started", {
      accountId: rows[0].id,
      metadata: { route: "/account/login", operation: "register", status: 200 },
    });
    return {
      ok: true,
      message: "Your account is ready.",
      redirectTo: "/account",
    };
  } catch (error) {
    await recordCustomerEvent("app.error", {
      metadata: {
        route: "/account/login",
        code: "AUTH_ACTION_FAILED",
        status: 500,
      },
    });
    return { ok: false, message: customerAccountError(error) };
  }
}
export async function loginCustomerAction(
  data: FormData,
): Promise<CustomerAuthResult> {
  const email = emailSchema.safeParse(data.get("email"));
  const password = passwordSchema.safeParse(data.get("password"));
  if (!email.success || !password.success)
    return { ok: false, message: genericCredentials };
  try {
    await limitCustomerAuth("login", email.data);
    const rows = await getSql()<
      { id: string; email: string; password_hash: string; is_active: boolean }[]
    >`SELECT id, email, password_hash, is_active FROM gyvft_customer_accounts WHERE email = ${email.data} LIMIT 1`;
    const account = rows[0];
    // Perform the same expensive password work even when the account is absent.
    const fallback =
      "scrypt$32768$8$1$00000000000000000000000000000000$" + "0".repeat(128);
    const valid = await verifyCustomerPassword(
      password.data,
      account?.password_hash ?? fallback,
    );
    if (!account?.is_active || !valid) {
      await recordCustomerEvent("session.failed", {
        metadata: {
          route: "/account/login",
          operation: "login",
          code: "INVALID_CREDENTIALS",
          status: 401,
        },
      });
      return { ok: false, message: genericCredentials };
    }
    await claimCustomerEnquiries(account);
    await createCustomerSession(account.id);
    await recordCustomerEvent("session.started", {
      accountId: account.id,
      metadata: { route: "/account/login", operation: "login", status: 200 },
    });
    return { ok: true, message: "Signed in.", redirectTo: "/account" };
  } catch (error) {
    await recordCustomerEvent("app.error", {
      metadata: {
        route: "/account/login",
        code: "AUTH_ACTION_FAILED",
        status: 500,
      },
    });
    return { ok: false, message: customerAccountError(error) };
  }
}
export async function requestCustomerPasswordResetAction(
  data: FormData,
): Promise<CustomerAuthResult> {
  const generic = {
    ok: true,
    message:
      "If an account exists, password reset instructions will arrive by email.",
  };
  const email = emailSchema.safeParse(data.get("email"));
  if (!email.success) return generic;
  try {
    await limitCustomerAuth("reset-request", email.data);
    const [account] = await getSql()<
      { id: string }[]
    >`SELECT id FROM gyvft_customer_accounts WHERE email = ${email.data} AND is_active = true`;
    if (!account) return generic;
    const token = newOpaqueToken();
    await getSql()`INSERT INTO gyvft_customer_password_resets (token_hash, account_id, expires_at) VALUES (${hashOpaqueToken(token)}, ${account.id}::uuid, now() + interval '1 hour')`;
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://www.gyvft.com"
        : "http://localhost:3000");
    const url = new URL("/account/login", origin);
    url.searchParams.set("reset", token);
    await sendPublicResendEmail({
      to: email.data,
      subject: "Reset your GYVFT password",
      text: `Use this link to reset your GYVFT password. It expires in one hour.\n\n${url.href}\n\nIf you didn’t request this, you can ignore this email.`,
      html: `<p>Reset your GYVFT password using <a href="${escapeHtml(url.href)}">this secure link</a>. It expires in one hour.</p><p>If you didn’t request this, you can ignore this email.</p>`,
    });
  } catch {
    logger.warn("Customer password reset request could not complete");
  }
  return generic;
}
export async function resetCustomerPasswordAction(
  data: FormData,
): Promise<CustomerAuthResult> {
  const token = String(data.get("token") ?? "");
  const password = passwordSchema.safeParse(data.get("password"));
  if (!isOpaqueToken(token) || !password.success)
    return {
      ok: false,
      message: "Use a valid reset link and a password of 8–128 characters.",
    };
  try {
    await limitCustomerAuth("reset-use");
    const passwordHash = await hashCustomerPassword(password.data);
    const updated = await getSql().begin(async (tx) => {
      const rows = await tx<
        { account_id: string }[]
      >`UPDATE gyvft_customer_password_resets SET used_at = now() WHERE token_hash = ${hashOpaqueToken(token)} AND used_at IS NULL AND expires_at > now() RETURNING account_id`;
      if (!rows[0]) return false;
      const id = rows[0].account_id;
      await tx`UPDATE gyvft_customer_accounts SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${id}::uuid AND is_active = true`;
      await tx`DELETE FROM gyvft_customer_sessions WHERE account_id = ${id}::uuid`;
      await tx`UPDATE gyvft_customer_password_resets SET used_at = now() WHERE account_id = ${id}::uuid AND used_at IS NULL`;
      return true;
    });
    return updated
      ? {
          ok: true,
          message:
            "Your password has been changed. Sign in with your new password.",
          redirectTo: "/account/login",
        }
      : {
          ok: false,
          message:
            "This reset link is invalid or has expired. Request a new one.",
        };
  } catch (error) {
    await recordCustomerEvent("app.error", {
      metadata: {
        route: "/account/login",
        code: "AUTH_ACTION_FAILED",
        status: 500,
      },
    });
    return { ok: false, message: customerAccountError(error) };
  }
}
