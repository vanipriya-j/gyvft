import "server-only";
import { createHash } from "crypto";
import { getEnv } from "@/config/env";
import { getSql } from "@/lib/database/client";
import { decryptSecret } from "@/lib/encryption/secrets";
import { createIntegrationLog } from "@/services/integrations/logs";

function hashValue(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

async function resolveMetaCapi() {
  const env = getEnv();
  const sql = getSql();
  const def = await sql<{ enabled: boolean; config: Record<string, unknown> }[]>`
    SELECT enabled, config FROM integration_definitions WHERE provider = 'meta_capi' LIMIT 1
  `;
  const secret = await sql<{ ciphertext: Buffer; iv: Buffer; auth_tag: Buffer }[]>`
    SELECT ciphertext, iv, auth_tag FROM integration_secrets
    WHERE provider = 'meta_capi' AND secret_name = 'access_token'
    LIMIT 1
  `;
  let accessToken: string | null = null;
  if (secret[0]) {
    accessToken = decryptSecret({
      ciphertext: secret[0].ciphertext,
      iv: secret[0].iv,
      authTag: secret[0].auth_tag,
    });
  } else if (env.META_ACCESS_TOKEN) {
    accessToken = env.META_ACCESS_TOKEN;
  }
  const config = def[0]?.config ?? {};
  const datasetId = String(config.dataset_id ?? env.META_DATASET_ID ?? "");
  const apiVersion = String(config.api_version ?? "v21.0");
  const testEventCode = (config.test_event_code as string | undefined) ?? undefined;
  const serverEventsEnabled = config.server_events_enabled !== false;
  return {
    enabled: Boolean(def[0]?.enabled ?? (accessToken && datasetId)) && serverEventsEnabled,
    accessToken,
    datasetId,
    apiVersion,
    testEventCode,
  };
}

export async function sendConversionEvent(input: {
  eventName: string;
  eventId: string;
  opportunityId?: string;
  email?: string;
  consentAdvertising: boolean;
  correlationId?: string;
  customData?: Record<string, unknown>;
}): Promise<{ sent: boolean; providerResponseId?: string }> {
  const sql = getSql();
  const rule = await sql<{ meta_server_enabled: boolean }[]>`
    SELECT meta_server_enabled FROM tracking_rules
    WHERE event_name = ${mapInternalToRule(input.eventName)}
    LIMIT 1
  `;
  // Also allow direct Meta standard event names
  const ruleEnabled =
    rule[0]?.meta_server_enabled ??
    ["Lead", "CompleteRegistration", "Schedule", "QualifiedLead", "SubmitApplication", "Purchase"].includes(
      input.eventName,
    );

  if (!input.consentAdvertising || !ruleEnabled) {
    return { sent: false };
  }

  const config = await resolveMetaCapi();
  if (!config.enabled || !config.accessToken || !config.datasetId) {
    await createIntegrationLog({
      provider: "meta_capi",
      operation: "send_event",
      eventName: input.eventName,
      correlationId: input.correlationId,
      success: false,
      sanitisedError: "Meta Conversions API is not configured",
    });
    throw new Error("Meta Conversions API is not configured");
  }

  const started = new Date();
  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        user_data: {
          ...(input.email ? { em: [hashValue(input.email)] } : {}),
        },
        custom_data: {
          ...(input.customData ?? {}),
          ...(input.opportunityId ? { opportunity_id: input.opportunityId } : {}),
        },
      },
    ],
    ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
  };

  const url = `https://graph.facebook.com/${config.apiVersion}/${config.datasetId}/events?access_token=${encodeURIComponent(config.accessToken)}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await response.json()) as { events_received?: number; fbtrace_id?: string; error?: { message?: string } };
    if (!response.ok) {
      throw new Error(json.error?.message ?? `Meta CAPI HTTP ${response.status}`);
    }
    await createIntegrationLog({
      provider: "meta_capi",
      operation: "send_event",
      eventName: input.eventName,
      correlationId: input.correlationId,
      success: true,
      httpStatus: response.status,
      providerResponseId: json.fbtrace_id,
      requestStartedAt: started,
      requestCompletedAt: new Date(),
      metadata: { eventId: input.eventId, eventsReceived: json.events_received },
    });
    return { sent: true, providerResponseId: json.fbtrace_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta CAPI failed";
    await createIntegrationLog({
      provider: "meta_capi",
      operation: "send_event",
      eventName: input.eventName,
      correlationId: input.correlationId,
      success: false,
      sanitisedError: message,
      requestStartedAt: started,
      requestCompletedAt: new Date(),
      nextRetryAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    throw error;
  }
}

function mapInternalToRule(eventName: string): string {
  switch (eventName) {
    case "Lead":
      return "story_form_submitted";
    case "Schedule":
      return "discovery_requested";
    case "SubmitApplication":
      return "partner_form_submitted";
    case "Purchase":
      return "opportunity_won";
    case "QualifiedLead":
      return "lead_qualified";
    default:
      return eventName;
  }
}
