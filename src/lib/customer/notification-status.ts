import "server-only";
import { getSql } from "@/lib/database/client";
export async function notificationRows(projectId?: string) {
  return getSql()`SELECT id,destination,state,attempts,created_at,attempted_at,
    attempts<8 AND (attempted_at IS NULL OR created_at>now()-interval '23 hours') AS can_retry
    FROM gyvft_customer_notifications WHERE (${projectId || null}::uuid IS NULL OR project_id=${projectId || null}::uuid)
    ORDER BY created_at DESC LIMIT 20`;
}
export async function notificationStatus() {
  const [summary] =
    await getSql()`SELECT count(*) FILTER(WHERE state='pending')::int AS queued,
    count(*) FILTER(WHERE state='sending' AND attempted_at>now()-interval '5 minutes')::int AS sending,
    count(*) FILTER(WHERE state='failed' OR (state='sending' AND attempted_at<=now()-interval '5 minutes'))::int AS attention
    FROM gyvft_customer_notifications`;
  return {
    emailConfigured: !!process.env.RESEND_API_KEY,
    retryConfigured: !!process.env.CRON_SECRET,
    summary: {
      queued: Number(summary.queued),
      sending: Number(summary.sending),
      attention: Number(summary.attention),
    },
    notifications: await notificationRows(),
  };
}
export type NotificationStatus = Awaited<ReturnType<typeof notificationStatus>>;
