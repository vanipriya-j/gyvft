import { customerApi, customerReply, customerJson } from "@/lib/customer/api";
import { circleForAccount, changeCircle } from "@/lib/customer/circles";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return customerApi(request, false, async (a) => {
    const p = new URL(request.url).searchParams;
    return customerReply({
      ok: true,
      data: await circleForAccount(
        id,
        a.id,
        Number(p.get("offset") || 0),
        Number(p.get("limit") || 25),
      ),
    });
  });
}
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return customerApi(request, true, async (a) => {
    await changeCircle(a, id, await customerJson(request, 8192));
    return customerReply({ ok: true });
  });
}
