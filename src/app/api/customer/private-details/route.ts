import { customerApi, customerJson, customerReply } from "@/lib/customer/api";
import { savePrivateDetails } from "@/lib/customer/private-details";
import { JourneyError } from "@/lib/customer/journey-model";
import { revalidatePath } from "next/cache";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return customerApi(request, true, async (account) => {
    try {
      const result = await savePrivateDetails(
        account.id,
        await customerJson(request, 20000),
      );
      revalidatePath("/account", "layout");
      return customerReply({ ok: true, message: "Saved.", ...result });
    } catch (error) {
      if (error instanceof JourneyError)
        return customerReply(
          {
            ok: false,
            error: { code: "VALIDATION_ERROR", message: error.message },
          },
          400,
        );
      throw error;
    }
  });
}
