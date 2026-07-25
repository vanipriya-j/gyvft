import "server-only";
import { Resend } from "resend";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logging/logger";

export type PublicEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

function requireResendConfig() {
  const env = getEnv();
  const apiKey = env.RESEND_API_KEY;
  const fromEmail = env.RESEND_FROM_EMAIL;
  const fromName = env.RESEND_FROM_NAME ?? "GYVFT";
  const leadsEmail = env.GYVFT_LEADS_EMAIL;

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
    from: `${fromName} <${fromEmail}>`,
    fromEmail,
    fromName,
    leadsEmail,
  };
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
  const resend = new Resend(config.apiKey);
  const to = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean);
  if (!to.length) {
    throw new Error("No email recipients");
  }

  const result = await resend.emails.send({
    from: config.from,
    to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
    attachments: input.attachments?.map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType,
    })),
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return { id: result.data?.id };
}

export function getPublicLeadsInbox(): string {
  return requireResendConfig().leadsEmail;
}

export function logAckFailure(formKey: string, error: unknown) {
  logger.warn("Visitor acknowledgement email failed", {
    formKey,
    message: error instanceof Error ? error.message : "unknown",
  });
}
