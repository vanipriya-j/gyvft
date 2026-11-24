import "server-only";
import { z } from "zod";
import { getSql } from "@/lib/database/client";
import { agentProposalsAvailable } from "./auth";
import { mcpResource } from "./config";
export async function mcpSettings() {
  const sql = getSql();
  const installed = await agentProposalsAvailable(sql);
  if (!installed)
    return { installed: false, enabled: false, url: mcpResource(), grants: [] };
  const [[settings], grants] = await Promise.all([
    sql`SELECT enabled FROM gyvft_mcp_settings WHERE singleton=true`,
    sql`SELECT id,scopes,created_at,last_used_at,refresh_expires_at,revoked_at,redeemed_at FROM gyvft_mcp_grants WHERE redeemed_at IS NOT NULL ORDER BY created_at DESC LIMIT 30`,
  ]);
  return {
    installed: true,
    enabled: !!settings?.enabled,
    url: mcpResource(),
    grants: grants.map((grant) => ({
      id: String(grant.id),
      scopes: grant.scopes as string[],
      createdAt: new Date(grant.created_at).toISOString(),
      lastUsed: grant.last_used_at
        ? new Date(grant.last_used_at).toISOString()
        : null,
      expiresAt: grant.refresh_expires_at
        ? new Date(grant.refresh_expires_at).toISOString()
        : null,
      revoked: !!grant.revoked_at,
      expired:
        !!grant.refresh_expires_at &&
        new Date(grant.refresh_expires_at).getTime() <= Date.now(),
    })),
  };
}
export async function setMcpEnabled(enabled: boolean) {
  z.boolean().parse(enabled);
  const sql = getSql();
  if (!(await agentProposalsAvailable(sql)))
    throw Error("The agent workspace needs activation first.");
  await sql.begin(async (tx) => {
    await tx`UPDATE gyvft_mcp_settings SET enabled=${enabled},updated_at=now() WHERE singleton=true`;
    if (!enabled)
      await tx`UPDATE gyvft_mcp_grants SET revoked_at=COALESCE(revoked_at,now()) WHERE revoked_at IS NULL`;
  });
}
export async function revokeMcpGrant(id: string) {
  z.string().uuid().parse(id);
  await getSql()`UPDATE gyvft_mcp_grants SET revoked_at=COALESCE(revoked_at,now()) WHERE id=${id}::uuid`;
}
export type McpSettings = Awaited<ReturnType<typeof mcpSettings>>;
