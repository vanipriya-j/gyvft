import { beforeEach, describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import type { Sql } from "postgres";
const mocks = vi.hoisted(() => ({ files: vi.fn(), read: vi.fn() }));
vi.mock("fs/promises", () => ({ readdir: mocks.files, readFile: mocks.read }));
import { runPendingMigrations } from "@/lib/database/migrations";
import {
  optionImagesFile,
  optionImagesPrerequisites,
  agentProposalsFile,
} from "@/lib/database/option-images-activation";
const contents = readFileSync(
  `supabase/migrations/${optionImagesFile}`,
  "utf8",
);
function connection(applied: readonly string[]) {
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
  mocks.files.mockResolvedValue(readdirSync("supabase/migrations"));
  mocks.read.mockResolvedValue(contents);
});
describe("explicit option-image activation", () => {
  it("runs only the two proposal workspace files and checks both hashes", async () => {
    const agentSQL = readFileSync(
      `supabase/migrations/${agentProposalsFile}`,
      "utf8",
    );
    mocks.read.mockImplementation(async (path: string) =>
      path.endsWith(agentProposalsFile) ? agentSQL : contents,
    );
    const { sql, tx } = connection(optionImagesPrerequisites);
    expect(
      await runPendingMigrations(sql, undefined, "agent-proposals"),
    ).toEqual([optionImagesFile, agentProposalsFile]);
    expect(tx.unsafe.mock.calls.map((call) => call[0])).toEqual([
      contents,
      agentSQL,
    ]);
    mocks.read.mockImplementation(async (path: string) =>
      path.endsWith(agentProposalsFile) ? agentSQL + "\n-- changed" : contents,
    );
    const changed = connection(optionImagesPrerequisites);
    await expect(
      runPendingMigrations(changed.sql, undefined, "agent-proposals"),
    ).rejects.toThrow("differs from the reviewed");
    expect(changed.begin).not.toHaveBeenCalled();
  });
  it("runs only the fixed gallery SQL, without applying unrelated pending migrations", async () => {
    const { sql, tx } = connection(optionImagesPrerequisites);
    expect(await runPendingMigrations(sql, undefined, "option-images")).toEqual(
      [optionImagesFile],
    );
    expect(tx.unsafe).toHaveBeenCalledExactlyOnceWith(contents);
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });
  it("blocks missing prerequisites and changed SQL without applying it", async () => {
    const missing = connection([]);
    await expect(
      runPendingMigrations(missing.sql, undefined, "option-images"),
    ).rejects.toThrow("Earlier updates need separate review");
    expect(missing.tx.unsafe).not.toHaveBeenCalled();
    mocks.read.mockResolvedValue(contents + "\n-- changed");
    const changed = connection(optionImagesPrerequisites);
    await expect(
      runPendingMigrations(changed.sql, undefined, "option-images"),
    ).rejects.toThrow("differs from the reviewed");
    expect(changed.begin).not.toHaveBeenCalled();
  });
  it("does not replay an already-recorded gallery update", async () => {
    const { sql, tx } = connection([
      ...optionImagesPrerequisites,
      optionImagesFile,
    ]);
    expect(await runPendingMigrations(sql, undefined, "option-images")).toEqual(
      [],
    );
    expect(tx.unsafe).not.toHaveBeenCalled();
  });
});
