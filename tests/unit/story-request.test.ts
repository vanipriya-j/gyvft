import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exactStoryDate,
  readStoryRequest,
  storyRequestSchema,
} from "@/lib/customer/story-request";
import { storyFormSchema } from "@/lib/validation/story-form";
import { storyInput } from "../fixtures/story-request";
const { submit } = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/services/leads/submit-public-lead", () => ({
  submitPublicLead: submit,
}));
import { submitStoryAction } from "@/actions/public-forms";
describe("backend for the existing seven-step story form", () => {
  beforeEach(() => {
    submit.mockReset();
    submit.mockResolvedValue({ submissionId: "saved" });
  });
  it("accepts the original fields without requiring newly invented questions", async () => {
    expect(storyFormSchema.safeParse(storyInput).success).toBe(true);
    expect(await submitStoryAction(storyInput)).toEqual({
      ok: true,
      opportunityId: "saved",
    });
    expect(submit.mock.calls[0][0].fields).toMatchObject({
      target_date_precision: "exact",
      quantity_range: "26-100",
      budget_range: "1L-5L",
      audiences: ["Family", "Community"],
      location_notes: storyInput.location_notes,
    });
    expect(submit.mock.calls[0][0].fields).not.toHaveProperty("gift_brief");
  });
  it("stores every original answer while excluding internal tracking/security metadata", () => {
    const parsed = readStoryRequest({
      ...storyInput,
      attribution: { anonymousVisitorId: "private-id" },
      consent: { analytics: true },
      arbitrary: "ignored",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const { honeypot, idempotency_key, ...expected } = storyInput;
    expect(parsed.data).toEqual({
      ...expected,
      source: "tell_your_story",
      version: 1,
    });
    for (const key of [
      "attribution",
      "consent",
      "honeypot",
      "idempotency_key",
      "arbitrary",
    ])
      expect(parsed.data).not.toHaveProperty(key);
    expect(honeypot).toBe("");
    expect(idempotency_key).toBeTruthy();
  });
  it("preserves flexible dates and budget ranges instead of inventing an exact day or amount", () => {
    const parsed = readStoryRequest({
      ...storyInput,
      target_date: "",
      target_date_precision: "flexible",
      budget_range: "Not sure",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(exactStoryDate(parsed.data)).toBeNull();
      expect(parsed.data.budget_range).toBe("Not sure");
    }
  });
  it("projects only valid exact dates and keeps month/quarter preferences in the snapshot", () => {
    const parsed = storyRequestSchema.parse({
      ...storyInput,
      source: "tell_your_story",
      version: 1,
    });
    expect(exactStoryDate(parsed)).toBe("2099-12-01");
    expect(
      exactStoryDate({ ...parsed, target_date_precision: "month" }),
    ).toBeNull();
    expect(
      exactStoryDate({ ...parsed, target_date_precision: "quarter" }),
    ).toBeNull();
    expect(exactStoryDate({ ...parsed, target_date: "2099-02-31" })).toBeNull();
  });
  it("retains original consent and audience validation", () => {
    expect(
      storyFormSchema.safeParse({ ...storyInput, communication_consent: false })
        .success,
    ).toBe(false);
    expect(
      storyFormSchema.safeParse({ ...storyInput, audiences: [] }).success,
    ).toBe(false);
  });
});
