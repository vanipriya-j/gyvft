import { z } from "zod";
export const inrAmount = z
  .number()
  .finite()
  .positive()
  .max(99999999.99)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
    "Use at most two decimal places.",
  );
export const rupeesToPaise = (value: number) =>
  Math.round(inrAmount.parse(value) * 100);
export const offlineApprovalSchema = z
  .object({
    request_id: z.string().uuid(),
    project_id: z.string().uuid(),
    approval_id: z.string().uuid(),
    expected_version: z.number().int().positive(),
    channel: z.enum(["whatsapp", "email", "in_person", "phone", "other"]),
    customer_approved_at: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .default(null),
    note: z.string().trim().min(1).max(2000),
    recorded_by: z.string().trim().min(2).max(120),
    proof: z
      .array(
        z
          .object({
            mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
            data: z.string().max(2800000),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();
export const paymentRequestSchema = z
  .object({
    request_id: z.string().uuid(),
    project_id: z.string().uuid(),
    approval_id: z.string().uuid(),
    expected_version: z.number().int().positive(),
    phase: z.enum(["advance", "balance"]),
    expected_due_paise: z.number().int().positive(),
    expected_paid_paise: z.number().int().nonnegative(),
  })
  .strict();
export function milestonePayment(
  total: number,
  paid: number,
  phase: "advance" | "balance",
) {
  const advance = Math.ceil(total / 2);
  return phase === "advance"
    ? Math.max(0, advance - paid)
    : Math.max(0, total - paid);
}
