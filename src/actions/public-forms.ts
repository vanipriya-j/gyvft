"use server";

import { z } from "zod";
import { getEnv } from "@/config/env";
import { createActivity } from "@/repositories/activities";
import { createOrMatchContact } from "@/repositories/contacts";
import { recordAnalyticsEvent } from "@/repositories/events";
import { createOrMatchOrganisation } from "@/repositories/organisations";
import { createOpportunity, findByIdempotencyKey } from "@/repositories/opportunities";
import { createIntegrationLog } from "@/services/integrations/logs";
import {
  submitDiscoveryRequest,
  submitPartnerOpportunity,
  submitStoryOpportunity,
} from "@/services/opportunities/lead-capture";
import { storeBriefFile } from "@/services/storage/briefs";
import { discoveryFormSchema, type DiscoveryFormInput } from "@/lib/validation/discovery-form";
import { partnerFormSchema, type PartnerFormInput } from "@/lib/validation/partner-form";
import { storyFormSchema, type StoryFormInput } from "@/lib/validation/story-form";

type ActionResult =
  | { ok: true; opportunityId: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const flattened = error.flatten();
  return Object.fromEntries(
    Object.entries(flattened.fieldErrors).filter((entry): entry is [string, string[]] =>
      Array.isArray(entry[1]),
    ),
  );
}

function messageFrom(error: unknown): string {
  if (error instanceof z.ZodError) return "Please check the highlighted fields.";
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export async function submitStoryAction(input: StoryFormInput): Promise<ActionResult> {
  const parsed = storyFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: messageFrom(parsed.error), fieldErrors: fieldErrors(parsed.error) };
  }
  try {
    const result = await submitStoryOpportunity(parsed.data);
    return { ok: true, opportunityId: result.opportunityId };
  } catch (error) {
    return { ok: false, message: messageFrom(error) };
  }
}

export async function submitPartnerAction(input: PartnerFormInput): Promise<ActionResult> {
  const parsed = partnerFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: messageFrom(parsed.error), fieldErrors: fieldErrors(parsed.error) };
  }
  try {
    const result = await submitPartnerOpportunity(parsed.data);
    return { ok: true, opportunityId: result.opportunityId };
  } catch (error) {
    return { ok: false, message: messageFrom(error) };
  }
}

export async function submitDiscoveryAction(input: DiscoveryFormInput): Promise<ActionResult> {
  const parsed = discoveryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: messageFrom(parsed.error), fieldErrors: fieldErrors(parsed.error) };
  }
  try {
    const result = await submitDiscoveryRequest(parsed.data);
    return { ok: true, opportunityId: result.opportunityId };
  } catch (error) {
    return { ok: false, message: messageFrom(error) };
  }
}

const briefMetadataSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  organisation_name: z.string().trim().max(200).optional().nullable(),
  designation: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  brief_title: z.string().trim().min(4).max(180),
  brief_context: z.string().trim().min(10).max(5000),
  timeline: z.string().trim().min(2).max(200),
  budget_range: z.string().trim().min(1).max(120),
  preferred_contact_method: z.enum(["email", "phone", "whatsapp"]),
  communication_consent: z.literal(true),
  honeypot: z.string().max(0).optional().nullable(),
  idempotency_key: z.string().uuid(),
  attribution: storyFormSchema.shape.attribution,
  consent: storyFormSchema.shape.consent,
});

export async function submitBriefUploadAction(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  const rawMetadata = formData.get("metadata");
  if (!(file instanceof File) || typeof rawMetadata !== "string") {
    return { ok: false, message: "Please attach a brief file and contact details." };
  }

  const metadataJson: unknown = JSON.parse(rawMetadata) as unknown;
  const parsed = briefMetadataSchema.safeParse(metadataJson);
  if (!parsed.success) {
    return { ok: false, message: messageFrom(parsed.error), fieldErrors: fieldErrors(parsed.error) };
  }
  if (parsed.data.honeypot) {
    return { ok: false, message: "Submission rejected." };
  }

  try {
    const duplicate = await findByIdempotencyKey(parsed.data.idempotency_key);
    if (duplicate) return { ok: true, opportunityId: duplicate.id };

    let organisationId: string | null = null;
    if (parsed.data.organisation_name?.trim()) {
      const organisation = await createOrMatchOrganisation({
        name: parsed.data.organisation_name,
      });
      organisationId = organisation.organisation.id;
    }

    const contact = await createOrMatchContact({
      fullName: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      organisationId,
      designation: parsed.data.designation,
      preferredContactMethod: parsed.data.preferred_contact_method,
      source: "brief_upload",
      communicationConsent: parsed.data.communication_consent,
      marketingConsent: false,
      consentVersion: parsed.data.consent?.version,
    });

    const opportunity = await createOpportunity({
      storyTitle: parsed.data.brief_title,
      intentType: "brief_upload",
      relationshipType: "unknown",
      source: "brief_upload",
      formKey: "upload_a_brief",
      contactId: contact.contact.id,
      organisationId,
      budgetRange: parsed.data.budget_range,
      targetDatePrecision: parsed.data.timeline,
      locationNotes: parsed.data.brief_context,
      idempotencyKey: parsed.data.idempotency_key,
    });

    await createActivity({
      opportunityId: opportunity.id,
      contactId: contact.contact.id,
      organisationId,
      activityType: "form.submitted",
      summary: "Brief uploaded",
      metadata: {
        form_key: "upload_a_brief",
        filename: file.name,
        byte_size: file.size,
      },
    });

    const env = getEnv();
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await storeBriefFile({ file, opportunityId: opportunity.id });
      } catch (error) {
        await createIntegrationLog({
          provider: "supabase_storage",
          operation: "upload_brief",
          success: false,
          sanitisedError: error instanceof Error ? error.message : "brief storage failed",
          metadata: { opportunityId: opportunity.id },
        });
      }
    } else {
      await createIntegrationLog({
        provider: "supabase_storage",
        operation: "upload_brief",
        success: false,
        sanitisedError: "Supabase storage is not configured",
        metadata: { opportunityId: opportunity.id },
      });
    }

    await recordAnalyticsEvent({
      eventName: "brief_upload_completed",
      eventId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      opportunityId: opportunity.id,
      contactId: contact.contact.id,
      sourceRoute: "upload_a_brief",
      consentAnalytics: parsed.data.consent?.analytics,
      consentAdvertising: parsed.data.consent?.advertising,
      properties: { source: "brief_upload" },
    });

    return { ok: true, opportunityId: opportunity.id };
  } catch (error) {
    return { ok: false, message: messageFrom(error) };
  }
}
