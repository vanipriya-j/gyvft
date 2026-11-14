import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
const { sql, getSql, json } = vi.hoisted(() => ({
  sql: vi.fn(),
  getSql: vi.fn(),
  json: vi.fn((value: unknown) => value),
}));
vi.mock("@/lib/database/client", () => ({ getSql }));
import {
  recordCustomerEvent,
  sanitizeCustomerEventMetadata,
} from "@/lib/customer/observability";
import { POST } from "@/app/api/operations/route";
const secret = "operator-secret-fixture-long-enough";
const request = (value: unknown) =>
  new Request("http://localhost/api/operations", {
    method: "POST",
    body: JSON.stringify(value),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.44",
    },
  });
describe("operator reporting and safe events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMemoryGuardsForTests();
    vi.stubEnv("SETUP_SECRET", secret);
    vi.stubEnv("DATABASE_URL", "postgres://local-fixture");
    getSql.mockReturnValue(Object.assign(sql, { json }));
    sql.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects invalid operator secrets before any database access", async () => {
    expect((await POST(request({ secret: "wrong" }))).status).toBe(401);
    expect(getSql).not.toHaveBeenCalled();
    expect(sql).not.toHaveBeenCalled();
  });
  it("drops credentials, PII, nested payloads and unsafe diagnostic strings", () => {
    expect(
      sanitizeCustomerEventMetadata({
        route: "/account/login",
        operation: "login",
        code: "INVALID_CREDENTIALS",
        status: 401,
        durationMs: 12.5,
        email: "person@example.test",
        ip: "1.2.3.4",
        password: "private",
        token: "private",
        payload: { secret: "private" },
      }),
    ).toEqual({
      route: "/account/login",
      operation: "login",
      code: "INVALID_CREDENTIALS",
      status: 401,
      durationMs: 13,
    });
    expect(
      sanitizeCustomerEventMetadata({
        code: "postgres://private:password@host",
        route: "/account?token=private",
        operation: { nested: "private" },
      }),
    ).toEqual({});
  });
  it("persists only allowlisted metadata and hashed-free diagnostic identifiers", async () => {
    await recordCustomerEvent("session.failed", {
      accountId: "not-a-uuid",
      requestId: "not-a-uuid",
      metadata: {
        operation: "login",
        code: "INVALID_CREDENTIALS",
        password: "private",
      },
    });
    expect(json).toHaveBeenCalledWith({
      operation: "login",
      code: "INVALID_CREDENTIALS",
    });
    const values = sql.mock.calls[0].slice(1);
    expect(values[0]).toBe("session.failed");
    expect(values[1]).toBeNull();
    expect(values[2]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(values)).not.toContain("private");
  });
  it("fails open when event storage is unavailable", async () => {
    sql.mockRejectedValueOnce(new Error("postgres://private:password@host"));
    await expect(
      recordCustomerEvent("app.error", { metadata: { code: "42P01" } }),
    ).resolves.toBeUndefined();
  });
  it("does not store unknown event types", async () => {
    await recordCustomerEvent("password.raw");
    expect(sql).not.toHaveBeenCalled();
  });
  it("reports aggregate source counts and sanitizes stored diagnostics again", async () => {
    sql
      .mockResolvedValueOnce([{ total: "4", recent: "3" }])
      .mockResolvedValueOnce([{ active: "2", active_accounts: "2" }])
      .mockResolvedValueOnce([{ total: "6", recent: "5", converted: "1" }])
      .mockResolvedValueOnce([{ accounts_with_requests: "3" }])
      .mockResolvedValueOnce([
        { stage: 0, count: "5" },
        { stage: 7, count: "1" },
      ])
      .mockResolvedValueOnce([{ event_type: "session.failed", count: "2" }])
      .mockResolvedValueOnce([
        {
          event_type: "session.failed",
          request_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          metadata: {
            code: "INVALID_CREDENTIALS",
            operation: "login",
            email: "private@example.test",
            secret: "private",
          },
          created_at: "2026-11-14T00:00:00Z",
        },
      ]);
    const response = await POST(request({ secret }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(
      body.metrics.find(
        (metric: { key: string }) => metric.key === "accounts_total",
      ).value,
    ).toBe(4);
    expect(
      body.metrics.find(
        (metric: { key: string }) => metric.key === "signin_failures_30d",
      ).value,
    ).toBe(2);
    expect(body.recentErrors[0].code).toBe("INVALID_CREDENTIALS");
    expect(JSON.stringify(body)).not.toContain("private");
    const queries = sql.mock.calls.map(([parts]) => parts.join(""));
    expect(
      queries
        .filter((query) => query.includes("FROM customer_projects"))
        .every((query) =>
          query.includes(
            "COALESCE(submission_key, '') NOT LIKE 'gyvft-demo-%'",
          ),
        ),
    ).toBe(true);
  });
});
