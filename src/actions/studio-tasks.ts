"use server";

import { revalidatePath } from "next/cache";
import { createActivity } from "@/repositories/activities";
import { createTask, updateTaskStatus } from "@/repositories/tasks";
import { updateTask } from "@/repositories/studio";
import { requireStudioUser } from "@/lib/auth/session";
import { withTransaction } from "@/lib/database/client";
import type { PriorityLevel, TaskStatus } from "@/types/domain";

const taskStatuses = ["open", "in_progress", "completed", "cancelled"] as const satisfies readonly TaskStatus[];
const priorities = ["low", "medium", "high", "urgent"] as const satisfies readonly PriorityLevel[];

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string): string | null {
  const text = value(formData, key);
  return text.length > 0 ? text : null;
}

function requireTaskStatus(input: string): TaskStatus {
  if (!taskStatuses.includes(input as TaskStatus)) throw new Error("Invalid task status");
  return input as TaskStatus;
}

function requirePriority(input: string): PriorityLevel {
  if (!priorities.includes(input as PriorityLevel)) throw new Error("Invalid priority");
  return input as PriorityLevel;
}

export async function createStudioTaskAction(formData: FormData) {
  const profile = await requireStudioUser();
  const title = value(formData, "title");
  if (!title) throw new Error("Task title is required");
  const opportunityId = optionalValue(formData, "opportunityId");
  const contactId = optionalValue(formData, "contactId");
  const organisationId = optionalValue(formData, "organisationId");
  await withTransaction(async (tx) => {
    const task = await createTask(
      {
        title,
        description: optionalValue(formData, "description"),
        opportunityId,
        contactId,
        organisationId,
        assignedUserId: optionalValue(formData, "assignedUserId") ?? profile.id,
        createdByUserId: profile.id,
        dueAt: optionalValue(formData, "dueAt"),
        priority: requirePriority(value(formData, "priority") || "medium"),
      },
      tx,
    );
    await createActivity(
      {
        opportunityId,
        contactId,
        organisationId,
        taskId: task.id,
        actorUserId: profile.id,
        activityType: "task.created",
        summary: `Task created: ${task.title}`,
        metadata: { taskId: task.id },
      },
      tx,
    );
  });
  revalidatePath("/studio/tasks");
  if (opportunityId) revalidatePath(`/studio/opportunities/${opportunityId}`);
}

export async function updateStudioTaskAction(formData: FormData) {
  await requireStudioUser();
  const id = value(formData, "taskId");
  await updateTask(id, {
    title: value(formData, "title"),
    description: optionalValue(formData, "description"),
    dueAt: optionalValue(formData, "dueAt"),
    priority: requirePriority(value(formData, "priority") || "medium"),
    status: requireTaskStatus(value(formData, "status") || "open"),
  });
  revalidatePath("/studio/tasks");
}

export async function updateTaskStatusAction(formData: FormData) {
  const profile = await requireStudioUser();
  const id = value(formData, "taskId");
  const status = requireTaskStatus(value(formData, "status"));
  const task = await updateTaskStatus(id, status, profile.id);
  await createActivity({
    opportunityId: task.opportunity_id,
    contactId: task.contact_id,
    organisationId: task.organisation_id,
    taskId: task.id,
    actorUserId: profile.id,
    activityType: "task.status_updated",
    summary: `Task marked ${status}`,
    metadata: { status },
  });
  revalidatePath("/studio/tasks");
  if (task.opportunity_id) revalidatePath(`/studio/opportunities/${task.opportunity_id}`);
}
