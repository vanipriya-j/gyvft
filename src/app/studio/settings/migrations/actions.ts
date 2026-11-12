"use server";
import { revalidatePath } from "next/cache";
import { requireStudioUser } from "@/lib/auth/session";
import { getSql } from "@/lib/database/client";
import {
  MigrationBusyError,
  runPendingMigrations,
} from "@/lib/database/migrations";
import { logger } from "@/lib/logging/logger";

export type MigrationResult = {
  ok: boolean;
  message: string;
  applied: string[];
};
export async function runMigrationsAction(): Promise<MigrationResult> {
  // Recheck authorization for every mutation, independently of the page/layout.
  const owner = await requireStudioUser({ roles: ["owner"] });
  try {
    const applied = await runPendingMigrations(getSql());
    logger.info("Database migrations completed", {
      actorId: owner.id,
      migrations: applied,
    });
    revalidatePath("/studio/settings/migrations");
    revalidatePath("/account", "layout");
    return {
      ok: true,
      applied,
      message: applied.length
        ? `${applied.length} migration${applied.length === 1 ? "" : "s"} applied successfully.`
        : "Your database is already up to date.",
    };
  } catch (error) {
    if (error instanceof MigrationBusyError)
      return { ok: false, applied: [], message: error.message };
    logger.error("Database migration run failed", {
      actorId: owner.id,
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "MIGRATION_FAILED",
    });
    revalidatePath("/studio/settings/migrations");
    return {
      ok: false,
      applied: [],
      message:
        "Migration completion could not be confirmed. Refresh migration history before retrying. Failed database transactions are rolled back; check the database connection and deployment logs.",
    };
  }
}
