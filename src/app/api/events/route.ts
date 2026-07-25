import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PUBLIC_EVENT_NAMES } from "@/config/constants";
import { recordAnalyticsEvent } from "@/repositories/events";

const eventSchema = z.object({
  eventName: z.enum(PUBLIC_EVENT_NAMES as unknown as [string, ...string[]]),
  sourceRoute: z.string().max(300).optional(),
  properties: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
});

export async function POST(request: Request) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await recordAnalyticsEvent({
      eventName: parsed.data.eventName,
      eventId: randomUUID(),
      correlationId: randomUUID(),
      sourceRoute: parsed.data.sourceRoute ?? null,
      properties: parsed.data.properties,
      consentAnalytics: Boolean(parsed.data.properties.consentAnalytics),
      consentAdvertising: false,
    });
  } catch {
    return NextResponse.json({ ok: true, recorded: false });
  }

  return NextResponse.json({ ok: true, recorded: true });
}
