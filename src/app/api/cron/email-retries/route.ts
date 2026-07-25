import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";
import { getSql } from "@/lib/database/client";
import { sendTransactionalEmail } from "@/services/email/send";

async function handle(request: Request) {
  const env = getEnv();
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  const failed = await sql<
    {
      id: string;
      template_key: string;
      to_addresses: string[];
      subject: string;
      opportunity_id: string | null;
      metadata: Record<string, unknown>;
      attempt_number: number;
    }[]
  >`
    SELECT id, template_key, to_addresses, subject, opportunity_id, metadata, attempt_number
    FROM email_deliveries
    WHERE status = 'failed'
      AND attempt_number < 5
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY created_at ASC
    LIMIT 20
  `;

  let retried = 0;
  for (const row of failed) {
    await sql`
      UPDATE email_deliveries
      SET attempt_number = attempt_number + 1, status = 'queued', updated_at = NOW()
      WHERE id = ${row.id}::uuid
    `;
    try {
      await sendTransactionalEmail({
        templateKey: row.template_key,
        to: row.to_addresses,
        subject: row.subject,
        opportunityId: row.opportunity_id ?? undefined,
        variables: row.metadata,
      });
      retried += 1;
    } catch {
      // failures are logged inside sendTransactionalEmail
    }
  }

  return NextResponse.json({ ok: true, retried, candidates: failed.length });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
