import "server-only";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { journeyProject } from "./journeys";
import { JourneyError, giftLocked } from "./journey-model";
import { momentsFor } from "./moments";
import { lineItemSchema } from "./pilot-model";
import { z } from "zod";
import { validImage } from "./images";
async function writeApprovalDraft(
  tx: Sql,
  projectId: string,
  kind: string,
  raw: Record<string, unknown>,
) {
  if (!["proposal", "design"].includes(kind))
    throw new JourneyError("Choose a quote or artwork.");
  const body = z
    .object({
      title: z.string().trim().min(2).max(180),
      description: z.string().trim().min(2).max(5000),
      items: z.array(lineItemSchema).max(50).optional(),
      gift_selection_id: z.string().uuid().nullable().optional(),
    })
    .parse(raw);
  let bytes: Buffer | null = null,
    mime: string | null = null;
  if (raw.image) {
    const pic = z
      .object({ data: z.string().max(2800000), mime: z.string() })
      .parse(raw.image);
    bytes = Buffer.from(pic.data, "base64");
    mime = pic.mime;
    if (!validImage(bytes, mime))
      throw new JourneyError("Use a PNG, JPEG or WebP image under 2 MB.");
  }
  await tx`INSERT INTO gyvft_gift_approval_drafts(project_id,kind,document,image_data,image_type) VALUES(${projectId}::uuid,${kind},${tx.json(body)},${bytes},${mime}) ON CONFLICT(project_id,kind) DO UPDATE SET document=EXCLUDED.document,image_data=COALESCE(EXCLUDED.image_data,gyvft_gift_approval_drafts.image_data),image_type=COALESCE(EXCLUDED.image_type,gyvft_gift_approval_drafts.image_type),version=gyvft_gift_approval_drafts.version+1,updated_at=now()`;
}
export async function operatorJourneyCommand(raw: Record<string, unknown>) {
  const op = z
      .enum([
        "feature_photo",
        "feature_testimonial",
        "save_approval_draft",
        "task",
        "internal_note",
      ])
      .parse(raw.op),
    requestId = z.string().uuid().parse(raw.request_id);
  const id = z.string().uuid().parse(raw.id);
  return getSql().begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    const p = await journeyProject(tx, id);
    if (p.is_draft) throw new JourneyError("Request unavailable.");
    const [prior] =
      await tx`SELECT project_id,operation FROM gyvft_customer_admin_events WHERE request_id=${requestId}::uuid`;
    if (prior) {
      if (prior.project_id !== id || prior.operation !== op)
        throw new JourneyError("Action key already used.");
      return;
    }
    if (op === "feature_photo") {
      const photoId = z.string().uuid().parse(raw.photo_id),
        featured = z.boolean().parse(raw.featured);
      const rows =
        await tx`UPDATE gyvft_gift_photos SET featured=${featured} WHERE id=${photoId}::uuid AND project_id=${id}::uuid AND (public_permission OR ${featured}=false) RETURNING id`;
      if (!rows[0])
        throw new JourneyError(
          "This photo is unavailable or the customer has withdrawn public permission.",
        );
    } else if (op === "feature_testimonial") {
      const featured = z.boolean().parse(raw.featured);
      const rows =
        await tx`UPDATE gyvft_gift_testimonials SET featured=${featured} WHERE project_id=${id}::uuid AND (public_permission OR ${featured}=false) RETURNING project_id`;
      if (!rows[0])
        throw new JourneyError(
          "The customer has not permitted public use of this testimonial.",
        );
    } else if (op === "save_approval_draft") {
      if (giftLocked(p as { stage: number }))
        throw new JourneyError(
          "Production has started. Gift and artwork are locked.",
        );
      if (
        raw.kind === "proposal" &&
        (p.shopify_order_id ||
          p.shopify_order_reference ||
          p.shopify_order_state !== "pending")
      )
        throw new JourneyError("The official Shopify order is read-only here.");
      await writeApprovalDraft(tx, id, String(raw.kind), raw);
    } else if (op === "task") {
      const d = z
        .object({
          owner: z.string().trim().min(1).max(120),
          due: z.union([z.string().datetime({ offset: true }), z.literal("")]),
        })
        .parse(raw);
      await tx`UPDATE customer_projects SET task_owner=${d.owner},task_due_at=${d.due || null}::timestamptz WHERE id=${id}::uuid`;
    } else {
      const body = z.string().trim().min(1).max(4000).parse(raw.body);
      await tx`INSERT INTO gyvft_gift_internal_notes(project_id,body) VALUES(${id}::uuid,${body})`;
    }
    await tx`INSERT INTO gyvft_customer_admin_events(request_id,project_id,operation) VALUES(${requestId}::uuid,${id}::uuid,${op})`;
  });
}
export async function operationalExtras(projectId: string) {
  const sql = getSql();
  const [notes, drafts, changes] = await Promise.all([
    sql`SELECT id,body,created_at FROM gyvft_gift_internal_notes WHERE project_id=${projectId}::uuid ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT kind,document,version,image_data IS NOT NULL AS has_image,updated_at FROM gyvft_gift_approval_drafts WHERE project_id=${projectId}::uuid`,
    sql`SELECT c.id,c.body,c.status,a.kind,a.version FROM gyvft_gift_changes c JOIN customer_project_approvals a ON a.id=c.approval_id WHERE c.project_id=${projectId}::uuid ORDER BY c.created_at DESC`,
  ]);
  return { notes, drafts, changes, ...(await momentsFor(projectId)) };
}
export async function operationsDirectory() {
  const sql = getSql();
  const [customers, occasions, submissions] = await Promise.all([
    sql`SELECT a.id,a.email,f.name,count(p.id)::int AS gifts,COALESCE(sum(p.paid_paise) FILTER(WHERE COALESCE(p.submission_key,'') NOT LIKE 'gyvft-demo-%'),0) AS paid FROM gyvft_customer_accounts a LEFT JOIN gyvft_customer_profiles f ON f.account_id=a.id LEFT JOIN customer_projects p ON p.customer_account_id=a.id AND p.is_draft=false GROUP BY a.id,a.email,f.name ORDER BY a.created_at DESC LIMIT 200`,
    sql`SELECT DISTINCT o.id,o.title,o.occasion_date::text,p.customer_email FROM gyvft_customer_occasions o JOIN customer_projects p ON p.occasion_id=o.id WHERE p.is_draft=false ORDER BY o.occasion_date::text LIMIT 100`,
    sql`SELECT p.id,p.title,p.customer_email,t.rating,t.public_permission,(SELECT count(*) FROM gyvft_gift_photos f WHERE f.project_id=p.id)::int AS photos FROM customer_projects p LEFT JOIN gyvft_gift_testimonials t ON t.project_id=p.id WHERE p.stage>=10 AND p.is_draft=false ORDER BY p.created_at DESC LIMIT 100`,
  ]);
  return { customers, occasions, submissions };
}
