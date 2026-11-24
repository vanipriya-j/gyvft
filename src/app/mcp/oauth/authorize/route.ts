import {
  approveMcpConnection,
  signAuthorisationRequest,
  McpAuthError,
} from "@/lib/mcp/auth";
import { mcpOrigin } from "@/lib/mcp/config";
import {
  customerJson,
  noStore,
  oauthFailure,
  rateLimitMcp,
  sameMcpOrigin,
} from "@/lib/mcp/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    rateLimitMcp(request, "authorize", 20);
    const token = await signAuthorisationRequest(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const url = new URL("/connect/gyvft-agent", mcpOrigin());
    url.searchParams.set("request", token);
    return new Response(null, {
      status: 303,
      headers: { ...noStore, Location: url.href },
    });
  } catch (error) {
    return oauthFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    rateLimitMcp(request, "consent", 5);
    if (!sameMcpOrigin(request)) throw new McpAuthError("access_denied");
    const body = await customerJson(request, 12000);
    if (typeof body.request !== "string" || body.request.length > 10000)
      throw new McpAuthError("invalid_request");
    const redirect = await approveMcpConnection(body.request, body.secret);
    return Response.json({ ok: true, redirect }, { headers: noStore });
  } catch (error) {
    return oauthFailure(error);
  }
}
