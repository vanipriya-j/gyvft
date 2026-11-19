import { CircleError } from "@/lib/customer/circle-model";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validSetupSecret } from "@/lib/security/setup-secret";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { DemoSeedConflict, seedCustomerDemos } from "@/lib/customer/demo-seed";
import { logger } from "@/lib/logging/logger";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
export async function POST(request: Request) {
  try {
    assertPublicFormRateLimit({
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown",
      formKey: "operator-demo-data",
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
  let data: z.infer<typeof input>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096)
      return reply({ ok: false, message: "Request too large." }, 413);
    data = input.parse(JSON.parse(raw));
  } catch {
    return reply(
      {
        ok: false,
        message:
          "Choose a demo password of 8–128 characters and confirm adding the four fictional accounts.",
      },
      400,
    );
  }
  try {
    const result = await seedCustomerDemos(data.password);
    revalidatePath("/account", "layout");
    logger.info("Operator added fictional customer demos", {
      inserted: result.inserted,
      accounts: result.accounts.length,
    });
    return reply({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CircleError)
      return reply({ ok: false, message: error.message }, error.status);
    if (error instanceof DemoSeedConflict)
      return reply({ ok: false, message: error.message }, 409);
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      /^[0-9]{2}[A-Z0-9]{3}$/.test(error.code)
        ? error.code
        : "DEMO_SEED_FAILED";
    const reference = randomUUID();
    logger.error("Demo data addition failed", { code, reference });
    return reply(
      {
        ok: false,
        message:
          code === "42P01" || code === "42703"
            ? "The existing customer schema is incomplete. No demo data was committed and no migration was run."
            : "Demo data could not be added. No partial batch was committed. Check the server log using this reference.",
        reference,
      },
      500,
    );
  }
}
const input = z
  .object({ password: z.string().min(8).max(128), confirm: z.literal(true) })
  .strict();
