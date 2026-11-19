import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validSetupSecret } from "@/lib/security/setup-secret";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { completeDemoCircles } from "@/lib/customer/circle-demo";
import { CircleError } from "@/lib/customer/circle-model";
import { logger } from "@/lib/logging/logger";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function POST(request: Request) {
  try {
    assertPublicFormRateLimit({
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown",
      formKey: "operator-demo-circles",
      limit: 8,
      windowMs: 3600000,
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
  if (!validSetupSecret(request.headers.get("x-setup-secret")))
    return reply(
      { ok: false, message: "Operator access could not be verified." },
      401,
    );
  if (!process.env.DATABASE_URL)
    return reply(
      { ok: false, message: "The database connection is unavailable." },
      503,
    );
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1024)
      return reply({ ok: false, message: "Request too large." }, 413);
    z.object({ confirm: z.literal(true) })
      .strict()
      .parse(JSON.parse(raw));
    const result = await completeDemoCircles();
    revalidatePath("/account/circles", "layout");
    revalidatePath("/account/occasions");
    revalidatePath("/account");
    logger.info("Operator completed demo circles", {
      inserted: result.inserted,
      corrected: result.corrected,
    });
    return reply({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CircleError)
      return reply({ ok: false, message: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return reply(
        {
          ok: false,
          message: "Confirm updating the four fictional demo workspaces.",
        },
        400,
      );
    const reference = randomUUID();
    logger.error("Demo circle update failed", {
      code: "DEMO_CIRCLES_FAILED",
      reference,
    });
    return reply(
      {
        ok: false,
        message:
          "No partial update was committed. Check the server log using this reference.",
        reference,
      },
      500,
    );
  }
}
