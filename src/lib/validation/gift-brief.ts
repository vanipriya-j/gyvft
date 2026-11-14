import { z } from "zod";

const recipient = z.object({
  name: z.string().trim().min(1, "Add a name or group label.").max(160),
  description: z
    .string()
    .trim()
    .min(2, "Tell us a little about them.")
    .max(2000),
  likes: z.string().trim().max(1000),
  dislikes: z.string().trim().max(1000),
});
export function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const giftBriefSchema = z
  .object({
    recipient_type: z.enum(["person", "group", "individuals"]),
    recipients: z.array(recipient).min(1).max(50),
    group_size: z.number().int().min(1).max(100000),
    occasion_description: z
      .string()
      .trim()
      .min(2, "Describe the occasion.")
      .max(3000),
    gift_message: z
      .string()
      .trim()
      .min(2, "What should the gift communicate?")
      .max(3000),
    budget_basis: z.enum(["per_recipient", "total"]),
    budget_amount: z
      .number({ invalid_type_error: "Enter a budget amount." })
      .positive("Enter a budget greater than zero.")
      .max(100000000)
      .multipleOf(0.01, "Use at most two decimal places."),
    currency: z.literal("INR"),
    delivery_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a delivery date.")
      .refine((value) => {
        const d = new Date(value + "T00:00:00Z");
        return (
          !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
        );
      }, "Choose a valid delivery date."),
  })
  .superRefine((brief, context) => {
    if (brief.recipient_type !== "individuals" && brief.recipients.length !== 1)
      context.addIssue({
        code: "custom",
        path: ["recipients"],
        message: "Use one profile for a person or a group.",
      });
    if (brief.recipient_type === "individuals" && brief.recipients.length < 2)
      context.addIssue({
        code: "custom",
        path: ["recipients"],
        message: "Add at least two individuals.",
      });
    if (brief.recipient_type === "group" && brief.group_size < 2)
      context.addIssue({
        code: "custom",
        path: ["group_size"],
        message: "Enter at least two recipients for a group.",
      });
  });
export type GiftBrief = z.infer<typeof giftBriefSchema>;
export const emptyRecipient = () => ({
  name: "",
  description: "",
  likes: "",
  dislikes: "",
});
export function emptyGiftBrief(): GiftBrief {
  return {
    recipient_type: "person",
    recipients: [emptyRecipient()],
    group_size: 1,
    occasion_description: "",
    gift_message: "",
    budget_basis: "per_recipient",
    budget_amount: 0,
    currency: "INR",
    delivery_date: "",
  };
}
export const recipientCount = (brief: GiftBrief) =>
  brief.recipient_type === "group" ? brief.group_size : brief.recipients.length;
export function giftBriefSummary(brief: GiftBrief) {
  const budget = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(brief.budget_amount);
  return [
    `Recipients: ${brief.recipient_type === "person" ? "One person" : brief.recipient_type === "group" ? `Group of ${brief.group_size}` : `${brief.recipients.length} individuals`}`,
    ...brief.recipients.map(
      (person, index) =>
        `${index + 1}. ${person.name}\nAbout: ${person.description}\nLikes: ${person.likes || "Not shared"}\nDislikes: ${person.dislikes || "Not shared"}`,
    ),
    `Occasion details: ${brief.occasion_description}`,
    `What the gift should communicate: ${brief.gift_message}`,
    `Budget: ${budget} ${brief.budget_basis === "total" ? "in total" : "per recipient"}`,
    `Requested delivery date: ${brief.delivery_date}`,
  ].join("\n\n");
}
