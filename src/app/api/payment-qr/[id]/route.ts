import { getCustomerAccount } from "@/lib/customer/session";
import { validSetupSecret } from "@/lib/security/setup-secret";
import { uuidPattern } from "@/lib/customer/model";
import { paymentQrFor } from "@/lib/customer/payment-qr";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuidPattern.test(id)) return new Response(null, { status: 404 });
  const operator = validSetupSecret(request.headers.get("x-setup-secret")),
    account = operator ? null : await getCustomerAccount();
  if (!operator && !account) return new Response(null, { status: 404 });
  try {
    const qr = await paymentQrFor(id, account?.id || null, operator);
    const expected = new URL(request.url).searchParams.get(
      "expected_amount_paise",
    );
    if (
      expected &&
      (!/^\d{1,12}$/.test(expected) || Number(expected) !== qr.amountPaise)
    )
      throw Error("stale");
    return new Response(new Uint8Array(qr.png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
