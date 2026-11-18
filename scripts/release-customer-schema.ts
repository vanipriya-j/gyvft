/** Apply the server-owned customer manifest only after a successful production build.
 * Preview/local builds never migrate a shared database. The runner uses one atomic
 * transaction, advisory locking and the same tracking table as /setup.
 */
import postgres from "postgres";
import { runPendingMigrations } from "../src/lib/database/migrations";
async function release() {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("Customer schema: skipped outside production deployment.");
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "Customer release requires DATABASE_URL. Configure it before deploying.",
    );
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
  try {
    const applied = await runPendingMigrations(
      sql,
      (event) => {
        if (event.filename)
          console.log(`Customer schema: ${event.phase} ${event.filename}`);
      },
      "customer",
    );
    console.log(
      `Customer schema ready: ${applied.length} migration(s) applied.`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
release().catch((error) => {
  console.error(
    "Customer schema release failed:",
    error instanceof Error ? error.message : "Unconfirmed database operation",
  );
  process.exitCode = 1;
});
