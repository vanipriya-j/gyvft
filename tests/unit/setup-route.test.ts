import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
const { sql, run, list } = vi.hoisted(() => ({
  sql: vi.fn(),
  run: vi.fn(),
  list: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.20" }),
}));
vi.mock("@/lib/database/client", () => ({ getSql: sql }));
vi.mock("@/lib/database/migrations", async (original) => ({
  ...(await original<typeof import("@/lib/database/migrations")>()),
  runPendingMigrations: run,
  listMigrations: list,
}));
import { GET, POST } from "@/app/api/setup/route";
import { MigrationExecutionError } from "@/lib/database/migrations";
import { validSetupSecret } from "@/lib/security/setup-secret";
const secret = "test-setup-secret-with-at-least-32-characters";
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/setup", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
describe("public setup with secret authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMemoryGuardsForTests();
    vi.stubEnv("SETUP_SECRET", secret);
    vi.stubEnv("DATABASE_URL", "postgres://configured-for-test");
    list.mockResolvedValue([]);
    run.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("exposes readiness booleans without secrets, users or database queries", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({
      hasSetupSecret: true,
      hasDatabaseUrl: true,
      ready: true,
    });
    expect(sql).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects missing/wrong secrets before reading the database", async () => {
    expect((await post({ action: "migrate", confirm: true })).status).toBe(401);
    expect((await post({ secret: "wrong", action: "status" })).status).toBe(
      401,
    );
    expect(sql).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
  it("disables setup when its secret is missing or too short", async () => {
    vi.stubEnv("SETUP_SECRET", "short");
    expect(
      (await post({ secret: "short", action: "migrate", confirm: true }))
        .status,
    ).toBe(503);
    expect(sql).not.toHaveBeenCalled();
  });
  it("disables setup when no database URL is configured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await post({ secret, action: "status" })).status).toBe(503);
    expect(sql).not.toHaveBeenCalled();
  });
  it("can check migrations with the secret without a Studio login", async () => {
    list.mockResolvedValue([{ id: "001_test.sql", appliedAt: null }]);
    const response = await post({ secret, action: "status" });
    expect(response.status).toBe(200);
    expect((await response.json()).migrations).toHaveLength(1);
    expect(run).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation for database mutation", async () => {
    expect((await post({ secret, action: "migrate" })).status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });
  it("runs packaged migrations after secret verification and confirmation", async () => {
    run.mockResolvedValue(["001_test.sql"]);
    const response = await post({ secret, action: "migrate", confirm: true });
    expect(response.status).toBe(200);
    expect((await response.json()).applied).toEqual(["001_test.sql"]);
    expect(run).toHaveBeenCalledOnce();
  });
  it("does not return database exception details or secrets", async () => {
    run.mockRejectedValue(new Error("postgres://private:password@server"));
    const response = await post({ secret, action: "migrate", confirm: true });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      "private:password",
    );
  });
  it("rejects malformed and oversized requests", async () => {
    expect((await post(null)).status).toBe(400);
    expect((await post({ secret: "x".repeat(5000) })).status).toBe(413);
    expect(sql).not.toHaveBeenCalled();
  });
  it("limits repeated attempts", async () => {
    for (let i = 0; i < 10; i++)
      await post({ secret: "wrong", action: "status" });
    expect((await post({ secret, action: "status" })).status).toBe(429);
    expect(sql).not.toHaveBeenCalled();
  });
  it("handles different secret lengths safely", () => {
    expect(validSetupSecret("")).toBe(false);
    expect(validSetupSecret(secret + "extra")).toBe(false);
    expect(validSetupSecret(secret)).toBe(true);
    expect(validSetupSecret("x".repeat(2000))).toBe(false);
  });
  it("accepts an 11-character setup secret and rejects a 10-character one", async () => {
    const fixture = "x".repeat(11);
    vi.stubEnv("SETUP_SECRET", fixture);
    expect(validSetupSecret(fixture)).toBe(true);
    expect((await (await GET()).json()).ready).toBe(true);
    expect((await post({ secret: fixture, action: "status" })).status).toBe(
      200,
    );
    vi.stubEnv("SETUP_SECRET", "x".repeat(10));
    expect(validSetupSecret("x".repeat(10))).toBe(false);
    expect((await (await GET()).json()).ready).toBe(false);
  });
  it("streams progress before the final result", async () => {
    run.mockImplementationOnce(async (_sql, progress) => {
      progress({
        phase: "applying",
        total: 1,
        completed: 0,
        filename: "001_test.sql",
      });
      progress({ phase: "committing", total: 1, completed: 1 });
      return ["001_test.sql"];
    });
    const response = await post({
      secret,
      action: "migrate",
      confirm: true,
      stream: true,
    });
    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson",
    );
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events[0].type).toBe("progress");
    expect(
      events.some((event) => event.progress?.filename === "001_test.sql"),
    ).toBe(true);
    expect(events.at(-1).result.ok).toBe(true);
  });
  it("returns a safe failed migration filename and SQLSTATE", async () => {
    const cause = Object.assign(
      new Error("private SQL including credentials"),
      { code: "42501" },
    );
    run.mockRejectedValueOnce(
      new MigrationExecutionError("001_test.sql", cause),
    );
    const response = await post({
      secret,
      action: "migrate",
      confirm: true,
      stream: true,
    });
    const text = await response.text();
    const result = JSON.parse(text.trim().split("\n").at(-1)!).result;
    expect(result.ok).toBe(false);
    expect(result.diagnostic).toEqual({
      code: "42501",
      filename: "001_test.sql",
    });
    expect(text).not.toContain("private SQL");
  });
  it("keeps a committed run successful if only refreshing history fails", async () => {
    run.mockResolvedValueOnce(["001_test.sql"]);
    list.mockRejectedValueOnce(new Error("read failed"));
    const response = await post({ secret, action: "migrate", confirm: true });
    expect((await response.json()).ok).toBe(true);
  });
  it("never lets a request select legacy Studio migrations", async () => {
    const response = await post({
      secret,
      action: "migrate",
      confirm: true,
      scope: "all",
    });
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith(undefined, undefined, "customer");
    expect(list).toHaveBeenCalledWith(undefined, "customer");
  });
});
