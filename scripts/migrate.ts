import { readdir, readFile } from "fs/promises";
import path from "path";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, { max: 1 });
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const applied = await sql<{ id: string }[]>`
      SELECT id FROM schema_migrations WHERE id = ${file} LIMIT 1
    `;
    if (applied[0]) {
      console.log(`skip ${file}`);
      continue;
    }
    const contents = await readFile(path.join(dir, file), "utf8");
    console.log(`apply ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
    });
  }

  await sql.end();
  console.log("Migrations complete");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
