import { scheduleNotifications } from "@/lib/customer/notifications";
import { after } from "next/server";
import { z } from "zod";
import { customerApi, customerReply } from "@/lib/customer/api";
import {
  shipmentsForProject,
  refreshDueShipments,
} from "@/lib/customer/shipping";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  return customerApi(request, false, async (account) => {
    const id = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("project_id"));
    const shipping = await shipmentsForProject(id, account.id);
    if (shipping.plan)
      after(async () => {
        try {
          await refreshDueShipments(id);
          scheduleNotifications(id);
        } catch {
          /* Retry on the next eligible read or recovery job. */
        }
      });
    return customerReply({ ok: true, shipping });
  });
}
