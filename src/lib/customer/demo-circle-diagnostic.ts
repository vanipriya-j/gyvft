export const completionSteps = {
  connect: "Opening the database connection",
  lock: "Checking for another demo update",
  accounts: "Checking the four demo accounts",
  schema: "Checking Circle tables",
  circle: "Creating a circle",
  members: "Adding accepted members",
  organisation: "Adding the organisation",
  recipients: "Adding recipients",
  occasions: "Adding shared occasions",
  gifts: "Linking sample gifts",
  audit: "Recording the operation",
  context: "Correcting occasion context",
  results: "Checking completed memberships",
  commit: "Confirming the transaction",
  rollback: "Confirming the test rollback",
  unknown: "Completing demo circles",
} as const;
export type CompletionStep = keyof typeof completionSteps;
const hints: Record<string, string> = {
  "23503":
    "A related database record is missing or a foreign-key definition differs from the expected schema.",
  "23505": "A sample identifier conflicts with an existing record.",
  "23514": "A database check rejected one of the sample records.",
  "42703": "An expected column is missing from the installed schema.",
  "42P01": "An expected table is missing from the installed schema.",
  "42501":
    "The database connection does not have permission for this operation.",
  "57014": "The database operation timed out.",
  "55P03": "A database record is busy with another operation.",
  "40P01": "The database stopped this operation because of a lock conflict.",
  "22P02": "A database value has an incompatible format.",
};
export function demoCircleDiagnostic(
  error: unknown,
  step: CompletionStep = "unknown",
) {
  const e =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const connectionCodes = new Set([
    "CONNECT_TIMEOUT",
    "CONNECTION_CLOSED",
    "CONNECTION_ENDED",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
  ]);
  const code =
    typeof e.code === "string" &&
    (/^[0-9A-Z]{5}$/.test(e.code) || connectionCodes.has(e.code))
      ? e.code
      : "DATABASE_ERROR";
  const metadata = (field: string) =>
    typeof e[field] === "string" &&
    /^[a-zA-Z0-9_]{1,128}$/.test(e[field] as string)
      ? (e[field] as string)
      : undefined;
  return {
    code,
    step,
    operation: completionSteps[step],
    table: metadata("table_name"),
    column: metadata("column_name"),
    constraint: metadata("constraint_name"),
    message: `${completionSteps[step]} failed. ${hints[code] || "The operation could not be confirmed."} Diagnostic: ${code}.`,
  };
}
export class DemoCircleFailure extends Error {
  constructor(public diagnostic: ReturnType<typeof demoCircleDiagnostic>) {
    super(diagnostic.message);
    this.name = "DemoCircleFailure";
  }
}
