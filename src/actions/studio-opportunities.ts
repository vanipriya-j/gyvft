"use server";

import { revalidatePath } from "next/cache";
import { OPPORTUNITY_STAGES } from "@/config/constants";
import { createActivity } from "@/repositories/activities";
import { createTask } from "@/repositories/tasks";
import { getOpportunityById, updateOpportunityStage } from "@/repositories/opportunities";
import {
  createNote,
  updateOpportunityAssignment,
  updateOpportunityPriority,
} from "@/repositories/studio";
import { requireStudioUser } from "@/lib/auth/session";
import { withTransaction } from "@/lib/database/client";
import type { OpportunityStage, PriorityLevel } from "@/types/domain";

const priorities = ["low", "medium", "high", "urgent"] as const satisfies readonly PriorityLevel[];

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string): string | null {
  const text = value(formData, key);
  return text.length > 0 ? text : null;
}

function requireStage(input: string): OpportunityStage {
  if (!OPPORTUNITY_STAGES.includes(input as OpportunityStage)) {
    throw new Error("Invalid stage");
  }
  return input as OpportunityStage;
}

function requirePriority(input: string): PriorityLevel {
  if (!priorities.includes(input as PriorityLevel)) {
    throw new Error("Invalid priority");
  }
  return input as PriorityLevel;
}

export async function changeOpportunityStageAction(formData: FormData) {
  const profile = await requireStudioUser();
  const id = value(formData, "opportunityId");
  const stage = requireStage(value(formData, "stage"));
  const previous = await getOpportunityById(id);
  if (!previous) throw new Error("Opportunity not found");

  await withTransaction(async (tx) => {
    const updated = await updateOpportunityStage(
      id,
      stage,
      {
        lostReason: optionalValue(formData, "lostReason"),
        lostNotes: optionalValue(formData, "lostNotes"),
        competitor: optionalValue(formData, "competitor"),
        revisitDate: optionalValue(formData, "revisitDate"),
        estimatedValue: optionalValue(formData, "estimatedValue")
          ? Number(optionalValue(formData, "estimatedValue"))
          : null,
        confirmedValue: optionalValue(formData, "confirmedValue")
          ? Number(optionalValue(formData, "confirmedValue"))
          : null,
        expectedStartDate: optionalValue(formData, "expectedStartDate"),
      },
      tx,
    );
    await createActivity(
      {
        opportunityId: id,
        actorUserId: profile.id,
        activityType: "opportunity.stage_changed",
        summary: `Stage changed from ${previous.stage} to ${updated.stage}`,
        metadata: { from: previous.stage, to: updated.stage },
      },
      tx,
    );
  });

  revalidatePath("/studio");
  revalidatePath("/studio/opportunities");
  revalidatePath(`/studio/opportunities/${id}`);
}

export async function assignOpportunityAction(formData: FormData) {
  const profile = await requireStudioUser();
  const id = value(formData, "opportunityId");
  const assignedUserId = optionalValue(formData, "assignedUserId");
  await withTransaction(async (tx) => {
    const updated = await updateOpportunityAssignment(id, assignedUserId, tx);
    await createActivity(
      {
        opportunityId: id,
        actorUserId: profile.id,
        activityType: "opportunity.assigned",
        summary: assignedUserId ? "Opportunity assignment updated" : "Opportunity assignment cleared",
        metadata: { assignedUserId: updated.assigned_user_id },
      },
      tx,
    );
  });
  revalidatePath("/studio/opportunities");
  revalidatePath(`/studio/opportunities/${id}`);
}

export async function updateOpportunityPriorityAction(formData: FormData) {
  const profile = await requireStudioUser();
  const id = value(formData, "opportunityId");
  const priority = requirePriority(value(formData, "priority"));
  await withTransaction(async (tx) => {
    await updateOpportunityPriority(id, priority, tx);
    await createActivity(
      {
        opportunityId: id,
        actorUserId: profile.id,
        activityType: "opportunity.priority_updated",
        summary: `Priority changed to ${priority}`,
        metadata: { priority },
      },
      tx,
    );
  });
  revalidatePath("/studio/opportunities");
  revalidatePath(`/studio/opportunities/${id}`);
}

export async function addOpportunityNoteAction(formData: FormData) {
  const profile = await requireStudioUser();
  const opportunityId = value(formData, "opportunityId");
  const body = value(formData, "body");
  if (!body) throw new Error("Note body is required");
  await withTransaction(async (tx) => {
    const note = await createNote({ opportunityId, authorUserId: profile.id, body }, tx);
    await createActivity(
      {
        opportunityId,
        actorUserId: profile.id,
        activityType: "note.created",
        summary: "Note added",
        metadata: { noteId: note.id },
      },
      tx,
    );
  });
  revalidatePath(`/studio/opportunities/${opportunityId}`);
}

export async function addOpportunityTaskAction(formData: FormData) {
  const profile = await requireStudioUser();
  const opportunityId = value(formData, "opportunityId");
  const title = value(formData, "title");
  if (!title) throw new Error("Task title is required");
  await withTransaction(async (tx) => {
    const task = await createTask(
      {
        opportunityId,
        title,
        description: optionalValue(formData, "description"),
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
  revalidatePath(`/studio/opportunities/${opportunityId}`);
}

export async function archiveOpportunityAction(formData: FormData) {
  formData.set("stage", "archived");
  await changeOpportunityStageAction(formData);
}

export async function markOpportunityWonAction(formData: FormData) {
  formData.set("stage", "won");
  await changeOpportunityStageAction(formData);
}

export async function markOpportunityLostAction(formData: FormData) {
  formData.set("stage", "lost");
  await changeOpportunityStageAction(formData);
}

