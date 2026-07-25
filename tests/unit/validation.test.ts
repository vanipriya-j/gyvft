import { describe, expect, it } from "vitest";
import { partnerFormSchema } from "@/lib/validation/partner-form";
import { storyFormSchema } from "@/lib/validation/story-form";

const attribution = {
  anonymousVisitorId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
};

describe("public form validation", () => {
  it("rejects a too-short story", () => {
    const result = storyFormSchema.safeParse({
      story_description: "Too short",
      occasion_type: "Birthday",
      audiences: ["Family"],
      preferred_formats: ["Book"],
      quantity_range: "1-25",
      budget_range: "Under 1L",
      primary_city: "Mumbai",
      full_name: "Test Visitor",
      email: "visitor@example.test",
      phone: "+919999999999",
      preferred_contact_method: "email",
      communication_consent: true,
      idempotency_key: "33333333-3333-4333-8333-333333333333",
      attribution,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.story_description?.[0]).toContain("at least 40");
    }
  });

  it("requires communication consent for story submissions", () => {
    const result = storyFormSchema.safeParse({
      story_description:
        "This is a sufficiently long story about a meaningful milestone and why it matters.",
      occasion_type: "Birthday",
      audiences: ["Family"],
      preferred_formats: ["Book"],
      quantity_range: "1-25",
      budget_range: "Under 1L",
      primary_city: "Mumbai",
      full_name: "Test Visitor",
      email: "visitor@example.test",
      phone: "+919999999999",
      preferred_contact_method: "email",
      communication_consent: false,
      idempotency_key: "33333333-3333-4333-8333-333333333333",
      attribution,
    });

    expect(result.success).toBe(false);
  });

  it("requires consent for merch partner submissions", () => {
    const result = partnerFormSchema.safeParse({
      full_name: "Partner Lead",
      organisation_name: "Partner Org",
      work_email: "partner@example.test",
      phone: "+918888888888",
      preferred_contact_method: "email",
      organisation_size: "51-200",
      primary_locations: "Mumbai",
      requirement_types: ["Employee onboarding kits"],
      annual_occasion_range: "5-10",
      quantity_range: "100-500",
      budget_range: "2L-10L",
      upcoming_requirement:
        "A recurring onboarding and recognition merchandise requirement.",
      communication_consent: false,
      idempotency_key: "44444444-4444-4444-8444-444444444444",
      attribution,
    });

    expect(result.success).toBe(false);
  });
});
