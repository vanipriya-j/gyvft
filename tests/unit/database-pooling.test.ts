import { describe, it, expect } from "vitest";
import { databasePoolConfig } from "@/lib/database/pooling";
describe("serverless database pooling", () => {
  it("uses transaction mode on Vercel without changing the project, credentials or database", () => {
    const raw =
      "postgresql://postgres.project:pa%24%24%40word@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require";
    const config = databasePoolConfig(raw, true),
      before = new URL(raw),
      after = new URL(config.url);
    expect(after.port).toBe("6543");
    expect(after.hostname).toBe(before.hostname);
    expect(after.username).toBe(before.username);
    expect(after.password).toBe(before.password);
    expect(after.pathname).toBe(before.pathname);
    expect(after.search).toBe(before.search);
    expect(config.options).toMatchObject({
      max: 1,
      max_pipeline: 1,
      infer: true,
      queue_timeout: 10,
      query_timeout: 20,
      cancel_timeout: 3,
      idle_timeout: 5,
      prepare: false,
    });
  });
  it("preserves existing transaction mode and non-Supabase database endpoints", () => {
    for (const url of [
      "postgres://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      "postgres://user:pass@127.0.0.1:55438/test",
      "postgres://user:pass@db.project.supabase.co:5432/postgres",
      "postgres://user:pass@not-pooler.supabase.com.attacker.test:5432/postgres",
    ])
      expect(databasePoolConfig(url, true).url).toBe(new URL(url).toString());
  });
  it("does not silently change an explicitly nonstandard port or a development session pooler", () => {
    const url =
      "postgres://user:pass@aws-0-us-east-1.pooler.supabase.com:5439/postgres";
    expect(new URL(databasePoolConfig(url, true).url).port).toBe("5439");
    expect(
      new URL(databasePoolConfig(url.replace("5439", "5432"), false).url).port,
    ).toBe("5432");
  });
});
