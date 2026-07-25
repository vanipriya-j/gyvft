import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import type { PriorityLevel, TaskStatus } from "@/types/domain";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  opportunity_id: string | null;
  contact_id: string | null;
  organisation_id: string | null;
  assigned_user_id: string | null;
  created_by_user_id: string | null;
  due_at: string | null;
  priority: PriorityLevel;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export async function createTask(
  input: {
    title: string;
    description?: string | null;
    opportunityId?: string | null;
    contactId?: string | null;
    organisationId?: string | null;
    assignedUserId?: string | null;
    createdByUserId?: string | null;
    dueAt?: string | null;
    priority?: PriorityLevel;
  },
  db: Sql = getSql(),
): Promise<Task> {
  const rows = await db<Task[]>`
    INSERT INTO tasks (
      title, description, opportunity_id, contact_id, organisation_id,
      assigned_user_id, created_by_user_id, due_at, priority
    ) VALUES (
      ${input.title},
      ${input.description ?? null},
      ${input.opportunityId ?? null}::uuid,
      ${input.contactId ?? null}::uuid,
      ${input.organisationId ?? null}::uuid,
      ${input.assignedUserId ?? null}::uuid,
      ${input.createdByUserId ?? null}::uuid,
      ${input.dueAt ?? null},
      ${input.priority ?? "medium"}
    )
    RETURNING *
  `;
  return rows[0]!;
}

export async function listTasks(filters: {
  assignedUserId?: string;
  status?: TaskStatus | TaskStatus[];
  due?: "today" | "upcoming" | "overdue";
  limit?: number;
  offset?: number;
}): Promise<{ rows: Task[]; total: number }> {
  const sql = getSql();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const statuses = Array.isArray(filters.status)
    ? filters.status
    : filters.status
      ? [filters.status]
      : null;

  const rows = await sql<Task[]>`
    SELECT * FROM tasks
    WHERE deleted_at IS NULL
      AND (${filters.assignedUserId ?? null}::uuid IS NULL OR assigned_user_id = ${filters.assignedUserId ?? null}::uuid)
      AND (${statuses}::text[] IS NULL OR status = ANY(${statuses}::text[]))
      AND (
        ${filters.due ?? null}::text IS NULL
        OR (${filters.due ?? null} = 'today' AND due_at::date = CURRENT_DATE)
        OR (${filters.due ?? null} = 'upcoming' AND due_at::date > CURRENT_DATE)
        OR (${filters.due ?? null} = 'overdue' AND due_at < NOW() AND status IN ('open','in_progress'))
      )
    ORDER BY due_at ASC NULLS LAST, created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const total = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM tasks
    WHERE deleted_at IS NULL
      AND (${filters.assignedUserId ?? null}::uuid IS NULL OR assigned_user_id = ${filters.assignedUserId ?? null}::uuid)
      AND (${statuses}::text[] IS NULL OR status = ANY(${statuses}::text[]))
      AND (
        ${filters.due ?? null}::text IS NULL
        OR (${filters.due ?? null} = 'today' AND due_at::date = CURRENT_DATE)
        OR (${filters.due ?? null} = 'upcoming' AND due_at::date > CURRENT_DATE)
        OR (${filters.due ?? null} = 'overdue' AND due_at < NOW() AND status IN ('open','in_progress'))
      )
  `;
  return { rows, total: Number(total[0]?.count ?? 0) };
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  actorUserId?: string | null,
  db: Sql = getSql(),
): Promise<Task> {
  const completedAt = status === "completed" ? new Date().toISOString() : null;
  const rows = await db<Task[]>`
    UPDATE tasks
    SET status = ${status},
        completed_at = ${completedAt},
        updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING *
  `;
  void actorUserId;
  return rows[0]!;
}
