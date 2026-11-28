import { z } from "zod";

export const pilotCustomerSchema = z
  .object({
    shopifyCustomerId: z.string().regex(/^gid:\/\/shopify\/Customer\/\d+$/),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    name: z.string().trim().min(1).max(160),
    sourceOrderCount: z.number().int().min(0).optional(),
  })
  .strict();
export const pilotCohortSchema = z
  .array(pilotCustomerSchema)
  .min(1)
  .max(20)
  .superRefine((rows, ctx) => {
    if (
      new Set(rows.map((r) => r.shopifyCustomerId)).size !== rows.length ||
      new Set(rows.map((r) => r.email)).size !== rows.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use distinct customer IDs and emails.",
      });
  });
export type PilotCustomer = z.infer<typeof pilotCustomerSchema>;
export type PilotPreview = {
  id: string;
  fingerprint: string;
  customer: PilotCustomer;
  account: "create" | "preserve";
  orders: number;
  points: number;
  pendingPoints: number;
  review: { id: string; reason: string }[];
  excluded: number;
  enabled: boolean;
};
