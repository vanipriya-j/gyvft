import { readFileSync, readdirSync } from "node:fs";
import { beforeEach, it, expect, vi } from "vitest";
import type { Sql } from "postgres";
const files = vi.hoisted(() => ({ read: vi.fn(), list: vi.fn() }));
vi.mock("fs/promises", () => ({ readFile: files.read, readdir: files.list }));
import {
  runPendingMigrations,
  migrationFiles,
} from "@/lib/database/migrations";
import {
  agentOperationsFile,
  agentOperationsPrerequisites,
} from "@/lib/database/agent-operations-activation";
import { operationsIntakeFile } from "@/lib/database/operations-intake-activation";
import { mcpTools } from "@/lib/mcp/tools";
import { operationTools } from "@/lib/mcp/operation-tools";
import { mcpScopes } from "@/lib/mcp/config";
import {
  milestonePayment,
  rupeesToPaise,
} from "@/lib/customer/agent-operations-model";
import { upiPaymentUri } from "@/lib/customer/payment-qr";
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
  files.list.mockResolvedValue(readdirSync("supabase/migrations"));
  files.read.mockImplementation(async (path: string) =>
    readFileSync(path, "utf8"),
  );
});
it("scopes activation to only intake and Operations, checksum pinned and skips existing files", async () => {
  expect(await migrationFiles("agent-operations")).toEqual([
    operationsIntakeFile,
    agentOperationsFile,
  ]);
  const first = connection(agentOperationsPrerequisites);
  expect(
    await runPendingMigrations(first.sql, undefined, "agent-operations"),
  ).toEqual([operationsIntakeFile, agentOperationsFile]);
  expect(first.tx.unsafe).toHaveBeenCalledTimes(2);
  const partial = connection([
    ...agentOperationsPrerequisites,
    operationsIntakeFile,
  ]);
  expect(
    await runPendingMigrations(partial.sql, undefined, "agent-operations"),
  ).toEqual([agentOperationsFile]);
  const replay = connection([
    ...agentOperationsPrerequisites,
    operationsIntakeFile,
    agentOperationsFile,
  ]);
  expect(
    await runPendingMigrations(replay.sql, undefined, "agent-operations"),
  ).toEqual([]);
  expect(replay.tx.unsafe).not.toHaveBeenCalled();
});
it("changed SQL and missing prerequisites fail before any SQL is applied", async () => {
  const missing = connection([]);
  await expect(
    runPendingMigrations(missing.sql, undefined, "agent-operations"),
  ).rejects.toThrow("Earlier updates");
  expect(missing.tx.unsafe).not.toHaveBeenCalled();
  files.read.mockImplementation(
    async (path: string) => readFileSync(path, "utf8") + "\n-- changed",
  );
  const changed = connection(agentOperationsPrerequisites);
  await expect(
    runPendingMigrations(changed.sql, undefined, "agent-operations"),
  ).rejects.toThrow("differs from the reviewed");
  expect(changed.begin).not.toHaveBeenCalled();
});
it("advertises all 15 tools with accurate granular scopes and file parameters", () => {
  expect(mcpTools).toHaveLength(15);
  expect(new Set(mcpTools.map((t) => t.name)).size).toBe(15);
  for (const tool of operationTools) {
    expect(mcpScopes).toContain(tool.securitySchemes[0].scopes[0]);
    expect(tool._meta.securitySchemes).toEqual(tool.securitySchemes);
    if (tool._meta["openai/fileParams"])
      expect(tool.inputSchema.properties).toHaveProperty("files");
    if (!tool.annotations.readOnlyHint)
      expect(tool.inputSchema.properties).toHaveProperty("client_reference");
  }
  expect(
    operationTools.find((t) => t.name === "record_offline_approval")
      ?.inputSchema.required,
  ).toContain("files");
  expect(
    operationTools.find((t) => t.name === "verify_customer_payment")
      ?.inputSchema.required,
  ).toContain("confirmed_receipt");
});
it("uses integer paise and gives the extra odd paisa to the advance", () => {
  expect(rupeesToPaise(6650.01)).toBe(665001);
  expect(() => rupeesToPaise(1.001)).toThrow();
  expect(() => rupeesToPaise(0)).toThrow();
  expect(milestonePayment(1330001, 0, "advance")).toBe(665001);
  expect(milestonePayment(1330001, 665001, "balance")).toBe(665000);
  expect(milestonePayment(1330001, 1330001, "balance")).toBe(0);
});
it("rejects malformed receiving accounts and fractional/nonpositive QR amounts", () => {
  const input = {
    upiId: "merchant@bank",
    payee: "Merchant",
    amountPaise: 101,
    reference: "GYfixture",
    note: "Gift",
  };
  expect(new URL(upiPaymentUri(input)).searchParams.get("am")).toBe("1.01");
  for (const upiId of ["", "javascript:bad", "user@bad&am=1"])
    expect(() => upiPaymentUri({ ...input, upiId })).toThrow();
  expect(() => upiPaymentUri({ ...input, amountPaise: 1.1 })).toThrow();
  expect(() => upiPaymentUri({ ...input, amountPaise: 0 })).toThrow();
});
