import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

vi.mock("@/config/env", () => ({
  getEnv: () => ({
    AARLA_STORY_LEADS_API_KEY: "test-aarla-story-leads-key-32chars",
    AARLA_STORY_LEADS_URL: "https://aarla-os.example/api/integrations/story/leads",
  }),
}));

describe("aarla story leads forwarder", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.AARLA_STORY_LEADS_API_KEY = "test-aarla-story-leads-key-32chars";
    process.env.AARLA_STORY_LEADS_URL = "https://aarla-os.example/api/integrations/story/leads";
    vi.resetModules();
  });

  it("builds the documented payload shape", async () => {
    const { buildAarlaStoryLeadPayload } = await import("@/services/leads/aarla-story-leads");
    const payload = buildAarlaStoryLeadPayload({
      formKey: "tell_your_story",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      submittedAt: "2026-09-18T10:00:00.000Z",
      fields: {
        full_name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+919000000000",
        preferred_contact_method: "whatsapp",
        story_description: "Teacher appreciation",
        occasion_type: "Birthday",
        audiences: ["Family"],
        preferred_formats: ["Book"],
        communication_consent: true,
        marketing_consent: false,
      },
      attribution: {
        lastTouchSource: "instagram",
        lastTouchMedium: "social",
        lastTouchLandingPage: "https://gyvft.vercel.app/tell-your-story",
      },
      referrer: "https://instagram.com/",
    });

    expect(payload.source).toBe("gyvft");
    expect(payload.module).toBe("your_story_our_telling");
    expect(payload.form_key).toBe("tell_your_story");
    expect(payload.contact.email).toBe("ada@example.com");
    expect(payload.story.audiences).toEqual(["Family"]);
    expect(payload.attribution.utm_source).toBe("instagram");
    expect(payload.attachment).toBeUndefined();
  });

  it("posts with Bearer and HMAC headers", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          ok: true,
          lead_id: "lead-1",
          module: "your_story_our_telling",
          created: true,
        }),
    });

    const { forwardLeadToAarlaStory, buildAarlaStoryLeadPayload } = await import(
      "@/services/leads/aarla-story-leads"
    );

    const payload = buildAarlaStoryLeadPayload({
      formKey: "book_a_discovery",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      submittedAt: "2026-09-18T10:00:00.000Z",
      fields: {
        full_name: "Grace Hopper",
        email: "grace@example.com",
        discussion_topic: "Discovery call",
        communication_consent: true,
      },
    });

    const result = await forwardLeadToAarlaStory(payload);
    expect(result?.lead_id).toBe("lead-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/integrations/story/leads");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer /);
    expect(headers["X-Aarla-Timestamp"]).toMatch(/^\d+$/);
    expect(headers["X-Aarla-Signature"]).toMatch(/^sha256=[a-f0-9]+$/);
  });

  it("fails open when the remote API errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ ok: false, code: "server_error", error: "boom" }),
    });

    const { tryForwardLeadToAarlaStory } = await import("@/services/leads/aarla-story-leads");
    const result = await tryForwardLeadToAarlaStory({
      formKey: "book_a_discovery",
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      submittedAt: "2026-09-18T10:00:00.000Z",
      fields: {
        full_name: "Test",
        email: "test@example.com",
        communication_consent: true,
      },
    });

    expect(result).toEqual({ leadId: null, skipped: false });
  });
});
