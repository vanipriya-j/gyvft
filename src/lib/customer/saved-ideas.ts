import "server-only";
import { aarlaShopHref } from "./aarla-shop-model";
import { z } from "zod";
import { getSql } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { catalogueForAccount } from "./account-catalogue";
import { publishedIdeas } from "./home-content";
import type { SavedIdea } from "./home-model";
import { pageOf } from "./home-model";
export const savedIdeaInput = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("story"),
      id: z.string().regex(/^[a-z0-9-]{1,120}$/),
    })
    .strict(),
  z
    .object({ kind: z.literal("product"), id: z.string().regex(/^\d{1,30}$/) })
    .strict(),
]);
const snapshotSchema = z.object({
  title: z.string(),
  image: z.string(),
  href: z.string(),
});
export async function setSavedIdea(
  accountId: string,
  input: z.infer<typeof savedIdeaInput>,
  saved: boolean,
) {
  const sql = getSql();
  if (input.kind === "story") {
    if (saved && !publishedIdeas().some((s) => s.id === input.id))
      throw new AppError("NOT_FOUND", "Idea unavailable.");
    if (saved)
      await sql`INSERT INTO gyvft_customer_saved_ideas(account_id,story_slug) VALUES(${accountId}::uuid,${input.id}) ON CONFLICT DO NOTHING`;
    else
      await sql`DELETE FROM gyvft_customer_saved_ideas WHERE account_id=${accountId}::uuid AND story_slug=${input.id}`;
  } else if (!saved) {
    // Removal works even when Aarla is down or the product has been retired.
    await sql`DELETE FROM gyvft_customer_saved_products WHERE account_id=${accountId}::uuid AND product_id=${input.id}`;
  } else {
    const catalogue = await catalogueForAccount(accountId);
    if (!catalogue.available)
      throw new AppError(
        "INTEGRATION_ERROR",
        "Aarla is temporarily unavailable. Please try saving again shortly.",
        { status: 503 },
      );
    const product = catalogue.allProducts.find((p) => p.id === input.id);
    if (!product) throw new AppError("NOT_FOUND", "Product unavailable.");
    // Accept references only. Never trust client-supplied prices, images or links.
    const snapshot = {
      title: product.title,
      image: product.image,
      href: product.href,
    };
    await sql`INSERT INTO gyvft_customer_saved_products(account_id,product_id,snapshot) VALUES(${accountId}::uuid,${input.id},${sql.json(snapshot)}) ON CONFLICT DO NOTHING`;
  }
  return { kind: input.kind, id: input.id, saved };
}
export async function savedIdeasFor(
  accountId: string,
  offset: number,
  limit: number,
  couponAvailable = false,
) {
  const sql = getSql();
  const [savedStories, products] = await Promise.all([
    sql<
      { story_slug: string; created_at: string }[]
    >`SELECT story_slug,created_at::text FROM gyvft_customer_saved_ideas WHERE account_id=${accountId}::uuid`,
    sql<
      { product_id: string; snapshot: unknown; created_at: string }[]
    >`SELECT product_id,snapshot,created_at::text FROM gyvft_customer_saved_products WHERE account_id=${accountId}::uuid`,
  ]);
  const published = publishedIdeas();
  const result: SavedIdea[] = savedStories.flatMap((row) => {
    const story = published.find((s) => s.id === row.story_slug);
    return story
      ? [
          {
            kind: "story" as const,
            id: story.id,
            title: story.title,
            image: story.image,
            href: story.href,
            savedAt: row.created_at,
            availability: "published" as const,
          },
        ]
      : [];
  });
  // Saved product references survive catalogue outages. No cached price/stock claim.
  for (const row of products) {
    const parsed = snapshotSchema.safeParse(row.snapshot);
    if (parsed.success)
      result.push({
        kind: "product",
        id: row.product_id,
        ...parsed.data,
        href: aarlaShopHref(parsed.data.href, couponAvailable),
        savedAt: row.created_at,
        availability: "unknown",
      });
  }
  result.sort(
    (a, b) =>
      new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime() ||
      a.kind.localeCompare(b.kind) ||
      a.id.localeCompare(b.id),
  );
  return pageOf(result, offset, limit);
}
