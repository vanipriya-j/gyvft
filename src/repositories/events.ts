import type { JSONValue, Sql } from "postgres";
import { getSql } from "@/lib/database/client";

export type AnalyticsEventRow = {
  id: string;
  event_name: string;
  event_id: string;
  correlation_id: string;
  anonymous_visitor_id: string | null;
  session_id: string | null;
  opportunity_id: string | null;
  contact_id: string | null;
  user_type: string;
  source_route: string | null;
  device_category: string | null;
  properties: Record<string, unknown>;
  consent_analytics: boolean;
  consent_advertising: boolean;
  created_at: string;
};

export async function recordAnalyticsEvent(
  input: {
    eventName: string;
    eventId: string;
    correlationId: string;
    anonymousVisitorId?: string | null;
    sessionId?: string | null;
    opportunityId?: string | null;
    contactId?: string | null;
    userType?: string;
    sourceRoute?: string | null;
    deviceCategory?: string | null;
    properties?: Record<string, unknown>;
    consentAnalytics?: boolean;
    consentAdvertising?: boolean;
  },
  db: Sql = getSql(),
): Promise<AnalyticsEventRow> {
  const rows = await db<AnalyticsEventRow[]>`
    INSERT INTO analytics_events (
      event_name, event_id, correlation_id, anonymous_visitor_id, session_id,
      opportunity_id, contact_id, user_type, source_route, device_category,
      properties, consent_analytics, consent_advertising
    ) VALUES (
      ${input.eventName},
      ${input.eventId}::uuid,
      ${input.correlationId}::uuid,
      ${input.anonymousVisitorId ?? null}::uuid,
      ${input.sessionId ?? null}::uuid,
      ${input.opportunityId ?? null}::uuid,
      ${input.contactId ?? null}::uuid,
      ${input.userType ?? "anonymous"},
      ${input.sourceRoute ?? null},
      ${input.deviceCategory ?? null},
      ${db.json((input.properties ?? {}) as JSONValue)},
      ${input.consentAnalytics ?? false},
      ${input.consentAdvertising ?? false}
    )
    ON CONFLICT (event_id) DO UPDATE SET event_name = EXCLUDED.event_name
    RETURNING *
  `;
  return rows[0]!;
}

export async function listAnalyticsEvents(filters: {
  eventName?: string;
  opportunityId?: string;
  correlationId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AnalyticsEventRow[]; total: number }> {
  const sql = getSql();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const rows = await sql<AnalyticsEventRow[]>`
    SELECT * FROM analytics_events
    WHERE (${filters.eventName ?? null}::text IS NULL OR event_name = ${filters.eventName ?? null})
      AND (${filters.opportunityId ?? null}::uuid IS NULL OR opportunity_id = ${filters.opportunityId ?? null}::uuid)
      AND (${filters.correlationId ?? null}::uuid IS NULL OR correlation_id = ${filters.correlationId ?? null}::uuid)
      AND (${filters.from ?? null}::timestamptz IS NULL OR created_at >= ${filters.from ?? null}::timestamptz)
      AND (${filters.to ?? null}::timestamptz IS NULL OR created_at <= ${filters.to ?? null}::timestamptz)
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const total = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM analytics_events
    WHERE (${filters.eventName ?? null}::text IS NULL OR event_name = ${filters.eventName ?? null})
      AND (${filters.opportunityId ?? null}::uuid IS NULL OR opportunity_id = ${filters.opportunityId ?? null}::uuid)
      AND (${filters.correlationId ?? null}::uuid IS NULL OR correlation_id = ${filters.correlationId ?? null}::uuid)
      AND (${filters.from ?? null}::timestamptz IS NULL OR created_at >= ${filters.from ?? null}::timestamptz)
      AND (${filters.to ?? null}::timestamptz IS NULL OR created_at <= ${filters.to ?? null}::timestamptz)
  `;
  return { rows, total: Number(total[0]?.count ?? 0) };
}

export async function getFunnelCounts(eventNames: string[], from?: string, to?: string) {
  const sql = getSql();
  const rows = await sql<{ event_name: string; count: string }[]>`
    SELECT event_name, COUNT(*)::text AS count
    FROM analytics_events
    WHERE event_name = ANY(${eventNames}::text[])
      AND (${from ?? null}::timestamptz IS NULL OR created_at >= ${from ?? null}::timestamptz)
      AND (${to ?? null}::timestamptz IS NULL OR created_at <= ${to ?? null}::timestamptz)
    GROUP BY event_name
  `;
  const map = new Map(rows.map((r) => [r.event_name, Number(r.count)]));
  return eventNames.map((name) => ({
    eventName: name,
    count: map.get(name) ?? 0,
  }));
}
