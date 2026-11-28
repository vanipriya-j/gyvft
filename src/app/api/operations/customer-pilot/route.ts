import { z } from "zod";
import { validSetupSecret } from "@/lib/security/setup-secret";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { customerJson, customerReply } from "@/lib/customer/api";
import { AppError } from "@/lib/errors/app-error";
import { pilotCustomerSchema } from "@/lib/rewards/pilot-model";
import {
  pilotStatus,
  previewPilotCustomer,
  applyPilotCustomer,
} from "@/lib/rewards/pilot";

export const runtime = "nodejs";
export const maxDuration = 60;
const command = z.discriminatedUnion("op", [
  z.object({ op: z.literal("status") }).strict(),
  z
    .object({ op: z.literal("preview"), customer: pilotCustomerSchema })
    .strict(),
  z
    .object({
      op: z.literal("apply"),
      customer: pilotCustomerSchema,
      id: z.string().uuid(),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      confirm: z.literal(true),
    })
    .strict(),
]);
export async function POST(request: Request) {
  try {
    assertPublicFormRateLimit({
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown",
      formKey: "customer-pilot",
      limit: 80,
      windowMs: 60000,
    });
    if (!validSetupSecret(request.headers.get("x-setup-secret")))
      return customerReply(
        { ok: false, message: "Operator access required." },
        401,
      );
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return customerReply(
        { ok: false, message: "Use the GYVFT setup page." },
        403,
      );
    const body = command.parse(await customerJson(request, 4096));
    const result =
      body.op === "status"
        ? await pilotStatus()
        : body.op === "preview"
          ? await previewPilotCustomer(body.customer)
          : await applyPilotCustomer(body.customer, body.id, body.fingerprint);
    return customerReply({ ok: true, result });
  } catch (e) {
    return customerReply(
      {
        ok: false,
        message:
          e instanceof AppError
            ? e.message
            : e instanceof z.ZodError
              ? "Check the selected customer and confirmation fields."
              : "Customer test could not complete. No partial transaction was saved. Retry the same apply after a lost response.",
      },
      e instanceof AppError ? e.status : e instanceof z.ZodError ? 400 : 503,
    );
  }
}
