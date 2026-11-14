import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "@/lib/database/client";
import type { PartnerFormInput } from "@/lib/validation/partner-form";
import type { StoryFormInput } from "@/lib/validation/story-form";
import { createIntegrationLog } from "@/services/integrations/logs";
import {
  submitPartnerOpportunity,
  submitStoryOpportunity,
} from "@/services/opportunities/lead-capture";
import { changeOpportunityStageAction } from "@/actions/studio-opportunities";
import { migrateTestDatabase, resetDatabase, createProfile } from "./db";

vi.mock("@/services/ai/summary", () => ({
  generateOpportunitySummary: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/services/meta/conversions", () => ({
  sendConversionEvent: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock("@/services/email/send", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({ accepted: true, deliveryId: "email-test" }),
}));

vi.mock("@/services/webhooks/dispatch", () => ({
  dispatchWebhooks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/session", () => ({
  requireStudioUser: vi.fn().mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    email: "owner@example.test",
    full_name: "Owner User",
    role: "owner",
    is_active: true,
    last_login_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    deleted_at: null,
  }),
}));

const aiSummary = await import("@/services/ai/summary");
const metaConversions = await import("@/services/meta/conversions");

function storyInput(overrides: Partial<StoryFormInput> = {}): StoryFormInput {
  return {
    story_description:
      "A detailed family story about a milestone, the people involved, and the keepsake we want to create together.",
    occasion_type: "Birthday",
    occasion_other: "",
    audiences: ["Family"],
    preferred_formats: ["Book"],
    target_date: null,
    target_date_precision: "flexible",
    quantity_range: "1-25",
    budget_range: "Under 1L",
    primary_city: "Mumbai",
    multiple_locations: false,
    location_notes: "",
    full_name: "Story Visitor",
    organisation_name: "Story Org",
    designation: "Founder",
    email: `story-${crypto.randomUUID()}@example.test`,
    phone: "+919999999999",
    preferred_contact_method: "email",
    communication_consent: true,
    marketing_consent: false,
    honeypot: "",
    idempotency_key: crypto.randomUUID(),
    consent: { analytics: true, advertising: true, version: "1.0.0" },
    ...overrides,
  };
}

function partnerInput(overrides: Partial<PartnerFormInput> = {}): PartnerFormInput {
  return {
    full_name: "Partner Visitor",
    organisation_name: "Partner Org",
    designation: "People Ops",
    work_email: `partner-${crypto.randomUUID()}@example.test`,
    phone: "+918888888888",
    preferred_contact_method: "email",
    organisation_size: "51-200",
    primary_locations: "Mumbai, Pune",
    requirement_types: ["Employee onboarding kits"],
    annual_occasion_range: "5-10",
    quantity_range: "100-500",
    budget_range: "2L-10L",
    upcoming_requirement:
      "Recurring onboarding kits and milestone merchandise for new hires.",
    additional_context: "Quarterly planning cycle.",
    communication_consent: true,
    marketing_consent: true,
    honeypot: "",
    idempotency_key: crypto.randomUUID(),
    consent: { analytics: true, advertising: true, version: "1.0.0" },
    ...overrides,
  };
}

beforeAll(() => {
  migrateTestDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  vi.mocked(aiSummary.generateOpportunitySummary).mockReset();
  vi.mocked(aiSummary.generateOpportunitySummary).mockResolvedValue(null);
  vi.mocked(metaConversions.sendConversionEvent).mockReset();
  vi.mocked(metaConversions.sendConversionEvent).mockResolvedValue({ sent: true });
});

describe("public lead capture integrations", () => {
  it("creates contact, organisation, opportunity, submission, activity, and analytics event for a story", async () => {
    const input = storyInput();

    const result = await submitStoryOpportunity(input);

    expect(result.duplicate).toBe(false);
    const sql = getSql();
    const [opportunities, contacts, organisations, submissions, activities, events] = await Promise.all([
      sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM opportunities`,
      sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM contacts`,
      sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM organisations`,
      sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM opportunity_submissions`,
      sql<{ activity_type: string }[]>`
        SELECT activity_type FROM activities
        WHERE opportunity_id = ${result.opportunityId}::uuid
        ORDER BY created_at ASC
      `,
      sql<{ event_id: string; opportunity_id: string | null }[]>`
        SELECT event_id, opportunity_id FROM analytics_events
        WHERE event_name = 'story_form_submitted'
      `,
    ]);

    expect(opportunities[0]?.count).toBe("1");
    expect(contacts[0]?.count).toBe("1");
    expect(organisations[0]?.count).toBe("1");
    expect(submissions[0]?.count).toBe("1");
    expect(activities.map((activity) => activity.activity_type)).toContain("form.submitted");
    expect(events[0]?.event_id).toBe(result.eventId);
    expect(events[0]?.opportunity_id).toBe(result.opportunityId);
  });

  it("creates a recurring merch partnership opportunity from partner submissions", async () => {
    const result = await submitPartnerOpportunity(partnerInput());
    const sql = getSql();

    const rows = await sql<{
      intent_type: string;
      relationship_type: string;
      source: string;
    }[]>`
      SELECT intent_type, relationship_type, source
      FROM opportunities
      WHERE id = ${result.opportunityId}::uuid
    `;

    expect(rows[0]).toMatchObject({
      intent_type: "merch_partnership_opportunity",
      relationship_type: "recurring",
      source: "merch_partner_form",
    });
  });

  it("treats duplicate idempotency keys as one opportunity", async () => {
    const idempotencyKey = crypto.randomUUID();
    const input = storyInput({ idempotency_key: idempotencyKey });
    const sql = getSql();

    const first = await submitStoryOpportunity(input);
    const second = await submitStoryOpportunity({
      ...input,
      email: `second-${crypto.randomUUID()}@example.test`,
    });

    const count = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM opportunities
    `;
    expect(second.duplicate).toBe(true);
    expect(second.opportunityId).toBe(first.opportunityId);
    expect(count[0]?.count).toBe("1");
  });

  it("succeeds when AI summary generation fails", async () => {
    vi.mocked(aiSummary.generateOpportunitySummary).mockRejectedValueOnce(new Error("AI down"));
    const sql = getSql();

    const result = await submitStoryOpportunity(storyInput());
    const opportunities = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM opportunities
    `;

    expect(result.duplicate).toBe(false);
    expect(result.secondaryErrors).toContainEqual({ step: "ai_summary", message: "AI down" });
    expect(opportunities[0]?.count).toBe("1");
  });

  it("succeeds when Meta Conversions API fails", async () => {
    vi.mocked(metaConversions.sendConversionEvent).mockRejectedValueOnce(new Error("Meta down"));
    const sql = getSql();

    const result = await submitStoryOpportunity(storyInput());
    const opportunities = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM opportunities
    `;

    expect(result.duplicate).toBe(false);
    expect(result.secondaryErrors).toContainEqual({ step: "meta_capi", message: "Meta down" });
    expect(opportunities[0]?.count).toBe("1");
  });

  it("creates an activity when opportunity stage changes", async () => {
    const profile = await createProfile({ id: "11111111-1111-4111-8111-111111111111" });
    const result = await submitStoryOpportunity(storyInput());
    const formData = new FormData();
    formData.set("opportunityId", result.opportunityId);
    formData.set("stage", "reviewing");
    const sql = getSql();

    await changeOpportunityStageAction(formData);

    const activities = await sql<{
      actor_user_id: string | null;
      activity_type: string;
      metadata: { from?: string; to?: string };
    }[]>`
      SELECT actor_user_id, activity_type, metadata
      FROM activities
      WHERE opportunity_id = ${result.opportunityId}::uuid
        AND activity_type = 'opportunity.stage_changed'
    `;
    expect(activities[0]?.actor_user_id).toBe(profile.id);
    expect(activities[0]?.metadata).toMatchObject({ from: "new", to: "reviewing" });
  });

  it("associates campaign attribution and preserves the original first touch", async () => {
    const sql = getSql();
    const campaign = await sql<{ id: string }[]>`
      INSERT INTO campaigns (name, status, campaign)
      VALUES ('Summer Story', 'active', 'summer-story')
      RETURNING id
    `;
    const anonymousVisitorId = crypto.randomUUID();
    const firstSessionId = crypto.randomUUID();

    const first = await submitStoryOpportunity(
      storyInput({
        attribution: {
          anonymousVisitorId,
          sessionId: firstSessionId,
          firstTouchSource: "google",
          firstTouchMedium: "cpc",
          firstTouchCampaign: "summer-story",
          firstTouchLandingPage: "/tell-your-story",
          lastTouchSource: "google",
          lastTouchMedium: "cpc",
          lastTouchCampaign: "summer-story",
          lastTouchLandingPage: "/tell-your-story",
        },
      }),
    );
    const second = await submitStoryOpportunity(
      storyInput({
        attribution: {
          anonymousVisitorId,
          sessionId: crypto.randomUUID(),
          firstTouchSource: "newsletter",
          firstTouchMedium: "email",
          firstTouchCampaign: "newsletter-touch",
          lastTouchSource: "instagram",
          lastTouchMedium: "social",
          lastTouchCampaign: "organic-social",
          lastTouchLandingPage: "/tell-your-story",
        },
      }),
    );

    const opportunities = await sql<{ id: string; campaign_id: string | null }[]>`
      SELECT id, campaign_id FROM opportunities ORDER BY created_at ASC
    `;
    const visitor = await sql<{
      first_touch_source: string | null;
      first_touch_campaign: string | null;
      last_touch_source: string | null;
    }[]>`
      SELECT first_touch_source, first_touch_campaign, last_touch_source
      FROM visitor_identities
      WHERE anonymous_visitor_id = ${anonymousVisitorId}::uuid
    `;

    expect(opportunities.find((row) => row.id === first.opportunityId)?.campaign_id).toBe(campaign[0]?.id);
    expect(opportunities.find((row) => row.id === second.opportunityId)?.campaign_id).toBeNull();
    expect(visitor[0]).toMatchObject({
      first_touch_source: "google",
      first_touch_campaign: "summer-story",
      last_touch_source: "instagram",
    });
  });

  it("records integration failures without secrets or raw provider state", async () => {
    const id = await createIntegrationLog({
      provider: "meta_capi",
      operation: "send_event",
      success: false,
      sanitisedError: "Meta Conversions API is not configured",
      metadata: { eventId: "event-1" },
    });
    const sql = getSql();

    const logs = await sql<{
      id: string;
      success: boolean;
      sanitised_error: string | null;
      metadata: { eventId?: string };
    }[]>`
      SELECT id, success, sanitised_error, metadata FROM integration_logs WHERE id = ${id}::uuid
    `;

    expect(logs[0]).toMatchObject({
      id,
      success: false,
      sanitised_error: "Meta Conversions API is not configured",
      metadata: { eventId: "event-1" },
    });
  });
});
