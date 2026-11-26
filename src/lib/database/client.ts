import "server-only";
import postgres, { type Sql } from "postgres";
import { databasePoolConfig } from "./pooling";
import { requireDatabaseUrl } from "@/config/env";

declare global {
  var __gyvftSql: Sql | undefined;
}

export function getSql(): Sql {
  if (global.__gyvftSql) return global.__gyvftSql;
  const config = databasePoolConfig(
    requireDatabaseUrl(),
    process.env.VERCEL === "1",
  );
  const sql = postgres(config.url, config.options);
  // One reused pool per process. Supabase transaction mode avoids the session
  // pool's 15-client ceiling; a single local connection bounds each Vercel instance.
  global.__gyvftSql = sql;
  return sql;
}

export async function withTransaction<T>(
  fn: (tx: Sql) => Promise<T>,
): Promise<T> {
  const sql = getSql();
  return sql.begin(async (tx) => fn(tx as unknown as Sql)) as Promise<T>;
}
