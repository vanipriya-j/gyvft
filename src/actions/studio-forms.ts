"use server";

import { revalidatePath } from "next/cache";
import { canManageLandingPages } from "@/lib/auth/roles";
import { requireStudioUser } from "@/lib/auth/session";
import { updateFormConfiguration } from "@/repositories/studio";
import type { PriorityLevel } from "@/types/domain";

const priorities = ["low", "medium", "high", "urgent"] as const satisfies readonly PriorityLevel[];

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string): string | null {
  const text = value(formData, key);
  return text.length > 0 ? text : null;
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function requirePriority(input: string): PriorityLevel {
  if (!priorities.includes(input as PriorityLevel)) throw new Error("Invalid priority");
  return input as PriorityLevel;
}

function parseRecipients(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function updateFormConfigurationAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canManageLandingPages(profile.role)) {
    throw new Error("You do not have permission to manage forms");
  }
  await updateFormConfiguration({
    formKey: value(formData, "formKey"),
    enabled: checked(formData, "enabled"),
    publicHeadline: optionalValue(formData, "publicHeadline"),
    supportingCopy: optionalValue(formData, "supportingCopy"),
    successMessage: optionalValue(formData, "successMessage"),
    notificationRecipients: parseRecipients(value(formData, "notificationRecipients")),
    defaultAssigneeUserId: optionalValue(formData, "defaultAssigneeUserId"),
    defaultPriority: requirePriority(value(formData, "defaultPriority") || "medium"),
    consentCopy: optionalValue(formData, "consentCopy"),
    autoResponseEnabled: checked(formData, "autoResponseEnabled"),
  });
  revalidatePath("/studio/forms");
}
