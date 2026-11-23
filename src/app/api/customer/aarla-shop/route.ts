import { z } from "zod";
import { customerApi, customerJson, customerReply } from "@/lib/customer/api";
import { shopAarlaForAccount } from "@/lib/customer/aarla-shop";
import { aarlaDestination } from "@/lib/customer/aarla-shop-model";
import { ShopifyError } from "@/lib/customer/shopify";
import { recordCustomerEvent } from "@/lib/customer/observability";
import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logging/logger";
export const runtime = "nodejs";
export const maxDuration = 60;
const input = z
  .object({
    destination: z
      .string()
      .min(1)
      .max(2048)
      .transform((value, ctx) => {
        try {
          return aarlaDestination(value);
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "Choose an Aarla product or collection.",
          });
          return z.NEVER;
        }
      }),
  })
  .strict();
export async function POST(request: Request) {
  return customerApi(request, true, async (account) => {
    const data = input.parse(await customerJson(request, 3072));
    try {
      return customerReply({
        ok: true,
        ...(await shopAarlaForAccount(account, data.destination)),
      });
    } catch (error) {
      if (!(error instanceof ShopifyError)) throw error;
      const reference = randomUUID();
      logger.error("Aarla shopping handoff failed", {
        requestId: reference,
        ...error.details,
      });
      await recordCustomerEvent("app.error", {
        accountId: account.id,
        requestId: reference,
        metadata: {
          route: "/api/customer/aarla-shop",
          operation: "aarla-coupon",
          code: error.details.code || "AARLA_COUPON_UNCONFIRMED",
          status: 503,
        },
      });
      return customerReply(
        {
          ok: false,
          error: {
            code: "INTEGRATION_ERROR",
            message:
              "We couldn’t confirm your 5% saving. Please try again or contact the GYVFT team.",
            reference,
          },
        },
        503,
      );
    }
  });
}
