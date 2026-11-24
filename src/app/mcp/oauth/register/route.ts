import { z } from "zod";
import { allowedRedirect, mcpClientId } from "@/lib/mcp/config";
import {
  customerJson,
  noStore,
  oauthFailure,
  rateLimitMcp,
} from "@/lib/mcp/http";
import { requireMcpEnabled } from "@/lib/mcp/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    rateLimitMcp(request, "register", 20);
    await requireMcpEnabled();
    const data = z
      .object({
        redirect_uris: z
          .array(z.string().refine(allowedRedirect))
          .min(1)
          .max(5),
        token_endpoint_auth_method: z.literal("none").optional(),
      })
      .passthrough()
      .parse(await customerJson(request, 8192));
    return Response.json(
      {
        client_id: mcpClientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        redirect_uris: data.redirect_uris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
      { status: 201, headers: noStore },
    );
  } catch (error) {
    return oauthFailure(error);
  }
}
