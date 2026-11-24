import { protectedResourceMetadata } from "@/lib/mcp/config";
export function GET() {
  return Response.json(protectedResourceMetadata(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
