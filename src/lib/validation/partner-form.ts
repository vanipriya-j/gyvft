import { z } from "zod";
import { MERCH_REQUIREMENT_TYPES } from "@/config/constants";

export const partnerFormSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  organisation_name: z.string().trim().min(2).max(200),
  designation: z.string().trim().max(120).optional().nullable(),
  work_email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  preferred_contact_method: z.enum(["email", "phone", "whatsapp"]),
  organisation_size: z.enum(["1-50", "51-200", "201-1000", "1000+", "Not sure"]),
  primary_locations: z.string().trim().min(2).max(500),
  requirement_types: z.array(z.enum(MERCH_REQUIREMENT_TYPES as unknown as [string, ...string[]])).min(1),
  annual_occasion_range: z.string().min(1),
  quantity_range: z.string().min(1),
  budget_range: z.string().min(1),
  upcoming_requirement: z.string().trim().min(10).max(5000),
  additional_context: z.string().trim().max(5000).optional().nullable(),
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

export type PartnerFormInput = z.infer<typeof partnerFormSchema>;
