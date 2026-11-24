import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PUBLIC_EVENT_NAMES } from "@/config/constants";
import { recordAnalyticsEvent } from "@/repositories/events";
import { analyticsPage, googleParameters } from "@/lib/analytics/model";
import { customerJson } from "@/lib/customer/api";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";

const eventSchema = z.object({
  eventName: z.enum(PUBLIC_EVENT_NAMES as unknown as [string, ...string[]]),
  sourceRoute: z.string().max(300).optional(),
  anonymousVisitorId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  properties: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
});

export async function POST(request: Request) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return NextResponse.json({ ok: false }, { status: 403 });
  try {
    assertPublicFormRateLimit({
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown",
      formKey: "analytics",
      limit: 120,
      windowMs: 60000,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const parsed = eventSchema.safeParse(
    await customerJson(request, 8192).catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let route: URL;
  try {
    route = new URL(parsed.data.sourceRoute || "/", "https://www.gyvft.com");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const page =
    route.origin === "https://www.gyvft.com"
      ? analyticsPage(route.pathname, route.search)
      : null;
  if (parsed.data.properties.consentAnalytics !== true || !page)
    return NextResponse.json({ ok: true, recorded: false });

  try {
    await recordAnalyticsEvent({
      eventName: parsed.data.eventName,
      eventId: randomUUID(),
      correlationId: randomUUID(),
      anonymousVisitorId: parsed.data.anonymousVisitorId,
      sessionId: parsed.data.sessionId,
      sourceRoute: page.path,
      properties: googleParameters(parsed.data.properties),
      consentAnalytics: true,
      consentAdvertising: false,
    });
  } catch {
    return NextResponse.json({ ok: true, recorded: false });
  }

  return NextResponse.json({ ok: true, recorded: true });
}
