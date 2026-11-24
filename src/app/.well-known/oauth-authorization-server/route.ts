import { authorisationMetadata } from "@/lib/mcp/config";
export function GET() {
  return Response.json(authorisationMetadata(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
