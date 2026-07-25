import "server-only";
import postgres, { type Sql } from "postgres";
import { requireDatabaseUrl } from "@/config/env";

declare global {
  var __gyvftSql: Sql | undefined;
}

export function getSql(): Sql {
  if (global.__gyvftSql) return global.__gyvftSql;
  const sql = postgres(requireDatabaseUrl(), {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  if (process.env.NODE_ENV !== "production") {
    global.__gyvftSql = sql;
  }
  return sql;
}

export async function withTransaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T> {
  const sql = getSql();
  return sql.begin(async (tx) => fn(tx as unknown as Sql)) as Promise<T>;
}
