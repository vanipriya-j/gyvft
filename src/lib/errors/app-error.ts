export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTEGRATION_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { status?: number; details?: unknown; expose?: boolean; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status =
      options?.status ??
      ({
        VALIDATION_ERROR: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        RATE_LIMITED: 429,
        INTEGRATION_ERROR: 502,
        INTERNAL_ERROR: 500,
      }[code] as number);
    this.details = options?.details;
    this.expose = options?.expose ?? code !== "INTERNAL_ERROR";
  }
}

export function toErrorResponse(error: unknown): {
  ok: false;
  error: { code: ErrorCode; message: string; details?: unknown };
  status: number;
} {
  if (error instanceof AppError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.expose ? error.message : "Something went wrong",
        details: error.expose ? error.details : undefined,
      },
      status: error.status,
    };
  }
  return {
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    status: 500,
  };
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; details?: unknown } };
