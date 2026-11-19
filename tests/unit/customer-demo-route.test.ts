import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
const { seed, log } = vi.hoisted(() => ({ seed: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/customer/demo-seed", () => ({
  seedCustomerDemos: seed,
  DemoSeedConflict: class DemoSeedConflict extends Error {},
}));
vi.mock("@/lib/logging/logger", () => ({ logger: { info: log, error: log } }));
import { DemoSeedConflict } from "@/lib/customer/demo-seed";
import { POST } from "@/app/api/operations/demo-data/route";
const secret = "local-demo-operator-secret",
  password = "A private local-only demo password";
const post = (body: unknown, key: string | null = secret) =>
  POST(
    new Request("http://localhost/api/operations/demo-data", {
      method: "POST",
      headers: key ? { "x-setup-secret": key } : {},
      body: JSON.stringify(body),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  resetMemoryGuardsForTests();
  vi.stubEnv("SETUP_SECRET", secret);
  vi.stubEnv("DATABASE_URL", "postgresql://local-only-test");
  seed.mockResolvedValue({
    inserted: 123,
    accounts: [1, 2, 3, 4],
    message: "Ready",
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("explicit insert-only customer demo command", () => {
  it("rejects missing/wrong operator access before seed execution", async () => {
    expect((await post({ password, confirm: true }, null)).status).toBe(401);
    expect((await post({ password, confirm: true }, "bad")).status).toBe(401);
    expect(seed).not.toHaveBeenCalled();
  });
  it("requires confirmation, valid password and the exact command shape", async () => {
    for (const body of [
      { password },
      { password, confirm: false },
      { password: "short", confirm: true },
      { password, confirm: true, migrate: true },
    ])
      expect((await post(body)).status).toBe(400);
    expect(seed).not.toHaveBeenCalled();
  });
  it("runs only on an authenticated, explicitly confirmed POST and never logs the password", async () => {
    const r = await post({ password, confirm: true });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(seed).toHaveBeenCalledExactlyOnceWith(password);
    expect(JSON.stringify(log.mock.calls)).not.toContain(password);
  });
  it("reports collisions without replacing existing accounts", async () => {
    seed.mockRejectedValueOnce(
      new DemoSeedConflict(
        "An account already occupies a demo email. Nothing was changed.",
      ),
    );
    expect((await post({ password, confirm: true })).status).toBe(409);
  });
  it("reports missing schema without running migrations or leaking database details", async () => {
    seed.mockRejectedValueOnce(
      Object.assign(new Error("postgresql://private:credentials@secret"), {
        code: "42703",
      }),
    );
    const r = await post({ password, confirm: true });
    const body = await r.json();
    expect(r.status).toBe(500);
    expect(body.message).toContain("no migration was run");
    expect(JSON.stringify(body)).not.toContain("credentials");
    expect(JSON.stringify(log.mock.calls)).not.toContain("credentials");
  });
});
