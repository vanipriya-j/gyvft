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

function requireResendConfig() {
  const env = getEnv();
  const apiKey = env.RESEND_API_KEY?.trim();
  const fromEmail = env.RESEND_FROM_EMAIL?.trim();
  const fromName = (env.RESEND_FROM_NAME ?? "GYVFT").trim() || "GYVFT";
  const leadsEmail = env.GYVFT_LEADS_EMAIL?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }
  if (!leadsEmail) {
    throw new Error("GYVFT_LEADS_EMAIL is not configured");
  }

  return {
    apiKey,
    fromEmail,
    fromName,
    leadsEmail,
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
    // Until aarla.in (or another domain) is verified, Resend only allows ack mail to the account owner.
    testingRecipientRestricted: isTestingRecipientRestriction(message),
    unverifiedDomain: isUnverifiedDomainError(message),
  });
}
