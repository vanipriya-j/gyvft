import "server-only";
import { Resend } from "resend";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logging/logger";

/** Resend testing sender — works before a custom domain is verified. */
export const RESEND_TESTING_FROM_EMAIL = "onboarding@resend.dev";

export type PublicEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

function readRuntime(name: "RESEND_API_KEY" | "RESEND_FROM_EMAIL" | "RESEND_FROM_NAME" | "GYVFT_LEADS_EMAIL") {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  const env = getEnv();
  const value = env[name];
  return typeof value === "string" ? value.trim() : undefined;
}

export function getPublicResendConfigStatus() {
  const apiKey = Boolean(readRuntime("RESEND_API_KEY"));
  const fromEmail = Boolean(readRuntime("RESEND_FROM_EMAIL"));
  const leadsEmail = Boolean(readRuntime("GYVFT_LEADS_EMAIL") || readRuntime("RESEND_FROM_EMAIL"));
  return {
    configured: apiKey && fromEmail && leadsEmail,
    hasApiKey: apiKey,
    hasFromEmail: fromEmail,
    hasLeadsEmail: leadsEmail,
  };
}

function requireResendConfig() {
  const apiKey = readRuntime("RESEND_API_KEY");
  const fromEmail = readRuntime("RESEND_FROM_EMAIL");
  const fromName = readRuntime("RESEND_FROM_NAME") || "GYVFT";
  // Fall back to from-address so one inbox env var is enough in simple setups.
  const leadsEmail = readRuntime("GYVFT_LEADS_EMAIL") || fromEmail;

  const missing = [
    !apiKey ? "RESEND_API_KEY" : null,
    !fromEmail ? "RESEND_FROM_EMAIL" : null,
    !leadsEmail ? "GYVFT_LEADS_EMAIL" : null,
  ].filter(Boolean);

  if (missing.length) {
    logger.error("Public Resend config incomplete", { missing });
    throw new Error(`Missing email configuration: ${missing.join(", ")}`);
  }

  return {
    apiKey: apiKey!,
    fromEmail: fromEmail!,
    fromName,
    leadsEmail: leadsEmail!,
  };
}

function formatFrom(fromName: string, fromEmail: string) {
  return `${fromName} <${fromEmail}>`;
}

function isUnverifiedDomainError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("domain is not verified") || lower.includes("verify a domain");
}

function isTestingRecipientRestriction(message: string): boolean {
  return message.toLowerCase().includes("only send testing emails to your own email");
}

async function sendOnce(input: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: PublicEmailAttachment[];
}): Promise<{ id?: string }> {
  const resend = new Resend(input.apiKey);
  const result = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
    attachments: input.attachments?.map((file) => ({
      filename: file.filename,
      content: file.content.toString("base64"),
      contentType: file.contentType,
    })),
  });

  if (result.error) {
    const error = new Error(result.error.message) as Error & { code?: string };
    error.code = result.error.name;
    throw error;
  }

  return { id: result.data?.id };
}

export async function sendPublicResendEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: PublicEmailAttachment[];
}): Promise<{ id?: string }> {
  const config = requireResendConfig();
  const to = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean);
  if (!to.length) {
    throw new Error("No email recipients");
  }

  const primaryFrom = formatFrom(config.fromName, config.fromEmail);

  try {
    return await sendOnce({
      apiKey: config.apiKey,
      from: primaryFrom,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
      attachments: input.attachments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";

    // Custom domain not verified yet — retry with Resend's testing sender so leads still deliver.
    if (
      isUnverifiedDomainError(message) &&
      config.fromEmail.toLowerCase() !== RESEND_TESTING_FROM_EMAIL
    ) {
      logger.warn("Resend from-domain unverified; retrying with testing sender", {
        configuredFrom: config.fromEmail,
        fallbackFrom: RESEND_TESTING_FROM_EMAIL,
      });
      try {
        return await sendOnce({
          apiKey: config.apiKey,
          from: formatFrom(config.fromName, RESEND_TESTING_FROM_EMAIL),
          to,
          subject: input.subject,
          text: input.text,
          html: input.html,
          replyTo: input.replyTo,
          attachments: input.attachments,
        });
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : "Email send failed";
        logger.warn("Resend send failed after testing-sender fallback", {
          message: fallbackMessage,
          testingRecipientRestricted: isTestingRecipientRestriction(fallbackMessage),
        });
        throw fallbackError;
      }
    }

    logger.warn("Resend send failed", {
      message,
      testingRecipientRestricted: isTestingRecipientRestriction(message),
      unverifiedDomain: isUnverifiedDomainError(message),
    });
    throw error;
  }
}

export function getPublicLeadsInbox(): string {
  return requireResendConfig().leadsEmail;
}

export function logAckFailure(formKey: string, error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  logger.warn("Visitor acknowledgement email failed", {
    formKey,
    message,
    testingRecipientRestricted: isTestingRecipientRestriction(message),
    unverifiedDomain: isUnverifiedDomainError(message),
  });
}
