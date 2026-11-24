import "server-only";
import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { validImage } from "./images";
import { offlineApprovalSchema } from "./agent-operations-model";
import { applyApprovalDecision } from "./approval-decisions";
import { journeyProject } from "./journeys";

export class AgentOperationsError extends Error {}
export async function agentOperationsReady(sql: Sql = getSql()) {
  const [row] =
    await sql`SELECT to_regclass('gyvft_agent_commands')::text AS name`;
  return !!row?.name;
}
export async function requireAgentOperations(sql: Sql = getSql()) {
  if (!(await agentOperationsReady(sql)))
    throw new AgentOperationsError(
      "Operations actions need their reviewed database update. Open /setup/agent-operations.",
    );
}
export async function offlineApprovalsFor(
  projectId: string,
  sql: Sql = getSql(),
) {
  if (!(await agentOperationsReady(sql))) return [];
  const rows =
    await sql`SELECT o.id,o.approval_id,o.approval_version,o.channel,o.customer_approved_at,o.note,o.recorded_by,o.source,o.recorded_at,a.kind,a.title,
    COALESCE((SELECT json_agg(json_build_object('id',f.id,'position',f.position) ORDER BY f.position) FROM gyvft_offline_approval_files f WHERE f.offline_approval_id=o.id),'[]'::json) AS files
    FROM gyvft_offline_approvals o JOIN customer_project_approvals a ON a.id=o.approval_id WHERE o.project_id=${projectId}::uuid ORDER BY o.recorded_at DESC`;
  return rows;
}
export async function recordOfflineApproval(
  raw: unknown,
  actor: { source: "operations" | "mcp"; id?: string },
  sourceHash?: string,
) {
  const input = offlineApprovalSchema.parse(raw),
    sql = getSql();
  await requireAgentOperations(sql);
  const images = input.proof.map((image) => {
    const data = Buffer.from(image.data, "base64");
    if (data.toString("base64") !== image.data || !validImage(data, image.mime))
      throw new AgentOperationsError(
        "Attach a valid screenshot as PNG, JPEG or WebP, up to 2 MB each.",
      );
    return { data, mime: image.mime };
  });
  const hash =
    sourceHash ||
    createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return sql.begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    await journeyProject(tx, input.project_id);
    const [prior] =
      await tx`SELECT id,input_hash,approval_id,approval_version FROM gyvft_offline_approvals WHERE id=${input.request_id}::uuid`;
    if (prior) {
      if (prior.input_hash !== hash)
        throw new AgentOperationsError(
          "This approval action key belongs to different data.",
        );
      return {
        id: prior.id,
        approval_id: prior.approval_id,
        version: prior.approval_version,
        duplicate: true,
      };
    }
    const [approval] =
      await tx`SELECT id,kind,version FROM customer_project_approvals WHERE id=${input.approval_id}::uuid AND project_id=${input.project_id}::uuid`;
    if (!approval || Number(approval.version) !== input.expected_version)
      throw new AgentOperationsError(
        "The approval version changed. Read the latest quote or artwork before recording consent.",
      );
    if (
      input.customer_approved_at &&
      new Date(input.customer_approved_at).getTime() > Date.now() + 60000
    )
      throw new AgentOperationsError(
        "The customer approval time cannot be in the future.",
      );
    const response = `Customer approval recorded offline by ${input.recorded_by} (${input.channel.replaceAll("_", " ")}). ${input.note}`;
    const changed = await applyApprovalDecision(tx, {
      projectId: input.project_id,
      approvalId: input.approval_id,
      accountId: null,
      decision: "approved",
      response,
      notifyTeam: false,
    });
    if (!changed.length)
      throw new AgentOperationsError(
        "Only the latest pending version can receive offline approval. Production locks and the customer selection still apply.",
      );
    await tx`INSERT INTO gyvft_offline_approvals(id,project_id,approval_id,approval_version,channel,customer_approved_at,note,recorded_by,source,actor_id,input_hash) VALUES(${input.request_id}::uuid,${input.project_id}::uuid,${input.approval_id}::uuid,${input.expected_version},${input.channel},${input.customer_approved_at}::timestamptz,${input.note},${input.recorded_by},${actor.source},${actor.id || null}::uuid,${hash})`;
    for (const [index, image] of images.entries())
      await tx`INSERT INTO gyvft_offline_approval_files(offline_approval_id,image_data,image_type,position) VALUES(${input.request_id}::uuid,${image.data},${image.mime},${index + 1})`;
    await tx`INSERT INTO gyvft_customer_admin_events(request_id,project_id,operation) VALUES(${input.request_id}::uuid,${input.project_id}::uuid,'offline_customer_approval')`;
    return {
      id: input.request_id,
      approval_id: input.approval_id,
      version: input.expected_version,
      duplicate: false,
    };
  });
}
