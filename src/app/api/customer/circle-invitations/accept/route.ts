import { customerApi, customerJson, customerReply } from "@/lib/customer/api";
import { acceptCircleInvitation } from "@/lib/customer/circles";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return customerApi(request, true, async (a) => {
    const input = z
      .object({
        token: z.string().length(43),
        display_name: z.string(),
        share_profile: z.boolean(),
      })
      .strict()
      .parse(await customerJson(request));
    return customerReply({
      ok: true,
      id: await acceptCircleInvitation(a, input.token, {
        display_name: input.display_name,
        share_profile: input.share_profile,
      }),
    });
  });
}
