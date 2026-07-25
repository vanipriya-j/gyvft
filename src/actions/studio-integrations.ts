"use server";

import { revalidatePath } from "next/cache";
import { canConfigureSecretIntegrations, canManageIntegrations } from "@/lib/auth/roles";
import { requireStudioUser } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/encryption/secrets";
import {
  updateTrackingRule,
  upsertIntegrationConfig,
  upsertIntegrationSecret,
  type JsonRecord,
} from "@/repositories/studio";
import type { IntegrationStatus } from "@/types/domain";

const statuses = ["not_configured", "configured", "connected", "error", "disabled"] as const satisfies readonly IntegrationStatus[];

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function requireStatus(input: string): IntegrationStatus {
  if (!statuses.includes(input as IntegrationStatus)) throw new Error("Invalid integration status");
  return input as IntegrationStatus;
}

function collectConfig(formData: FormData): JsonRecord {
  const config: JsonRecord = {};
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("config.")) continue;
    const configKey = key.slice("config.".length);
    const text = String(raw).trim();
    if (text) config[configKey] = text;
  }
  return config;
}

function collectSecrets(formData: FormData): Array<{ secretName: string; plaintext: string }> {
  const secrets: Array<{ secretName: string; plaintext: string }> = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("secret.")) continue;
    const plaintext = String(raw).trim();
    if (!plaintext) continue;
    secrets.push({ secretName: key.slice("secret.".length), plaintext });
  }
  return secrets;
}

export async function saveIntegrationAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canManageIntegrations(profile.role)) {
    throw new Error("You do not have permission to manage integrations");
  }
  const provider = value(formData, "provider");
  const displayName = value(formData, "displayName") || provider;
  const secrets = collectSecrets(formData);
  if (secrets.length > 0 && !canConfigureSecretIntegrations(profile.role)) {
    throw new Error("Only owners can update integration secrets");
  }

  await upsertIntegrationConfig({
    provider,
    displayName,
    enabled: checked(formData, "enabled"),
    status: requireStatus(value(formData, "status") || "not_configured"),
    config: collectConfig(formData),
  });

  for (const secret of secrets) {
    await upsertIntegrationSecret({
      provider,
      secretName: secret.secretName,
      secret: encryptSecret(secret.plaintext),
      createdByUserId: profile.id,
    });
  }

  revalidatePath("/studio/integrations");
  revalidatePath(`/studio/integrations/${provider}`);
}

export async function updateTrackingRuleAction(formData: FormData) {
  const profile = await requireStudioUser();
  if (!canManageIntegrations(profile.role)) {
    throw new Error("You do not have permission to manage tracking rules");
  }
  await updateTrackingRule({
    eventName: value(formData, "eventName"),
    internalEnabled: checked(formData, "internalEnabled"),
    ga4Enabled: checked(formData, "ga4Enabled"),
    metaBrowserEnabled: checked(formData, "metaBrowserEnabled"),
    metaServerEnabled: checked(formData, "metaServerEnabled"),
  });
  revalidatePath("/studio/integrations/tracking");
}
