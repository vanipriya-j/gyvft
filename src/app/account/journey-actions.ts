"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCustomerAccount } from "@/lib/customer/session";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import {
  saveGift,
  saveProfile,
  savePerson,
  saveOccasion,
  invitePerson,
  acceptInvitation,
  requestVersionChange,
} from "@/lib/customer/journeys";
import {
  saveTestimonial,
  addMomentPhoto,
  photoPermission,
  deleteMomentPhoto,
} from "@/lib/customer/moments";
import { CircleError } from "@/lib/customer/circle-model";
import { JourneyError } from "@/lib/customer/journey-model";
import { scheduleNotifications } from "@/lib/customer/notifications";
import { recordCustomerEvent } from "@/lib/customer/observability";
import { logger } from "@/lib/logging/logger";
import { sendPublicResendEmail } from "@/services/email/public-resend";
async function run(
  fn: (account: {
    id: string;
    email: string;
  }) => Promise<Record<string, unknown> | void>,
) {
  const account = await requireCustomerAccount();
  assertPublicFormRateLimit({
    ip: account.id,
    formKey: "gifting-journey",
    limit: 60,
    windowMs: 60000,
  });
  try {
    const result = await fn(account);
    revalidatePath("/account", "layout");
    return { ok: true as const, message: "Saved.", ...result };
  } catch (error) {
    if (error instanceof JourneyError || error instanceof CircleError)
      return { ok: false as const, message: error.message };
    if (error instanceof z.ZodError)
      return {
        ok: false as const,
        message: error.issues[0]?.message || "Check the required fields.",
      };
    logger.error("Gifting action failed", { code: "JOURNEY_WRITE_FAILED" });
    await recordCustomerEvent("app.error", {
      accountId: account.id,
      metadata: {
        operation: "gift-journey",
        code: "JOURNEY_WRITE_FAILED",
        status: 500,
      },
    });
    return {
      ok: false as const,
      message:
        "We could not confirm this save. Refresh to check before trying again.",
    };
  }
}
export async function saveGiftBrief(id: string, raw: unknown, draft: boolean) {
  return run(async (a) => {
    const giftId = await saveGift(a, id, raw, draft);
    if (!draft) scheduleNotifications(giftId);
    return {
      id: giftId,
      message: draft
        ? "Your private draft is saved."
        : "Your story is with Aarla.",
    };
  });
}
export async function updateProfile(data: FormData) {
  return run(async (a) => {
    await saveProfile(a.id, {
      ...Object.fromEntries(data),
      share_profile: data.has("share_profile"),
    });
  });
}
export async function updatePerson(id: string, data: FormData) {
  return run(async (a) => ({
    id: await savePerson(a.id, id, Object.fromEntries(data)),
  }));
}
export async function updateOccasion(id: string, data: FormData) {
  return run(async (a) => ({
    id: await saveOccasion(a.id, id, {
      ...Object.fromEntries(data),
      repeats_annually: data.has("repeats_annually"),
      person_id: String(data.get("person_id") || "") || null,
    }),
  }));
}
export async function prepareInvitation(id: string) {
  return run(async (a) => {
    const invitation = await invitePerson(a.id, id);
    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://www.gyvft.com";
    const url = new URL(`/account/invitations/${invitation.token}`, origin)
      .href;
    return {
      url,
      message:
        "Invitation link is ready. Share it with this person; it expires in seven days.",
    };
  });
}
export async function sendInvitationEmail(id: string) {
  return run(async (a) => {
    if (!process.env.RESEND_API_KEY)
      throw new JourneyError(
        "Email is unavailable. Prepare and share an invitation link instead.",
      );
    const invitation = await invitePerson(a.id, id);
    const url = new URL(
      `/account/invitations/${invitation.token}`,
      process.env.NEXT_PUBLIC_APP_URL || "https://www.gyvft.com",
    ).href;
    await sendPublicResendEmail({
      to: invitation.email,
      subject: "An invitation to your GYVFT gifting circle",
      text: `You have been invited to share a little about yourself on GYVFT. Accept using ${invitation.email}. Your private profile stays under your control.\n\n${url}\n\nThis link expires in seven days.`,
      idempotencyKey: `invite:${id}:${invitation.token}`,
    });
    return { message: "Invitation sent." };
  });
}
export async function acceptPersonInvitation(token: string) {
  return run(async (a) => {
    await acceptInvitation(a, token);
    return {
      message:
        "Invitation accepted. You control shared information in About me.",
    };
  });
}
export async function changeGiftVersion(
  id: string,
  approvalId: string,
  data: FormData,
) {
  return run(async (a) => {
    await requestVersionChange(
      a.id,
      id,
      approvalId,
      String(data.get("body") || ""),
    );
    scheduleNotifications(id);
    return { message: "Your version-specific change request is with Aarla." };
  });
}
export async function feedbackForGift(id: string, data: FormData) {
  return run(async (a) => {
    await saveTestimonial(a.id, id, {
      rating: Number(data.get("rating")),
      body: String(data.get("body") || ""),
      public_permission: data.has("public_permission"),
    });
    return {
      message: "Feedback saved. Your public permission is recorded separately.",
    };
  });
}
export async function setPhotoSharing(id: string, permitted: boolean) {
  return run(async (a) => {
    await photoPermission(a.id, id, permitted);
    return {
      message: permitted
        ? "Permission recorded. Aarla can now consider featuring this photo."
        : "Public permission withdrawn. Your private photo is kept.",
    };
  });
}
export async function removeGiftPhoto(id: string) {
  return run(async (a) => {
    await deleteMomentPhoto(a.id, id);
    return { message: "Photo removed." };
  });
}
export async function reviewTaste(
  name: string,
  accept: boolean,
  _data: FormData,
) {
  void _data;
  return run(async (a) => {
    const { decideTaste } = await import("@/lib/customer/journeys");
    await decideTaste(a.id, name, accept);
    return {
      message: accept
        ? "Added to your interests. You can edit it in About me."
        : "Suggestion dismissed.",
    };
  });
}
export async function uploadOneGiftPhoto(
  projectId: string,
  photoId: string,
  data: FormData,
) {
  return run(async (a) => {
    const file = data.get("photo");
    if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024)
      throw new JourneyError("Choose a photo under 2 MB.");
    await addMomentPhoto(a.id, projectId, photoId, {
      caption: String(data.get("caption") || ""),
      kind: String(data.get("kind") || ""),
      public_permission: data.has("public_permission"),
      rights: data.has("rights"),
      bytes: Buffer.from(await file.arrayBuffer()),
      mime: file.type,
    });
    return { message: "Photo saved." };
  });
}
