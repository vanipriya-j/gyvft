import { beforeEach, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { demoAccounts } from "@/lib/customer/demo-accounts";
import {
  initialDemoRewards,
  demoRewardView,
  reserveDemoReward,
  completeDemoReward,
  refreshDemoRewards,
  updateDemoRewardDates,
} from "@/lib/customer/demo-rewards-model";
const now = new Date("2026-11-26T06:00:00.000Z");
describe("complete fictional rewards model", () => {
  it.each(demoAccounts)(
    "provides a populated, verified sample wallet for $kind",
    (account) => {
      const state = initialDemoRewards(account.id, now),
        view = demoRewardView(state);
      expect(view).toMatchObject({
        installed: true,
        enabled: true,
        verified: true,
        demo: true,
      });
      expect(view.wallet.available).toBeGreaterThan(0);
      expect(view.wallet.pending).toBeGreaterThan(0);
      expect(view.wallet.history.length).toBeGreaterThan(0);
      expect(state.history.reduce((n, e) => n + e.points, 0)).toBe(
        state.available,
      );
    },
  );
  it("never infers demo status from an email alias or an unknown ID", () => {
    expect(() => initialDemoRewards(randomUUID())).toThrow("Demo account");
  });
  it("reserves only once and completes the sample exactly once without earning new points", () => {
    const original = initialDemoRewards(demoAccounts[0].id, now),
      id = randomUUID();
    const first = reserveDemoReward(original, "points", 100, id, now);
    expect(first.state).toMatchObject({
      available: original.available - 100,
      reserved: 100,
      spent: 150,
    });
    expect(first.coupon.minimum_paise).toBe(40000);
    expect(
      reserveDemoReward(first.state, "points", 200, randomUUID(), now).coupon
        .id,
    ).toBe(id);
    const completed = completeDemoReward(first.state, id, now);
    expect(completed).toMatchObject({
      available: original.available - 100,
      reserved: 0,
      spent: 250,
      pending: original.pending,
    });
    expect(completeDemoReward(completed, id, now)).toEqual(completed);
  });
  it("rejects overspending, zero/fractional points and unknown checkout references", () => {
    const state = initialDemoRewards(demoAccounts[0].id, now);
    for (const amount of [0, 1.5, state.available + 1])
      expect(() =>
        reserveDemoReward(state, "points", amount, randomUUID(), now),
      ).toThrow();
    expect(() => completeDemoReward(state, randomUUID(), now)).toThrow(
      "unavailable",
    );
  });
  it("returns unused expired reservations once", () => {
    const state = initialDemoRewards(demoAccounts[0].id, now),
      active = reserveDemoReward(state, "points", 100, randomUUID(), now).state;
    const later = new Date(now.getTime() + 2 * 86400000),
      released = refreshDemoRewards(active, later);
    expect(released).toMatchObject({ available: state.available, reserved: 0 });
    expect(refreshDemoRewards(released, later)).toEqual(released);
  });
  it("demonstrates an annual self-occasion offer with no point debit", () => {
    const state = initialDemoRewards(demoAccounts[1].id, now),
      reserved = reserveDemoReward(state, "birthday", 150, randomUUID(), now);
    expect(reserved.coupon).toMatchObject({
      minimum_paise: 150000,
      points: 150,
      event_year: 2026,
    });
    expect(reserved.state.available).toBe(state.available);
    expect(reserved.state.reserved).toBe(0);
    expect(() =>
      reserveDemoReward(reserved.state, "birthday", 150, randomUUID(), now),
    ).toThrow("already");
    expect(() =>
      updateDemoRewardDates(reserved.state, "01-01", null, true, now),
    ).toThrow("fixed");
    expect(
      updateDemoRewardDates(
        reserved.state,
        state.dates.birthday,
        state.dates.anniversary,
        false,
        now,
      ).dates.consent,
    ).toBe(false);
  });
});
const context = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      context.jar.has(name) ? { value: context.jar.get(name) } : undefined,
    set: (name: string, value: string) => {
      context.jar.set(name, value);
    },
  }),
}));
import {
  readDemoRewards,
  demoRewardCommand,
  demoRewardsFor,
} from "@/lib/customer/demo-rewards";
describe("session-bound sample rewards transport", () => {
  beforeEach(() => {
    context.jar.clear();
    context.jar.set("gyvft_customer_session", "fictional-browser-session");
  });
  it("persists a sample reservation without a database or provider", async () => {
    const a = demoAccounts[0],
      before = await readDemoRewards(a);
    const result = await demoRewardCommand(a, {
      op: "redeem",
      kind: "points",
      points: 100,
    });
    expect(result.redirectUrl).toMatch(
      /^\/account\/rewards\/checkout\?intent=/,
    );
    expect(await readDemoRewards(a)).toMatchObject({
      available: before.available - 100,
      reserved: 100,
    });
    await demoRewardCommand(a, {
      op: "demo-checkout",
      intent: new URL(
        result.redirectUrl!,
        "https://www.gyvft.com",
      ).searchParams.get("intent"),
    });
    expect((await demoRewardsFor(a)).wallet.spent).toBe(before.spent + 100);
  });
  it("rejects real users and forged fixture identities", async () => {
    for (const account of [
      { id: randomUUID(), email: demoAccounts[0].email },
      { id: demoAccounts[0].id, email: "somebody@example.test" },
    ])
      await expect(
        demoRewardCommand(account, { op: "demo-reset" }),
      ).rejects.toThrow("only");
  });
  it("does not reuse sample funds across accounts, sessions or tampered cookies", async () => {
    const a = demoAccounts[0];
    await demoRewardCommand(a, { op: "redeem", kind: "points", points: 100 });
    context.jar.set("gyvft_customer_session", "another-session");
    expect((await readDemoRewards(a)).reserved).toBe(0);
    expect((await readDemoRewards(demoAccounts[1])).accountId).toBe(
      demoAccounts[1].id,
    );
    context.jar.set("gyvft_demo_rewards_v1", "e30." + "💣".repeat(43));
    expect((await readDemoRewards(a)).reserved).toBe(0);
  });
  it("never emails a sample customer or accepts a verification token", async () => {
    await expect(
      demoRewardCommand(demoAccounts[0], { op: "verify-email" }),
    ).rejects.toThrow("do not send");
    await expect(
      demoRewardCommand(demoAccounts[0], {
        op: "confirm-email",
        token: "x".repeat(43),
      }),
    ).rejects.toThrow("do not send");
  });
});
