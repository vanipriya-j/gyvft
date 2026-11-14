import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  account: vi.fn(),
  owned: vi.fn(),
  refresh: vi.fn(),
  rate: vi.fn(),
  event: vi.fn(),
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => mocks.sql }));
vi.mock("@/lib/customer/session", () => ({
  requireCustomerAccount: mocks.account,
}));
vi.mock("@/lib/customer/data", () => ({ ownedProject: mocks.owned }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/lib/security/memory-guards", () => ({
  assertPublicFormRateLimit: mocks.rate,
}));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: mocks.event,
}));
import {
  addOccasion,
  removeOccasion,
  saveIdea,
  saveRequestDates,
} from "@/app/account/dashboard-actions";
import { dashboardExtrasFor } from "@/lib/customer/dashboard-data";
const owner = "11111111-1111-4111-8111-111111111111",
  project = "22222222-2222-4222-8222-222222222222";
const form = (input: Record<string, string>) => {
  const f = new FormData();
  Object.entries(input).forEach(([k, v]) => f.set(k, v));
  return f;
};
describe("private gifting dashboard actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.account.mockResolvedValue({ id: owner, email: "owner@example.test" });
    mocks.owned.mockResolvedValue({ id: project });
    mocks.sql.mockResolvedValue([{ id: project }]);
    mocks.event.mockResolvedValue(undefined);
  });
  it("creates occasions under the authenticated account, with idempotent duplicate handling", async () => {
    const result = await addOccasion(
      form({
        title: "Family birthday",
        occasion_date: "2027-01-10",
        repeats_annually: "on",
      }),
    );
    expect(result.ok).toBe(true);
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual([
      owner,
      "Family birthday",
      "2027-01-10",
      true,
    ]);
    expect(mocks.sql.mock.calls[0][0].join("")).toContain(
      "ON CONFLICT DO NOTHING",
    );
  });
  it("rejects impossible occasion dates before writing", async () => {
    expect(
      (
        await addOccasion(
          form({ title: "Birthday", occasion_date: "2027-02-31" }),
        )
      ).ok,
    ).toBe(false);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it("cannot remove a different account's occasion", async () => {
    mocks.sql.mockResolvedValue([]);
    expect((await removeOccasion(project, new FormData())).ok).toBe(false);
    expect(mocks.sql.mock.calls[0][0].join("?")).toContain(
      "AND account_id=?::uuid",
    );
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual([project, owner]);
  });
  it("denies date changes on a request the account does not own", async () => {
    mocks.owned.mockResolvedValue(null);
    expect(
      (
        await saveRequestDates(
          project,
          form({ occasion_date: "2027-01-10", delivery_date: "2027-01-08" }),
        )
      ).ok,
    ).toBe(false);
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.owned).toHaveBeenCalledWith(project, owner);
  });
  it("saves occasion and requested delivery dates independently with owner-scoped SQL", async () => {
    expect(
      (
        await saveRequestDates(
          project,
          form({ occasion_date: "2027-01-10", delivery_date: "2027-01-08" }),
        )
      ).ok,
    ).toBe(true);
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual([
      "2027-01-10",
      "2027-01-08",
      project,
      owner,
    ]);
    expect(mocks.sql.mock.calls[0][0].join("?")).toContain(
      "AND customer_account_id=?::uuid",
    );
    expect(mocks.refresh).toHaveBeenCalledWith("/account");
  });
  it("clears a date without changing the other date or original brief target", async () => {
    await saveRequestDates(
      project,
      form({ occasion_date: "", delivery_date: "2027-01-08" }),
    );
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual([
      null,
      "2027-01-08",
      project,
      owner,
    ]);
    expect(mocks.sql.mock.calls[0][0].join("")).not.toContain("target_date");
  });
  it("only saves published ideas and always binds them to the session owner", async () => {
    expect(
      (await saveIdea(form({ slug: "../../private", intent: "save" }))).ok,
    ).toBe(false);
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(
      (await saveIdea(form({ slug: "private-diwali-hampers", intent: "save" })))
        .ok,
    ).toBe(true);
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual([
      owner,
      "private-diwali-hampers",
    ]);
  });
  it("requires login before a dashboard mutation", async () => {
    mocks.account.mockRejectedValue(new Error("login required"));
    await expect(
      addOccasion(form({ title: "Birthday", occasion_date: "2027-01-01" })),
    ).rejects.toThrow("login required");
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it("reports missing setup safely without exposing a raw database error", async () => {
    mocks.sql.mockRejectedValue(
      Object.assign(new Error("secret connection details"), { code: "42P01" }),
    );
    const result = await addOccasion(
      form({ title: "Birthday", occasion_date: "2027-01-01" }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("setup");
    expect(result.message).not.toContain("secret");
  });
});
describe("owner-scoped dashboard reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sql.mockResolvedValue([]);
  });
  it("scopes calendar, saved ideas and approvals to the account and excludes stale approval versions", async () => {
    await dashboardExtrasFor(owner);
    expect(mocks.sql).toHaveBeenCalledTimes(3);
    for (const call of mocks.sql.mock.calls)
      expect(call.slice(1)).toEqual([owner]);
    const query = mocks.sql.mock.calls[2][0].join("");
    expect(query).toContain("NOT EXISTS");
    expect(query).toContain("n.version>a.version");
  });
  it("keeps existing requests usable while a new schema migration is pending", async () => {
    mocks.sql.mockRejectedValue({ code: "42P01" });
    expect(await dashboardExtrasFor(owner)).toEqual({
      occasions: [],
      savedSlugs: [],
      approvals: [],
      setupRequired: true,
    });
  });
  it("does not turn an unexpected database outage into a misleading empty dashboard", async () => {
    mocks.sql.mockRejectedValue(new Error("database offline"));
    await expect(dashboardExtrasFor(owner)).rejects.toThrow("database offline");
  });
});
