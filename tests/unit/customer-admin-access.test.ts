import { beforeEach, afterEach, it, expect, vi, describe } from "vitest";
const mock = vi.hoisted(() => ({
  sql: vi.fn(),
  mutate: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  send: vi.fn(),
  status: vi.fn(),
  deliver: vi.fn(),
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => mock.sql }));
vi.mock("@/lib/customer/pilot-admin", () => ({
  mutatePilot: mock.mutate,
  pilotList: mock.list,
  pilotDetail: mock.detail,
  PilotError: class extends Error {},
}));
vi.mock("@/lib/customer/notifications", () => ({
  deliverNotifications: mock.deliver,
  scheduleNotifications: vi.fn(),
}));
vi.mock("@/services/notifications/transports", async (original) => ({
  ...(await original<typeof import("@/services/notifications/transports")>()),
  sendNotificationEmail: mock.send,
}));
vi.mock("@/lib/customer/notification-status", () => ({
  notificationStatus: mock.status,
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
  const command = (
    op: string,
    secret = "fixture-secret-for-admin",
    extra = {},
  ) =>
    POST(
      new Request("https://www.gyvft.com/api/operations/requests", {
        method: "POST",
        headers: { "x-setup-secret": secret },
        body: JSON.stringify({ op, ...extra }),
      }),
    );
  it("protects notification status, retry and test sends with operator authorization", async () => {
    for (const op of [
      "notification_status",
      "aarla_savings_status",
      "retry_all_notifications",
      "test_notification_email",
    ])
      expect((await command(op, "wrong")).status).toBe(401);
    expect(mock.send).not.toHaveBeenCalled();
    expect(mock.deliver).not.toHaveBeenCalled();
    expect(mock.status).not.toHaveBeenCalled();
  });
  it("sends a test only to the configured team inbox, ignoring a caller-supplied recipient", async () => {
    vi.stubEnv("GYVFT_LEADS_EMAIL", "team@example.test");
    mock.send.mockResolvedValue("provider-id");
    const r = await command("test_notification_email", undefined, {
      request_id: "11111111-1111-4111-8111-111111111111",
      to: "somebody@example.test",
    });
    expect(r.status).toBe(200);
    expect(mock.send.mock.calls[0][0].to).toBe("team@example.test");
    expect((await r.json()).message).toContain("Check the team inbox");
  });
  it("requires an action key before sending a test and limits repeated test sends", async () => {
    expect((await command("test_notification_email")).status).toBe(400);
    expect(mock.send).not.toHaveBeenCalled();
    for (let i = 0; i < 2; i++)
      await command("test_notification_email", undefined, {
        request_id: "11111111-1111-4111-8111-111111111111",
      });
    expect(
      (
        await command("test_notification_email", undefined, {
          request_id: "11111111-1111-4111-8111-111111111111",
        })
      ).status,
    ).toBe(429);
  });
  it("reports actual retry counts without claiming inbox delivery", async () => {
    mock.deliver.mockResolvedValue({ candidates: 2, accepted: 1 });
    const r = await command("retry_all_notifications");
    expect(r.status).toBe(200);
    expect((await r.json()).message).toContain("1 accepted by provider");
  });
});
