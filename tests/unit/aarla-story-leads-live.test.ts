/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";

const sendMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": "203.0.113.50",
      referer: "https://gyvft.vercel.app/book-a-discovery",
    }),
}));

vi.mock("@/services/email/public-resend", () => ({
  getPublicLeadsInbox: () => "aarla@aarla.in",
  logAckFailure: vi.fn(),
  sendPublicResendEmail: (...args: unknown[]) => sendMock(...args),
}));

const LIVE = Boolean(process.env.STORY_LEADS_API_KEY);

describe.runIf(LIVE)("live Aarla OS lead forward via submitPublicLead", () => {
  beforeEach(() => {
    resetMemoryGuardsForTests();
    sendMock.mockReset();
    sendMock.mockResolvedValue({ id: "msg_live" });
  });

  afterEach(() => {
    resetMemoryGuardsForTests();
  });

  it("emails then creates a real Aarla OS story lead", async () => {
    const { submitPublicLead } = await import("@/services/leads/submit-public-lead");
    const { tryForwardLeadToAarlaStory } = await import("@/services/leads/aarla-story-leads");

    const idempotencyKey = crypto.randomUUID();
    const result = await submitPublicLead({
      formKey: "book_a_discovery",
      idempotencyKey,
      honeypot: "",
      fields: {
        full_name: "Live E2E GYVFT",
        email: "live-e2e@example.com",
        phone: "+919700000001",
        preferred_contact_method: "email",
        discussion_topic: "Live E2E: GYVFT form -> Aarla OS story lead",
        occasion_or_requirement: "Integration test",
        timeline: "Now",
        communication_consent: true,
      },
    });

    expect(result.submissionId).toBeTruthy();
    expect(sendMock).toHaveBeenCalled();
    expect(sendMock.mock.calls[0][0].to).toBe("aarla@aarla.in");

    // Idempotent replay through the forwarder should return the same lead.
    const replay = await tryForwardLeadToAarlaStory({
      formKey: "book_a_discovery",
      idempotencyKey,
      submittedAt: new Date().toISOString(),
      fields: {
        full_name: "Live E2E GYVFT",
        email: "live-e2e@example.com",
        discussion_topic: "Live E2E: GYVFT form -> Aarla OS story lead",
        communication_consent: true,
      },
      referrer: "https://gyvft.vercel.app/book-a-discovery",
    });

    expect(replay.skipped).toBe(false);
    expect(replay.leadId).toBeTruthy();
    console.log("AARLA_LEAD_ID", replay.leadId);
  }, 30_000);
});
