import "server-only";
import { z } from "zod";
import { getSql } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { analyticsConfiguration } from "@/lib/analytics/config";
import { demoAccountIds } from "./demo-accounts";
import { conversionFacts, type ConversionProject } from "./conversion-model";

export const conversionInput = z.object({
  window_days: z
    .union([z.literal(30), z.literal(90), z.literal(365), z.literal(0)])
    .default(90),
  stalled_days: z.number().int().min(1).max(30).default(3),
});

export async function conversionReport(
  raw: unknown,
  sql = getSql(),
  asOf = new Date(),
) {
  const input = conversionInput.parse(raw),
    now = asOf.toISOString();
  const since = new Date(
    input.window_days ? asOf.getTime() - input.window_days * 86400000 : 0,
  ).toISOString();
  const [projects, accounts, drafts] = await Promise.all([
    sql<
      ConversionProject[]
    >`SELECT p.id,p.title,p.customer_email,p.created_at,p.stage,p.kind,p.task_owner,
      COALESCE(p.shopify_order_reference,p.shopify_order_id) AS shopify_order_reference,
      EXISTS(SELECT 1 FROM gyvft_gift_options o WHERE o.project_id=p.id AND o.published) AS has_options,
      EXISTS(SELECT 1 FROM gyvft_gift_options o WHERE o.project_id=p.id AND o.published AND NOT o.operator_hidden) AS visible_options,
      EXISTS(SELECT 1 FROM gyvft_gift_selections s WHERE s.project_id=p.id) AS has_selection,
      EXISTS(SELECT 1 FROM customer_project_approvals a WHERE a.project_id=p.id AND a.kind='proposal' AND a.created_at<=${now}::timestamptz) AS has_quote,
      EXISTS(SELECT 1 FROM customer_project_approvals a WHERE a.project_id=p.id AND a.kind='proposal' AND a.status='approved' AND COALESCE(a.decided_at,a.created_at)<=${now}::timestamptz) AS approved_quote,
      EXISTS(SELECT 1 FROM customer_payment_submissions s WHERE s.project_id=p.id AND s.status='verified' AND COALESCE(s.verified_at,s.created_at)<=${now}::timestamptz) AS verified_payment,
      EXISTS(SELECT 1 FROM customer_payment_submissions s WHERE s.project_id=p.id AND s.status='pending') AS pending_payment,
      COALESCE((SELECT sum(s.amount_paise)::text FROM customer_payment_submissions s WHERE s.project_id=p.id AND s.status='verified' AND COALESCE(s.verified_at,s.created_at)<=${now}::timestamptz),'0') AS paid_paise,
      q.status AS quote_status,d.status AS design_status,COALESCE(q.amount_paise,0)::text AS quote_paise,
      GREATEST(q.created_at,d.created_at,(SELECT max(o.created_at) FROM gyvft_gift_options o WHERE o.project_id=p.id AND o.published AND NOT o.operator_hidden)) AS shared_at,
      GREATEST(q.decided_at,d.decided_at) AS decided_at,
      (SELECT max(m.created_at) FROM customer_project_messages m WHERE m.project_id=p.id AND m.sender='customer') AS last_customer,
      (SELECT max(m.created_at) FROM customer_project_messages m WHERE m.project_id=p.id AND m.sender='team') AS last_team,
      GREATEST((SELECT max(s.created_at) FROM gyvft_gift_selections s WHERE s.project_id=p.id),
        (SELECT max(r.created_at) FROM gyvft_gift_brief_revisions r WHERE r.project_id=p.id),
        (SELECT max(s.created_at) FROM customer_payment_submissions s WHERE s.project_id=p.id)) AS last_activity
      FROM customer_projects p
      LEFT JOIN LATERAL (SELECT status,amount_paise,created_at,decided_at FROM customer_project_approvals a WHERE a.project_id=p.id AND a.kind='proposal' ORDER BY version DESC LIMIT 1) q ON true
      LEFT JOIN LATERAL (SELECT status,created_at,decided_at FROM customer_project_approvals a WHERE a.project_id=p.id AND a.kind='design' ORDER BY version DESC LIMIT 1) d ON true
      WHERE NOT p.is_draft AND COALESCE(p.submission_key,'') NOT LIKE 'gyvft-demo-%'
        AND (p.customer_account_id IS NULL OR NOT(p.customer_account_id=ANY(${demoAccountIds}::uuid[])))
        AND p.created_at<=${now}::timestamptz
        AND (p.created_at>=${since}::timestamptz OR p.stage<7)
      ORDER BY p.created_at DESC LIMIT 10001`,
    sql`SELECT count(*)::int AS registered,
      count(*) FILTER(WHERE EXISTS(SELECT 1 FROM customer_projects p WHERE p.customer_account_id=a.id AND NOT p.is_draft AND COALESCE(p.submission_key,'') NOT LIKE 'gyvft-demo-%' AND p.created_at<=${now}::timestamptz))::int AS with_request
      FROM gyvft_customer_accounts a WHERE NOT(a.id=ANY(${demoAccountIds}::uuid[])) AND a.created_at BETWEEN ${since}::timestamptz AND ${now}::timestamptz`,
    sql`SELECT count(*)::int AS saved FROM customer_projects p WHERE p.is_draft AND COALESCE(p.submission_key,'') NOT LIKE 'gyvft-demo-%' AND (p.customer_account_id IS NULL OR NOT(p.customer_account_id=ANY(${demoAccountIds}::uuid[]))) AND p.created_at<=${now}::timestamptz`,
  ]);
  if (projects.length > 10000)
    throw new AppError(
      "CONFLICT",
      "This reporting range is too large. Choose a shorter period.",
    );
  return {
    ...conversionFacts(
      projects,
      { windowDays: input.window_days, stalledDays: input.stalled_days },
      asOf,
    ),
    accounts: {
      registered: Number(accounts[0]?.registered || 0),
      withRequest: Number(accounts[0]?.with_request || 0),
    },
    savedPrivateBriefs: Number(drafts[0]?.saved || 0),
    googleAnalytics: {
      configured: analyticsConfiguration() !== null,
      url: "https://analytics.google.com/",
    },
  };
}
export type ConversionReport = Awaited<ReturnType<typeof conversionReport>>;
