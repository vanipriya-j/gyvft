import { z } from "zod";
import { customerApi, customerJson, customerReply } from "@/lib/customer/api";
import {
  customerRewardView,
  refreshCustomerRewardCoupons,
  redeemForAccount,
  saveRewardDates,
} from "@/lib/rewards/service";
import {
  sendRewardVerification,
  confirmRewardVerification,
} from "@/lib/rewards/identity";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  return customerApi(request, false, async (account) =>
    customerReply({ ok: true, ...(await customerRewardView(account)) }),
  );
}
const command = z.discriminatedUnion("op", [
  z.object({ op: z.literal("refresh") }).strict(),
  z.object({ op: z.literal("verify-email") }).strict(),
  z
    .object({ op: z.literal("confirm-email"), token: z.string().length(43) })
    .strict(),
  z
    .object({
      op: z.literal("redeem"),
      kind: z.enum(["points", "birthday", "anniversary"]),
      points: z.number().int().min(1).max(1000000),
    })
    .strict(),
  z
    .object({
      op: z.literal("dates"),
      birthday: z
        .string()
        .regex(/^\d{2}-\d{2}$/)
        .nullable(),
      anniversary: z
        .string()
        .regex(/^\d{2}-\d{2}$/)
        .nullable(),
      consent: z.boolean(),
    })
    .strict(),
]);
export async function POST(request: Request) {
  return customerApi(request, true, async (account) => {
    const input = command.parse(await customerJson(request));
    if (input.op === "refresh")
      return customerReply({
        ok: true,
        ...(await refreshCustomerRewardCoupons(account)),
      });
    if (input.op === "verify-email")
      return customerReply({
        ok: true,
        ...(await sendRewardVerification(account)),
      });
    if (input.op === "confirm-email")
      return customerReply({
        ok: true,
        ...(await confirmRewardVerification(account, input.token)),
      });
    if (input.op === "dates")
      return customerReply({
        ok: true,
        ...(await saveRewardDates(
          account,
          input.birthday,
          input.anniversary,
          input.consent,
        )),
      });
    return customerReply({
      ok: true,
      ...(await redeemForAccount(account, input.kind, input.points)),
    });
  });
}
