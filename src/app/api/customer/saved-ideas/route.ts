import { revalidatePath } from "next/cache";
import { customerApi, customerJson, customerReply } from "@/lib/customer/api";
import { savedIdeaInput, setSavedIdea } from "@/lib/customer/saved-ideas";
export const runtime = "nodejs";
async function save(request: Request, saved: boolean) {
  return customerApi(request, true, async (account) => {
    const input = savedIdeaInput.parse(await customerJson(request));
    const data = await setSavedIdea(account.id, input, saved);
    revalidatePath("/account");
    return customerReply({ ok: true, data });
  });
}
export async function PUT(request: Request) {
  return save(request, true);
}
export async function DELETE(request: Request) {
  return save(request, false);
}
