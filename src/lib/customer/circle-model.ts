import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import { optionalDay } from "./journey-model";
export class CircleError extends AppError {}
export const circleCategories = {
  family: "Family",
  friends: "Friends",
  corporate: "Company",
  school: "School",
  college: "College",
  alumni: "Alumni",
  community: "Community",
  other: "Other",
} as const;
export type CircleCategory = keyof typeof circleCategories;
export const institutionalCategories = new Set<CircleCategory>([
  "corporate",
  "school",
  "college",
]);
const domain = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/,
    "Use an email domain such as company.com.",
  );
export const organisationSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    website: z.string().trim().url().max(500),
    domain,
  })
  .strict()
  .superRefine((o, c) => {
    let u: URL;
    try {
      u = new URL(o.website);
    } catch {
      c.addIssue({
        code: "custom",
        message: "Use a valid HTTPS organisation website.",
      });
      return;
    }
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      !(u.hostname === o.domain || u.hostname.endsWith("." + o.domain))
    )
      c.addIssue({
        code: "custom",
        message: "Use an HTTPS website on the organisation’s stated domain.",
      });
  });
export const circleInput = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    category: z.enum([
      "family",
      "friends",
      "corporate",
      "school",
      "college",
      "alumni",
      "community",
      "other",
    ]),
    description: z.string().trim().max(2000).default(""),
    display_name: z.string().trim().min(2).max(120),
    organisation: organisationSchema.nullable().default(null),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (institutionalCategories.has(c.category) !== !!c.organisation)
      ctx.addIssue({
        code: "custom",
        message:
          "Companies, schools and colleges need organisation details. Personal circles do not.",
      });
  });
export const circleRecipientInput = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    email: z
      .union([z.string().trim().toLowerCase().email().max(254), z.literal("")])
      .default(""),
    about: z.string().trim().max(2000).default(""),
    likes: z.string().trim().max(1000).default(""),
    avoid: z.string().trim().max(1000).default(""),
  })
  .strict();
export const circleInviteInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    display_name: z.string().trim().min(2).max(120),
    role: z.enum(["admin", "member"]).default("member"),
    recipient_id: z.string().uuid().nullable().default(null),
    replace: z.boolean().default(false),
  })
  .strict();
export const circleOccasionInput = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    occasion_date: optionalDay.refine(Boolean, "Choose an occasion date."),
    repeats_annually: z.boolean().default(false),
    description: z.string().trim().max(2000).default(""),
    publish: z.literal(true),
  })
  .strict();
export type Circle = {
  id: string;
  name: string;
  category: CircleCategory;
  description: string;
  owner_account_id: string;
  is_demo: boolean;
  archived_at: string | null;
  role: "admin" | "member";
  display_name: string;
  share_profile: boolean;
  member_count: number;
  recipient_count: number;
};
export type CircleMember = {
  account_id: string;
  display_name: string;
  role: "admin" | "member";
  is_owner: boolean;
  email: string | null;
  share_profile: boolean;
  about: string | null;
  interests: string | null;
  avoid: string | null;
};
export type CircleRecipient = z.infer<typeof circleRecipientInput> & {
  linked_account_id: string | null;
};
export type CircleOccasion = Omit<
  z.infer<typeof circleOccasionInput>,
  "publish"
>;
export type CircleOrganisation = z.infer<typeof organisationSchema> & {
  id: string;
  verification_state: "unverified" | "verified" | "needs_review";
  verification_note: string;
  verified_at: string | null;
};
export type PendingCircleInvitation = {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "member";
  expires_at: string;
  expired: boolean;
};
export type CircleDetail = {
  circle: Circle;
  organisation: CircleOrganisation | null;
  members: CircleMember[];
  memberPage: { offset: number; limit: number; total: number };
  recipients: CircleRecipient[];
  invitations: PendingCircleInvitation[];
  occasions: CircleOccasion[];
  gifts: { id: string; title: string; stage: number }[];
};
