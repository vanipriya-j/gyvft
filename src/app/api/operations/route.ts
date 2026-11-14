import { NextResponse } from "next/server";
import { validSetupSecret } from "@/lib/security/setup-secret";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { getSql } from "@/lib/database/client";
import {
  sanitizeCustomerEventMetadata,
  customerEventTypes,
} from "@/lib/customer/observability";
import { stages, uuidPattern } from "@/lib/customer/model";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, no-transform", Pragma: "no-cache" },
  });
const count = (value: unknown) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
};
export async function POST(request: Request) {
  try {
    assertPublicFormRateLimit({
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown",
      formKey: "customer-operations",
      limit: 20,
    });
  } catch {
    return reply(
      {
        ok: false,
        message: "Too many attempts. Please wait before trying again.",
      },
      429,
    );
  }
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096)
      return reply({ ok: false, message: "Request too large." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ ok: false, message: "Invalid reporting request." }, 400);
  }
  if (!validSetupSecret(body.secret ?? request.headers.get("x-setup-secret")))
    return reply(
      { ok: false, message: "Operator access could not be verified." },
      401,
    );
  try {
    const sql = getSql();
    const [
      accounts,
      sessions,
      requests,
      funnel,
      statusRows,
      eventRows,
      errorRows,
    ] = await Promise.all([
      sql<
        { total: string; recent: string }[]
      >`SELECT count(*)::text AS total, count(*) FILTER (WHERE created_at >= now() - interval '30 days')::text AS recent FROM gyvft_customer_accounts`,
      sql<
        { active: string; active_accounts: string }[]
      >`SELECT count(*)::text AS active, count(DISTINCT account_id)::text AS active_accounts FROM gyvft_customer_sessions s JOIN gyvft_customer_accounts a ON a.id = s.account_id WHERE s.expires_at > now() AND a.is_active = true`,
      sql<
        { total: string; recent: string; converted: string }[]
      >`SELECT count(*)::text AS total, count(*) FILTER (WHERE created_at >= now() - interval '30 days')::text AS recent, count(*) FILTER (WHERE kind = 'project')::text AS converted FROM customer_projects WHERE COALESCE(submission_key, '') NOT LIKE 'gyvft-demo-%'`,
      sql<
        { accounts_with_requests: string }[]
      >`SELECT count(DISTINCT customer_account_id)::text AS accounts_with_requests FROM customer_projects WHERE customer_account_id IS NOT NULL AND COALESCE(submission_key, '') NOT LIKE 'gyvft-demo-%'`,
      sql<
        { stage: number; count: string }[]
      >`SELECT stage, count(*)::text AS count FROM customer_projects WHERE COALESCE(submission_key, '') NOT LIKE 'gyvft-demo-%' GROUP BY stage ORDER BY stage`,
      sql<
        { event_type: string; count: string }[]
      >`SELECT event_type, count(*)::text AS count FROM gyvft_customer_events WHERE created_at >= now() - interval '30 days' GROUP BY event_type ORDER BY event_type`,
      sql<
        {
          event_type: string;
          request_id: string;
          metadata: unknown;
          created_at: string;
        }[]
      >`SELECT event_type, request_id, metadata, created_at FROM gyvft_customer_events WHERE event_type IN ('app.error', 'session.failed', 'setup.failed') AND created_at >= now() - interval '30 days' ORDER BY created_at DESC LIMIT 30`,
    ]);
    const metrics = [
      {
        key: "accounts_total",
        label: "Customer accounts",
        value: count(accounts[0]?.total),
      },
      {
        key: "accounts_30d",
        label: "Accounts created · 30 days",
        value: count(accounts[0]?.recent),
      },
      {
        key: "active_sessions",
        label: "Active sessions",
        value: count(sessions[0]?.active),
      },
      {
        key: "active_accounts",
        label: "Accounts with active sessions",
        value: count(sessions[0]?.active_accounts),
      },
      {
        key: "enquiries_total",
        label: "Real enquiries / projects",
        value: count(requests[0]?.total),
      },
      {
        key: "enquiries_30d",
        label: "Real enquiries · 30 days",
        value: count(requests[0]?.recent),
      },
      {
        key: "accounts_with_requests",
        label: "Accounts with real enquiries",
        value: count(funnel[0]?.accounts_with_requests),
      },
      {
        key: "converted_projects",
        label: "Converted project records",
        value: count(requests[0]?.converted),
      },
      {
        key: "signin_failures_30d",
        label: "Sign-in failures · 30 days",
        value: count(
          eventRows.find((row) => row.event_type === "session.failed")?.count,
        ),
      },
      {
        key: "errors_30d",
        label: "Application errors · 30 days",
        value: count(
          eventRows.find((row) => row.event_type === "app.error")?.count,
        ),
      },
    ];
    return reply({
      ok: true,
      generatedAt: new Date().toISOString(),
      windowDays: 30,
      health: { database: "ok", reporting: "ok" },
      metrics,
      byStatus: statusRows
        .filter(
          (row) =>
            Number.isInteger(Number(row.stage)) &&
            Number(row.stage) >= 0 &&
            Number(row.stage) < stages.length,
        )
        .map((row) => ({
          stage: Number(row.stage),
          label: stages[Number(row.stage)],
          count: count(row.count),
        })),
      events: eventRows
        .filter((row) =>
          customerEventTypes.some((type) => type === row.event_type),
        )
        .map((row) => ({ type: row.event_type, count: count(row.count) })),
      recentErrors: errorRows
        .filter((row) =>
          ["app.error", "session.failed", "setup.failed"].includes(
            row.event_type,
          ),
        )
        .map((row) => ({
          type: row.event_type,
          requestId: uuidPattern.test(row.request_id)
            ? row.request_id
            : undefined,
          ...sanitizeCustomerEventMetadata(row.metadata),
          createdAt: row.created_at,
        })),
    });
  } catch {
    return reply(
      {
        ok: false,
        message:
          "Reporting is unavailable. Confirm the latest customer setup update has completed, then try again.",
      },
      503,
    );
  }
}
