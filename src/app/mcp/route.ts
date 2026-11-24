import { z } from "zod";
import { authenticateMcp, McpAuthError } from "@/lib/mcp/auth";
import { mcpOrigin } from "@/lib/mcp/config";
import { customerJson, noStore, rateLimitMcp } from "@/lib/mcp/http";
import { mcpTools, callMcpTool } from "@/lib/mcp/tools";
import { GiftWorkspaceError } from "@/lib/customer/gift-workspace";
import { McpImageError } from "@/lib/mcp/images";
export const runtime = "nodejs";
export const maxDuration = 60;
const supported = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"];
const serverInfo = { name: "GYVFT proposal workspace", version: "1.0.0" };
const rpc = (
  id: string | number | null,
  result: Record<string, unknown>,
  modern = false,
) =>
  Response.json(
    {
      jsonrpc: "2.0",
      id,
      result: modern
        ? {
            ...result,
            _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
          }
        : result,
    },
    {
      headers: {
        ...noStore,
        ...(modern ? { "MCP-Protocol-Version": "2026-07-28" } : {}),
      },
    },
  );
const failure = (
  id: string | number | null,
  code: number,
  message: string,
  status = 200,
  data?: unknown,
) =>
  Response.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code, message, ...(data === undefined ? {} : { data }) },
    },
    { status, headers: noStore },
  );
export function GET() {
  return new Response(null, {
    status: 405,
    headers: { ...noStore, Allow: "POST" },
  });
}
export async function POST(request: Request) {
  // Next normalises loopback URLs to localhost. Use the actual Host (never a
  // forwarded host) so canonical-origin enforcement also works in local QA.
  const receivedUrl = new URL(request.url);
  if (request.headers.has("host"))
    receivedUrl.host = request.headers.get("host")!;
  if (receivedUrl.origin !== mcpOrigin())
    return new Response(null, { status: 403, headers: noStore });
  const origin = request.headers.get("origin");
  if (origin && origin !== mcpOrigin() && origin !== "https://chatgpt.com")
    return new Response(null, { status: 403, headers: noStore });
  try {
    rateLimitMcp(request, "rpc", 90);
  } catch {
    return new Response(null, {
      status: 429,
      headers: { ...noStore, "Retry-After": "60" },
    });
  }
  let actor;
  try {
    actor = await authenticateMcp(request.headers.get("authorization"));
  } catch (error) {
    return Response.json(
      { error: error instanceof McpAuthError ? error.code : "invalid_token" },
      {
        status: 401,
        headers: {
          ...noStore,
          "WWW-Authenticate": `Bearer resource_metadata="${mcpOrigin()}/.well-known/oauth-protected-resource/mcp", scope="gyvft:requests:read gyvft:options:write"`,
        },
      },
    );
  }
  let body;
  try {
    body = await customerJson(request, 131072);
  } catch {
    return failure(null, -32700, "Invalid JSON-RPC request.", 400);
  }
  if (
    !body ||
    Array.isArray(body) ||
    body.jsonrpc !== "2.0" ||
    typeof body.method !== "string" ||
    (body.id !== undefined &&
      body.id !== null &&
      typeof body.id !== "string" &&
      typeof body.id !== "number")
  )
    return failure(null, -32600, "Invalid JSON-RPC request.", 400);
  const id = body.id ?? null;
  const version = request.headers.get("MCP-Protocol-Version"),
    metadataVersion =
      body.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
  if (metadataVersion !== undefined && typeof metadataVersion !== "string")
    return failure(id, -32602, "Invalid protocol metadata.", 400);
  if (
    (version && !supported.includes(version)) ||
    (metadataVersion && !supported.includes(metadataVersion))
  )
    return failure(id, -32022, "Unsupported MCP protocol version.", 400, {
      supported,
      requested: version || metadataVersion,
    });
  if (version && metadataVersion && version !== metadataVersion)
    return failure(id, -32020, "Protocol header and body do not match.", 400);
  const modern = version === "2026-07-28" || metadataVersion === "2026-07-28";
  if (modern) {
    if (
      version !== "2026-07-28" ||
      metadataVersion !== version ||
      request.headers.get("Mcp-Method") !== body.method
    )
      return failure(
        id,
        -32020,
        "Required MCP headers are missing or do not match the body.",
        400,
      );
    const capabilities =
      body.params?._meta?.["io.modelcontextprotocol/clientCapabilities"];
    if (
      !capabilities ||
      typeof capabilities !== "object" ||
      Array.isArray(capabilities)
    )
      return failure(
        id,
        -32602,
        "Include per-request client capabilities.",
        400,
      );
    if (body.method === "tools/call") {
      let name = request.headers.get("Mcp-Name");
      if (name?.startsWith("=?base64?") && name.endsWith("?=")) {
        const encoded = name.slice("=?base64?".length, -2);
        try {
          const bytes = Buffer.from(encoded, "base64");
          if (bytes.toString("base64") !== encoded) throw Error("encoding");
          name = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          return failure(id, -32020, "Invalid MCP name header encoding.", 400);
        }
      }
      if (!name || name !== body.params?.name)
        return failure(
          id,
          -32020,
          "MCP name header and tool name do not match.",
          400,
        );
    }
  }
  const respond = (result: Record<string, unknown>) => rpc(id, result, modern);
  if (body.id === undefined) {
    if (
      !modern &&
      ["notifications/initialized", "notifications/cancelled"].includes(
        body.method,
      )
    )
      return new Response(null, { status: 202, headers: noStore });
    return failure(null, -32600, "A request id is required.", 400);
  }
  if (body.method === "initialize" && !modern)
    return respond({
      protocolVersion: supported.slice(1).includes(body.params?.protocolVersion)
        ? body.params.protocolVersion
        : "2025-11-25",
      capabilities: { tools: { listChanged: false } },
      serverInfo,
      instructions:
        "Read briefs and save private gift option drafts. Publishing is an explicit owner action in GYVFT Operations. Prices come from the owner, not a retail catalogue.",
    });
  if (body.method === "ping") return respond({});
  if (body.method === "tools/list") return respond({ tools: mcpTools });
  if (body.method !== "tools/call")
    return failure(id, -32601, "Method not found.", modern ? 404 : 200);
  const parsed = z
    .object({
      name: z.string(),
      arguments: z.unknown().optional(),
      _meta: z.unknown().optional(),
    })
    .safeParse(body.params);
  if (!parsed.success) return failure(id, -32602, "Invalid tool parameters.");
  try {
    const result = await callMcpTool(
      parsed.data.name,
      parsed.data.arguments,
      actor,
      request.signal,
    );
    return respond({
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Check the tool fields and quantities. Prices use low_inr/high_inr in rupees."
        : error instanceof GiftWorkspaceError || error instanceof McpImageError
          ? error.message
          : error instanceof Error &&
              [
                "Submitted request unavailable.",
                "Unknown GYVFT tool.",
                "This connection does not have the required scope.",
              ].includes(error.message)
            ? error.message
            : "The draft could not be confirmed. Read the request before retrying with the same action key.";
    return respond({
      isError: true,
      content: [{ type: "text", text: message }],
    });
  }
}
