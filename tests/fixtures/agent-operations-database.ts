import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
export async function agentOperationsFixture(uri: string) {
  const target = new URL(uri);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55438" ||
    target.pathname !== "/gyvft_gallery_test"
  )
    throw Error(
      "Agent Operations tests require their dedicated localhost:55438 fixture.",
    );
  const schema = "agent_ops_" + randomUUID().replaceAll("-", "");
  const sql = postgres(uri, {
    max: 5,
    connection: { search_path: schema },
    onnotice: () => {},
  });
  await sql.unsafe(`CREATE SCHEMA ${schema}`);
  // Only inside the strictly checked disposable fixture; production setup uses the exact pinned files.
  for (const file of readdirSync("supabase/migrations")
    .filter(
      (file) =>
        file.startsWith("202611") &&
        file.endsWith(".sql") &&
        !file.includes("customer_demo_requests"),
    )
    .sort()) {
    await sql.unsafe(
      readFileSync("supabase/migrations/" + file, "utf8").replaceAll(
        "public.",
        schema + ".",
      ),
    );
  }
  return { sql, schema };
}
