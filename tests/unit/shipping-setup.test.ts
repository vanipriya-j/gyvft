import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import type { Sql } from "postgres";
const mocks = vi.hoisted(() => ({ files: vi.fn(), read: vi.fn() }));
vi.mock("fs/promises", () => ({ readdir: mocks.files, readFile: mocks.read }));
import {
  runPendingMigrations,
  MigrationPreconditionError,
} from "@/lib/database/migrations";
const filename = "20261120000001_shipping.sql";
const customerFiles = readdirSync("supabase/migrations")
  .filter((f) => /^202611/.test(f))
  .sort();
const approvedSQL = readFileSync(`supabase/migrations/${filename}`, "utf8");
function connection(applied: string[]) {
  const tx = Object.assign(
    vi.fn(async (parts: TemplateStringsArray) => {
      const q = parts.join("?");
      if (q.includes("pg_try_advisory")) return [{ acquired: true }];
      if (q.includes("information_schema.columns"))
        return [{ uses_filename: false }];
      if (q.startsWith("SELECT id")) return applied.map((id) => ({ id }));
      return [];
    }),
    { unsafe: vi.fn() },
  );
  const begin = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));
  return { tx, begin, sql: { begin } as unknown as Sql };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.files.mockResolvedValue(customerFiles);
  mocks.read.mockResolvedValue(approvedSQL);
});
describe("approved shipping-only migration", () => {
  it("executes exactly the approved SQL, not other bundled migrations", async () => {
    const { sql, tx } = connection(customerFiles.filter((f) => f < filename));
    expect(await runPendingMigrations(sql, undefined, "shipping")).toEqual([
      filename,
    ]);
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(tx.unsafe).toHaveBeenCalledExactlyOnceWith(approvedSQL);
  });
  it("blocks when an earlier migration is missing rather than applying it implicitly", async () => {
    const { sql, tx } = connection([]);
    await expect(
      runPendingMigrations(sql, undefined, "shipping"),
    ).rejects.toBeInstanceOf(MigrationPreconditionError);
    expect(tx.unsafe).not.toHaveBeenCalled();
  });
  it("rejects modified SQL before opening a transaction", async () => {
    mocks.read.mockResolvedValue(approvedSQL + "\n-- altered");
    const { sql, begin } = connection(customerFiles);
    await expect(
      runPendingMigrations(sql, undefined, "shipping"),
    ).rejects.toThrow("differs from the approved");
    expect(begin).not.toHaveBeenCalled();
  });
  it("does not execute an already recorded update again", async () => {
    const { sql, tx } = connection(customerFiles);
    expect(await runPendingMigrations(sql, undefined, "shipping")).toEqual([]);
    expect(tx.unsafe).not.toHaveBeenCalled();
  });
});
