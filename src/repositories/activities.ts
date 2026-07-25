import type { JSONValue, Sql } from "postgres";
import { getSql } from "@/lib/database/client";

export type Activity = {
  id: string;
  opportunity_id: string | null;
  contact_id: string | null;
  organisation_id: string | null;
  task_id: string | null;
  actor_user_id: string | null;
  activity_type: string;
  summary: string;
  metadata: Record<string, unknown>;
  is_immutable: boolean;
  created_at: string;
};

export async function createActivity(
  input: {
    opportunityId?: string | null;
    contactId?: string | null;
    organisationId?: string | null;
    taskId?: string | null;
    actorUserId?: string | null;
    activityType: string;
    summary: string;
    metadata?: Record<string, unknown>;
  },
  db: Sql = getSql(),
): Promise<Activity> {
  const rows = await db<Activity[]>`
    INSERT INTO activities (
      opportunity_id, contact_id, organisation_id, task_id, actor_user_id,
      activity_type, summary, metadata
    ) VALUES (
      ${input.opportunityId ?? null}::uuid,
      ${input.contactId ?? null}::uuid,
      ${input.organisationId ?? null}::uuid,
      ${input.taskId ?? null}::uuid,
      ${input.actorUserId ?? null}::uuid,
      ${input.activityType},
      ${input.summary},
      ${db.json((input.metadata ?? {}) as JSONValue)}
    )
    RETURNING *
  `;
  return rows[0]!;
}

export async function listActivitiesForOpportunity(
  opportunityId: string,
): Promise<Activity[]> {
  const sql = getSql();
  return sql<Activity[]>`
    SELECT * FROM activities
    WHERE opportunity_id = ${opportunityId}::uuid
    ORDER BY created_at DESC
  `;
}
