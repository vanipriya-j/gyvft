import { exchangeMcpToken } from "@/lib/mcp/auth";
import { noStore, oauthFailure, oauthForm, rateLimitMcp } from "@/lib/mcp/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    rateLimitMcp(request, "token");
    return Response.json(await exchangeMcpToken(await oauthForm(request)), {
      headers: noStore,
    });
  } catch (error) {
    return oauthFailure(error);
  }
}
