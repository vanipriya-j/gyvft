import { refreshDueShipments } from "@/lib/customer/shipping";
import { equalSecret } from "@/services/notifications/security";
import { logger } from "@/lib/logging/logger";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !equalSecret(request.headers.get("authorization") || "", `Bearer ${secret}`)
  )
    return Response.json({ ok: false }, { status: 401 });
  try {
    return Response.json(
      { ok: true, ...(await refreshDueShipments()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    logger.warn("Shipping tracking recovery failed", {
      code: "SHIPPING_RECOVERY_FAILED",
    });
    return Response.json({ ok: false }, { status: 503 });
  }
}
