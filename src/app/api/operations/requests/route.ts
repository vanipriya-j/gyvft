import {
  circleOrganisationDirectory,
  verifyCircleOrganisation,
} from "@/lib/customer/circles";
import { AppError } from "@/lib/errors/app-error";
import {
  operatorJourneyCommand,
  operationsDirectory,
} from "@/lib/customer/operations-workflow";
import { JourneyError } from "@/lib/customer/journey-model";
import { operationsSnapshot } from "@/lib/customer/operations-snapshot";
import {
  ShopifyError,
  shopifyConfigured,
  syncShopifyCustomer,
  syncPendingCustomers,
  createOrSyncShopifyOrder,
} from "@/lib/customer/shopify";
import { logger } from "@/lib/logging/logger";
import { aarlaCouponConnectionStatus } from "@/lib/customer/aarla-shop";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validSetupSecret } from "@/lib/security/setup-secret";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import {
  mutatePilot,
  pilotList,
  pilotDetail,
  PilotError,
} from "@/lib/customer/pilot-admin";
import {
  deliverNotifications,
  scheduleNotifications,
} from "@/lib/customer/notifications";
import { getSql } from "@/lib/database/client";
import { shippingCommand } from "@/lib/customer/shipping-commands";
import { DelhiveryError } from "@/services/shipping/delhivery";
import { notificationStatus } from "@/lib/customer/notification-status";
import {
  NotificationTransportError,
  sendNotificationEmail,
} from "@/services/notifications/transports";
import {
  publishGiftOption,
  setGiftVisibility,
  GiftWorkspaceError,
} from "@/lib/customer/gift-workspace";
import { validImage } from "@/lib/customer/images";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
export async function POST(request: Request) {
  try {
    assertPublicFormRateLimit({
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown",
      formKey: "b2c-admin",
      limit: 90,
      windowMs: 60000,
    });
  } catch {
    return reply(
      { ok: false, message: "Too many requests. Please wait a minute." },
      429,
    );
  }
  if (!validSetupSecret(request.headers.get("x-setup-secret")))
    return reply(
      { ok: false, message: "Operator access could not be verified." },
      401,
    );
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ ok: false, message: "Missing action." }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 3 * 1024 * 1024) {
        await reader.cancel();
        return reply({ ok: false, message: "Use an image under 2 MB." }, 413);
      }
      chunks.push(value);
    }
    const raw = JSON.parse(Buffer.concat(chunks).toString()) as Record<
      string,
      unknown
    >;
    if (typeof raw.op === "string" && raw.op.startsWith("shipping_")) {
      const result = await shippingCommand(raw);
      if (typeof raw.project_id === "string") {
        revalidatePath(`/account/projects/${raw.project_id}`);
        scheduleNotifications(raw.project_id);
      }
      return reply(result);
    }
    if (raw.op === "aarla_savings_status")
      return reply({ ok: true, ...(await aarlaCouponConnectionStatus()) });
    if (raw.op === "notification_status")
      return reply({ ok: true, notifications: await notificationStatus() });
    if (raw.op === "test_notification_email") {
      assertPublicFormRateLimit({
        ip: "operator-notification-test",
        formKey: "email-test",
        limit: 3,
        windowMs: 3600000,
      });
      await sendNotificationEmail({
        id: z.string().uuid().parse(raw.request_id),
        to:
          process.env.GYVFT_LEADS_EMAIL ||
          process.env.RESEND_FROM_EMAIL ||
          "aarla@aarla.in",
        subject: "GYVFT notification delivery test",
        text: "This is a notification test requested from GYVFT Operations. If you received it, email delivery to the team inbox is working. This does not test delivery to every customer.",
      });
      return reply({
        ok: true,
        message:
          "Test accepted by email provider. Check the team inbox to confirm receipt.",
      });
    }
    if (raw.op === "retry_all_notifications") {
      const result = await deliverNotifications();
      return reply({
        ok: true,
        message: `Processed ${result.candidates} due notifications; ${result.accepted} accepted by provider. Check notification status for failures.`,
      });
    }
    if (raw.op === "snapshot")
      return reply({
        ok: true,
        snapshot: await operationsSnapshot(),
        shopifyConfigured: shopifyConfigured(),
      });
    if (raw.op === "list")
      return reply({
        ok: true,
        requests: await pilotList(String(raw.query || "")),
        shopifyConfigured: shopifyConfigured(),
      });
    if (raw.op === "upi_settings") {
      const parsed = z
        .object({
          upi_id: z
            .string()
            .trim()
            .regex(/^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}$/)
            .max(160),
          payee_name: z.string().trim().min(2).max(100),
        })
        .parse(raw);
      let image: Buffer | null = null,
        mime: string | null = null;
      if (raw.image) {
        const pic = z
          .object({ data: z.string().max(2800000), mime: z.string() })
          .parse(raw.image);
        image = Buffer.from(pic.data, "base64");
        mime = pic.mime;
        if (!validImage(image, mime))
          throw new PilotError(
            "Use a valid PNG, JPEG or WebP QR image under 2 MB.",
          );
        if (raw.confirmed_payee !== true)
          throw new PilotError(
            "Confirm that the QR pays the same receiving account.",
          );
      }
      await getSql()`INSERT INTO gyvft_customer_upi_settings(singleton,upi_id,payee_name,qr_data,qr_type) VALUES(true,${parsed.upi_id},${parsed.payee_name},${image},${mime}) ON CONFLICT(singleton) DO UPDATE SET upi_id=EXCLUDED.upi_id,payee_name=EXCLUDED.payee_name,qr_data=CASE WHEN gyvft_customer_upi_settings.upi_id=EXCLUDED.upi_id THEN COALESCE(EXCLUDED.qr_data,gyvft_customer_upi_settings.qr_data) ELSE EXCLUDED.qr_data END,qr_type=CASE WHEN gyvft_customer_upi_settings.upi_id=EXCLUDED.upi_id THEN COALESCE(EXCLUDED.qr_type,gyvft_customer_upi_settings.qr_type) ELSE EXCLUDED.qr_type END,updated_at=now()`;
      revalidatePath("/account");
      return reply({ ok: true, message: "Receiving UPI account saved." });
    }
    if (raw.op === "sync_customers") {
      const linked = await syncPendingCustomers();
      return reply({
        ok: true,
        message: `Linked ${linked} pending customer accounts. Run again for the next batch.`,
      });
    }
    if (raw.op === "circle_organisations")
      return reply({
        ok: true,
        organisations: await circleOrganisationDirectory(),
      });
    if (raw.op === "verify_circle_organisation") {
      await verifyCircleOrganisation(String(raw.id), {
        state: raw.state,
        note: raw.note,
        confirmed: raw.confirmed,
      });
      revalidatePath("/account/circles", "layout");
      return reply({ ok: true, message: "Organisation review saved." });
    }
    if (raw.op === "directory")
      return reply({ ok: true, ...(await operationsDirectory()) });
    if (
      [
        "task",
        "internal_note",
        "save_approval_draft",
        "feature_photo",
        "feature_testimonial",
      ].includes(String(raw.op))
    ) {
      await operatorJourneyCommand(raw);
      revalidatePath("/account", "layout");
      return reply({ ok: true, message: "Saved." });
    }
    if (raw.op === "publish_saved_approval") {
      await mutatePilot({
        ...raw,
        op: "publish",
        saved_draft_version: raw.version,
      });
      scheduleNotifications(String(raw.id));
      revalidatePath("/account", "layout");
      return reply({
        ok: true,
        message: "Published. The customer can now review this exact version.",
      });
    }
    const id = z.string().uuid().parse(raw.id);
    if (raw.op === "shopify_customer") {
      const [p] =
        await getSql()`SELECT customer_account_id FROM customer_projects WHERE id=${id}::uuid`;
      if (!p?.customer_account_id)
        throw new PilotError(
          "The customer must connect their GYVFT account first.",
        );
      const linked = await syncShopifyCustomer(p.customer_account_id);
      return reply({
        ok: true,
        message: linked
          ? "Shopify customer linked."
          : "Customer linking is pending.",
      });
    }
    if (raw.op === "shopify_order") {
      const reference = await createOrSyncShopifyOrder(
        id,
        raw.confirm_order === true,
      );
      revalidatePath(`/account/projects/${id}`);
      return reply({ ok: true, message: `Shopify order linked: ${reference}` });
    }
    if (raw.op === "detail")
      return reply({ ok: true, ...(await pilotDetail(id)) });
    if (raw.op === "retry_notifications") {
      const result = await deliverNotifications(id);
      return reply({
        ok: true,
        message: `Processed ${result.candidates} due notifications; ${result.accepted} accepted by provider. Future retries and uncertain sends are not resent by this action.`,
      });
    }
    if (raw.op === "publish_gift_option")
      await publishGiftOption(id, z.string().uuid().parse(raw.request_id), raw);
    else if (raw.op === "gift_visibility")
      await setGiftVisibility(
        id,
        z.string().uuid().parse(raw.option_id),
        z.enum(["curated", "draft"]).parse(raw.kind),
        z.boolean().parse(raw.hidden),
      );
    else await mutatePilot(raw);
    scheduleNotifications(id);
    revalidatePath("/account");
    revalidatePath(`/account/projects/${id}`);
    revalidatePath(`/account/projects/${id}/options`);
    return reply({
      ok: true,
      message: "Saved. Customer-visible details are updated.",
    });
  } catch (error) {
    if (error instanceof DelhiveryError)
      return reply(
        {
          ok: false,
          message: `Delhivery did not confirm this operation (${error.code}). Check the connection or reconcile the booking before retrying.`,
        },
        502,
      );
    if (error instanceof NotificationTransportError)
      return reply(
        {
          ok: false,
          message: `Email was not confirmed (${error.code}). Check the verified sender and email provider logs before retrying.`,
        },
        502,
      );
    if (error instanceof AppError)
      return reply({ ok: false, message: error.message }, error.status);
    if (
      error instanceof JourneyError ||
      error instanceof PilotError ||
      error instanceof ShopifyError ||
      error instanceof GiftWorkspaceError
    )
      return reply({ ok: false, message: error.message }, 409);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return reply(
        { ok: false, message: "Check the required fields and amounts." },
        400,
      );
    const code =
      error && typeof error === "object" && "code" in error ? error.code : "";
    logger.error("B2C operation could not be confirmed", {
      code: typeof code === "string" ? code : "B2C_OPERATION_FAILED",
    });
    return reply(
      {
        ok: false,
        message:
          code === "42P01" || code === "42703"
            ? "Run the latest customer setup before using the B2C admin view."
            : "This operation could not be confirmed. Refresh the request before retrying.",
      },
      503,
    );
  }
}
