import "server-only";
import type { JSONValue } from "postgres";
import { Resend } from "resend";
import { getEnv } from "@/config/env";
import { getSql } from "@/lib/database/client";
import { decryptSecret } from "@/lib/encryption/secrets";
import { logger } from "@/lib/logging/logger";
import { createIntegrationLog } from "@/services/integrations/logs";

async function resolveResendConfig(): Promise<{
  apiKey: string | null;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
}> {
  const env = getEnv();
  const sql = getSql();
  const def = await sql<{ enabled: boolean; config: Record<string, unknown>; status: string }[]>`
    SELECT enabled, config, status FROM integration_definitions WHERE provider = 'resend' LIMIT 1
  `;
  const secret = await sql<{ ciphertext: Buffer; iv: Buffer; auth_tag: Buffer }[]>`
    SELECT ciphertext, iv, auth_tag FROM integration_secrets
    WHERE provider = 'resend' AND secret_name = 'api_key'
    LIMIT 1
  `;

  let apiKey: string | null = null;
  if (secret[0]) {
    apiKey = decryptSecret({
      ciphertext: secret[0].ciphertext,
      iv: secret[0].iv,
      authTag: secret[0].auth_tag,
    });
  } else if (env.RESEND_API_KEY) {
    apiKey = env.RESEND_API_KEY;
  }

  const config = def[0]?.config ?? {};
  return {
    apiKey,
    fromEmail: (config.from_email as string | undefined) ?? env.RESEND_FROM_EMAIL ?? "hello@gyvft.com",
    fromName: (config.from_name as string | undefined) ?? env.RESEND_FROM_NAME ?? "GYVFT",
    enabled: def[0]?.enabled ?? Boolean(apiKey),
  };
}

function renderBody(templateKey: string, variables: Record<string, unknown>): string {
  const name = String(variables.name ?? "there");
  switch (templateKey) {
    case "story_ack":
      return `Hello ${name},\n\nThank you for trusting GYVFT with your story. Our team will review it and follow up shortly.\n\n— GYVFT`;
    case "partner_ack":
      return `Hello ${name},\n\nThank you for your interest in making GYVFT your merchandise and storytelling partner. We will be in touch soon.\n\n— GYVFT`;
    case "brief_ack":
      return `Hello ${name},\n\nWe have received your brief and will review it carefully.\n\n— GYVFT`;
    case "discovery_ack":
      return `Hello ${name},\n\nWe have received your discovery request and will schedule a conversation.\n\n— GYVFT`;
    case "internal_opportunity":
      return `A new opportunity was created.\n\nID: ${variables.opportunityId}\nIntent: ${variables.intentType}\nSource: ${variables.source}`;
    case "task_assignment":
      return `You have been assigned a task: ${variables.title}`;
    case "opportunity_assignment":
      return `You have been assigned an opportunity: ${variables.opportunityId}`;
    case "user_invitation":
      return `You have been invited to GYVFT Studio. Visit ${variables.inviteUrl} to accept.`;
    case "test_email":
      return `This is a GYVFT Resend configuration test.`;
    default:
      return `Hello ${name},\n\nThank you for contacting GYVFT.`;
  }
}

export async function sendTransactionalEmail(input: {
  templateKey: string;
  to: string[];
  subject: string;
  opportunityId?: string;
  variables?: Record<string, unknown>;
}): Promise<{ accepted: boolean; deliveryId: string; providerMessageId?: string }> {
  const sql = getSql();
  const recipients = input.to.filter(Boolean);
  if (!recipients.length) {
    const row = await sql<{ id: string }[]>`
      INSERT INTO email_deliveries (template_key, to_addresses, subject, opportunity_id, status, last_error)
      VALUES (
        ${input.templateKey},
        ${[] as string[]},
        ${input.subject},
        ${input.opportunityId ?? null}::uuid,
        'skipped',
        'No recipients'
      )
      RETURNING id
    `;
    return { accepted: false, deliveryId: row[0]!.id };
  }

  const delivery = await sql<{ id: string }[]>`
    INSERT INTO email_deliveries (template_key, to_addresses, subject, opportunity_id, status, metadata)
    VALUES (
      ${input.templateKey},
      ${recipients},
      ${input.subject},
      ${input.opportunityId ?? null}::uuid,
      'queued',
      ${sql.json((input.variables ?? {}) as JSONValue)}
    )
    RETURNING id
  `;
  const deliveryId = delivery[0]!.id;
  const config = await resolveResendConfig();

  if (!config.enabled || !config.apiKey) {
    await sql`
      UPDATE email_deliveries
      SET status = 'failed', last_error = 'Resend is not configured', updated_at = NOW()
      WHERE id = ${deliveryId}::uuid
    `;
    await createIntegrationLog({
      provider: "resend",
      operation: "send_email",
      eventName: input.templateKey,
      success: false,
      sanitisedError: "Resend is not configured",
    });
    throw new Error("Resend is not configured");
  }

  const started = new Date();
  try {
    const resend = new Resend(config.apiKey);
    const body = renderBody(input.templateKey, input.variables ?? {});
    const result = await resend.emails.send({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: recipients,
      subject: input.subject,
      text: body,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    const providerMessageId = result.data?.id;
    await sql`
      UPDATE email_deliveries
      SET status = 'sent',
          provider_message_id = ${providerMessageId ?? null},
          sent_at = NOW(),
          updated_at = NOW()
      WHERE id = ${deliveryId}::uuid
    `;
    await createIntegrationLog({
      provider: "resend",
      operation: "send_email",
      eventName: input.templateKey,
      success: true,
      providerResponseId: providerMessageId,
      requestStartedAt: started,
      requestCompletedAt: new Date(),
    });
    return { accepted: true, deliveryId, providerMessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    await sql`
      UPDATE email_deliveries
      SET status = 'failed',
          last_error = ${message},
          next_retry_at = NOW() + INTERVAL '15 minutes',
          updated_at = NOW()
      WHERE id = ${deliveryId}::uuid
    `;
    await createIntegrationLog({
      provider: "resend",
      operation: "send_email",
      eventName: input.templateKey,
      success: false,
      sanitisedError: message,
      requestStartedAt: started,
      requestCompletedAt: new Date(),
    });
    logger.warn("Email send failed", { templateKey: input.templateKey, message });
    throw error;
  }
}
