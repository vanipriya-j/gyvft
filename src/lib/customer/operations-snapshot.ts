import "server-only";
import { getSql } from "@/lib/database/client";
import { nextOperatorTask } from "./next-task";

/** Operational facts shared by dashboards and reports. Samples and private drafts
 * never contribute to workload, delivery forecasts or money totals. */
export async function operationsSnapshot() {
  const sql = getSql();
  const [totals, pipeline, receipts, payments, deliveries, queue] =
    await Promise.all([
      sql`SELECT count(*) FILTER(WHERE p.stage<10)::int AS active,
      count(*) FILTER(WHERE p.stage IN(7,8))::int AS production,
      count(*) FILTER(WHERE p.stage=8)::int AS packed,
      count(*) FILTER(WHERE p.stage<10 AND p.delivery_date<(now() AT TIME ZONE 'Asia/Kolkata')::date)::int AS overdue_deliveries,
      COALESCE(sum(GREATEST(p.total_paise-p.paid_paise,0)) FILTER(WHERE p.kind='project'),0)::text AS outstanding
      FROM customer_projects p WHERE NOT p.is_draft AND COALESCE(p.submission_key,'') NOT LIKE 'gyvft-demo-%'`,
      sql`SELECT stage,count(*)::int AS count FROM customer_projects WHERE NOT is_draft AND COALESCE(submission_key,'') NOT LIKE 'gyvft-demo-%' GROUP BY stage ORDER BY stage`,
      sql`SELECT (s.verified_at AT TIME ZONE 'Asia/Kolkata')::date::text AS day,sum(s.amount_paise)::text AS amount FROM customer_payment_submissions s JOIN customer_projects p ON p.id=s.project_id WHERE s.status='verified' AND s.verified_at>=((now() AT TIME ZONE 'Asia/Kolkata')::date-29) AT TIME ZONE 'Asia/Kolkata' AND NOT p.is_draft AND COALESCE(p.submission_key,'') NOT LIKE 'gyvft-demo-%' GROUP BY 1 ORDER BY 1`,
      sql`SELECT s.id,s.project_id,p.title,p.customer_email,s.amount_paise::text,s.created_at,
      count(*) OVER()::int AS total_pending, (s.created_at<now()-interval '24 hours') AS overdue
      FROM customer_payment_submissions s JOIN customer_projects p ON p.id=s.project_id WHERE s.status='pending' AND NOT p.is_draft AND COALESCE(p.submission_key,'') NOT LIKE 'gyvft-demo-%' ORDER BY s.created_at LIMIT 5`,
      sql`SELECT id,title,customer_email,delivery_date::text,stage,GREATEST(COALESCE(total_paise,0)-paid_paise,0)::text AS balance FROM customer_projects WHERE NOT is_draft AND stage<10 AND COALESCE(submission_key,'') NOT LIKE 'gyvft-demo-%' AND delivery_date BETWEEN (now() AT TIME ZONE 'Asia/Kolkata')::date AND (now() AT TIME ZONE 'Asia/Kolkata')::date+7 ORDER BY delivery_date,created_at LIMIT 5`,
      sql`SELECT p.id,p.title,p.customer_email,p.kind,p.stage,p.task_owner,p.task_due_at,p.delivery_date::text,p.shopify_order_reference,
      (SELECT a.status FROM customer_project_approvals a WHERE a.project_id=p.id AND a.kind='proposal' ORDER BY a.version DESC LIMIT 1) AS quote_status,
      (SELECT a.status FROM customer_project_approvals a WHERE a.project_id=p.id AND a.kind='design' ORDER BY a.version DESC LIMIT 1) AS design_status,
      EXISTS(SELECT 1 FROM customer_payment_submissions s WHERE s.project_id=p.id AND s.status='pending') AS pending_payment,
      EXISTS(SELECT 1 FROM gyvft_gift_selections s WHERE s.project_id=p.id) AS has_selection,
      EXISTS(SELECT 1 FROM gyvft_gift_options o WHERE o.project_id=p.id AND o.published AND NOT o.operator_hidden) AS visible_options
      FROM customer_projects p WHERE NOT p.is_draft AND p.stage<10 AND COALESCE(p.submission_key,'') NOT LIKE 'gyvft-demo-%'
      ORDER BY pending_payment DESC,p.task_due_at NULLS LAST,p.delivery_date NULLS LAST,p.created_at LIMIT 6`,
    ]);
  const first = totals[0];
  const buckets = [
    { label: "Brief & options", stages: [0, 1, 2] },
    { label: "Quote", stages: [3] },
    { label: "Payment & artwork", stages: [4, 5, 6] },
    { label: "Production & packing", stages: [7, 8] },
    { label: "In transit", stages: [9] },
    { label: "Delivered", stages: [10, 11] },
  ];
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      active: Number(first?.active || 0),
      production: Number(first?.production || 0),
      packed: Number(first?.packed || 0),
      pendingPayments: Number(payments[0]?.total_pending || 0),
      overdueDeliveries: Number(first?.overdue_deliveries || 0),
    },
    money: {
      verifiedLast30Days: receipts.reduce(
        (sum, r) => sum + Number(r.amount),
        0,
      ),
      outstanding: Number(first?.outstanding || 0),
    },
    pipeline: buckets.map((b) => ({
      label: b.label,
      count: pipeline
        .filter((r) => b.stages.includes(Number(r.stage)))
        .reduce((n, r) => n + Number(r.count), 0),
    })),
    receipts: receipts.map((r) => ({
      day: String(r.day),
      amount: Number(r.amount),
    })),
    payments: payments.map((r) => ({
      id: String(r.id),
      projectId: String(r.project_id),
      title: String(r.title),
      email: String(r.customer_email),
      amount: Number(r.amount_paise),
      createdAt: String(r.created_at),
      overdue: Boolean(r.overdue),
    })),
    deliveries: deliveries.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      email: String(r.customer_email),
      date: String(r.delivery_date),
      stage: Number(r.stage),
      balance: Number(r.balance),
    })),
    queue: queue.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      email: String(r.customer_email),
      owner: String(r.task_owner || "Aarla"),
      due: r.task_due_at ? String(r.task_due_at) : null,
      ...nextOperatorTask(r),
    })),
  };
}
export type OperationsSnapshot = Awaited<ReturnType<typeof operationsSnapshot>>;
