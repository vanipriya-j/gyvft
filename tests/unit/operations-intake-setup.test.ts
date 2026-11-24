import { readFileSync, readdirSync } from "node:fs";
import { beforeEach, it, expect, vi } from "vitest";
import type { Sql } from "postgres";
const files = vi.hoisted(() => ({ read: vi.fn(), list: vi.fn() }));
vi.mock("fs/promises", () => ({ readFile: files.read, readdir: files.list }));
import { runPendingMigrations } from "@/lib/database/migrations";
import {
  operationsIntakeFile,
  operationsIntakePrerequisites,
} from "@/lib/database/operations-intake-activation";
const source = readFileSync(
  "supabase/migrations/" + operationsIntakeFile,
  "utf8",
);
function connection(applied: readonly string[]) {
  const tx = Object.assign(
    vi.fn(async (parts: TemplateStringsArray) => {
      const q = parts.join("?");
      if (q.includes("pg_try_advisory")) return [{ acquired: true }];
      if (q.includes("information_schema")) return [{ uses_filename: false }];
      if (q.startsWith("SELECT id")) return applied.map((id) => ({ id }));
      return [];
    }),
    { unsafe: vi.fn() },
  );
  const begin = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));
  return { sql: { begin } as unknown as Sql, tx, begin };
}
beforeEach(() => {
  vi.clearAllMocks();
  files.read.mockResolvedValue(source);
  files.list.mockResolvedValue(readdirSync("supabase/migrations"));
});
it("applies only the pinned intake SQL and skips it when already recorded", async () => {
  const first = connection(operationsIntakePrerequisites);
  expect(
    await runPendingMigrations(first.sql, undefined, "operations-intake"),
  ).toEqual([operationsIntakeFile]);
  expect(first.tx.unsafe).toHaveBeenCalledExactlyOnceWith(source);
  const replay = connection([
    ...operationsIntakePrerequisites,
    operationsIntakeFile,
  ]);
  expect(
    await runPendingMigrations(replay.sql, undefined, "operations-intake"),
  ).toEqual([]);
  expect(replay.tx.unsafe).not.toHaveBeenCalled();
});
it("blocks changed SQL and missing prerequisites instead of applying other files", async () => {
  const missing = connection([]);
  await expect(
    runPendingMigrations(missing.sql, undefined, "operations-intake"),
  ).rejects.toThrow("Earlier updates need separate review");
  expect(missing.tx.unsafe).not.toHaveBeenCalled();
  files.read.mockResolvedValue(source + "\n-- changed");
  const changed = connection(operationsIntakePrerequisites);
  await expect(
    runPendingMigrations(changed.sql, undefined, "operations-intake"),
  ).rejects.toThrow("differs from the reviewed");
  expect(changed.begin).not.toHaveBeenCalled();
});
