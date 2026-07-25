import { afterAll } from "vitest";
import { config } from "dotenv";
import type { Sql } from "postgres";

declare global {
  var __gyvftSql: Sql | undefined;
}

config({ path: ".env.local" });
config();

Reflect.set(process.env, "NODE_ENV", "test");
process.env.DATABASE_URL ??= "postgresql://gyvft:gyvft_dev@127.0.0.1:5432/gyvft_test";
process.env.INTEGRATION_ENCRYPTION_KEY ??= "test-integration-encryption-key-32-bytes";

afterAll(async () => {
  const sql = globalThis.__gyvftSql;
  if (sql) {
    await sql.end({ timeout: 1 });
    globalThis.__gyvftSql = undefined;
  }
});
