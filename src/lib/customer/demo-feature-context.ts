import "server-only";
import type { Sql } from "postgres";
import { demoProjectSpecs } from "./demo-feature-data";
/** Fixture IDs alone never prove ownership or permit replacement of live records. */
export async function demoProjectContext(
  sql: Sql,
  id: string,
  accountId?: string,
) {
  const spec = demoProjectSpecs.find((p) => p.projectId === id);
  if (!spec || (accountId && accountId !== spec.accountId)) return null;
  const [project] =
    await sql`SELECT id,customer_account_id,submission_key,stage,title,brief FROM customer_projects WHERE id=${id}::uuid AND customer_account_id=${spec.accountId}::uuid AND submission_key=${spec.submissionKey}`;
  return project ? { spec, project } : null;
}
