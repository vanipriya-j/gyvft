import "server-only";
import { after } from "next/server";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { logger } from "@/lib/logging/logger";
import { demoAccountIds } from "./demo-accounts";
import { notificationUrl, notificationText } from "./notification-model";
import { paymentRequestEmail } from "./payment-request-email";
import {
  NotificationTransportError,
  sendNotificationEmail,
} from "@/services/notifications/transports";

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
  await sql`INSERT INTO gyvft_customer_notifications(event_key,project_id,recipient,destination,subject)
    SELECT ${eventKey},id,${to},${destination},${subject} FROM customer_projects
    WHERE id=${projectId}::uuid AND COALESCE(submission_key,'') NOT LIKE 'gyvft-demo-%'
    AND (customer_account_id IS NULL OR customer_account_id NOT IN ${sql(demoAccountIds)})
    ON CONFLICT(event_key) DO NOTHING`;
}
type Job = {
  event_key: string;
  id: string;
  project_id: string;
  recipient: string;
  destination: string;
  subject: string;
  attempts: number;
};
/** Bounded, concurrency-safe recovery of the existing customer email outbox. */
export async function deliverNotifications(projectId?: string) {
  const sql = getSql();
  if (!process.env.RESEND_API_KEY) return { candidates: 0, accepted: 0 };
  const jobs = await sql<
    Job[]
  >`UPDATE gyvft_customer_notifications SET state='sending',attempts=attempts+1,attempted_at=now()
    WHERE id IN (SELECT n.id FROM gyvft_customer_notifications n JOIN customer_projects p ON p.id=n.project_id
      LEFT JOIN gyvft_customer_accounts a ON a.id=p.customer_account_id
      WHERE (${projectId || null}::uuid IS NULL OR project_id=${projectId || null}::uuid)
      AND (state='pending' OR (state='failed' AND attempted_at<now()-interval '2 minutes') OR (state='sending' AND attempted_at<now()-interval '5 minutes')) AND attempts<8
      -- Resend's deduplication window is 24 h. Conservatively stop retries at
      -- 23 h from creation; queued emails that were never attempted may send.
      AND (attempted_at IS NULL OR n.created_at>now()-interval '23 hours')
      AND COALESCE(p.submission_key,'') NOT LIKE 'gyvft-demo-%'
      AND (p.customer_account_id IS NULL OR (p.customer_account_id NOT IN ${sql(demoAccountIds)} AND a.is_active))
      ORDER BY n.created_at LIMIT 4 FOR UPDATE OF n SKIP LOCKED) RETURNING *`;
  let accepted = 0;
  for (let start = 0; start < jobs.length; start += 2) {
    if (start) await new Promise((resolve) => setTimeout(resolve, 1100));
    await Promise.all(
      jobs.slice(start, start + 2).map(async (job) => {
        try {
          const payment = await paymentRequestEmail(sql, job.event_key);
          if (payment?.superseded) {
            await sql`UPDATE gyvft_customer_notifications SET state='failed',attempts=8 WHERE id=${job.id}::uuid AND state='sending' AND attempts=${job.attempts}`;
            return;
          }
          const url = notificationUrl(job.project_id, job.destination);
          const input = {
            id: job.id,
            to: job.recipient,
            subject: job.subject,
            text: payment?.text || notificationText(url),
          };
          try {
            await sendNotificationEmail(input);
          } catch (error) {
            // One prompt retry handles transient failures without waiting for cron.
            // Both sends share the same Resend idempotency key and immutable body.
            if (error instanceof NotificationTransportError && !error.retryable)
              throw error;
            await new Promise((resolve) => setTimeout(resolve, 1200));
            await sendNotificationEmail(input);
          }
          await sql`UPDATE gyvft_customer_notifications SET state='sent',sent_at=now() WHERE id=${job.id}::uuid AND state='sending' AND attempts=${job.attempts}`;
          accepted++;
        } catch (error) {
          await sql`UPDATE gyvft_customer_notifications SET state='failed' WHERE id=${job.id}::uuid AND state='sending' AND attempts=${job.attempts}`;
          logger.warn("Customer notification delivery pending", {
            code:
              error instanceof NotificationTransportError
                ? error.code
                : "CUSTOMER_MAIL_PENDING",
            notificationId: job.id,
          });
        }
      }),
    );
  }
  return { candidates: jobs.length, accepted };
}
export function scheduleNotifications(id: string) {
  if (process.env.RESEND_API_KEY)
    after(async () => {
      try {
        await deliverNotifications(id);
      } catch {
        logger.warn("Customer notification recovery needed", {
          code: "NOTIFICATION_RETRY_NEEDED",
        });
      }
    });
}
