import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/database/client";
import {
  AgentOperationsError,
  requireAgentOperations,
} from "@/lib/customer/agent-operations";

export function operationFingerprint(
  name: string,
  input: Record<string, unknown>,
) {
  const files = Array.isArray(input.files)
    ? input.files.map((file) => (file as { file_id: string }).file_id)
    : undefined;
  return createHash("sha256")
    .update(
      JSON.stringify({
        name,
        input: { ...input, ...(files ? { files } : {}) },
      }),
    )
    .digest("hex");
}
/** Reserve a durable intent before side effects. Underlying object commands own their transactions. */
export async function reserveOperation(
  id: string,
  projectId: string | null,
  name: string,
  digest: string,
  actorId: string,
) {
  const sql = getSql();
  await requireAgentOperations(sql);
  await sql`INSERT INTO gyvft_agent_commands(id,project_id,operation,input_hash,actor_id) VALUES(${id}::uuid,${projectId}::uuid,${name},${digest},${actorId}::uuid) ON CONFLICT(id) DO NOTHING`;
  const [row] =
    await sql`SELECT project_id,operation,input_hash,result FROM gyvft_agent_commands WHERE id=${id}::uuid`;
  if (
    !row ||
    row.project_id !== projectId ||
    row.operation !== name ||
    row.input_hash !== digest
  )
    throw new AgentOperationsError(
      "This action key was used for different data. Use a new key only for a new instruction.",
    );
  return row.result as Record<string, unknown> | null;
}
export async function completeOperation(
  id: string,
  result: Record<string, unknown>,
) {
  const [row] =
    await getSql()`UPDATE gyvft_agent_commands SET result=COALESCE(result,${getSql().json(JSON.parse(JSON.stringify(result)))}),completed_at=COALESCE(completed_at,now()) WHERE id=${id}::uuid RETURNING result`;
  return row.result as Record<string, unknown>;
}
