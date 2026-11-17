import { customerApi, customerReply } from "@/lib/customer/api";
import { customerHome, homeQuery } from "@/lib/customer/home";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return customerApi(request, false, async (account) => {
    const query = homeQuery.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return customerReply({
      ok: true,
      data: await customerHome(account, query),
    });
  });
}
