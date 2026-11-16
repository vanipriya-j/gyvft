import { beforeEach, afterEach, it, expect, vi, describe } from "vitest";
const mock = vi.hoisted(() => ({
  sql: vi.fn(),
  mutate: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => mock.sql }));
vi.mock("@/lib/customer/pilot-admin", () => ({
  mutatePilot: mock.mutate,
  pilotList: mock.list,
  pilotDetail: mock.detail,
  PilotError: class extends Error {},
}));
vi.mock("@/lib/customer/notifications", () => ({
  deliverNotifications: vi.fn(),
  scheduleNotifications: vi.fn(),
}));
import { POST } from "@/app/api/operations/requests/route";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
describe("operator authorization", () => {
  beforeEach(() => {
    vi.stubEnv("SETUP_SECRET", "fixture-secret-for-admin");
    vi.clearAllMocks();
    resetMemoryGuardsForTests();
  });
  afterEach(() => vi.unstubAllEnvs());
  it("does not let customer cookies replace the operator secret", async () => {
    const r = await POST(
      new Request("https://www.gyvft.com/api/operations/requests", {
        method: "POST",
        headers: { cookie: "gyvft_customer_session=customer" },
        body: JSON.stringify({ op: "list" }),
      }),
    );
    expect(r.status).toBe(401);
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.sql).not.toHaveBeenCalled();
  });
  it("rejects a wrong operator secret before touching customer records", async () => {
    const r = await POST(
      new Request("https://www.gyvft.com/api/operations/requests", {
        method: "POST",
        headers: { "x-setup-secret": "wrong" },
        body: JSON.stringify({
          op: "detail",
          id: "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );
    expect(r.status).toBe(401);
    expect(mock.detail).not.toHaveBeenCalled();
    expect(mock.mutate).not.toHaveBeenCalled();
  });
  it("returns an uncached list after valid operator authentication", async () => {
    mock.list.mockResolvedValue([]);
    const r = await POST(
      new Request("https://www.gyvft.com/api/operations/requests", {
        method: "POST",
        headers: { "x-setup-secret": "fixture-secret-for-admin" },
        body: JSON.stringify({ op: "list" }),
      }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(mock.list).toHaveBeenCalledOnce();
  });
});
