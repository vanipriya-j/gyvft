import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
const { complete, log, refresh } = vi.hoisted(() => ({
  complete: vi.fn(),
  log: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: refresh }));
vi.mock("@/lib/customer/circle-demo", () => ({
  completeDemoCircles: complete,
}));
vi.mock("@/lib/logging/logger", () => ({
  logger: { info: log, error: log, warn: log },
}));
import { POST } from "@/app/api/operations/demo-circles/route";
import { CircleError } from "@/lib/customer/circle-model";
const secret = "local-demo-circles-secret";
const post = (data: unknown, key: string | null = secret) =>
  POST(
    new Request("https://www.gyvft.com/api/operations/demo-circles", {
      method: "POST",
      headers: key ? { "x-setup-secret": key } : {},
      body: JSON.stringify(data),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  resetMemoryGuardsForTests();
  vi.stubEnv("SETUP_SECRET", secret);
  vi.stubEnv("DATABASE_URL", "postgresql://local-only");
  complete.mockResolvedValue({
    inserted: 5,
    corrected: 13,
    accounts: [],
    message: "Completed",
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("explicit demo-circle completion command", () => {
  it("rejects missing or bad operator access before opening the data command", async () => {
    expect((await post({ confirm: true }, null)).status).toBe(401);
    expect((await post({ confirm: true }, "bad")).status).toBe(401);
    expect(complete).not.toHaveBeenCalled();
  });
  it("requires an exact confirmation and accepts no password, migration or account override", async () => {
    for (const value of [
      {},
      { confirm: false },
      { confirm: true, password: "do-not-touch" },
      { confirm: true, migrate: true },
      { confirm: true, account_id: "another-user" },
    ])
      expect((await post(value)).status).toBe(400);
    expect(complete).not.toHaveBeenCalled();
    const r = await post({ confirm: true });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(complete).toHaveBeenCalledExactlyOnceWith();
  });
  it("reports a schema prerequisite without running migrations", async () => {
    complete.mockRejectedValueOnce(
      new CircleError(
        "SETUP_REQUIRED",
        "Approve and apply the Circles migration first.",
      ),
    );
    expect((await post({ confirm: true })).status).toBe(503);
  });
  it("fails closed for missing or conflicting demo accounts", async () => {
    complete.mockRejectedValueOnce(
      new CircleError(
        "CONFLICT",
        "Four original demo accounts could not be confirmed.",
      ),
    );
    expect((await post({ confirm: true })).status).toBe(409);
  });
  it("never leaks database credentials or partial-write claims on an unexpected failure", async () => {
    complete.mockRejectedValueOnce(
      new Error("postgresql://private:password@server"),
    );
    const r = await post({ confirm: true });
    const result = await r.json();
    expect(r.status).toBe(500);
    expect(result.diagnostic.code).toBe("DATABASE_ERROR");
    expect(result.reference).toEqual(expect.any(String));
    expect(
      JSON.stringify(result) + JSON.stringify(log.mock.calls),
    ).not.toContain("password@");
  });
});

it("supports a rollback-only check without invalidating pages or claiming data was saved", async () => {
  complete.mockResolvedValueOnce({
    inserted: 5,
    corrected: 14,
    accounts: [],
    checkOnly: true,
    message: "Check passed. No changes saved.",
  });
  const r = await post({ confirm: true, check_only: true });
  expect(r.status).toBe(200);
  expect(complete).toHaveBeenCalledWith({ checkOnly: true });
  expect(refresh).not.toHaveBeenCalled();
});
it("does not turn successful data completion into a false rollback claim when cache refresh fails", async () => {
  refresh.mockImplementationOnce(() => {
    throw Error("cache offline");
  });
  const r = await post({ confirm: true });
  expect(r.status).toBe(200);
  expect((await r.json()).ok).toBe(true);
});
