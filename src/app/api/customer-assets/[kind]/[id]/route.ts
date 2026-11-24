import { getSql } from "@/lib/database/client";
import { getCustomerAccount } from "@/lib/customer/session";
import { validSetupSecret } from "@/lib/security/setup-secret";
import { uuidPattern } from "@/lib/customer/model";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  if (
    !uuidPattern.test(id) ||
    ![
      "approval",
      "payment",
      "occasion",
      "gift-option",
      "gift-option-image",
      "moment",
      "approval-draft",
    ].includes(kind)
  )
    return new Response(null, { status: 404 });
  const operator = validSetupSecret(request.headers.get("x-setup-secret"));
  const account = operator ? null : await getCustomerAccount();
  if (!operator && !account && kind !== "moment")
    return new Response(null, { status: 404 });
  const sql = getSql();
  if (kind === "gift-option-image") {
    const [table] =
      await sql`SELECT to_regclass('gyvft_gift_option_images')::text AS name`;
    if (!table?.name) return new Response(null, { status: 404 });
  }
  const rows =
    kind === "moment"
      ? await sql`SELECT a.image_data AS data,a.image_type AS mime FROM gyvft_gift_photos a JOIN customer_projects p ON p.id=a.project_id WHERE a.id=${id}::uuid AND (${operator} OR p.customer_account_id=${account?.id || null}::uuid OR (a.public_permission=true AND a.featured=true))`
      : kind === "approval-draft"
        ? operator
          ? await sql`SELECT image_data AS data,image_type AS mime FROM gyvft_gift_approval_drafts WHERE project_id=${id}::uuid AND kind=${new URL(request.url).searchParams.get("type") === "design" ? "design" : "proposal"}`
          : []
        : kind === "gift-option-image"
          ? await sql`SELECT i.image_data AS data,i.image_type AS mime FROM gyvft_gift_option_images i JOIN gyvft_gift_options o ON o.id=i.option_id JOIN customer_projects p ON p.id=o.project_id WHERE i.id=${id}::uuid AND (${operator} OR (p.customer_account_id=${account?.id || null}::uuid AND o.published AND NOT o.operator_hidden))`
          : kind === "gift-option"
            ? await sql`SELECT a.image_data AS data,a.image_type AS mime FROM gyvft_gift_options a JOIN customer_projects p ON p.id=a.project_id WHERE a.id=${id}::uuid AND (${operator} OR (p.customer_account_id=${account?.id || null}::uuid AND a.published AND NOT a.operator_hidden))`
            : kind === "occasion"
              ? await sql`SELECT photo_data AS data,photo_type AS mime FROM gyvft_customer_occasions WHERE id=${id}::uuid AND (${operator} OR account_id=${account?.id || null}::uuid)`
              : kind === "approval"
                ? await sql`SELECT a.image_data AS data,a.image_type AS mime FROM customer_project_approvals a JOIN customer_projects p ON p.id=a.project_id WHERE a.id=${id}::uuid AND (${operator} OR p.customer_account_id=${account?.id || null}::uuid)`
                : await sql`SELECT a.evidence_data AS data,a.evidence_type AS mime FROM customer_payment_submissions a JOIN customer_projects p ON p.id=a.project_id WHERE a.id=${id}::uuid AND (${operator} OR p.customer_account_id=${account?.id || null}::uuid)`;
  if (!rows[0]?.data) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(rows[0].data), {
    headers: {
      "Content-Type": rows[0].mime,
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
