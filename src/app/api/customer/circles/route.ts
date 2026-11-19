import { customerApi, customerReply, customerJson } from "@/lib/customer/api";
import { circlesForAccount, createCircle } from "@/lib/customer/circles";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return customerApi(request, false, async (a) =>
    customerReply({
      ok: true,
      circles: await circlesForAccount(
        a.id,
        new URL(request.url).searchParams.get("archived") === "1",
      ),
    }),
  );
}
export async function POST(request: Request) {
  return customerApi(request, true, async (a) =>
    customerReply(
      {
        ok: true,
        id: await createCircle(a, await customerJson(request, 8192)),
      },
      201,
    ),
  );
}
