import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { setupReadiness, validSetupSecret } from "@/lib/security/setup-secret";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { getSql } from "@/lib/database/client";
import {
  listMigrations,
  MigrationBusyError,
  runPendingMigrations,
} from "@/lib/database/migrations";
import { logger } from "@/lib/logging/logger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function GET() {
  return reply(setupReadiness());
}
export async function POST(request: Request) {
  const h = await headers();
  try {
    assertPublicFormRateLimit({
      ip:
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        "unknown",
      formKey: "database-setup",
      limit: 10,
    });
  } catch {
    return reply(
      {
        ok: false,
        message: "Too many attempts. Wait a few minutes before trying again.",
      },
      429,
    );
  }
  if (!setupReadiness().hasSetupSecret)
    return reply(
      {
        ok: false,
        message:
          "Setup is disabled. Configure SETUP_SECRET with at least 11 characters in Vercel, then redeploy.",
      },
      503,
    );
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096)
      return reply({ ok: false, message: "Request too large." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Invalid request");
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ ok: false, message: "Invalid setup request." }, 400);
  }
  if (!validSetupSecret(body.secret ?? request.headers.get("x-setup-secret")))
    return reply({ ok: false, message: "Invalid setup secret." }, 401);
  if (!setupReadiness().hasDatabaseUrl)
    return reply(
      {
        ok: false,
        message:
          "DATABASE_URL is not configured. Set it in Vercel, then redeploy.",
      },
      503,
    );
  if (body.action !== "status" && body.action !== "migrate")
    return reply(
      { ok: false, message: "Choose check status or run migrations." },
      400,
    );
  if (body.action === "migrate" && body.confirm !== true)
    return reply(
      {
        ok: false,
        message: "Confirm that you want to apply pending migrations.",
      },
      400,
    );
  try {
    const sql = getSql();
    const applied =
      body.action === "migrate" ? await runPendingMigrations(sql) : [];
    if (body.action === "migrate")
      logger.info("Secret-protected setup migrations completed", {
        migrations: applied,
      });
    const migrations = await listMigrations(sql);
    return reply({
      ok: true,
      applied,
      migrations,
      message:
        body.action === "status"
          ? "Migration status loaded."
          : applied.length
            ? `${applied.length} migration${applied.length === 1 ? "" : "s"} applied successfully.`
            : "Your database is already up to date.",
    });
  } catch (error) {
    if (error instanceof MigrationBusyError)
      return reply({ ok: false, message: error.message }, 409);
    logger.error("Setup database operation failed", {
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "SETUP_FAILED",
    });
    return reply(
      {
        ok: false,
        message:
          "The database operation could not be confirmed. Check migration status before retrying. Verify DATABASE_URL and inspect Vercel logs. Failed transactions are rolled back.",
      },
      500,
    );
  }
}
