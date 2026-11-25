import { z } from "zod";
import { validSetupSecret } from "@/lib/security/setup-secret";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { customerJson, customerReply } from "@/lib/customer/api";
import { AppError } from "@/lib/errors/app-error";
import {
  operationsRewardView,
  updateRewardSettings,
  reconcileDueRewards,
} from "@/lib/rewards/service";
import { previewOpening, applyOpening } from "@/lib/rewards/store";
import { syncRewardOrders, reviewRewardOrder } from "@/lib/rewards/sync";
export const runtime = "nodejs";
export const maxDuration = 60;
const command = z.discriminatedUnion("op", [
  z.object({ op: z.literal("status") }).strict(),
  z
    .object({
      op: z.literal("settings"),
      enabled: z.boolean(),
      collection: z
        .string()
        .regex(/^gid:\/\/shopify\/Collection\/\d+$/)
        .nullable(),
    })
    .strict(),
  z.object({ op: z.literal("sync") }).strict(),
  z.object({ op: z.literal("reconcile") }).strict(),
  z.object({ op: z.literal("preview") }).strict(),
  z
    .object({
      op: z.literal("apply"),
      id: z.string().uuid(),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      confirm: z.literal(true),
    })
    .strict(),
  z
    .object({
      op: z.literal("review"),
      id: z.string().regex(/^gid:\/\/shopify\/Order\/\d+$/),
      version: z.string().datetime(),
      eligiblePaise: z.number().int().min(0).max(10000000000).nullable(),
      reason: z.string().trim().min(8).max(500),
    })
    .strict(),
]);
export async function POST(request: Request) {
  try {
    assertPublicFormRateLimit({
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown",
      formKey: "rewards-operations",
      limit: 80,
      windowMs: 60000,
    });
    if (!validSetupSecret(request.headers.get("x-setup-secret")))
      return customerReply(
        { ok: false, message: "Operator access required." },
        401,
      );
    const body = command.parse(await customerJson(request, 4096));
    let result: unknown;
    if (body.op === "status")
      return customerReply({ ok: true, ...(await operationsRewardView()) });
    if (body.op === "settings")
      result = await updateRewardSettings(body.enabled, body.collection);
    if (body.op === "sync") result = await syncRewardOrders();
    if (body.op === "reconcile") result = await reconcileDueRewards();
    if (body.op === "preview") result = await previewOpening();
    if (body.op === "apply")
      result = await applyOpening(body.id, body.fingerprint);
    if (body.op === "review")
      result = await reviewRewardOrder(
        body.id,
        body.version,
        body.eligiblePaise,
        body.reason,
      );
    return customerReply({
      ok: true,
      result,
      ...(await operationsRewardView()),
    });
  } catch (error) {
    return customerReply(
      {
        ok: false,
        message:
          error instanceof AppError
            ? error.message
            : error instanceof z.ZodError
              ? "Check the required fields."
              : "Rewards could not complete. No provider error or private data is exposed.",
      },
      error instanceof AppError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : 503,
    );
  }
}
