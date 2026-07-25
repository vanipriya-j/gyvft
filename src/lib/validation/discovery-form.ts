import { z } from "zod";

export const discoveryFormSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  organisation_name: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  discussion_topic: z.string().trim().min(10).max(5000),
  occasion_or_requirement: z.string().trim().min(2).max(500),
  timeline: z.string().trim().min(2).max(200),
  preferred_contact_method: z.enum(["email", "phone", "whatsapp"]),
  communication_consent: z.literal(true),
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

export type DiscoveryFormInput = z.infer<typeof discoveryFormSchema>;
