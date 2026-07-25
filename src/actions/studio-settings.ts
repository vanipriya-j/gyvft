"use server";

import { revalidatePath } from "next/cache";
import { canManageUsers, canManageWorkspaceSecurity } from "@/lib/auth/roles";
import { requireStudioUser } from "@/lib/auth/session";
import {
  createConsentVersion,
  updateConsentSettings,
  updateProfileAccess,
  updateWorkspaceSettings,
} from "@/repositories/studio";
import type { UserRole } from "@/types/domain";

const roles = ["owner", "admin", "contributor"] as const satisfies readonly UserRole[];

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

function requireRole(input: string): UserRole {
  if (!roles.includes(input as UserRole)) throw new Error("Invalid role");
  return input as UserRole;
}

export async function updateUserAccessAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canManageUsers(profile.role)) throw new Error("Only owners can manage users");
  await updateProfileAccess(value(formData, "profileId"), {
    role: requireRole(value(formData, "role")),
    isActive: checked(formData, "isActive"),
  });
  revalidatePath("/studio/settings/users");
}

export async function updateSecuritySettingsAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canManageWorkspaceSecurity(profile.role)) {
    throw new Error("Only owners can manage security settings");
  }
  await updateWorkspaceSettings({
    defaultOpportunityOwnerId: optionalValue(formData, "defaultOpportunityOwnerId"),
    productionMode: checked(formData, "productionMode"),
    botProtectionEnabled: checked(formData, "botProtectionEnabled"),
    defaultCurrency: optionalValue(formData, "defaultCurrency"),
    maxUploadBytes: optionalValue(formData, "maxUploadBytes") ? Number(optionalValue(formData, "maxUploadBytes")) : null,
  });
  revalidatePath("/studio/settings");
  revalidatePath("/studio/settings/security");
}

export async function updateConsentSettingsAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canManageWorkspaceSecurity(profile.role)) {
    throw new Error("Only owners can manage consent settings");
  }
  await updateConsentSettings({
    bannerTitle: value(formData, "bannerTitle"),
    bannerBody: value(formData, "bannerBody"),
    privacyUrl: value(formData, "privacyUrl"),
    cookiesUrl: value(formData, "cookiesUrl"),
    defaultRegionBehaviour: value(formData, "defaultRegionBehaviour") || "opt_in",
    retentionDays: Number(value(formData, "retentionDays") || "365"),
    activeVersion: value(formData, "activeVersion") || "1.0.0",
  });
  revalidatePath("/studio/settings/consent");
}

export async function createConsentVersionAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canManageWorkspaceSecurity(profile.role)) {
    throw new Error("Only owners can create consent versions");
  }
  await createConsentVersion({
    version: value(formData, "version"),
    bannerTitle: value(formData, "bannerTitle"),
    bannerBody: value(formData, "bannerBody"),
    privacyUrl: value(formData, "privacyUrl"),
    cookiesUrl: value(formData, "cookiesUrl"),
    isActive: checked(formData, "isActive"),
  });
  revalidatePath("/studio/settings/consent");
}
