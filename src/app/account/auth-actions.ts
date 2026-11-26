"use server";
import { randomUUID } from "node:crypto";
import { scheduleCustomerSync } from "@/lib/customer/shopify";
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
  CustomerRateLimitError,
  limitCustomerAuth,
  customerAccountError,
} from "@/lib/customer/accounts";
import { sendPublicResendEmail } from "@/services/email/public-resend";
import { escapeHtml } from "@/lib/security/sanitize";
import { deferCustomerEvent } from "@/lib/customer/deferred-events";
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

// Log only classified failures, never request input, provider messages or URLs.
type AuthOperation = "register" | "login" | "reset-request" | "reset-use";
type AuthPhase =
  | "rate-limit"
  | "password"
  | "account"
  | "claim"
  | "session"
  | "reset-token"
  | "reset-link"
  | "email";
async function reportAuthFailure(
  operation: AuthOperation,
  phase: AuthPhase,
  error: unknown,
) {
  const rawCode =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  const providerCodes = new Set([
    "validation_error",
    "missing_api_key",
    "restricted_api_key",
    "invalid_api_key",
    "rate_limit_exceeded",
    "application_error",
    "internal_server_error",
  ]);
  const limited = error instanceof CustomerRateLimitError;
  const code = limited
    ? "AUTH_RATE_LIMITED"
    : typeof rawCode === "string" && /^[0-9]{2}[A-Z0-9]{3}$/.test(rawCode)
      ? `DB_${rawCode}`
      : typeof rawCode === "string" &&
          phase === "email" &&
          providerCodes.has(rawCode)
        ? `EMAIL_${rawCode.toUpperCase()}`
        : phase === "email" && !process.env.RESEND_API_KEY?.trim()
          ? "EMAIL_NOT_CONFIGURED"
          : "AUTH_ACTION_FAILED";
  const requestId = randomUUID(),
    status = limited ? 429 : 500;
  const fields = { requestId, operation, phase, code, status };
  if (limited) logger.warn("Customer authentication operation limited", fields);
  else logger.error("Customer authentication operation failed", fields);
  deferCustomerEvent("app.error", {
    requestId,
    metadata: { route: "/account/login", operation, code, status },
  });
}
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
  let phase: AuthPhase = "rate-limit";
  try {
    await limitCustomerAuth("register", email.data);
    phase = "password";
    const passwordHash = await hashCustomerPassword(password.data);
    phase = "account";
    const rows = await getSql()<
      { id: string; email: string }[]
    >`INSERT INTO gyvft_customer_accounts (email, password_hash) VALUES (${email.data}, ${passwordHash}) ON CONFLICT (email) DO NOTHING RETURNING id, email`;
    if (!rows[0])
      return {
        ok: false,
        message:
          "We couldn’t create this account. Try signing in or use Forgot password.",
      };
    deferCustomerEvent("account.created", {
      accountId: rows[0].id,
      metadata: { route: "/account/login", operation: "register", status: 201 },
    });
    phase = "claim";
    await claimCustomerEnquiries(rows[0]);
    phase = "session";
    await createCustomerSession(rows[0].id);
    scheduleCustomerSync(rows[0].id);
    deferCustomerEvent("session.started", {
      accountId: rows[0].id,
      metadata: { route: "/account/login", operation: "register", status: 200 },
    });
    return {
      ok: true,
      message: "Your account is ready.",
      redirectTo: "/account",
    };
  } catch (error) {
    await reportAuthFailure("register", phase, error);
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
  let phase: AuthPhase = "rate-limit";
  try {
    await limitCustomerAuth("login", email.data);
    phase = "account";
    const rows = await getSql()<
      { id: string; email: string; password_hash: string; is_active: boolean }[]
    >`SELECT id, email, password_hash, is_active FROM gyvft_customer_accounts WHERE email = ${email.data} LIMIT 1`;
    const account = rows[0];
    // Perform the same expensive password work even when the account is absent.
    const fallback =
      "scrypt$32768$8$1$00000000000000000000000000000000$" + "0".repeat(128);
    phase = "password";
    const valid = await verifyCustomerPassword(
      password.data,
      account?.password_hash ?? fallback,
    );
    if (!account?.is_active || !valid) {
      deferCustomerEvent("session.failed", {
        metadata: {
          route: "/account/login",
          operation: "login",
          code: "INVALID_CREDENTIALS",
          status: 401,
        },
      });
      return { ok: false, message: genericCredentials };
    }
    phase = "claim";
    await claimCustomerEnquiries(account);
    phase = "session";
    await createCustomerSession(account.id);
    scheduleCustomerSync(account.id);
    deferCustomerEvent("session.started", {
      accountId: account.id,
      metadata: { route: "/account/login", operation: "login", status: 200 },
    });
    return { ok: true, message: "Signed in.", redirectTo: "/account" };
  } catch (error) {
    await reportAuthFailure("login", phase, error);
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
  let phase: AuthPhase = "rate-limit";
  const requestId = randomUUID();
  try {
    await limitCustomerAuth("reset-request", email.data);
    phase = "account";
    const [account] = await getSql()<
      { id: string }[]
    >`SELECT id FROM gyvft_customer_accounts WHERE email = ${email.data} AND is_active = true`;
    if (!account) {
      logger.info("Customer password reset lookup completed", {
        requestId,
        operation: "reset-request",
        outcome: "no_active_account",
      });
      return generic;
    }
    phase = "reset-token";
    const token = newOpaqueToken();
    await getSql()`INSERT INTO gyvft_customer_password_resets (token_hash, account_id, expires_at) VALUES (${hashOpaqueToken(token)}, ${account.id}::uuid, now() + interval '1 hour')`;
    phase = "reset-link";
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://www.gyvft.com"
        : "http://localhost:3000");
    const url = new URL("/account/login", origin);
    url.searchParams.set("reset", token);
    phase = "email";
    await sendPublicResendEmail({
      to: email.data,
      subject: "Reset your GYVFT password",
      text: `Use this link to reset your GYVFT password. It expires in one hour.\n\n${url.href}\n\nIf you didn’t request this, you can ignore this email.`,
      html: `<p>Reset your GYVFT password using <a href="${escapeHtml(url.href)}">this secure link</a>. It expires in one hour.</p><p>If you didn’t request this, you can ignore this email.</p>`,
    });
    logger.info("Customer password reset email accepted", {
      requestId,
      operation: "reset-request",
    });
  } catch (error) {
    await reportAuthFailure("reset-request", phase, error);
    // This limit is checked before account lookup and applies equally to unknown addresses.
    if (error instanceof CustomerRateLimitError)
      return { ok: false, message: customerAccountError(error) };
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
  let phase: AuthPhase = "rate-limit";
  try {
    await limitCustomerAuth("reset-use");
    phase = "password";
    const passwordHash = await hashCustomerPassword(password.data);
    phase = "reset-token";
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
    await reportAuthFailure("reset-use", phase, error);
    return { ok: false, message: customerAccountError(error) };
  }
}
