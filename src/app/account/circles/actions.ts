"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCustomerAccount } from "@/lib/customer/session";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import {
  createCircle,
  changeCircle,
  inviteToCircle,
  acceptCircleInvitation,
} from "@/lib/customer/circles";
import { AppError } from "@/lib/errors/app-error";
import { sendPublicResendEmail } from "@/services/email/public-resend";
import { escapeHtml } from "@/lib/security/sanitize";
import { logger } from "@/lib/logging/logger";
export type CircleActionResult = {
  ok: boolean;
  message: string;
  id?: string;
  url?: string;
};
async function run(
  fn: (actor: {
    id: string;
    email: string;
  }) => Promise<Partial<CircleActionResult>>,
): Promise<CircleActionResult> {
  const actor = await requireCustomerAccount();
  try {
    assertPublicFormRateLimit({
      ip: actor.id,
      formKey: "circle-write",
      limit: 30,
      windowMs: 60000,
    });
    const result = await fn(actor);
    revalidatePath("/account/circles", "layout");
    revalidatePath("/account");
    revalidatePath("/account/occasions");
    return { ok: true, message: "Saved.", ...result };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError)
      return {
        ok: false,
        message: error.issues[0]?.message || "Check the required fields.",
      };
    logger.error("Circle action failed", { code: "CIRCLE_ACTION_FAILED" });
    return {
      ok: false,
      message:
        "We couldn’t confirm this action. Refresh to check before retrying.",
    };
  }
}
const text = (d: FormData, k: string) => String(d.get(k) || "");
function org(data: FormData) {
  return text(data, "organisation_name")
    ? {
        name: text(data, "organisation_name"),
        website: text(data, "website"),
        domain: text(data, "domain"),
      }
    : null;
}
export async function createCircleAction(id: string, data: FormData) {
  return run(async (actor) => ({
    id: await createCircle(actor, {
      id,
      name: text(data, "name"),
      category: text(data, "category"),
      description: text(data, "description"),
      display_name: text(data, "display_name"),
      organisation: org(data),
    }),
    message: "Your circle is ready.",
  }));
}
export async function circleCommandAction(id: string, data: FormData) {
  return run(async (actor) => {
    const op = text(data, "op");
    let command: Record<string, unknown> = { op };
    if (op === "update")
      command = {
        op,
        name: text(data, "name"),
        description: text(data, "description"),
        ...(org(data) ? { organisation: org(data) } : {}),
      };
    else if (op === "profile")
      command = {
        op,
        display_name: text(data, "display_name"),
        share_profile: data.has("share_profile"),
      };
    else if (op === "role")
      command = {
        op,
        account_id: text(data, "account_id"),
        role: text(data, "role"),
      };
    else if (op === "remove" || op === "transfer")
      command = { op, account_id: text(data, "account_id") };
    else if (op === "archive") command = { op, confirm: data.has("confirm") };
    else if (op === "revoke_invitation")
      command = { op, invitation_id: text(data, "invitation_id") };
    else if (op === "recipient")
      command = {
        op,
        recipient: {
          id: text(data, "recipient_id"),
          name: text(data, "name"),
          email: text(data, "email"),
          about: text(data, "about"),
          likes: text(data, "likes"),
          avoid: text(data, "avoid"),
        },
      };
    else if (op === "archive_recipient")
      command = { op, recipient_id: text(data, "recipient_id") };
    else if (op === "occasion")
      command = {
        op,
        occasion: {
          id: text(data, "occasion_id"),
          title: text(data, "title"),
          occasion_date: text(data, "occasion_date"),
          repeats_annually: data.has("repeats_annually"),
          description: text(data, "description"),
          publish: data.has("publish"),
        },
      };
    else if (op === "archive_occasion")
      command = { op, occasion_id: text(data, "occasion_id") };
    await changeCircle(actor, id, command);
    return {
      message:
        op === "leave"
          ? "You’ve left this circle."
          : op === "archive"
            ? "Circle archived. Its records are preserved."
            : "Saved.",
    };
  });
}
export async function inviteCircleAction(id: string, data: FormData) {
  return run(async (actor) => {
    const invite = await inviteToCircle(actor, id, {
      email: text(data, "email"),
      display_name: text(data, "display_name"),
      role: text(data, "role") || "member",
      recipient_id: text(data, "recipient_id") || null,
      replace: data.has("replace"),
    });
    const url = new URL(
      `/account/circle-invitations/${invite.token}`,
      process.env.NEXT_PUBLIC_APP_URL || "https://www.gyvft.com",
    ).href;
    let message = "Invitation link ready. It expires in seven days.";
    if (data.has("send_email")) {
      try {
        await sendPublicResendEmail({
          to: invite.email,
          subject: "You’re invited to a circle on GYVFT",
          text: `You’ve been invited to a private gifting circle. Sign in with this email to accept. Your profile stays private until you choose to share it.\n\n${url}\n\nThis invitation expires in seven days.`,
          html: `<p>You’re invited to a private gifting circle on GYVFT.</p><p><a href="${escapeHtml(url)}">View your invitation</a></p><p>Use the email this invitation was sent to. Your profile stays private until you choose to share it. This link expires in seven days.</p>`,
        });
        message =
          "Invitation email accepted for sending. You can also copy the link.";
      } catch {
        message =
          "The invitation link is ready, but email delivery could not be confirmed. Copy and share the link.";
      }
    }
    return { url, message };
  });
}
export async function acceptCircleAction(token: string, data: FormData) {
  return run(async (actor) => ({
    id: await acceptCircleInvitation(actor, token, {
      display_name: text(data, "display_name"),
      share_profile: data.has("share_profile"),
    }),
    message: "You’ve joined the circle.",
  }));
}
