import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  list: vi.fn(),
  getSql: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/database/client", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/database/migrations", async (original) => ({
  ...(await original<typeof import("@/lib/database/migrations")>()),
  runPendingMigrations: mocks.run,
  listMigrations: mocks.list,
}));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: vi.fn(),
}));
import { POST } from "@/app/api/setup/route";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
import { MigrationPreconditionError } from "@/lib/database/migrations";
beforeEach(() => {
  vi.clearAllMocks();
  resetMemoryGuardsForTests();
  vi.stubEnv("SETUP_SECRET", "local-setup-operator-secret");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
  mocks.headers.mockResolvedValue(new Headers());
  mocks.getSql.mockReturnValue("fixture-sql");
  mocks.list.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());
const command = (data: Record<string, unknown>) =>
  POST(
    new Request("https://www.gyvft.com/api/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }),
  );
it("requires authentication and explicit invocation", async () => {
  expect(
    (await command({ action: "shipping-migrate", confirm: true })).status,
  ).toBe(401);
  expect(mocks.run).not.toHaveBeenCalled();
  expect(
    (
      await command({
        action: "shipping-migrate",
        secret: "local-setup-operator-secret",
      })
    ).status,
  ).toBe(400);
  expect(mocks.run).not.toHaveBeenCalled();
});
it("checks status without running SQL", async () => {
  const r = await command({
    action: "status",
    secret: "local-setup-operator-secret",
  });
  expect(r.status).toBe(200);
  expect(mocks.run).not.toHaveBeenCalled();
  expect(mocks.list).toHaveBeenCalledWith("fixture-sql", "customer");
});
it("always selects the shipping scope regardless of a supplied filename", async () => {
  mocks.run.mockResolvedValue(["20261120000001_shipping.sql"]);
  const r = await command({
    action: "shipping-migrate",
    secret: "local-setup-operator-secret",
    confirm: true,
    filename: "20260725000001_init.sql",
  });
  expect(r.status).toBe(200);
  expect(mocks.run).toHaveBeenCalledWith("fixture-sql", undefined, "shipping");
});
it("requires explicit approval and selects only the proposal scope for agent activation", async () => {
  expect(
    (
      await command({
        action: "agent-proposals-migrate",
        secret: "local-setup-operator-secret",
      })
    ).status,
  ).toBe(400);
  expect(mocks.run).not.toHaveBeenCalled();
  mocks.run.mockResolvedValue([
    "20261124000001_gift_option_images.sql",
    "20261124000002_agent_proposals.sql",
  ]);
  const response = await command({
    action: "agent-proposals-migrate",
    secret: "local-setup-operator-secret",
    confirm: true,
    filename: "20260725000001_init.sql",
  });
  expect(response.status).toBe(200);
  expect(mocks.run).toHaveBeenCalledExactlyOnceWith(
    "fixture-sql",
    undefined,
    "agent-proposals",
  );
});
it("returns a blocked prerequisite without claiming migration success", async () => {
  mocks.run.mockRejectedValue(
    new MigrationPreconditionError("Earlier updates need separate review."),
  );
  const r = await command({
    action: "shipping-migrate",
    secret: "local-setup-operator-secret",
    confirm: true,
  });
  expect(r.status).toBe(409);
  expect(await r.json()).toMatchObject({
    ok: false,
    message: "Earlier updates need separate review.",
  });
});
