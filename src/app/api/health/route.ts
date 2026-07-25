import { NextResponse } from "next/server";
import { getSql } from "@/lib/database/client";

export async function GET() {
  try {
    const sql = getSql();
    await sql`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "gyvft",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, service: "gyvft", error: "database_unavailable" },
      { status: 503 },
    );
  }
}
