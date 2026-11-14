import postgres from "postgres";
import { config } from "dotenv";
import { runPendingMigrations } from "../src/lib/database/migrations";
config({ path: ".env.local" });
config();
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
  });
  try {
    const applied = await runPendingMigrations(
      sql,
      undefined,
      process.argv.includes("--customer") ? "customer" : "all",
    );
    for (const id of applied) console.log(`applied ${id}`);
    console.log(
      applied.length ? "Migrations complete" : "Database already up to date",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
