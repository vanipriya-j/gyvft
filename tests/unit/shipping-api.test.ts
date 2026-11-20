import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  account: vi.fn(),
  shipping: vi.fn(),
  refresh: vi.fn(),
  command: vi.fn(),
  sql: vi.fn(),
  after: vi.fn(),
}));
vi.mock("@/lib/customer/session", () => ({ getCustomerAccount: mock.account }));
vi.mock("@/lib/customer/shipping", () => ({
  shipmentsForProject: mock.shipping,
  refreshDueShipments: mock.refresh,
}));
vi.mock("@/lib/customer/shipping-commands", () => ({
  shippingCommand: mock.command,
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => mock.sql }));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: vi.fn(),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: mock.after,
}));
import { GET } from "@/app/api/customer/shipments/route";
import { GET as cron } from "@/app/api/cron/shipping/route";
import { POST } from "@/app/api/operations/requests/route";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  resetMemoryGuardsForTests();
  vi.stubEnv("SETUP_SECRET", "local-operator-secret");
  vi.stubEnv("CRON_SECRET", "local-cron-secret");
});
afterEach(() => vi.unstubAllEnvs());
it("requires customer identity and passes account ownership to the shipment query", async () => {
  mock.account.mockResolvedValue(null);
  expect(
    (
      await GET(
        new Request(`http://localhost/api/customer/shipments?project_id=${id}`),
      )
    ).status,
  ).toBe(401);
  expect(mock.shipping).not.toHaveBeenCalled();
  mock.account.mockResolvedValue({ id: "owner", email: "owner@example.test" });
  mock.shipping.mockResolvedValue({ plan: null, shipments: [] });
  const r = await GET(
    new Request(`http://localhost/api/customer/shipments?project_id=${id}`),
  );
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(mock.shipping).toHaveBeenCalledWith(id, "owner");
  expect(mock.refresh).not.toHaveBeenCalled();
});
it("requires the operator secret for every shipping command before any provider or database work", async () => {
  for (const op of [
    "shipping_settings_status",
    "shipping_settings_save",
    "shipping_settings_test",
    "shipping_detail",
    "shipping_plan",
    "shipping_save",
    "shipping_archive",
    "shipping_manual",
    "shipping_book",
    "shipping_refresh",
    "shipping_pickup",
  ]) {
    const r = await POST(
      new Request("http://localhost/api/operations/requests", {
        method: "POST",
        headers: { cookie: "gyvft_customer_session=customer" },
        body: JSON.stringify({ op, project_id: id }),
      }),
    );
    expect(r.status).toBe(401);
  }
  expect(mock.command).not.toHaveBeenCalled();
  expect(mock.sql).not.toHaveBeenCalled();
});
it("guards cron with its separate secret", async () => {
  expect(
    (await cron(new Request("http://localhost/api/cron/shipping"))).status,
  ).toBe(401);
  expect(mock.refresh).not.toHaveBeenCalled();
  mock.refresh.mockResolvedValue({ checked: 2 });
  const r = await cron(
    new Request("http://localhost/api/cron/shipping", {
      headers: { authorization: "Bearer local-cron-secret" },
    }),
  );
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ checked: 2 });
});
