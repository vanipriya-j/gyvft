"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RESERVED_SLUGS } from "@/config/constants";
import { canManageLandingPages } from "@/lib/auth/roles";
import { requireStudioUser } from "@/lib/auth/session";
import { deleteLandingPage, upsertLandingPage } from "@/repositories/studio";
import type { LandingPageStatus } from "@/types/domain";

const statuses = ["draft", "published", "archived"] as const satisfies readonly LandingPageStatus[];

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string): string | null {
  const text = value(formData, key);
  return text.length > 0 ? text : null;
}

function requireStatus(input: string): LandingPageStatus {
  if (!statuses.includes(input as LandingPageStatus)) throw new Error("Invalid landing page status");
  return input as LandingPageStatus;
}

function normaliseSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number])) {
    throw new Error("Choose a different slug");
  }
  return slug;
}

export async function saveLandingPageAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canManageLandingPages(profile.role)) {
    throw new Error("You do not have permission to manage landing pages");
  }
  const page = await upsertLandingPage({
    id: optionalValue(formData, "landingPageId"),
    internalName: value(formData, "internalName"),
    slug: normaliseSlug(value(formData, "slug")),
    status: requireStatus(value(formData, "status") || "draft"),
    seoTitle: optionalValue(formData, "seoTitle"),
    seoDescription: optionalValue(formData, "seoDescription"),
    socialImagePath: optionalValue(formData, "socialImagePath"),
    primaryCtaLabel: optionalValue(formData, "primaryCtaLabel"),
    primaryCtaHref: optionalValue(formData, "primaryCtaHref"),
    formDestination: optionalValue(formData, "formDestination"),
    campaignId: optionalValue(formData, "campaignId"),
    createdByUserId: profile.id,
  });
  revalidatePath("/studio/landing-pages");
  revalidatePath(`/studio/landing-pages/${page.id}`);
  if (!optionalValue(formData, "landingPageId")) redirect(`/studio/landing-pages/${page.id}`);
}

export async function deleteLandingPageAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canManageLandingPages(profile.role)) {
    throw new Error("You do not have permission to delete landing pages");
  }
  await deleteLandingPage(value(formData, "landingPageId"));
  revalidatePath("/studio/landing-pages");
  redirect("/studio/landing-pages");
}
