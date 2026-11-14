/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
import { storyInput } from "../fixtures/story-request";
import { escapeHtml } from "@/lib/security/sanitize";

const sendMock = vi.fn();
const captureMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/leads/customer-enquiry", () => ({
  captureCustomerEnquiry: captureMock,
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": "203.0.113.10",
      referer: "https://example.com/campaign",
    }),
}));

vi.mock("@/services/email/public-resend", () => ({
  getPublicLeadsInbox: () => "aarla@aarla.in",
  logAckFailure: vi.fn(),
  sendPublicResendEmail: (...args: unknown[]) => sendMock(...args),
}));

vi.mock("@/config/env", () => ({
  getEnv: () => ({
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "aarla@aarla.in",
    RESEND_FROM_NAME: "GYVFT by Aarla",
    GYVFT_LEADS_EMAIL: "aarla@aarla.in",
  }),
}));

describe("public lead email submission", () => {
  beforeEach(() => {
    resetMemoryGuardsForTests();
    captureMock.mockReset();
    captureMock.mockResolvedValue(undefined);
    sendMock.mockReset();
    sendMock.mockResolvedValue({ id: "msg_1" });
  });

  afterEach(() => {
    resetMemoryGuardsForTests();
  });

  it("passes all original story answers into customer storage and readable lead email", async () => {
    const { submitPublicLead } =
      await import("@/services/leads/submit-public-lead");
    await submitPublicLead({
      formKey: "tell_your_story",
      idempotencyKey: storyInput.idempotency_key,
      fields: storyInput,
    });
    expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storyDetails: expect.objectContaining({
          occasion_other: "Family reunion",
          audiences: ["Family", "Community"],
          preferred_formats: ["Book", "Merchandise"],
          quantity_range: "26-100",
          budget_range: "1L-5L",
          multiple_locations: true,
          location_notes: storyInput.location_notes,
        }),
      }),
    );
    expect(sendMock.mock.calls[0][0].text).toContain("Family reunion");
    expect(sendMock.mock.calls[0][0].text).toContain("1L-5L");
    expect(sendMock.mock.calls[0][0].text).toContain(storyInput.location_notes);
  });

  it("escapes HTML for email rendering", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("sends internal + acknowledgement emails for a story lead", async () => {
    const { submitPublicLead, __testables } =
      await import("@/services/leads/submit-public-lead");

    const result = await submitPublicLead({
      formKey: "tell_your_story",
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      honeypot: "",
      fields: {
        full_name: "Ada Visitor",
        email: "ada@example.test",
        phone: "+919999999999",
        organisation_name: "",
        preferred_contact_method: "whatsapp",
        story_description:
          "A long enough story about a family milestone and keepsake.",
      },
      attribution: {
        firstTouchCampaign: "spring",
        firstTouchSource: "google",
      },
    });

    expect(result.submissionId).toBeTruthy();
    expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.test",
        submissionKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    );
    expect(sendMock).toHaveBeenCalledTimes(2);

    const internal = sendMock.mock.calls[0][0];
    expect(internal.to).toBe("aarla@aarla.in");
    expect(internal.subject).toBe("New GYVFT Story Lead — Ada Visitor");
    expect(internal.replyTo).toBe("ada@example.test");
    expect(internal.text).toContain("Form name: Tell Your Story");
    expect(internal.text).toContain("Preferred contact method: whatsapp");
    expect(internal.text).toContain("UTM campaign (first): spring");
    expect(internal.text).not.toContain("Organisation:");

    const ack = sendMock.mock.calls[1][0];
    expect(ack.to).toBe("ada@example.test");
    expect(ack.subject).toBe(__testables.ACK_SUBJECT);
    expect(ack.text).toBe(__testables.ACK_TEXT);
  });

  it("uses organisation in partner lead subject", async () => {
    const { submitPublicLead } =
      await import("@/services/leads/submit-public-lead");
    await submitPublicLead({
      formKey: "become_a_merch_partner",
      idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      fields: {
        full_name: "Priya",
        work_email: "priya@org.test",
        organisation_name: "Northwind",
        phone: "+919888888888",
        preferred_contact_method: "email",
      },
    });
    expect(sendMock.mock.calls[0][0].subject).toBe(
      "New GYVFT Story & Merch Partner Lead — Northwind",
    );
  });

  it("returns the same submission id for duplicate idempotency keys without re-emailing", async () => {
    const { submitPublicLead } =
      await import("@/services/leads/submit-public-lead");
    const key = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const first = await submitPublicLead({
      formKey: "book_a_discovery",
      idempotencyKey: key,
      fields: {
        full_name: "Sam",
        email: "sam@example.test",
        phone: "+919777777777",
        preferred_contact_method: "phone",
        discussion_topic: "We want to explore a founder anniversary gift.",
      },
    });
    sendMock.mockClear();
    const second = await submitPublicLead({
      formKey: "book_a_discovery",
      idempotencyKey: key,
      fields: {
        full_name: "Sam",
        email: "sam@example.test",
        phone: "+919777777777",
        preferred_contact_method: "phone",
        discussion_topic: "We want to explore a founder anniversary gift.",
      },
    });
    expect(second.submissionId).toBe(first.submissionId);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("fails the submission when the internal email cannot be sent", async () => {
    sendMock.mockRejectedValueOnce(new Error("resend down"));
    const { submitPublicLead } =
      await import("@/services/leads/submit-public-lead");
    await expect(
      submitPublicLead({
        formKey: "tell_your_story",
        idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        fields: {
          full_name: "Fail Case",
          email: "fail@example.test",
          phone: "+919666666666",
          preferred_contact_method: "email",
        },
      }),
    ).rejects.toThrow(/try again/i);
  });

  it("still succeeds when only the acknowledgement email fails", async () => {
    sendMock
      .mockResolvedValueOnce({ id: "internal" })
      .mockRejectedValueOnce(new Error("ack failed"));
    const { submitPublicLead } =
      await import("@/services/leads/submit-public-lead");
    const result = await submitPublicLead({
      formKey: "tell_your_story",
      idempotencyKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      fields: {
        full_name: "Ack Fail",
        email: "ack@example.test",
        phone: "+919555555555",
        preferred_contact_method: "email",
      },
    });
    expect(result.submissionId).toBeTruthy();
    expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ack@example.test",
        submissionKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      }),
    );
  });

  it("rejects honeypot submissions", async () => {
    const { submitPublicLead } =
      await import("@/services/leads/submit-public-lead");
    await expect(
      submitPublicLead({
        formKey: "tell_your_story",
        idempotencyKey: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        honeypot: "http://spam.test",
        fields: {
          full_name: "Bot",
          email: "bot@example.test",
          phone: "+919444444444",
          preferred_contact_method: "email",
        },
      }),
    ).rejects.toThrow(/rejected/i);
    expect(sendMock).not.toHaveBeenCalled();
  });
  it("preserves an emailed enquiry when customer storage is unavailable", async () => {
    captureMock.mockRejectedValueOnce(new Error("storage unavailable"));
    const { submitPublicLead } =
      await import("@/services/leads/submit-public-lead");
    await expect(
      submitPublicLead({
        formKey: "tell_your_story",
        idempotencyKey: "portal-outage",
        fields: { full_name: "Customer", email: "customer@example.test" },
      }),
    ).resolves.toHaveProperty("submissionId");
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});
