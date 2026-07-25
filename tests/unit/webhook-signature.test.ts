import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { signWebhookPayload } from "@/services/webhooks/dispatch";

describe("webhook signature", () => {
  it("signs timestamp-prefixed payloads with HMAC SHA-256", () => {
    const secret = "webhook_signing_secret";
    const body = JSON.stringify({ event: "opportunity.created", data: { id: "opp_1" } });
    const timestamp = "1784987212";
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(signWebhookPayload(secret, body, timestamp)).toBe(expected);
  });
});
