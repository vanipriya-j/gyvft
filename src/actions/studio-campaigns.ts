"use server";

import { revalidatePath } from "next/cache";
import { canViewAnalytics } from "@/lib/auth/roles";
import { requireStudioUser } from "@/lib/auth/session";
import { deleteCampaign, upsertCampaign } from "@/repositories/studio";
import type { CampaignStatus } from "@/types/domain";

const statuses = ["draft", "active", "paused", "completed"] as const satisfies readonly CampaignStatus[];

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string): string | null {
  const text = value(formData, key);
  return text.length > 0 ? text : null;
}

function requireStatus(input: string): CampaignStatus {
  if (!statuses.includes(input as CampaignStatus)) throw new Error("Invalid campaign status");
  return input as CampaignStatus;
}

export async function saveCampaignAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canViewAnalytics(profile.role)) throw new Error("You do not have permission to manage campaigns");
  await upsertCampaign({
    id: optionalValue(formData, "campaignId"),
    name: value(formData, "name"),
    status: requireStatus(value(formData, "status") || "draft"),
    channel: optionalValue(formData, "channel"),
    source: optionalValue(formData, "source"),
    medium: optionalValue(formData, "medium"),
    campaign: optionalValue(formData, "campaign"),
    content: optionalValue(formData, "content"),
    term: optionalValue(formData, "term"),
    landingPage: optionalValue(formData, "landingPage"),
    startDate: optionalValue(formData, "startDate"),
    endDate: optionalValue(formData, "endDate"),
    ownerUserId: profile.id,
    notes: optionalValue(formData, "notes"),
  });
  revalidatePath("/studio/campaigns");
  revalidatePath("/studio/analytics/campaigns");
}

export async function deleteCampaignAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canViewAnalytics(profile.role)) throw new Error("You do not have permission to delete campaigns");
  await deleteCampaign(value(formData, "campaignId"));
  revalidatePath("/studio/campaigns");
}
