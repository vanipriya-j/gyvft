import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { databasePoolConfig } from "@/lib/database/pooling";
const uri = process.env.TEST_DEMO_COVERAGE_DB_URL;
describe.skipIf(!uri)("single-connection non-pipelined driver", () => {
  let sql: Sql;
  const schema = "pool_driver_" + randomUUID().replaceAll("-", "");
  beforeAll(async () => {
    const url = new URL(uri!);
    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "55438" ||
      url.pathname !== "/gyvft_gallery_test"
    )
      throw Error("Dedicated disposable local database required");
    const config = databasePoolConfig(uri!, true);
    sql = postgres(config.url, config.options);
    await sql.unsafe(
      `CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.entries(id int PRIMARY KEY)`,
    );
  });
  afterAll(async () => {
    if (sql) {
      await sql.unsafe(`DROP SCHEMA ${schema} CASCADE`);
      await sql.end();
    }
  });
  it("keeps distinguishable concurrent results correctly associated across repeated bursts", async () => {
    for (let round = 0; round < 5; round++) {
      const results = await Promise.all(
        Array.from({ length: 24 }, async (_, i) => {
          const id = randomUUID(),
            flag = i % 2 === 0,
            bytes = Buffer.from(`row-${round}-${i}`);
          const [row] =
            await sql`SELECT ${i}::int AS i,${id}::uuid AS id,${flag}::boolean AS flag,${sql.json({ round, i })}::jsonb AS doc,${bytes}::bytea AS bytes,${[i, round]}::int[] AS numbers`;
          expect(row).toMatchObject({
            i,
            id,
            flag,
            doc: { round, i },
            numbers: [i, round],
          });
          expect(Buffer.from(row.bytes)).toEqual(bytes);
          return row.i;
        }),
      );
      expect(results).toEqual(Array.from({ length: 24 }, (_, i) => i));
    }
  });
  it("preserves transaction reservations, commits and rollbacks alongside concurrent reads", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        i % 4 === 0
          ? sql.begin(async (tx) => {
              await tx.unsafe(`INSERT INTO ${schema}.entries(id) VALUES($1)`, [
                i,
              ]);
              const rows = await Promise.all([
                tx`SELECT ${i}::int AS value`,
                tx`SELECT ${i + 1}::int AS value`,
              ]);
              expect(rows.map((r) => r[0].value)).toEqual([i, i + 1]);
            })
          : sql`SELECT ${i}::int`,
      ),
    );
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe(`INSERT INTO ${schema}.entries VALUES(9000)`);
        throw Error("rollback fixture");
      }),
    ).rejects.toThrow("rollback fixture");
    expect(
      (await sql.unsafe(`SELECT count(*)::int AS n FROM ${schema}.entries`))[0]
        .n,
    ).toBe(5);
  });
  it("expires a queued query without executing it", async () => {
    const short = postgres(uri!, {
      ...databasePoolConfig(uri!, true).options,
      queue_timeout: 0.05,
    });
    try {
      const slow = short`SELECT pg_sleep(0.2)`.execute();
      const queued = short.unsafe(`INSERT INTO ${schema}.entries VALUES(9001)`);
      await expect(queued).rejects.toMatchObject({ code: "QUEUE_TIMEOUT" });
      await slow;
      expect(
        (
          await sql.unsafe(
            `SELECT count(*)::int AS n FROM ${schema}.entries WHERE id=9001`,
          )
        )[0].n,
      ).toBe(0);
    } finally {
      await short.end();
    }
  });
  it("bounds a running query and rolls back its transaction, then remains usable", async () => {
    const short = postgres(uri!, {
      ...databasePoolConfig(uri!, true).options,
      query_timeout: 0.05,
      cancel_timeout: 0.3,
    });
    try {
      await expect(
        short.begin(async (tx) => {
          await tx.unsafe(`INSERT INTO ${schema}.entries VALUES(9002)`);
          await tx`SELECT pg_sleep(0.3)`;
        }),
      ).rejects.toMatchObject({ code: "QUERY_TIMEOUT" });
      expect((await short`SELECT 1 AS ok`)[0].ok).toBe(1);
      expect(
        (
          await sql.unsafe(
            `SELECT count(*)::int AS n FROM ${schema}.entries WHERE id=9002`,
          )
        )[0].n,
      ).toBe(0);
    } finally {
      await short.end();
    }
  });
});
