import { config } from "dotenv";
import postgres from "postgres";
import { spawnSync } from "child_process";

config({ path: ".env.local" });
config();

async function main() {
  if (process.env.IS_PRODUCTION === "true" || process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset: production environment flag is enabled.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1")) {
    throw new Error("Refusing to reset: DATABASE_URL does not point to localhost.");
  }

  const sql = postgres(databaseUrl, { max: 1 });
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql`GRANT ALL ON SCHEMA public TO PUBLIC`;
  await sql.end();

  const migrate = spawnSync("npx", ["tsx", "scripts/migrate.ts"], { stdio: "inherit" });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);
  console.log("Local database reset and migrations reapplied.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
