import "server-only";
export type AarlaProduct = {
  id: string;
  title: string;
  href: string;
  image: string;
  pricePaise: number;
  comparePaise: number | null;
  available: boolean;
  createdAt: string;
};
export function parseCatalogue(raw: unknown): AarlaProduct[] {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("products" in raw) ||
    !Array.isArray(raw.products)
  )
    return [];
  const result: AarlaProduct[] = [];
  for (const p of raw.products) {
    if (
      !p ||
      typeof p !== "object" ||
      !/^\d{1,30}$/.test(String(p.id)) ||
      typeof p.title !== "string" ||
      typeof p.handle !== "string" ||
      !Array.isArray(p.variants)
    )
      continue;
    const variants = p.variants.filter(
      (v: Record<string, unknown>) =>
        v !== null &&
        typeof v === "object" &&
        typeof v.price === "string" &&
        /^\d+(\.\d{1,2})?$/.test(v.price),
    );
    const inStock = variants.filter(
      (v: Record<string, unknown>) => v.available === true,
    );
    const chosen = (inStock.length ? inStock : variants).sort(
      (a: { price: string }, b: { price: string }) =>
        Number(a.price) - Number(b.price),
    )[0];
    if (!chosen) continue;
    const source = p.images?.[0]?.src;
    if (typeof source !== "string") continue;
    let url: URL;
    try {
      url = new URL(source);
    } catch {
      continue;
    }
    if (
      url.protocol !== "https:" ||
      Boolean(url.username || url.password) ||
      !["cdn.shopify.com", "aarla.in"].includes(url.hostname)
    )
      continue;
    const price = Math.round(Number(chosen.price) * 100),
      compare = Math.round(Number(chosen.compare_at_price) * 100);
    if (!Number.isSafeInteger(price) || price < 0) continue;
    result.push({
      id: String(p.id),
      title: p.title.slice(0, 240),
      href: `https://aarla.in/products/${encodeURIComponent(p.handle)}?utm_source=gyvft&utm_medium=customer_dashboard`,
      image: url.href,
      pricePaise: price,
      comparePaise:
        Number.isSafeInteger(compare) && compare > price ? compare : null,
      available: inStock.length > 0,
      createdAt: String(p.created_at || ""),
    });
  }
  return result.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
export async function aarlaCatalogue() {
  try {
    const all: AarlaProduct[] = [];
    const pages = await Promise.all(
      [1, 2, 3].map(async (page) => {
        const response = await fetch(
          `https://aarla.in/products.json?limit=100&page=${page}`,
          { next: { revalidate: 900 }, signal: AbortSignal.timeout(7000) },
        );
        if (!response.ok) throw Error("Catalogue unavailable");
        return parseCatalogue(await response.json());
      }),
    );
    all.push(...pages.flat());
    const unique = [...new Map(all.map((p) => [p.id, p])).values()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return {
      allProducts: unique,
      products: unique.filter((p) => p.available).slice(0, 12),
      offers: unique.filter((p) => p.available && p.comparePaise).slice(0, 10),
      available: true,
    };
  } catch {
    return { allProducts: [], products: [], offers: [], available: false };
  }
}
