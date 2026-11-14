import { NextResponse } from "next/server";
import { getPublicResendConfigStatus } from "@/services/email/public-resend";
export const dynamic = "force-dynamic";
export async function GET() {
  const mail = getPublicResendConfigStatus();
  let database: "ok" | "unavailable" | "unconfigured" = "unconfigured";
  let customerAccounts: "ready" | "setup-required" | "unavailable" =
    "unavailable";
  if (process.env.DATABASE_URL) {
    try {
      const { getSql } = await import("@/lib/database/client");
      const [row] = await getSql()<
        {
          accounts: string | null;
          sessions: string | null;
          requests: string | null;
        }[]
      >`SELECT to_regclass('public.gyvft_customer_accounts')::text AS accounts, to_regclass('public.gyvft_customer_sessions')::text AS sessions, to_regclass('public.customer_projects')::text AS requests`;
      database = "ok";
      customerAccounts =
        row.accounts && row.sessions && row.requests
          ? "ready"
          : "setup-required";
    } catch {
      database = "unavailable";
    }
  }
  const ok = database === "ok" && customerAccounts === "ready";
  return NextResponse.json(
    {
      ok,
      service: "gyvft",
      time: new Date().toISOString(),
      database,
      customerAccounts,
      mail,
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
