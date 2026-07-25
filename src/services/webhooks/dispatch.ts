import "server-only";
import { createHmac, randomUUID } from "crypto";
import type { JSONValue } from "postgres";
import { getSql } from "@/lib/database/client";
import { decryptSecret } from "@/lib/encryption/secrets";
import { createIntegrationLog } from "@/services/integrations/logs";
import type { WebhookEventName } from "@/types/domain";

export function signWebhookPayload(secret: string, body: string, timestamp: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export async function dispatchWebhooks(eventName: WebhookEventName, payload: Record<string, unknown>) {
  const sql = getSql();
  const endpoints = await sql<{
    id: string;
    url: string;
    timeout_ms: number;
    max_attempts: number;
    subscribed_events: string[];
  }[]>`
    SELECT id, url, timeout_ms, max_attempts, subscribed_events
    FROM webhook_endpoints
    WHERE enabled = TRUE AND deleted_at IS NULL
  `;

  for (const endpoint of endpoints) {
    if (!endpoint.subscribed_events.includes(eventName)) continue;
    const delivery = await sql<{ id: string }[]>`
      INSERT INTO webhook_deliveries (webhook_endpoint_id, event_name, payload, status)
      VALUES (${endpoint.id}::uuid, ${eventName}, ${sql.json(payload as JSONValue)}, 'pending')
      RETURNING id
    `;
    await attemptWebhookDelivery(delivery[0]!.id);
  }
}

export async function attemptWebhookDelivery(deliveryId: string) {
  const sql = getSql();
  const rows = await sql<{
    id: string;
    webhook_endpoint_id: string;
    event_name: string;
    payload: Record<string, unknown>;
    attempt_number: number;
    url: string;
    timeout_ms: number;
    max_attempts: number;
  }[]>`
    SELECT d.id, d.webhook_endpoint_id, d.event_name, d.payload, d.attempt_number,
           e.url, e.timeout_ms, e.max_attempts
    FROM webhook_deliveries d
    JOIN webhook_endpoints e ON e.id = d.webhook_endpoint_id
    WHERE d.id = ${deliveryId}::uuid
    LIMIT 1
  `;
  const delivery = rows[0];
  if (!delivery) return;

  const secretRow = await sql<{ ciphertext: Buffer; iv: Buffer; auth_tag: Buffer }[]>`
    SELECT ciphertext, iv, auth_tag FROM webhook_endpoint_secrets
    WHERE webhook_endpoint_id = ${delivery.webhook_endpoint_id}::uuid
    LIMIT 1
  `;
  if (!secretRow[0]) {
    await sql`
      UPDATE webhook_deliveries
      SET status = 'failed', failure_reason = 'Missing signing secret', updated_at = NOW()
      WHERE id = ${deliveryId}::uuid
    `;
    return;
  }

  const secret = decryptSecret({
    ciphertext: secretRow[0].ciphertext,
    iv: secretRow[0].iv,
    authTag: secretRow[0].auth_tag,
  });

  const bodyObject = {
    id: randomUUID(),
    event: delivery.event_name,
    created_at: new Date().toISOString(),
    data: delivery.payload,
  };
  const body = JSON.stringify(bodyObject);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signWebhookPayload(secret, body, timestamp);
  const started = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), delivery.timeout_ms);
    const response = await fetch(delivery.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GYVFT-Timestamp": timestamp,
        "X-GYVFT-Signature": signature,
        "X-GYVFT-Event": delivery.event_name,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const duration = Date.now() - started;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    await sql`
      UPDATE webhook_deliveries
      SET status = 'delivered',
          response_status = ${response.status},
          response_duration_ms = ${duration},
          delivered_at = NOW(),
          updated_at = NOW()
      WHERE id = ${deliveryId}::uuid
    `;
    await createIntegrationLog({
      provider: "webhooks",
      operation: "deliver",
      eventName: delivery.event_name,
      success: true,
      httpStatus: response.status,
      metadata: { deliveryId, duration },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook delivery failed";
    const attempt = delivery.attempt_number;
    const shouldRetry = attempt < delivery.max_attempts;
    const delayMinutes = Math.min(2 ** attempt, 60);
    await sql`
      UPDATE webhook_deliveries
      SET status = ${shouldRetry ? "pending" : "failed"},
          attempt_number = ${attempt + (shouldRetry ? 0 : 0)},
          failure_reason = ${message},
          response_duration_ms = ${Date.now() - started},
          next_retry_at = ${shouldRetry ? new Date(Date.now() + delayMinutes * 60 * 1000).toISOString() : null},
          updated_at = NOW()
      WHERE id = ${deliveryId}::uuid
    `;
    if (shouldRetry) {
      await sql`
        UPDATE webhook_deliveries
        SET attempt_number = attempt_number + 1
        WHERE id = ${deliveryId}::uuid
      `;
    }
    await createIntegrationLog({
      provider: "webhooks",
      operation: "deliver",
      eventName: delivery.event_name,
      success: false,
      sanitisedError: message,
      attemptNumber: attempt,
      nextRetryAt: shouldRetry ? new Date(Date.now() + delayMinutes * 60 * 1000) : null,
      metadata: { deliveryId },
    });
  }
}
