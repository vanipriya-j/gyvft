import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

vi.mock("@/config/env", () => ({
  getEnv: () => ({
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "aarla@aarla.in",
    RESEND_FROM_NAME: "GYVFT by Aarla",
    GYVFT_LEADS_EMAIL: "aarla@aarla.in",
  }),
}));

describe("public resend unverified-domain fallback", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("retries with onboarding@resend.dev when the configured domain is unverified", async () => {
    sendMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          name: "validation_error",
          message:
            "The aarla.in domain is not verified. Please, add and verify your domain on https://resend.com/domains",
        },
      })
      .mockResolvedValueOnce({
        data: { id: "msg_fallback" },
        error: null,
      });

    const { sendPublicResendEmail, RESEND_TESTING_FROM_EMAIL } = await import(
      "@/services/email/public-resend"
    );

    const result = await sendPublicResendEmail({
      to: "aarla@aarla.in",
      subject: "New GYVFT Story Lead — Ada",
      text: "Form name: Tell Your Story",
      replyTo: "ada@example.test",
    });

    expect(result.id).toBe("msg_fallback");
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0][0].from).toContain("aarla@aarla.in");
    expect(sendMock.mock.calls[1][0].from).toBe(`GYVFT by Aarla <${RESEND_TESTING_FROM_EMAIL}>`);
  });
});
