import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";
import { getSql } from "@/lib/database/client";
import { attemptWebhookDelivery } from "@/services/webhooks/dispatch";

async function handle(request: Request) {
  const env = getEnv();
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  const pending = await sql<{ id: string }[]>`
    SELECT id FROM webhook_deliveries
    WHERE status = 'pending'
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY created_at ASC
    LIMIT 25
  `;

  for (const row of pending) {
    await attemptWebhookDelivery(row.id);
  }

  return NextResponse.json({ ok: true, processed: pending.length });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
