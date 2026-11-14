import { z } from "zod";
import { storyFormSchema } from "@/lib/validation/story-form";

// Exact validated snapshot of the existing seven-step form. Operational metadata
// and attribution are deliberately excluded from the customer-visible request.
export const storyRequestSchema = storyFormSchema
  .omit({
    honeypot: true,
    idempotency_key: true,
    attribution: true,
    consent: true,
  })
  .extend({ source: z.literal("tell_your_story"), version: z.literal(1) });
export type StoryRequest = z.infer<typeof storyRequestSchema>;
export function readStoryRequest(fields: unknown) {
  return storyRequestSchema.safeParse(
    fields && typeof fields === "object"
      ? { ...fields, source: "tell_your_story", version: 1 }
      : fields,
  );
}
/** Only an exact day is projected into the DATE column. Flexible/month/quarter
 * preferences remain intact in the snapshot and are never made into a promise. */
export function exactStoryDate(story: StoryRequest) {
  if (
    story.target_date_precision !== "exact" ||
    !story.target_date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(story.target_date)
  )
    return null;
  const d = new Date(story.target_date + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === story.target_date
    ? story.target_date
    : null;
}
