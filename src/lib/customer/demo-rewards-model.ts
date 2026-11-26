import { z } from "zod";
import { indiaToday } from "./dashboard-model";
import { demoAccounts } from "./demo-accounts";
import {
  rewardsPolicy,
  minimumSpendPaise,
  celebrationWindow,
  dayMs,
  wholePoints,
} from "@/lib/rewards/policy";
const coupon = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(["points", "birthday", "anniversary", "saving"]),
    code: z.string().max(80),
    event_year: z.number().int().nullable(),
    points: z.number().int().min(0).max(100000),
    minimum_paise: z.number().int().min(0),
    state: z.enum(["active", "redeemed", "released"]),
    expires_at: z.string().datetime(),
    created_at: z.string().datetime(),
  })
  .strict();
const entry = z
  .object({
    kind: z.string().max(30),
    points: z.number().int().min(-100000).max(100000),
    detail: z.string().max(240),
    created_at: z.string().datetime(),
  })
  .strict();
export const demoRewardStateSchema = z
  .object({
    version: z.literal(1),
    accountId: z.string().uuid(),
    available: z.number().int().min(0).max(100000),
    pending: z.number().int().min(0).max(100000),
    reserved: z.number().int().min(0).max(100000),
    spent: z.number().int().min(0).max(100000),
    dates: z.object({
      birthday: z.string().nullable(),
      anniversary: z.string().nullable(),
      consent: z.boolean(),
    }),
    coupons: z.array(coupon).max(10),
    history: z.array(entry).max(30),
  })
  .strict();
export type DemoRewardState = z.infer<typeof demoRewardStateSchema>;
const spend = [3250000, 4250000, 1875000, 6125000];
export function initialDemoRewards(
  accountId: string,
  now = new Date(),
): DemoRewardState {
  const index = demoAccounts.findIndex((a) => a.id === accountId);
  if (index < 0) throw Error("Demo account required");
  const available = wholePoints(spend[index]).points,
    created = (offset: number) =>
      new Date(now.getTime() + offset * dayMs).toISOString();
  return {
    version: 1,
    accountId,
    available,
    pending: [60, 120, 45, 180][index],
    reserved: 0,
    spent: 150,
    dates: {
      birthday: indiaToday(now).slice(5),
      anniversary: index === 0 ? null : "11-15",
      consent: true,
    },
    coupons: [],
    history: [
      {
        kind: "earn",
        points: available,
        detail: "Sample Aarla retail purchases · points available",
        created_at: created(-5),
      },
      {
        kind: "redeem",
        points: -150,
        detail: "Sample redemption · checkout completed",
        created_at: created(-35),
      },
      {
        kind: "earn",
        points: 150,
        detail: "Sample previous retail purchase",
        created_at: created(-65),
      },
    ],
  };
}
export function demoRewardView(state: DemoRewardState) {
  return {
    installed: true,
    enabled: true,
    verified: true,
    demo: true,
    wallet: {
      available: state.available,
      pending: state.pending,
      reserved: state.reserved,
      spent: state.spent,
      debt: 0,
      history: state.history,
      coupons: state.coupons,
      dates: state.dates,
    },
  };
}
export function reserveDemoReward(
  state: DemoRewardState,
  kind: "points" | "birthday" | "anniversary",
  requested: number,
  id: string,
  now = new Date(),
) {
  const current = state.coupons.find(
    (c) => c.kind === "points" && c.state === "active",
  );
  if (kind === "points" && current) return { state, coupon: current };
  let eventYear: number | null = null;
  let points = requested,
    minimum = minimumSpendPaise(points),
    expiresAt = new Date(now.getTime() + dayMs).toISOString();
  if (kind !== "points") {
    const date = state.dates[kind];
    if (!state.dates.consent || !date)
      throw Error("Save your own occasion date and opt in first.");
    const window = celebrationWindow(date, now);
    if (!window)
      throw Error(
        "Your sample occasion offer opens seven days before your day.",
      );
    const used = state.coupons.find(
      (c) => c.kind === kind && c.event_year === window.year,
    );
    if (used)
      throw Error(
        "This sample occasion offer has already been issued this year.",
      );
    eventYear = window.year;
    points = rewardsPolicy.celebrationPoints;
    minimum = rewardsPolicy.celebrationMinimumPaise;
    expiresAt = window.endsAt;
  } else if (points > state.available)
    throw Error("Choose points within your sample balance.");
  const next = structuredClone(state),
    intent = {
      id,
      kind,
      event_year: eventYear,
      code: `SAMPLE-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      points,
      minimum_paise: minimum,
      state: "active" as const,
      expires_at: expiresAt,
      created_at: now.toISOString(),
    };
  if (kind === "points") {
    next.available -= points;
    next.reserved += points;
    next.history.unshift({
      kind: "reserve",
      points: 0,
      detail: `${points} sample points reserved for checkout`,
      created_at: now.toISOString(),
    });
  }
  next.coupons.unshift(intent);
  next.coupons = next.coupons.slice(0, 10);
  next.history = next.history.slice(0, 30);
  return { state: next, coupon: intent };
}
export function completeDemoReward(
  state: DemoRewardState,
  id: string,
  now = new Date(),
) {
  const next = structuredClone(state),
    intent = next.coupons.find((c) => c.id === id);
  if (!intent) throw Error("Sample checkout unavailable.");
  if (intent.state === "redeemed") return next;
  if (
    intent.state !== "active" ||
    new Date(intent.expires_at).getTime() <= now.getTime()
  )
    throw Error("This sample checkout expired.");
  intent.state = "redeemed";
  if (intent.kind === "points") {
    next.reserved -= intent.points;
    next.spent += intent.points;
  }
  next.history.unshift({
    kind: intent.kind === "points" ? "redeem" : "occasion",
    points: intent.kind === "points" ? -intent.points : 0,
    detail:
      intent.kind === "points"
        ? "Sample checkout completed · no new points earned"
        : "Sample occasion coupon used · no new points earned",
    created_at: now.toISOString(),
  });
  next.history = next.history.slice(0, 30);
  return next;
}
export function refreshDemoRewards(state: DemoRewardState, now = new Date()) {
  const next = structuredClone(state);
  for (const c of next.coupons) {
    if (
      c.state === "active" &&
      new Date(c.expires_at).getTime() <= now.getTime()
    ) {
      c.state = "released";
      if (c.kind === "points") {
        next.available += c.points;
        next.reserved -= c.points;
      }
      next.history.unshift({
        kind: "release",
        points: 0,
        detail: "Unused sample coupon expired; reserved points returned",
        created_at: now.toISOString(),
      });
    }
  }
  next.history = next.history.slice(0, 30);
  return next;
}
export function updateDemoRewardDates(
  state: DemoRewardState,
  birthday: string | null,
  anniversary: string | null,
  consent: boolean,
  now = new Date(),
) {
  if (
    state.coupons.some(
      (c) =>
        ["birthday", "anniversary"].includes(c.kind) &&
        new Date(c.created_at).getTime() > now.getTime() - 365 * dayMs,
    ) &&
    (state.dates.birthday !== birthday ||
      state.dates.anniversary !== anniversary)
  )
    throw Error(
      "Sample occasion dates stay fixed for 12 months after an offer is issued. You can still switch offers off.",
    );
  for (const date of [birthday, anniversary]) if (date) celebrationWindow(date);
  return { ...state, dates: { birthday, anniversary, consent } };
}
