import { z } from "zod";
import { dateKey } from "./dashboard-model";
export class JourneyError extends Error {}
export const optionalDay = z
  .string()
  .refine((v) => !v || dateKey(v) === v, "Choose a valid date.");
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  about: z.string().trim().max(2000),
  interests: z.string().trim().max(1000),
  avoid: z.string().trim().max(1000),
  share_profile: z.boolean(),
});
export const personSchema = z.object({
  name: z.string().trim().min(2).max(120),
  relationship: z.string().trim().max(100),
  about: z.string().trim().max(2000),
  likes: z.string().trim().max(1000),
  avoid: z.string().trim().max(1000),
  email: z.union([z.string().trim().email().max(254), z.literal("")]),
});
export const occasionSchema = z.object({
  title: z.string().trim().min(2).max(160),
  occasion_date: optionalDay.refine(Boolean, "Choose an occasion date."),
  repeats_annually: z.boolean(),
  notes: z.string().trim().max(2000),
  relationship: z.string().trim().max(100),
  person_id: z.string().uuid().nullable(),
});
export const giftBriefSchema = z.object({
  title: z.string().trim().min(2).max(160),
  story: z.string().trim().min(40).max(20000),
  occasion: z.string().trim().min(2).max(120),
  audience: z.enum(["One person", "One group", "Separate individuals"]),
  recipients: z.number().int().min(1).max(10000),
  individuals: z
    .array(
      z.object({
        name: z.string().trim().max(120),
        likes: z.string().trim().max(1000),
        avoid: z.string().trim().max(1000),
      }),
    )
    .max(50)
    .default([]),
  recipient_notes: z.string().trim().max(5000),
  likes: z.string().trim().max(2000),
  avoid: z.string().trim().max(2000),
  message: z.string().trim().max(2000),
  formats: z.string().trim().max(1000),
  budget: z.string().trim().min(1).max(120),
  budget_basis: z.enum(["per_recipient", "total"]),
  delivery_date: optionalDay,
  city: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(40),
  occasion_id: z.string().uuid().nullable(),
  person_id: z.string().uuid().nullable(),
});
export const draftGiftBriefSchema = giftBriefSchema.extend({
  title: z.string().trim().max(160),
  story: z.string().trim().max(20000),
  occasion: z.string().trim().max(120),
  budget: z.string().trim().max(120),
  city: z.string().trim().max(120),
  phone: z.string().trim().max(40),
});
export type GiftBrief = z.infer<typeof giftBriefSchema>;
export type Person = z.infer<typeof personSchema> & {
  id: string;
  linked_account_id: string | null;
  invitation_accepted_at: string | null;
  shared_about: string | null;
  shared_interests: string | null;
  shared_avoid: string | null;
};
export type Occasion = z.infer<typeof occasionSchema> & {
  id: string;
  has_photo: boolean;
};
export type Profile = z.infer<typeof profileSchema>;
export type GiftPhoto = {
  id: string;
  caption: string;
  kind: string;
  public_permission: boolean;
  featured: boolean;
  created_at: string;
};
export type Testimonial = {
  rating: number;
  body: string;
  public_permission: boolean;
  featured: boolean;
};
export function giftLocked(p: {
  stage: number;
  production_started_at?: unknown;
}) {
  return !!p.production_started_at || p.stage >= 7;
}
export function paymentPlan(total: number, paid: number, pending: number) {
  const advance = Math.ceil(total / 2);
  return {
    total,
    paid,
    pending,
    advance,
    now: Math.max(0, advance - paid),
    later: Math.max(0, total - Math.max(advance, paid)),
    outstanding: Math.max(0, total - paid),
  };
}
