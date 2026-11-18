import "server-only";
import { getSql } from "@/lib/database/client";
import {
  dateKey,
  finiteMoney,
  nextOccasionDate,
  type Occasion,
} from "./dashboard-model";
import {
  financialYear,
  giftAction,
  pageOf,
  pageResult,
  type GiftCard,
} from "./home-model";
import { stages } from "./model";
import { storyRequestSchema } from "./story-request";
type GiftRow = {
  id: string;
  title: string;
  kind: string;
  stage: number;
  next_action: string;
  gift_brief: unknown;
  delivery_date: string | null;
  occasion_date: string | null;
  demo: boolean;
  total_paise: string;
  paid_paise: string;
  pending_kind: string | null;
  pending_payment: boolean;
  option_count: number;
  quote_requested: boolean;
  image: string | null;
};
export async function homeGifts(
  accountId: string,
  offset: number,
  limit: number,
) {
  const [result] = await getSql()<{ total: number; items: GiftRow[] }[]>`
    WITH cards AS (
      SELECT p.id,p.title,p.kind,p.stage,p.next_action,p.gift_brief,p.delivery_date,p.occasion_date,
        COALESCE(p.submission_key LIKE 'gyvft-demo-%',false) AS demo,p.total_paise::text,p.paid_paise::text,
        approval.kind AS pending_kind,
        EXISTS(SELECT 1 FROM customer_payment_submissions ps WHERE ps.project_id=p.id AND ps.status='pending') AS pending_payment,
        (SELECT count(*)::int FROM gyvft_gift_options o LEFT JOIN gyvft_gift_visibility v ON v.project_id=o.project_id AND v.option_id=o.id AND v.kind='curated'
          WHERE o.project_id=p.id AND o.published AND NOT o.operator_hidden AND NOT COALESCE(v.hidden,false)) AS option_count,
        EXISTS(SELECT 1 FROM gyvft_gift_selections s WHERE s.project_id=p.id) AS quote_requested,
        COALESCE((SELECT '/api/customer-assets/approval/' || a.id FROM customer_project_approvals a
          WHERE a.project_id=p.id AND a.image_data IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customer_project_approvals n WHERE n.project_id=a.project_id AND n.kind=a.kind AND n.version>a.version)
          ORDER BY CASE WHEN a.kind='design' THEN 0 ELSE 1 END,a.created_at DESC,a.id LIMIT 1),
          (SELECT '/api/customer-assets/gift-option/' || o.id FROM gyvft_gift_options o LEFT JOIN gyvft_gift_visibility v ON v.project_id=o.project_id AND v.option_id=o.id AND v.kind='curated'
            WHERE o.project_id=p.id AND o.published AND NOT o.operator_hidden AND NOT COALESCE(v.hidden,false) ORDER BY o.created_at,o.id LIMIT 1)) AS image,
        p.created_at
      FROM customer_projects p
      LEFT JOIN LATERAL (SELECT a.kind FROM customer_project_approvals a WHERE a.project_id=p.id AND a.status='pending'
        AND NOT EXISTS(SELECT 1 FROM customer_project_approvals n WHERE n.project_id=a.project_id AND n.kind=a.kind AND n.version>a.version)
        ORDER BY CASE WHEN a.kind='design' THEN 0 ELSE 1 END,a.created_at DESC LIMIT 1) approval ON true
      WHERE p.customer_account_id=${accountId}::uuid AND NOT p.is_draft AND p.stage<10
    ), ranked AS (
      SELECT * FROM cards ORDER BY demo,
        CASE WHEN pending_kind IS NOT NULL THEN 0
          WHEN kind='project' AND total_paise::bigint>paid_paise::bigint AND NOT pending_payment AND ((stage=4 AND paid_paise::bigint<ceil(total_paise::numeric/2)) OR stage=8) THEN 1
          WHEN kind='enquiry' AND option_count>0 AND NOT quote_requested THEN 2 ELSE 3 END,
        delivery_date NULLS LAST,created_at DESC,id
      LIMIT ${limit} OFFSET ${offset}
    ) SELECT (SELECT count(*)::int FROM cards) AS total,COALESCE((SELECT jsonb_agg(r) FROM ranked r),'[]'::jsonb) AS items`;
  const items = result.items.map((p): GiftCard => {
    const brief = storyRequestSchema.safeParse(p.gift_brief);
    return {
      id: p.id,
      title: p.title,
      stage: p.stage,
      stageLabel: stages[p.stage],
      nextAction: p.next_action,
      requestedDeliveryDate: dateKey(p.delivery_date),
      occasionDate: dateKey(p.occasion_date),
      quantityRange: brief.success ? brief.data.quantity_range || null : null,
      image: p.image,
      demo: p.demo,
      visibleOptionCount: p.option_count,
      action: giftAction({
        id: p.id,
        kind: p.kind,
        stage: p.stage,
        demo: p.demo,
        total: finiteMoney(p.total_paise),
        paid: finiteMoney(p.paid_paise),
        pendingKind: p.pending_kind,
        pendingPayment: p.pending_payment,
        options: p.option_count,
        quoteRequested: p.quote_requested,
      }),
    };
  });
  return pageResult(items, result.total, offset, limit);
}
export async function homeOccasions(
  accountId: string,
  today: string,
  offset: number,
  limit: number,
) {
  // Recurrence precedes pagination: an old birthday may be the next occasion.
  const rows = await getSql()<
    (Occasion & { source: "calendar" | "gift" })[]
  >`SELECT id,title,occasion_date::text,repeats_annually,photo_data IS NOT NULL AS has_photo,'calendar' AS source
    FROM gyvft_customer_occasions WHERE account_id=${accountId}::uuid
    UNION ALL SELECT id,title,occasion_date::text,false AS repeats_annually,false AS has_photo,'gift' AS source
    FROM customer_projects WHERE customer_account_id=${accountId}::uuid AND occasion_date IS NOT NULL AND stage<10
      AND COALESCE(submission_key NOT LIKE 'gyvft-demo-%',true)`;
  const items = rows
    .flatMap((o) => {
      const date = nextOccasionDate(o, today);
      return date
        ? [
            {
              id: o.id,
              source: o.source,
              title: o.title,
              date,
              annual: o.repeats_annually,
              daysAway: Math.round(
                (Date.parse(date + "T00:00:00Z") -
                  Date.parse(today + "T00:00:00Z")) /
                  86400000,
              ),
              image: o.has_photo
                ? `/api/customer-assets/occasion/${o.id}`
                : null,
              action: {
                label: o.source === "gift" ? "View gift" : "Plan a gift",
                href:
                  o.source === "gift"
                    ? `/account/projects/${o.id}`
                    : "/tell-your-story",
              },
            },
          ]
        : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return pageOf(items, offset, limit);
}
export async function homePayments(
  accountId: string,
  today: string,
  offset: number,
  limit: number,
) {
  const period = financialYear(today),
    sql = getSql();
  const [summary, receipts] = await Promise.all([
    sql`SELECT
      (SELECT COALESCE(sum(s.amount_paise),0)::text FROM customer_payment_submissions s JOIN customer_projects p ON p.id=s.project_id
        WHERE p.customer_account_id=${accountId}::uuid AND p.kind='project' AND COALESCE(p.submission_key NOT LIKE 'gyvft-demo-%',true)
        AND s.status='verified' AND s.verified_at>=(${period.start}::date::timestamp AT TIME ZONE 'Asia/Kolkata')
        AND s.verified_at<(${period.endExclusive}::date::timestamp AT TIME ZONE 'Asia/Kolkata')) AS fy_paid,
      count(*) FILTER(WHERE p.stage>=10)::int AS completed_gifts,
      COALESCE(sum(GREATEST(0,p.total_paise-p.paid_paise)) FILTER(WHERE p.stage<10),0)::text AS outstanding,
      count(*) FILTER(WHERE p.stage<10 AND p.total_paise>p.paid_paise AND ((p.stage=4 AND p.paid_paise<ceil(p.total_paise::numeric/2)) OR p.stage=8)
        AND NOT EXISTS(SELECT 1 FROM customer_payment_submissions s WHERE s.project_id=p.id AND s.status='pending'))::int AS due_count,
      count(*) FILTER(WHERE EXISTS(SELECT 1 FROM customer_payment_submissions s WHERE s.project_id=p.id AND s.status='pending'))::int AS pending_count,
      (SELECT count(*)::int FROM customer_payment_submissions s JOIN customer_projects q ON q.id=s.project_id
        WHERE q.customer_account_id=${accountId}::uuid AND q.kind='project' AND COALESCE(q.submission_key NOT LIKE 'gyvft-demo-%',true) AND s.status='verified') AS receipt_count
      FROM customer_projects p WHERE p.customer_account_id=${accountId}::uuid AND p.kind='project' AND COALESCE(p.submission_key NOT LIKE 'gyvft-demo-%',true)`,
    sql`SELECT s.id,p.id AS project_id,p.title,s.amount_paise::text,s.verified_at::text
      FROM customer_payment_submissions s JOIN customer_projects p ON p.id=s.project_id
      WHERE p.customer_account_id=${accountId}::uuid AND p.kind='project' AND COALESCE(p.submission_key NOT LIKE 'gyvft-demo-%',true) AND s.status='verified'
      ORDER BY s.verified_at DESC NULLS LAST,s.id LIMIT ${limit} OFFSET ${offset}`,
  ]);
  const s = summary[0];
  return {
    currency: "INR" as const,
    financialYear: period,
    paidThisFinancialYearPaise: finiteMoney(s.fy_paid),
    completedGifts: s.completed_gifts as number,
    completedGiftsPeriod: "all_time" as const,
    outstandingPaise: finiteMoney(s.outstanding),
    dueGiftCount: s.due_count as number,
    pendingVerificationGiftCount: s.pending_count as number,
    receipts: pageResult(
      receipts.map((r) => ({
        id: r.id as string,
        projectId: r.project_id as string,
        title: r.title as string,
        amountPaise: finiteMoney(r.amount_paise),
        verifiedAt: r.verified_at as string | null,
        href: `/account/projects/${r.project_id}`,
        kind: "verified_payment" as const,
      })),
      s.receipt_count as number,
      offset,
      limit,
    ),
  };
}
