import "server-only";
import { createHmac } from "crypto";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logging/logger";
import type { PublicEmailAttachment } from "@/services/email/public-resend";

export type AarlaStoryFormKey =
  | "tell_your_story"
  | "become_a_merch_partner"
  | "book_a_discovery"
  | "upload_a_brief";

export const DEFAULT_AARLA_STORY_LEADS_URL =
  "https://aarla-os.vercel.app/api/integrations/story/leads";

type AttributionLike = {
  firstTouchSource?: string | null;
  firstTouchMedium?: string | null;
  firstTouchCampaign?: string | null;
  firstTouchLandingPage?: string | null;
  firstTouchReferrer?: string | null;
  lastTouchSource?: string | null;
  lastTouchMedium?: string | null;
  lastTouchCampaign?: string | null;
  lastTouchLandingPage?: string | null;
  lastTouchReferrer?: string | null;
};

export type AarlaStoryLeadPayload = {
  idempotency_key: string;
  source: "gyvft";
  module: "your_story_our_telling";
  form_key: AarlaStoryFormKey;
  submitted_at: string;
  contact: {
    full_name: string;
    email: string;
    phone: string | null;
    organisation_name: string | null;
    designation: string | null;
    preferred_contact_method: "email" | "phone" | "whatsapp" | null;
  };
  story: {
    description: string | null;
    occasion_type: string | null;
    audiences: string[];
    preferred_formats: string[];
    target_date: string | null;
    quantity_range: string | null;
    budget_range: string | null;
    primary_city: string | null;
    discussion_topic: string | null;
    timeline: string | null;
    additional_context: string | null;
  };
  consent: {
    communication: boolean;
    marketing: boolean;
  };
  attribution: {
    landing_page: string | null;
    referrer: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
  };
  attachment?: {
    filename: string;
    content_type: string;
    content_base64: string;
  };
};

export type AarlaStoryLeadResult = {
  ok: true;
  lead_id: string;
  module: string;
  form_key?: string;
  lead_type?: string;
  created?: boolean;
};

function readRuntime(name: "AARLA_STORY_LEADS_URL" | "AARLA_STORY_LEADS_API_KEY") {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  const env = getEnv();
  const value = env[name];
  return typeof value === "string" ? value.trim() : undefined;
}

export function getAarlaStoryLeadsConfig() {
  const url = readRuntime("AARLA_STORY_LEADS_URL") || DEFAULT_AARLA_STORY_LEADS_URL;
  const apiKey = readRuntime("AARLA_STORY_LEADS_API_KEY");
  return {
    url,
    apiKey,
    configured: Boolean(apiKey),
  };
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function asContactMethod(value: unknown): "email" | "phone" | "whatsapp" | null {
  const text = asString(value);
  if (text === "email" || text === "phone" || text === "whatsapp") return text;
  return null;
}

export function buildAarlaStoryLeadPayload(input: {
  formKey: AarlaStoryFormKey;
  idempotencyKey: string;
  submittedAt: string;
  fields: Record<string, unknown>;
  attribution?: AttributionLike | null;
  referrer?: string | null;
  attachment?: PublicEmailAttachment | null;
}): AarlaStoryLeadPayload {
  const fields = input.fields;
  const attribution = input.attribution;

  const payload: AarlaStoryLeadPayload = {
    idempotency_key: input.idempotencyKey,
    source: "gyvft",
    module: "your_story_our_telling",
    form_key: input.formKey,
    submitted_at: input.submittedAt,
    contact: {
      full_name: asString(fields.full_name ?? fields.name) || "Unknown",
      email: asString(fields.email ?? fields.work_email) || "",
      phone: asString(fields.phone),
      organisation_name: asString(fields.organisation_name ?? fields.organisation),
      designation: asString(fields.designation),
      preferred_contact_method: asContactMethod(fields.preferred_contact_method),
    },
    story: {
      description: asString(fields.story_description),
      occasion_type: asString(fields.occasion_type ?? fields.occasion_or_requirement),
      audiences: asStringArray(fields.audiences),
      preferred_formats: asStringArray(fields.preferred_formats ?? fields.requirement_types),
      target_date: asString(fields.target_date),
      quantity_range: asString(fields.quantity_range),
      budget_range: asString(fields.budget_range),
      primary_city: asString(fields.primary_city ?? fields.primary_locations),
      discussion_topic: asString(fields.discussion_topic),
      timeline: asString(fields.timeline),
      additional_context: asString(
        fields.additional_context ?? fields.brief_context ?? fields.location_notes,
      ),
    },
    consent: {
      communication: Boolean(fields.communication_consent ?? true),
      marketing: Boolean(fields.marketing_consent ?? false),
    },
    attribution: {
      landing_page:
        asString(attribution?.lastTouchLandingPage) ||
        asString(attribution?.firstTouchLandingPage),
      referrer:
        asString(input.referrer) ||
        asString(attribution?.lastTouchReferrer) ||
        asString(attribution?.firstTouchReferrer),
      utm_source:
        asString(attribution?.lastTouchSource) || asString(attribution?.firstTouchSource),
      utm_medium:
        asString(attribution?.lastTouchMedium) || asString(attribution?.firstTouchMedium),
      utm_campaign:
        asString(attribution?.lastTouchCampaign) || asString(attribution?.firstTouchCampaign),
    },
  };

  if (input.formKey === "upload_a_brief" && input.attachment) {
    payload.attachment = {
      filename: input.attachment.filename,
      content_type: input.attachment.contentType || "application/octet-stream",
      content_base64: input.attachment.content.toString("base64"),
    };
  }

  return payload;
}

function signHmac(apiKey: string, timestamp: string, rawBody: string): string {
  const digest = createHmac("sha256", apiKey).update(`${timestamp}.${rawBody}`).digest("hex");
  return `sha256=${digest}`;
}

/**
 * Forward a GYVFT public form lead into Aarla OS "Your Story. Our Telling."
 * Returns null when not configured. Throws on HTTP / transport failures.
 */
export async function forwardLeadToAarlaStory(
  payload: AarlaStoryLeadPayload,
): Promise<AarlaStoryLeadResult | null> {
  const config = getAarlaStoryLeadsConfig();
  if (!config.apiKey) {
    logger.warn("Aarla story leads API key not configured; skipping CRM forward");
    return null;
  }

  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "X-Aarla-Timestamp": timestamp,
      "X-Aarla-Signature": signHmac(config.apiKey, timestamp, rawBody),
    },
    body: rawBody,
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message =
      json && typeof json === "object" && "error" in json
        ? String((json as { error?: unknown }).error ?? text)
        : text || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const result = json as AarlaStoryLeadResult | null;
  if (!result?.ok || !result.lead_id) {
    throw new Error("Aarla story leads API returned an unexpected success payload");
  }
  return result;
}

/** Fail-open wrapper used by public form submit. */
export async function tryForwardLeadToAarlaStory(input: {
  formKey: AarlaStoryFormKey;
  idempotencyKey: string;
  submittedAt: string;
  fields: Record<string, unknown>;
  attribution?: AttributionLike | null;
  referrer?: string | null;
  attachment?: PublicEmailAttachment | null;
}): Promise<{ leadId: string | null; skipped: boolean }> {
  const config = getAarlaStoryLeadsConfig();
  if (!config.apiKey) {
    return { leadId: null, skipped: true };
  }

  try {
    const payload = buildAarlaStoryLeadPayload(input);
    const result = await forwardLeadToAarlaStory(payload);
    return { leadId: result?.lead_id ?? null, skipped: false };
  } catch (error) {
    logger.warn("Aarla story lead forward failed (email delivery unaffected)", {
      formKey: input.formKey,
      message: error instanceof Error ? error.message : "unknown",
    });
    return { leadId: null, skipped: false };
  }
}
