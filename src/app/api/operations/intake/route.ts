import { z } from "zod";
import { validSetupSecret } from "@/lib/security/setup-secret";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { customerJson } from "@/lib/customer/api";
import {
  operationsIntakeReady,
  intakeCustomers,
  createOperationsIntake,
  sendOperationsSetupEmail,
  OperationsIntakeError,
} from "@/lib/customer/operations-intake";
import { recordCustomerEvent } from "@/lib/customer/observability";
import { AppError } from "@/lib/errors/app-error";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
export async function POST(request: Request) {
  try {
    assertPublicFormRateLimit({
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown",
      formKey: "operations-intake",
      limit: 40,
      windowMs: 60000,
    });
  } catch {
    return reply(
      { ok: false, message: "Too many requests. Please wait a minute." },
      429,
    );
  }
  if (!validSetupSecret(request.headers.get("x-setup-secret")))
    return reply(
      { ok: false, message: "Operator access could not be verified." },
      401,
    );
  try {
    const body = z
      .object({ op: z.string() })
      .passthrough()
      .parse(await customerJson(request, 4 * 1024 * 1024));
    if (body.op === "status")
      return reply({ ok: true, installed: await operationsIntakeReady() });
    if (body.op === "customers")
      return reply({
        ok: true,
        customers: await intakeCustomers(
          z
            .string()
            .max(120)
            .parse(body.query || ""),
        ),
      });
    if (body.op === "create") {
      const { op, ...input } = body;
      void op;
      const result = await createOperationsIntake(input);
      if (!result.duplicate) {
        if (result.created_account)
          await recordCustomerEvent("account.created", {
            accountId: result.account_id,
            metadata: {
              route: "/api/operations/intake",
              operation: "operations-intake",
              status: 201,
            },
          });
        if (result.project_id)
          await recordCustomerEvent("enquiry.created", {
            accountId: result.account_id,
            requestId: result.project_id,
            metadata: {
              route: "/api/operations/intake",
              operation: "operations-intake",
              status: 201,
            },
          });
      }
      return reply({
        ok: true,
        result,
        message: result.project_id
          ? "Requirement saved under this customer. No email has been sent."
          : "Customer saved. Send their setup email when you are ready.",
      });
    }
    if (body.op === "send_setup_email")
      return reply({
        ok: true,
        ...(await sendOperationsSetupEmail(
          z.string().uuid().parse(body.account_id),
          z.string().uuid().parse(body.request_id),
        )),
      });
    return reply(
      { ok: false, message: "Choose a customer intake action." },
      400,
    );
  } catch (error) {
    return reply(
      {
        ok: false,
        message:
          error instanceof OperationsIntakeError
            ? error.message
            : error instanceof AppError && error.expose
              ? error.message
              : error instanceof z.ZodError
                ? `Check ${error.issues[0]?.path.join(".") || "the form"}: ${error.issues[0]?.message}`
                : "The save could not be confirmed. Your entries are retained; retry the same save before starting another.",
      },
      error instanceof OperationsIntakeError
        ? 409
        : error instanceof AppError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500,
    );
  }
}
