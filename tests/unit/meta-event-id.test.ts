import { describe, expect, it } from "vitest";
import { buildLeadTrackingPayloads } from "@/services/opportunities/lead-capture";
import type { Opportunity } from "@/types/domain";

function opportunityFixture(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    story_title: "A family milestone",
    intent_type: "story_opportunity",
    relationship_type: "one_off",
    stage: "new",
    priority: "medium",
    source: "story_form",
    campaign_id: null,
    contact_id: "66666666-6666-4666-8666-666666666666",
    organisation_id: null,
    assigned_user_id: null,
    occasion_type: "Birthday",
    occasion_other: null,
    target_date: null,
    target_date_precision: "flexible",
    quantity_range: "1-25",
    budget_range: "Under 1L",
    currency: "INR",
    estimated_value: null,
    confirmed_value: null,
    expected_start_date: null,
    primary_city: "Mumbai",
    multiple_locations: false,
    location_notes: null,
    lost_reason: null,
    lost_notes: null,
    competitor: null,
    revisit_date: null,
    form_key: "tell_your_story",
    idempotency_key: "77777777-7777-4777-8777-777777777777",
    attribution_id: null,
    ai_summary_status: "pending",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

describe("Meta browser/server event ID sharing", () => {
  it("uses the same eventId for internal analytics and Meta CAPI payloads", () => {
    const eventId = "88888888-8888-4888-8888-888888888888";
    const payloads = buildLeadTrackingPayloads({
      opportunity: opportunityFixture(),
      eventName: "story_form_submitted",
      eventId,
      correlationId: "99999999-9999-4999-8999-999999999999",
      toEmail: "lead@example.test",
      consentAdvertising: true,
      consentAnalytics: true,
      attribution: {
        anonymousVisitorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        deviceCategory: "desktop",
      },
    });

    expect(payloads.analytics.eventId).toBe(eventId);
    expect(payloads.meta.eventId).toBe(eventId);
    expect(payloads.meta.eventName).toBe("Lead");
  });
});
