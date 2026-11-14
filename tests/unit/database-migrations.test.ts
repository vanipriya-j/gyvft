import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
const { files, read } = vi.hoisted(() => ({ files: vi.fn(), read: vi.fn() }));
vi.mock("fs/promises", () => ({ readdir: files, readFile: read }));
import {
  listMigrations,
  migrationFiles,
  MigrationBusyError,
  runPendingMigrations,
} from "@/lib/database/migrations";
function connection(
  options: { locked?: boolean; applied?: string[]; failure?: boolean } = {},
) {
  const tx = Object.assign(
    vi.fn(async (parts: TemplateStringsArray) => {
      const text = parts.join("?");
      if (text.includes("pg_try_advisory_xact_lock"))
        return [{ acquired: !options.locked }];
      if (text.startsWith("SELECT id"))
        return (options.applied ?? []).map((id) => ({ id }));
      return [];
    }),
    {
      unsafe: vi.fn(async () => {
        if (options.failure) throw new Error("SQL failed");
      }),
    },
  );
  const sql = Object.assign(vi.fn(), {
    begin: vi.fn(async (fn: (transaction: unknown) => Promise<unknown>) =>
      fn(tx),
    ),
  });
  return { sql: sql as unknown as Sql, tx, begin: sql.begin };
}
describe("database migrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    files.mockResolvedValue([
      "002_second.sql",
      "001_first.sql",
      "notes.txt",
      "../injected.sql",
    ]);
    read.mockImplementation(async (p: string) =>
      p.endsWith("001_first.sql") ? "FIRST SQL" : "SECOND SQL",
    );
  });
  it("accepts only packaged migration filenames and sorts them", async () => {
    expect(await migrationFiles()).toEqual(["001_first.sql", "002_second.sql"]);
  });
  it("does not create migration history when simply viewing status", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ name: null }]);
    expect(await listMigrations(query as unknown as Sql)).toEqual([
      { id: "001_first.sql", appliedAt: null },
      { id: "002_second.sql", appliedAt: null },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("skips applied migrations and records pending SQL within the transaction", async () => {
    const { sql, tx } = connection({ applied: ["001_first.sql"] });
    expect(await runPendingMigrations(sql)).toEqual(["002_second.sql"]);
    expect(tx.unsafe).toHaveBeenCalledExactlyOnceWith("SECOND SQL");
    const inserts = tx.mock.calls.filter(([p]) =>
      p.join("").startsWith("INSERT"),
    );
    expect(inserts).toHaveLength(1);
  });
  it("rejects overlapping runs before executing SQL or creating history", async () => {
    const { sql, tx } = connection({ locked: true });
    await expect(runPendingMigrations(sql)).rejects.toBeInstanceOf(
      MigrationBusyError,
    );
    expect(tx.unsafe).not.toHaveBeenCalled();
    expect(tx.mock.calls.some(([p]) => p.join("").startsWith("CREATE"))).toBe(
      false,
    );
  });
  it("propagates SQL failures out of the transaction without recording success", async () => {
    const { sql, tx } = connection({ failure: true });
    await expect(runPendingMigrations(sql)).rejects.toThrow("001_first.sql");
    expect(tx.mock.calls.some(([p]) => p.join("").startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("reports the actual pending file then commit, without claiming completion before commit", async () => {
    const { sql } = connection({ applied: ["001_first.sql"] });
    const events: unknown[] = [];
    await runPendingMigrations(sql, (event) => events.push(event));
    expect(events).toEqual([
      { phase: "checking", total: 0, completed: 0 },
      { phase: "applying", total: 1, completed: 0, filename: "002_second.sql" },
      { phase: "committing", total: 1, completed: 1 },
    ]);
  });
});
