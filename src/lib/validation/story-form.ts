import { z } from "zod";
import { AUDIENCE_OPTIONS, FORMAT_OPTIONS, OCCASION_TYPES } from "@/config/constants";

export const storyFormSchema = z.object({
  story_description: z.string().trim().min(40, "Please share a fuller story (at least 40 characters).").max(20000),
  occasion_type: z.enum(OCCASION_TYPES as unknown as [string, ...string[]]),
  occasion_other: z.string().trim().max(200).optional().nullable(),
  audiences: z.array(z.enum(AUDIENCE_OPTIONS as unknown as [string, ...string[]])).min(1),
  preferred_formats: z.array(z.enum(FORMAT_OPTIONS as unknown as [string, ...string[]])).min(1),
  target_date: z.string().optional().nullable(),
  target_date_precision: z.enum(["exact", "month", "quarter", "flexible"]).default("flexible"),
  quantity_range: z.string().min(1),
  budget_range: z.string().min(1),
  primary_city: z.string().trim().min(1).max(120),
  multiple_locations: z.boolean().default(false),
  location_notes: z.string().trim().max(2000).optional().nullable(),
  full_name: z.string().trim().min(2).max(120),
  organisation_name: z.string().trim().max(200).optional().nullable(),
  designation: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  preferred_contact_method: z.enum(["email", "phone", "whatsapp"]),
  communication_consent: z.literal(true, {
    errorMap: () => ({ message: "Communication consent is required." }),
  }),
  marketing_consent: z.boolean().default(false),
  honeypot: z.string().max(0).optional().nullable(),
  idempotency_key: z.string().uuid(),
  attribution: z
    .object({
      anonymousVisitorId: z.string().uuid(),
      sessionId: z.string().uuid(),
      firstTouchSource: z.string().optional().nullable(),
      firstTouchMedium: z.string().optional().nullable(),
      firstTouchCampaign: z.string().optional().nullable(),
      firstTouchContent: z.string().optional().nullable(),
      firstTouchTerm: z.string().optional().nullable(),
      firstTouchLandingPage: z.string().optional().nullable(),
      firstTouchReferrer: z.string().optional().nullable(),
      lastTouchSource: z.string().optional().nullable(),
      lastTouchMedium: z.string().optional().nullable(),
      lastTouchCampaign: z.string().optional().nullable(),
      lastTouchContent: z.string().optional().nullable(),
      lastTouchTerm: z.string().optional().nullable(),
      lastTouchLandingPage: z.string().optional().nullable(),
      deviceCategory: z.string().optional().nullable(),
    })
    .optional(),
  consent: z
    .object({
      analytics: z.boolean(),
      advertising: z.boolean(),
      version: z.string(),
    })
    .optional(),
});

export type StoryFormInput = z.infer<typeof storyFormSchema>;
