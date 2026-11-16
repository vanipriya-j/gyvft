import { getSql } from "@/lib/database/client";
import { getCustomerAccount } from "@/lib/customer/session";
export const dynamic = "force-dynamic";
export async function GET() {
  const account = await getCustomerAccount();
  if (!account) return new Response(null, { status: 404 });
  try {
    const [row] =
      await getSql()`SELECT qr_data,qr_type FROM gyvft_customer_upi_settings WHERE singleton=true`;
    if (!row?.qr_data) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(row.qr_data), {
      headers: {
        "Content-Type": row.qr_type,
        "Cache-Control": "private,no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
