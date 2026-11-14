"use server";

import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import { discoveryFormSchema, type DiscoveryFormInput } from "@/lib/validation/discovery-form";
import { partnerFormSchema, type PartnerFormInput } from "@/lib/validation/partner-form";
import { storyFormSchema, type StoryFormInput } from "@/lib/validation/story-form";
import { submitPublicLead } from "@/services/leads/submit-public-lead";

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
  if (error instanceof AppError && error.expose) return error.message;
  if (error instanceof z.ZodError) return "Please check the highlighted fields.";
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function omitMeta<T extends Record<string, unknown>>(input: T) {
  const fields = { ...input };
  delete fields.honeypot;
  delete fields.idempotency_key;
  delete fields.attribution;
  delete fields.consent;
  return fields;
}

export async function submitStoryAction(input: StoryFormInput): Promise<ActionResult> {
  const parsed = storyFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: messageFrom(parsed.error), fieldErrors: fieldErrors(parsed.error) };
  }
  try {
    const result = await submitPublicLead({
      formKey: "tell_your_story",
      idempotencyKey: parsed.data.idempotency_key,
      honeypot: parsed.data.honeypot,
      fields: omitMeta(parsed.data),
      attribution: parsed.data.attribution,
    });
    return { ok: true, opportunityId: result.submissionId };
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
    const result = await submitPublicLead({
      formKey: "become_a_merch_partner",
      idempotencyKey: parsed.data.idempotency_key,
      honeypot: parsed.data.honeypot,
      fields: omitMeta(parsed.data),
      attribution: parsed.data.attribution,
    });
    return { ok: true, opportunityId: result.submissionId };
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
    const result = await submitPublicLead({
      formKey: "book_a_discovery",
      idempotencyKey: parsed.data.idempotency_key,
      honeypot: parsed.data.honeypot,
      fields: omitMeta(parsed.data),
      attribution: parsed.data.attribution,
    });
    return { ok: true, opportunityId: result.submissionId };
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

  let metadataJson: unknown;
  try {
    metadataJson = JSON.parse(rawMetadata) as unknown;
  } catch {
    return { ok: false, message: "Please attach a brief file and contact details." };
  }

  const parsed = briefMetadataSchema.safeParse(metadataJson);
  if (!parsed.success) {
    return { ok: false, message: messageFrom(parsed.error), fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await submitPublicLead({
      formKey: "upload_a_brief",
      idempotencyKey: parsed.data.idempotency_key,
      honeypot: parsed.data.honeypot,
      fields: omitMeta(parsed.data),
      attribution: parsed.data.attribution,
      attachment: {
        filename: file.name || "brief-upload",
        content: bytes,
        contentType: file.type || undefined,
      },
    });
    return { ok: true, opportunityId: result.submissionId };
  } catch (error) {
    return { ok: false, message: messageFrom(error) };
  }
}
