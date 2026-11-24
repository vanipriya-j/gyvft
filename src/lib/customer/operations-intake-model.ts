import { z } from "zod";

export const MAX_REQUIREMENT_FILES = 6;
export const MAX_REQUIREMENT_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_REQUIREMENT_TOTAL_BYTES = 2500 * 1024;
const email = z.string().trim().toLowerCase().email().max(254);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T00:00:00Z");
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Choose a valid date.");
export const intakeCustomerSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("new"),
      name: z.string().trim().min(2).max(120),
      email,
    })
    .strict(),
  z
    .object({ kind: z.literal("existing"), id: z.string().uuid(), email })
    .strict(),
]);
export const requirementSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    story: z.string().trim().max(20000).default(""),
    customer_type: z.enum(["b2c", "b2b"]).default("b2c"),
    organisation_name: z.string().trim().max(160).default(""),
    recipients: z.number().int().min(1).max(10000).optional(),
    budget: z.string().trim().max(120).default(""),
    budget_basis: z.enum(["per_recipient", "total"]).default("per_recipient"),
    city: z.string().trim().max(120).default(""),
    phone: z.string().trim().max(40).default(""),
    occasion: z.string().trim().max(120).default(""),
    occasion_date: day.nullable().default(null),
    delivery_date: day.nullable().default(null),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.customer_type === "b2b" && !value.organisation_name)
      ctx.addIssue({
        code: "custom",
        path: ["organisation_name"],
        message: "Add the organisation name.",
      });
  });
export const requirementFileSchema = z
  .object({
    filename: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .refine(
        (value) => !/[\x00-\x1f\x7f/\\]/.test(value),
        "Use a plain filename without folders or control characters.",
      ),
    mime: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]),
    data: z
      .string()
      .min(16)
      .max(Math.ceil(MAX_REQUIREMENT_FILE_BYTES / 3) * 4),
  })
  .strict();
export const operationsIntakeSchema = z
  .object({
    request_id: z.string().uuid(),
    customer: intakeCustomerSchema,
    requirement: requirementSchema.optional(),
    files: z
      .array(requirementFileSchema)
      .max(MAX_REQUIREMENT_FILES)
      .default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.files.length && !value.requirement)
      ctx.addIssue({
        code: "custom",
        path: ["requirement"],
        message: "Add a request title for these files.",
      });
    if (value.requirement && !value.requirement.story && !value.files.length)
      ctx.addIssue({
        code: "custom",
        path: ["requirement", "story"],
        message: "Paste the requirement or attach at least one file.",
      });
  });
export type IntakeCustomer = z.infer<typeof intakeCustomerSchema>;
export type OperationsIntake = z.infer<typeof operationsIntakeSchema>;
export type RequirementAttachment = {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
};
export type IntakeCustomerSummary = {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  setup_pending: boolean;
  setup_email_state: string | null;
};
export type IntakeResult = {
  account_id: string;
  email: string;
  name: string;
  created_account: boolean;
  project_id: string | null;
  setup_pending: boolean;
  duplicate: boolean;
};
