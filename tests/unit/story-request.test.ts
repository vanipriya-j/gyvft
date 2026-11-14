import { beforeEach, describe, expect, it, vi } from "vitest";
import { giftBriefSchema, giftBriefSummary } from "@/lib/validation/gift-brief";
import { storyFormSchema } from "@/lib/validation/story-form";
const { submit } = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/services/leads/submit-public-lead", () => ({
  submitPublicLead: submit,
}));
import { submitStoryAction } from "@/actions/public-forms";
import { gift } from "../fixtures/gift-brief";
const story = () => ({
  gift_brief: structuredClone(gift),
  story_description:
    "A gift to celebrate my lifelong friend's milestone birthday and everything we have shared.",
  occasion_type: "Birthday",
  preferred_formats: ["Book"],
  primary_city: "Chennai",
  full_name: "Test Customer",
  email: "test@example.test",
  phone: "+919999999999",
  preferred_contact_method: "email",
  communication_consent: true,
  idempotency_key: "11111111-1111-4111-8111-111111111111",
});
describe("structured gifting requests", () => {
  beforeEach(() => {
    submit.mockReset();
    submit.mockResolvedValue({ submissionId: "saved" });
  });
  it("preserves profiles and derives handoff date, count and explicit per-recipient budget", async () => {
    const input = storyFormSchema.parse(story());
    input.target_date = "1900-01-01";
    input.budget_range = "stale draft value";
    expect(await submitStoryAction(input)).toEqual({
      ok: true,
      opportunityId: "saved",
    });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({
          gift_brief: gift,
          target_date: "2099-12-01",
          target_date_precision: "exact",
          quantity_range: "1",
          budget_range: "INR 2500.5 per recipient",
        }),
      }),
    );
  });
  it("keeps a total budget distinct from per-recipient pricing for a group", async () => {
    const input = storyFormSchema.parse({
      ...story(),
      gift_brief: {
        ...gift,
        recipient_type: "group",
        group_size: 25,
        budget_basis: "total",
        budget_amount: 10000,
      },
    });
    await submitStoryAction(input);
    expect(submit.mock.calls[0][0].fields).toMatchObject({
      quantity_range: "25",
      budget_range: "INR 10000 total",
    });
  });
  it("accepts separately described individuals and keeps each person's preferences", () => {
    const brief = {
      ...gift,
      recipient_type: "individuals",
      recipients: [
        gift.recipients[0],
        {
          name: "Alex",
          description: "A colleague",
          likes: "Coffee",
          dislikes: "Tea",
        },
      ],
    };
    expect(giftBriefSchema.parse(brief).recipients[1].dislikes).toBe("Tea");
    expect(giftBriefSummary(giftBriefSchema.parse(brief))).toContain(
      "2 individuals",
    );
  });
  it("rejects mismatched recipient modes instead of silently dropping profiles", () => {
    expect(
      giftBriefSchema.safeParse({
        ...gift,
        recipients: [gift.recipients[0], gift.recipients[0]],
      }).success,
    ).toBe(false);
    expect(
      giftBriefSchema.safeParse({ ...gift, recipient_type: "individuals" })
        .success,
    ).toBe(false);
    expect(
      giftBriefSchema.safeParse({
        ...gift,
        recipient_type: "group",
        group_size: 1,
      }).success,
    ).toBe(false);
  });
  it.each([0, -1, 1.001, Number.NaN])(
    "rejects an invalid budget: %s",
    (amount) => {
      expect(
        giftBriefSchema.safeParse({ ...gift, budget_amount: amount }).success,
      ).toBe(false);
    },
  );
  it("rejects missing details, impossible dates and past delivery dates on new submissions", () => {
    expect(
      storyFormSchema.safeParse({ ...story(), gift_brief: undefined }).success,
    ).toBe(false);
    expect(
      giftBriefSchema.safeParse({ ...gift, delivery_date: "2099-02-31" })
        .success,
    ).toBe(false);
    expect(
      storyFormSchema.safeParse({
        ...story(),
        gift_brief: { ...gift, delivery_date: "2000-01-01" },
      }).success,
    ).toBe(false);
  });
  it("still renders saved briefs after their delivery date has passed", () => {
    expect(
      giftBriefSchema.safeParse({ ...gift, delivery_date: "2000-01-01" })
        .success,
    ).toBe(true);
  });
  it("allows unknown likes/dislikes while requiring a recipient description", () => {
    expect(
      giftBriefSchema.safeParse({
        ...gift,
        recipients: [{ ...gift.recipients[0], likes: "", dislikes: "" }],
      }).success,
    ).toBe(true);
    expect(
      giftBriefSchema.safeParse({
        ...gift,
        recipients: [{ ...gift.recipients[0], description: "" }],
      }).success,
    ).toBe(false);
  });
});
