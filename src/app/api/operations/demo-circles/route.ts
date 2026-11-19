import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validSetupSecret } from "@/lib/security/setup-secret";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { completeDemoCircles } from "@/lib/customer/circle-demo";
import { CircleError } from "@/lib/customer/circle-model";
import { logger } from "@/lib/logging/logger";
import {
  DemoCircleFailure,
  demoCircleDiagnostic,
} from "@/lib/customer/demo-circle-diagnostic";
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
  let checkOnly = false;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1024)
      return reply({ ok: false, message: "Request too large." }, 413);
    const input = z
      .object({ confirm: z.literal(true), check_only: z.boolean().optional() })
      .strict()
      .parse(JSON.parse(raw));
    checkOnly = !!input.check_only;
    const result = input.check_only
      ? await completeDemoCircles({ checkOnly: true })
      : await completeDemoCircles();
    if (!result.checkOnly) {
      try {
        revalidatePath("/account/circles", "layout");
        revalidatePath("/account/occasions");
        revalidatePath("/account");
      } catch {
        logger.warn("Demo circles saved; page refresh could not be confirmed", {
          code: "DEMO_CIRCLES_CACHE_REFRESH_FAILED",
        });
      }
    }

    logger.info(
      result.checkOnly
        ? "Operator checked demo circles without saving"
        : "Operator completed demo circles",
      {
        inserted: result.inserted,
        corrected: result.corrected,
        checkOnly: !!result.checkOnly,
      },
    );
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
    const diagnostic =
      error instanceof DemoCircleFailure
        ? error.diagnostic
        : demoCircleDiagnostic(error);
    logger.error("Demo circle update failed", { ...diagnostic, reference });
    return reply(
      {
        ok: false,
        message:
          diagnostic.message +
          (checkOnly
            ? " The check did not save changes. Share the diagnostic below."
            : " Check current circles before another save attempt."),
        diagnostic,
        reference,
      },
      500,
    );
  }
}
