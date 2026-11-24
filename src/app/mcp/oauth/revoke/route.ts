import { revokeMcpToken, McpAuthError } from "@/lib/mcp/auth";
import { mcpClientId } from "@/lib/mcp/config";
import { noStore, oauthFailure, oauthForm, rateLimitMcp } from "@/lib/mcp/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    rateLimitMcp(request, "revoke");
    const data = await oauthForm(request);
    if (data.get("client_id") !== mcpClientId)
      throw new McpAuthError("invalid_client");
    await revokeMcpToken(data.get("token") || "");
    return new Response(null, { status: 200, headers: noStore });
  } catch (error) {
    return oauthFailure(error);
  }
}
