"use server";
import { requireCustomerAccount } from "@/lib/customer/session";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import {
  saveGiftDraft,
  requestGiftQuote,
  setGiftVisibility,
  GiftWorkspaceError,
} from "@/lib/customer/gift-workspace";
import { revalidatePath } from "next/cache";
import { scheduleNotifications } from "@/lib/customer/notifications";
import { logger } from "@/lib/logging/logger";
import { recordCustomerEvent } from "@/lib/customer/observability";
import { ZodError } from "zod";
async function actor() {
  const account = await requireCustomerAccount();
  assertPublicFormRateLimit({
    ip: account.id,
    formKey: "gift-workspace",
    limit: 60,
    windowMs: 60000,
  });
  return account;
}
function failure(error: unknown) {
  if (error instanceof GiftWorkspaceError)
    return { ok: false as const, message: error.message };
  if (error instanceof ZodError)
    return {
      ok: false as const,
      message: "Check the required fields and product quantities.",
    };
  logger.error("Gift workspace operation failed", {
    code: "GIFT_WORKSPACE_WRITE_FAILED",
  });
  return {
    ok: false as const,
    message:
      "We could not confirm this save. Reload to check the saved draft before retrying.",
  };
}
export async function saveWorkspaceDraft(
  projectId: string,
  id: string,
  version: number,
  document: unknown,
) {
  const account = await actor();
  try {
    const draft = await saveGiftDraft(
      projectId,
      account.id,
      id,
      version,
      document,
    );
    return { ok: true as const, draft };
  } catch (error) {
    return failure(error);
  }
}
export async function submitWorkspaceQuote(
  projectId: string,
  draftId: string,
  version: number,
  selectionId: string,
) {
  const account = await actor();
  try {
    const selection = await requestGiftQuote(
      projectId,
      account.id,
      draftId,
      version,
      selectionId,
    );
    scheduleNotifications(projectId);
    revalidatePath(`/account/projects/${projectId}`);
    await recordCustomerEvent("gift.quote_requested", {
      accountId: account.id,
      metadata: { operation: "gift-workspace", status: 201 },
    });
    return { ok: true as const, selection };
  } catch (error) {
    return failure(error);
  }
}

export async function toggleGiftOption(
  projectId: string,
  id: string,
  kind: "curated" | "draft",
  hidden: boolean,
) {
  const account = await actor();
  if (!["curated", "draft"].includes(kind) || typeof hidden !== "boolean")
    return { ok: false as const, message: "Invalid option." };
  try {
    await setGiftVisibility(projectId, id, kind, hidden, account.id);
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}
