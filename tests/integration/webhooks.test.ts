import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "@/lib/database/client";
import { encryptSecret } from "@/lib/encryption/secrets";
import {
  attemptWebhookDelivery,
  dispatchWebhooks,
  signWebhookPayload,
} from "@/services/webhooks/dispatch";
import { migrateTestDatabase, resetDatabase } from "./db";

type CapturedWebhookRequest = {
  url: string;
  headers: Headers;
  body: string;
};

function requireCapturedRequest(input: CapturedWebhookRequest | null): CapturedWebhookRequest {
  expect(input).not.toBeNull();
  if (!input) throw new Error("Expected webhook request to be captured");
  return input;
}

async function createWebhookEndpoint(secret: string, subscribedEvents = ["opportunity.created"]) {
  const sql = getSql();
  const endpoint = await sql<{ id: string }[]>`
    INSERT INTO webhook_endpoints (name, url, subscribed_events, enabled, timeout_ms, max_attempts)
    VALUES ('Test endpoint', 'https://webhook.example.test/receive', ${subscribedEvents}, TRUE, 5000, 3)
    RETURNING id
  `;
  const encrypted = encryptSecret(secret);
  await sql`
    INSERT INTO webhook_endpoint_secrets (webhook_endpoint_id, ciphertext, iv, auth_tag, key_version)
    VALUES (
      ${endpoint[0]!.id}::uuid,
      ${encrypted.ciphertext},
      ${encrypted.iv},
      ${encrypted.authTag},
      ${encrypted.keyVersion}
    )
  `;
  return endpoint[0]!.id;
}

beforeAll(() => {
  migrateTestDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

describe("webhook delivery integrations", () => {
  it("signs webhook deliveries with timestamp and payload headers", async () => {
    const secret = "whsec_test_delivery";
    await createWebhookEndpoint(secret);
    let captured: CapturedWebhookRequest | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        captured = {
          url: url.toString(),
          headers: new Headers(init?.headers),
          body: String(init?.body ?? ""),
        };
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    await dispatchWebhooks("opportunity.created", { opportunityId: crypto.randomUUID() });

    const request = requireCapturedRequest(captured);
    expect(request.url).toBe("https://webhook.example.test/receive");
    const timestamp = request.headers.get("X-GYVFT-Timestamp") ?? "";
    const signature = request.headers.get("X-GYVFT-Signature") ?? "";
    expect(request.headers.get("X-GYVFT-Event")).toBe("opportunity.created");
    expect(signature).toBe(signWebhookPayload(secret, request.body, timestamp));
    const sql = getSql();
    const delivery = await sql<{ status: string; response_status: number | null }[]>`
      SELECT status, response_status FROM webhook_deliveries
    `;
    expect(delivery[0]).toMatchObject({ status: "delivered", response_status: 200 });
  });

  it("marks failed webhooks pending and schedules a retry", async () => {
    await createWebhookEndpoint("whsec_retry");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("fail", { status: 503 })),
    );

    await dispatchWebhooks("opportunity.created", { opportunityId: crypto.randomUUID() });

    const sql = getSql();
    const delivery = await sql<{
      id: string;
      status: string;
      attempt_number: number;
      next_retry_at: string | null;
      failure_reason: string | null;
    }[]>`
      SELECT id, status, attempt_number, next_retry_at, failure_reason
      FROM webhook_deliveries
    `;
    expect(delivery[0]).toMatchObject({
      status: "pending",
      attempt_number: 2,
      failure_reason: "HTTP 503",
    });
    expect(delivery[0]?.next_retry_at).not.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("still failing", { status: 500 })),
    );
    await attemptWebhookDelivery(delivery[0]!.id);

    const retried = await sql<{
      status: string;
      attempt_number: number;
      next_retry_at: string | null;
    }[]>`
      SELECT status, attempt_number, next_retry_at
      FROM webhook_deliveries
      WHERE id = ${delivery[0]!.id}::uuid
    `;
    expect(retried[0]?.status).toBe("pending");
    expect(retried[0]?.attempt_number).toBe(3);
    expect(retried[0]?.next_retry_at).not.toBeNull();
  });
});
