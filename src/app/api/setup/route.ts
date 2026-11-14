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
import { migrationDiagnostic } from "@/lib/database/migration-diagnostic";
import type { MigrationProgress } from "@/lib/database/migration-progress";
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
  async function execute(onProgress?: (event: MigrationProgress) => void) {
    try {
      const sql = getSql();
      const applied =
        body.action === "migrate"
          ? await runPendingMigrations(sql, onProgress)
          : [];
      if (body.action === "migrate")
        logger.info("Secret-protected setup migrations completed", {
          migrations: applied,
        });
      try {
        const migrations = await listMigrations(sql);
        return {
          status: 200,
          result: {
            ok: true,
            applied,
            migrations,
            message:
              body.action === "status"
                ? "Migration status loaded."
                : applied.length
                  ? `${applied.length} update${applied.length === 1 ? "" : "s"} saved. Your database is ready.`
                  : "No updates needed. Your database is ready.",
          },
        };
      } catch (error) {
        // A committed migration batch must never be described as rolled back.
        if (body.action !== "migrate") throw error;
        return {
          status: 200,
          result: {
            ok: true,
            applied,
            message:
              "Database updates were saved. The history list could not be refreshed.",
          },
        };
      }
    } catch (error) {
      if (error instanceof MigrationBusyError)
        return { status: 409, result: { ok: false, message: error.message } };
      const diagnostic = migrationDiagnostic(error);
      logger.error("Setup database operation failed", {
        code: diagnostic.code,
        migration: diagnostic.filename,
      });
      return {
        status: 500,
        result: {
          ok: false,
          message: diagnostic.message,
          diagnostic: { code: diagnostic.code, filename: diagnostic.filename },
        },
      };
    }
  }
  if (body.stream === true && body.action === "migrate") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            /* Browser disconnected; let the database finish safely. */
          }
        };
        send({
          type: "progress",
          progress: { phase: "checking", total: 0, completed: 0 },
        });
        try {
          const { result } = await execute((progress) =>
            send({ type: "progress", progress }),
          );
          send({ type: "result", result });
        } finally {
          try {
            controller.close();
          } catch {
            /* Already disconnected. */
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  }
  const { result, status } = await execute();
  return reply(result, status);
}
