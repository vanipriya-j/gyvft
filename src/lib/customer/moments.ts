import "server-only";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { uuidPattern } from "./model";
import { validImage } from "./images";
import { journeyProject } from "./journeys";
import {
  JourneyError,
  type GiftPhoto,
  type Testimonial,
} from "./journey-model";
export async function momentsFor(projectId: string, accountId?: string) {
  const sql = getSql();
  if (accountId) {
    const [p] =
      await sql`SELECT id FROM customer_projects WHERE id=${projectId}::uuid AND customer_account_id=${accountId}::uuid`;
    if (!p) throw new JourneyError("Gift unavailable.");
  }
  const [photos, testimonials] = await Promise.all([
    sql<
      GiftPhoto[]
    >`SELECT id,caption,kind,public_permission,featured,created_at FROM gyvft_gift_photos WHERE project_id=${projectId}::uuid ORDER BY created_at,id`,
    sql<
      Testimonial[]
    >`SELECT rating,body,public_permission,featured FROM gyvft_gift_testimonials WHERE project_id=${projectId}::uuid`,
  ]);
  return { photos, testimonial: testimonials[0] || null };
}
export async function saveTestimonial(
  accountId: string,
  id: string,
  raw: { rating: number; body: string; public_permission: boolean },
) {
  if (
    !Number.isInteger(raw.rating) ||
    raw.rating < 1 ||
    raw.rating > 5 ||
    !raw.body.trim() ||
    raw.body.length > 2000 ||
    typeof raw.public_permission !== "boolean"
  )
    throw new JourneyError(
      "Choose a rating and add feedback up to 2,000 characters.",
    );
  await getSql().begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    const p = await journeyProject(tx, id, accountId);
    if (p.stage < 10)
      throw new JourneyError("Share your experience after delivery.");
    await tx`INSERT INTO gyvft_gift_testimonials(project_id,rating,body,public_permission) VALUES(${id}::uuid,${raw.rating},${raw.body.trim()},${raw.public_permission}) ON CONFLICT(project_id) DO UPDATE SET rating=EXCLUDED.rating,body=EXCLUDED.body,public_permission=EXCLUDED.public_permission,featured=false,updated_at=now()`;
  });
}
export async function addMomentPhoto(
  accountId: string,
  projectId: string,
  id: string,
  raw: {
    caption: string;
    kind: string;
    public_permission: boolean;
    rights: boolean;
    bytes: Buffer;
    mime: string;
  },
) {
  if (
    !uuidPattern.test(id) ||
    !validImage(raw.bytes, raw.mime) ||
    raw.caption.length > 500 ||
    ![
      "Gift distribution",
      "Someone using their gift",
      "Unwrapping",
      "The celebration",
    ].includes(raw.kind) ||
    raw.rights !== true ||
    typeof raw.public_permission !== "boolean"
  )
    throw new JourneyError(
      "Use a PNG, JPEG or WebP photo under 2 MB and confirm permission from the people shown.",
    );
  await getSql().begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    const p = await journeyProject(tx, projectId, accountId);
    if (p.stage < 10)
      throw new JourneyError("Add gift moments after delivery.");
    const [prior] =
      await tx`SELECT project_id FROM gyvft_gift_photos WHERE id=${id}::uuid`;
    if (prior) {
      if (prior.project_id !== projectId)
        throw new JourneyError("Photo unavailable.");
      return;
    }
    const [count] =
      await tx`SELECT count(*)::int AS n FROM gyvft_gift_photos WHERE project_id=${projectId}::uuid`;
    if (count.n >= 12)
      throw new JourneyError("You can keep up to 12 photos for this gift.");
    await tx`INSERT INTO gyvft_gift_photos(id,project_id,caption,kind,image_data,image_type,public_permission) VALUES(${id}::uuid,${projectId}::uuid,${raw.caption.trim()},${raw.kind},${raw.bytes},${raw.mime},${raw.public_permission})`;
  });
}
export async function photoPermission(
  accountId: string,
  id: string,
  permitted: boolean,
) {
  if (!uuidPattern.test(id) || typeof permitted !== "boolean")
    throw new JourneyError("Photo unavailable.");
  const rows =
    await getSql()`UPDATE gyvft_gift_photos a SET public_permission=${permitted},featured=CASE WHEN ${permitted} THEN a.featured ELSE false END FROM customer_projects p WHERE a.project_id=p.id AND a.id=${id}::uuid AND p.customer_account_id=${accountId}::uuid RETURNING p.id`;
  if (!rows[0]) throw new JourneyError("Photo unavailable.");
  return String(rows[0].id);
}
export async function deleteMomentPhoto(accountId: string, id: string) {
  if (!uuidPattern.test(id)) throw new JourneyError("Photo unavailable.");
  const rows =
    await getSql()`DELETE FROM gyvft_gift_photos a USING customer_projects p WHERE a.project_id=p.id AND a.id=${id}::uuid AND p.customer_account_id=${accountId}::uuid RETURNING p.id`;
  if (!rows[0]) throw new JourneyError("Photo unavailable.");
  return String(rows[0].id);
}
export async function featureMomentPhoto(id: string, featured: boolean) {
  if (!uuidPattern.test(id)) throw new JourneyError("Photo unavailable.");
  const rows =
    await getSql()`UPDATE gyvft_gift_photos SET featured=${featured} WHERE id=${id}::uuid AND (public_permission=true OR ${featured}=false) RETURNING id`;
  if (!rows[0])
    throw new JourneyError(
      "The customer has not permitted public use of this photo.",
    );
}
export async function featureTestimonial(projectId: string, featured: boolean) {
  const rows =
    await getSql()`UPDATE gyvft_gift_testimonials SET featured=${featured} WHERE project_id=${projectId}::uuid AND (public_permission=true OR ${featured}=false) RETURNING project_id`;
  if (!rows[0])
    throw new JourneyError(
      "The customer has not permitted public use of this testimonial.",
    );
}
export async function publicMoments() {
  return getSql()`SELECT m.id,m.caption,m.kind FROM gyvft_gift_photos m WHERE m.public_permission=true AND m.featured=true ORDER BY m.created_at DESC LIMIT 24`;
}
