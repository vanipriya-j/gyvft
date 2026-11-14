import { MigrationExecutionError } from "./migrations";
export function migrationDiagnostic(error: unknown) {
  const cause = error instanceof MigrationExecutionError ? error.cause : error;
  const code =
    cause &&
    typeof cause === "object" &&
    "code" in cause &&
    typeof cause.code === "string" &&
    /^[0-9A-Z]{5}$/.test(cause.code)
      ? cause.code
      : "DATABASE_ERROR";
  const filename =
    error instanceof MigrationExecutionError ? error.filename : undefined;
  const hints: Record<string, string> = {
    "42501": "The database role does not have permission for this operation.",
    "42703":
      "The existing database has a different column structure than expected.",
    "42P01": "An expected database table is missing.",
    "42710": "A database object already exists with a conflicting definition.",
    "23505": "A database record conflicts with an existing unique value.",
    "28P01": "Database authentication failed. Check DATABASE_URL in Vercel.",
    "57014": "The database operation timed out. Check status before retrying.",
    "55P03":
      "The database is busy with another operation. Wait before trying again.",
  };
  return {
    code,
    filename,
    message: `${filename ? `Stopped at ${filename}. ` : "Setup could not complete. "}${hints[code] || "The database operation failed. Share the diagnostic below so we can identify the cause."} Diagnostic: ${code}.`,
  };
}
