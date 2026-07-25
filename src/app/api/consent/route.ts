import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/database/client";
import { logger } from "@/lib/logging/logger";

const consentSchema = z.object({
  version: z.string().min(1).max(40),
  analytics: z.boolean(),
  advertising: z.boolean(),
  anonymousVisitorId: z.string().uuid().optional().nullable(),
  source: z.enum(["banner", "preferences", "withdrawal"]).default("banner"),
});

export async function POST(request: Request) {
  try {
    const body = consentSchema.parse(await request.json());
    const sql = getSql();
    await sql`
      INSERT INTO consent_records (
        consent_version, anonymous_visitor_id, necessary, analytics, advertising, source
      ) VALUES (
        ${body.version},
        ${body.anonymousVisitorId ?? null}::uuid,
        TRUE,
        ${body.analytics},
        ${body.advertising},
        ${body.source}
      )
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.warn("Consent record failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, error: "invalid_consent_payload" }, { status: 400 });
  }
}
