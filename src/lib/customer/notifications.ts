import "server-only";
import { after } from "next/server";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { sendPublicResendEmail } from "@/services/email/public-resend";
import { logger } from "@/lib/logging/logger";
export async function queueNotification(
  sql: Sql,
  projectId: string,
  eventKey: string,
  destination: "customer" | "team",
  email: string,
  subject: string,
) {
  const to =
    destination === "team"
      ? process.env.GYVFT_LEADS_EMAIL ||
        process.env.RESEND_FROM_EMAIL ||
        "aarla@aarla.in"
      : email;
  await sql`INSERT INTO gyvft_customer_notifications(event_key,project_id,recipient,destination,subject) SELECT ${eventKey},id,${to},${destination},${subject} FROM customer_projects WHERE id=${projectId}::uuid AND COALESCE(submission_key,'') NOT LIKE 'gyvft-demo-%' ON CONFLICT(event_key) DO NOTHING`;
}
export async function deliverNotifications(projectId: string) {
  const sql = getSql();
  const jobs = await sql<
    { id: string; recipient: string; destination: string; subject: string }[]
  >`UPDATE gyvft_customer_notifications SET state='sending',attempts=attempts+1,attempted_at=now() WHERE id IN (SELECT id FROM gyvft_customer_notifications WHERE project_id=${projectId}::uuid AND (state IN ('pending','failed') OR (state='sending' AND attempted_at<now()-interval '5 minutes')) AND attempts<8 ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING id,recipient,destination,subject`;
  for (const job of jobs) {
    try {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.NODE_ENV === "production"
          ? "https://www.gyvft.com"
          : "http://localhost:3000");
      const url = new URL(
        job.destination === "team"
          ? `/operations/requests?request=${projectId}`
          : `/account/projects/${projectId}`,
        origin,
      );
      await sendPublicResendEmail({
        to: job.recipient,
        idempotencyKey: `gyvft-notification-${job.id}`,
        subject: job.subject,
        text: `There is an update to your GYVFT request. Sign in to view it securely:\n\n${url.href}\n\nYour story. Our telling.`,
      });
      await sql`UPDATE gyvft_customer_notifications SET state='sent',sent_at=now() WHERE id=${job.id}::uuid`;
    } catch {
      await sql`UPDATE gyvft_customer_notifications SET state='failed' WHERE id=${job.id}::uuid`;
      logger.warn("Customer notification delivery pending", {
        code: "CUSTOMER_MAIL_PENDING",
      });
    }
  }
}

export function scheduleNotifications(id: string) {
  if (process.env.RESEND_API_KEY)
    after(async () => {
      try {
        await deliverNotifications(id);
      } catch {
        logger.warn("Customer notification retry needed", {
          code: "MAIL_RETRY_NEEDED",
        });
      }
    });
}
