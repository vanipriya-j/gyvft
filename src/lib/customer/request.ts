import "server-only";
import { ownedProject } from "./data";
import { getSql } from "@/lib/database/client";
import type { GiftSelection } from "./gift-workspace-model";
import type { OrderItem } from "./pilot-model";

/** An owned request and its related records. Ownership is checked before child reads. */
export async function requestForAccount(id: string, accountId: string) {
  if (!process.env.DATABASE_URL) return null;
  const project = await ownedProject(id, accountId);
  if (!project) return null;
  const sql = getSql();
  const [events, messages, payments, approvals, giftSelections] =
    await Promise.all([
      sql<
        { id: string; title: string; body: string; created_at: string }[]
      >`SELECT * FROM customer_project_events WHERE project_id = ${id}::uuid ORDER BY created_at ASC`,
      sql<
        { id: string; sender: string; body: string; created_at: string }[]
      >`SELECT * FROM customer_project_messages WHERE project_id = ${id}::uuid ORDER BY created_at`,
      sql<
        {
          id: string;
          amount_paise: number;
          status: string;
          reference: string;
          has_evidence: boolean;
          created_at: string;
        }[]
      >`SELECT id,amount_paise,status,reference,created_at,evidence_data IS NOT NULL AS has_evidence FROM customer_payment_submissions WHERE project_id = ${id}::uuid ORDER BY created_at DESC`,
      sql<
        {
          id: string;
          title: string;
          kind: string;
          gift_selection_id: string | null;
          version: number;
          description: string;
          status: string;
          customer_response: string | null;
          amount_paise: number | null;
          has_image: boolean;
          items: OrderItem[] | null;
        }[]
      >`SELECT id,title,kind,version,description,status,customer_response,amount_paise,items,gift_selection_id,image_data IS NOT NULL AS has_image FROM customer_project_approvals WHERE project_id = ${id}::uuid ORDER BY created_at DESC`,
      sql<
        Pick<GiftSelection, "id" | "draft_version" | "snapshot">[]
      >`SELECT id,draft_version,snapshot FROM gyvft_gift_selections WHERE project_id=${id}::uuid ORDER BY created_at DESC,id DESC`,
    ]);
  const options = await sql<
    { id: string; title: string; has_image: boolean }[]
  >`
    SELECT o.id,o.title,o.image_data IS NOT NULL AS has_image FROM gyvft_gift_options o
    LEFT JOIN gyvft_gift_visibility v ON v.project_id=o.project_id AND v.option_id=o.id AND v.kind='curated'
    WHERE o.project_id=${id}::uuid AND o.published=true AND COALESCE(v.hidden,false)=false ORDER BY o.created_at,o.id`;
  const [address] =
    await sql`SELECT * FROM customer_delivery_addresses WHERE project_id=${id}::uuid`;
  const [upi] =
    await sql`SELECT upi_id,payee_name,qr_data IS NOT NULL AS has_qr FROM gyvft_customer_upi_settings WHERE singleton=true`;
  return {
    project,
    events,
    messages,
    payments,
    approvals,
    giftSelections,
    options,
    address,
    upi,
  };
}
