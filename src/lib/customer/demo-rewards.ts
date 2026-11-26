import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { sessionCookie, type CustomerAccount } from "./session";
import { demoAccounts, isDemoAccount } from "./demo-accounts";
import { AppError } from "@/lib/errors/app-error";
import {
  initialDemoRewards,
  demoRewardStateSchema,
  demoRewardView,
  reserveDemoReward,
  completeDemoReward,
  refreshDemoRewards,
  updateDemoRewardDates,
  type DemoRewardState,
} from "./demo-rewards-model";
const cookieName = "gyvft_demo_rewards_v1";
const assertDemo = (account: CustomerAccount) => {
  if (
    !demoAccounts.some((d) => d.id === account.id && d.email === account.email)
  )
    throw new AppError(
      "FORBIDDEN",
      "Sample rewards are available only to the four demo accounts.",
    );
};
async function signature(account: CustomerAccount, payload: string) {
  const session = (await cookies()).get(sessionCookie)?.value;
  if (!session)
    throw new AppError("UNAUTHORIZED", "Sign in to the demo account.");
  return createHmac("sha256", session)
    .update(`gyvft-demo-rewards-v1\0${account.id}\0${payload}`)
    .digest("base64url");
}
export async function readDemoRewards(account: CustomerAccount) {
  assertDemo(account);
  const raw = (await cookies()).get(cookieName)?.value;
  if (raw && raw.length < 12000) {
    const [payload, proof, ...extra] = raw.split(".");
    if (!extra.length && payload && proof) {
      const expected = await signature(account, payload);
      if (
        /^[A-Za-z0-9_-]{43}$/.test(proof) &&
        proof.length === expected.length &&
        timingSafeEqual(Buffer.from(proof), Buffer.from(expected))
      ) {
        try {
          const state = demoRewardStateSchema.parse(
            JSON.parse(Buffer.from(payload, "base64url").toString()),
          );
          if (state.accountId === account.id) return refreshDemoRewards(state);
        } catch {}
      }
    }
  }
  return initialDemoRewards(account.id);
}
async function save(account: CustomerAccount, state: DemoRewardState) {
  assertDemo(account);
  const validated = demoRewardStateSchema.parse(state),
    payload = Buffer.from(
      JSON.stringify({
        ...validated,
        history: validated.history.slice(0, 5),
        coupons: validated.coupons.slice(0, 3),
      }),
    ).toString("base64url");
  if (payload.length > 3500)
    throw new AppError(
      "CONFLICT",
      "The sample session is full. Sign in again to start a fresh demo.",
    );
  const proof = await signature(account, payload);
  (await cookies()).set(cookieName, `${payload}.${proof}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
}
export async function demoRewardsFor(account: CustomerAccount) {
  return demoRewardView(await readDemoRewards(account));
}
export async function demoRewardCommand(
  account: CustomerAccount,
  input: { op: string; [key: string]: unknown },
) {
  assertDemo(account);
  let state = await readDemoRewards(account);
  try {
    if (input.op === "demo-reset") {
      await save(account, initialDemoRewards(account.id));
      return {
        message:
          "Your sample wallet has been reset. Customer records were not changed.",
      };
    }
    if (input.op === "redeem") {
      const kind = z
          .enum(["points", "birthday", "anniversary"])
          .parse(input.kind),
        points = z.number().int().min(1).max(1000000).parse(input.points);
      const reserved = reserveDemoReward(state, kind, points, randomUUID());
      await save(account, reserved.state);
      return {
        redirectUrl: `/account/rewards/checkout?intent=${reserved.coupon.id}`,
        code: reserved.coupon.code,
        points: reserved.coupon.points,
        minimumPaise: reserved.coupon.minimum_paise,
        expiresAt: reserved.coupon.expires_at,
        demo: true,
      };
    }
    if (input.op === "dates") {
      state = updateDemoRewardDates(
        state,
        input.birthday as string | null,
        input.anniversary as string | null,
        input.consent === true,
      );
      await save(account, state);
      return {
        message:
          "Your sample occasion dates are saved. No notification was sent.",
      };
    }
    if (input.op === "demo-checkout") {
      state = completeDemoReward(state, z.string().uuid().parse(input.intent));
      await save(account, state);
      return {
        message:
          "Sample checkout complete. No payment, Shopify order or real coupon was created.",
      };
    }
    if (input.op === "refresh") {
      await save(account, refreshDemoRewards(state));
      return {
        message:
          "Your sample rewards are up to date. No Shopify call was made.",
      };
    }
    throw new AppError(
      "FORBIDDEN",
      "Sample accounts do not send real verification emails or claim real rewards.",
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "VALIDATION_ERROR",
      error instanceof Error
        ? error.message
        : "Check the sample reward fields.",
    );
  }
}
export { isDemoAccount };
