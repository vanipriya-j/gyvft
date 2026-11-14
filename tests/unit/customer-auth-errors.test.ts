import { describe, expect, it } from "vitest";
import { customerAuthMessage } from "@/lib/auth/customer-errors";
describe("customer authentication errors", () => {
  it("explains missing configuration without blaming the customer’s credentials", () => {
    expect(
      customerAuthMessage({ code: "AUTH_CONFIGURATION_MISSING" }),
    ).toContain("temporarily unavailable");
  });
  it("distinguishes disabled signup and rate limits", () => {
    expect(customerAuthMessage({ code: "signup_disabled" })).toContain(
      "not enabled",
    );
    expect(
      customerAuthMessage({ code: "over_email_send_rate_limit" }),
    ).toContain("wait");
  });
  it("provides recovery guidance for passwords and verification", () => {
    expect(customerAuthMessage({ code: "weak_password" })).toContain(
      "12 characters",
    );
    expect(customerAuthMessage({ code: "otp_expired" })).toContain("expired");
    expect(customerAuthMessage({ code: "invalid_credentials" })).toContain(
      "email and password",
    );
  });
  it("never returns raw provider messages or secrets", () => {
    for (const error of [
      null,
      new Error("postgres://private:password@host"),
      { code: "unknown", message: "private-key-value" },
    ]) {
      const message = customerAuthMessage(error);
      expect(message).not.toContain("private");
      expect(message).not.toContain("postgres://");
    }
  });
});
