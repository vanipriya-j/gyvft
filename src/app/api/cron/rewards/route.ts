import { equalSecret } from "@/services/notifications/security";
import { rewardsReady, rewardSettings } from "@/lib/rewards/store";
import { syncRewardOrders } from "@/lib/rewards/sync";
import { reconcileDueRewards } from "@/lib/rewards/service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    !equalSecret(
      request.headers.get("authorization") || "",
      `Bearer ${process.env.CRON_SECRET}`,
    )
  )
    return Response.json({ ok: false }, { status: 401 });
  const headers = { "Cache-Control": "no-store" };
  if (!(await rewardsReady()))
    return Response.json(
      { ok: true, skipped: "Rewards setup pending" },
      { headers },
    );
  const settings = await rewardSettings();
  if (!settings.collection_id)
    return Response.json(
      { ok: true, skipped: "Retail collection setup pending" },
      { headers },
    );
  try {
    const started = Date.now();
    const orders = await syncRewardOrders(20000);
    const coupons = await reconcileDueRewards(
      20,
      Math.max(0, 35000 - (Date.now() - started)),
    );
    return Response.json({ ok: true, coupons, orders }, { headers });
  } catch {
    return Response.json(
      { ok: false, message: "Rewards reconciliation needs Operations review." },
      { status: 503, headers },
    );
  }
}
