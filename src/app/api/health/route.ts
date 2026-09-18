import { NextResponse } from "next/server";
import { getPublicResendConfigStatus } from "@/services/email/public-resend";

export async function GET() {
  const mail = getPublicResendConfigStatus();

  // Public site can run without a database; only report DB when configured.
  let database: "ok" | "unavailable" | "unconfigured" = "unconfigured";
  if (process.env.DATABASE_URL) {
    try {
      const { getSql } = await import("@/lib/database/client");
      const sql = getSql();
      await sql`SELECT 1`;
      database = "ok";
    } catch {
      database = "unavailable";
    }
  }

  const ok = mail.configured;
  return NextResponse.json(
    {
      ok,
      service: "gyvft",
      time: new Date().toISOString(),
      mail,
      database,
    },
    { status: ok ? 200 : 503 },
  );
}
