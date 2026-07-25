import "server-only";
import type { JSONValue } from "postgres";
import { getSql } from "@/lib/database/client";

export async function createIntegrationLog(input: {
  provider: string;
  integrationId?: string | null;
  operation: string;
  eventName?: string | null;
  correlationId?: string | null;
  attemptNumber?: number;
  requestStartedAt?: Date;
  requestCompletedAt?: Date;
  success: boolean;
  httpStatus?: number | null;
  providerResponseId?: string | null;
  sanitisedError?: string | null;
  nextRetryAt?: Date | null;
  metadata?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO integration_logs (
      provider, integration_id, operation, event_name, correlation_id, attempt_number,
      request_started_at, request_completed_at, success, http_status, provider_response_id,
      sanitised_error, next_retry_at, metadata
    ) VALUES (
      ${input.provider},
      ${input.integrationId ?? null}::uuid,
      ${input.operation},
      ${input.eventName ?? null},
      ${input.correlationId ?? null}::uuid,
      ${input.attemptNumber ?? 1},
      ${input.requestStartedAt?.toISOString() ?? new Date().toISOString()},
      ${input.requestCompletedAt?.toISOString() ?? null},
      ${input.success},
      ${input.httpStatus ?? null},
      ${input.providerResponseId ?? null},
      ${input.sanitisedError ?? null},
      ${input.nextRetryAt?.toISOString() ?? null},
      ${sql.json((input.metadata ?? {}) as JSONValue)}
    )
    RETURNING id
  `;
  return rows[0]!.id;
}

export async function listIntegrationLogs(filters: {
  provider?: string;
  success?: boolean;
  correlationId?: string;
  limit?: number;
  offset?: number;
}) {
  const sql = getSql();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const rows = await sql`
    SELECT * FROM integration_logs
    WHERE (${filters.provider ?? null}::text IS NULL OR provider = ${filters.provider ?? null})
      AND (${filters.success ?? null}::boolean IS NULL OR success = ${filters.success ?? null})
      AND (${filters.correlationId ?? null}::uuid IS NULL OR correlation_id = ${filters.correlationId ?? null}::uuid)
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows;
}
