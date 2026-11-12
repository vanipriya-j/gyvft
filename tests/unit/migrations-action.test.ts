import { beforeEach, describe, expect, it, vi } from "vitest";
const { owner, run, sql } = vi.hoisted(() => ({
  owner: vi.fn(),
  run: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireStudioUser: owner }));
vi.mock("@/lib/database/client", () => ({ getSql: sql }));
vi.mock("@/lib/database/migrations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/database/migrations")>();
  return { ...actual, runPendingMigrations: run };
});
import { runMigrationsAction } from "@/app/studio/settings/migrations/actions";
import { MigrationBusyError } from "@/lib/database/migrations";
describe("owner-only migrations action", () => {
  beforeEach(() => vi.clearAllMocks());
  it("denies non-owner callers before opening a database connection", async () => {
    owner.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(runMigrationsAction()).rejects.toThrow("Forbidden");
    expect(owner).toHaveBeenCalledWith({ roles: ["owner"] });
    expect(sql).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
  it("reports a successful run to the owner", async () => {
    owner.mockResolvedValueOnce({ id: "owner-id" });
    run.mockResolvedValueOnce(["001_first.sql"]);
    const result = await runMigrationsAction();
    expect(result.ok).toBe(true);
    expect(result.applied).toEqual(["001_first.sql"]);
  });
  it("reports an overlapping migration without claiming success", async () => {
    owner.mockResolvedValueOnce({ id: "owner-id" });
    run.mockRejectedValueOnce(new MigrationBusyError());
    const result = await runMigrationsAction();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Another migration run");
  });
  it("does not leak SQL errors or connection secrets to the browser", async () => {
    owner.mockResolvedValueOnce({ id: "owner-id" });
    run.mockRejectedValueOnce(
      new Error("postgres://secret:password@host/private"),
    );
    const result = await runMigrationsAction();
    expect(result.ok).toBe(false);
    expect(result.applied).toEqual([]);
    expect(result.message).not.toContain("secret");
  });
});
