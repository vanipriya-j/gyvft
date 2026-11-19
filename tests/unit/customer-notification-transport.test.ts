import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotificationEmail } from "@/services/notifications/transports";
import { GET } from "@/app/api/cron/customer-notifications/route";
const { deliver } = vi.hoisted(() => ({ deliver: vi.fn() }));
vi.mock("@/lib/customer/notifications", () => ({
  deliverNotifications: deliver,
}));
const fetchMock = vi.fn();
const input = {
  id: "fixture-id",
  to: "customer@example.test",
  subject: "Options ready",
  text: "Sign in securely.",
};
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RESEND_API_KEY", "re_fixture");
  vi.stubEnv("RESEND_FROM_EMAIL", "gifts@example.test");
  fetchMock.mockReset();
  deliver.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("transactional email transport", () => {
  it("uses the provider deduplication key and bounded request timeout", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "accepted-id" }));
    expect(await sendNotificationEmail(input)).toBe("accepted-id");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.resend.com/emails");
    const options = fetchMock.mock.calls[0][1];
    expect(options.headers["Idempotency-Key"]).toBe(
      "gyvft-notification-fixture-id",
    );
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body).to).toEqual([input.to]);
  });
  it("does not hide an unverified sender behind a testing-domain fallback", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: "private provider detail" }, { status: 403 }),
    );
    await expect(sendNotificationEmail(input)).rejects.toMatchObject({
      code: "EMAIL_HTTP_403",
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("classifies rate limits and ambiguous provider responses as safely retryable", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 429 }));
    await expect(sendNotificationEmail(input)).rejects.toMatchObject({
      code: "EMAIL_HTTP_429",
      retryable: true,
    });
    fetchMock.mockResolvedValueOnce(Response.json({}));
    await expect(sendNotificationEmail(input)).rejects.toMatchObject({
      code: "EMAIL_RESPONSE_UNCERTAIN",
      retryable: true,
    });
  });
  it("does not call a provider when email is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendNotificationEmail(input)).rejects.toMatchObject({
      code: "EMAIL_NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
describe("customer recovery cron", () => {
  it("requires the cron secret and keeps recovery independent of Studio", async () => {
    vi.stubEnv("CRON_SECRET", "local-cron-secret");
    expect(
      (
        await GET(
          new Request("https://www.gyvft.com/api/cron/customer-notifications"),
        )
      ).status,
    ).toBe(401);
    expect(deliver).not.toHaveBeenCalled();
    deliver.mockResolvedValue({ candidates: 2, accepted: 1 });
    const r = await GET(
      new Request("https://www.gyvft.com/api/cron/customer-notifications", {
        headers: { authorization: "Bearer local-cron-secret" },
      }),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, candidates: 2, accepted: 1 });
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});
