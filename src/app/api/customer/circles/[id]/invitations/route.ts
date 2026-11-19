import { customerApi, customerReply, customerJson } from "@/lib/customer/api";
import { inviteToCircle } from "@/lib/customer/circles";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return customerApi(request, true, async (a) =>
    customerReply(
      {
        ok: true,
        ...(await inviteToCircle(a, id, await customerJson(request, 8192))),
      },
      201,
    ),
  );
}
