import type { AarlaProduct } from "./catalogue";
const examples = [
  ["Illustrated reunion keepsakes", "bits-2001-reunion", 85000],
  ["A personal note & a little music", "various-music-schools", 65000],
  ["Thoughtful gifts for a celebration", "various-dance-schools", 125000],
  ["A story to keep, a gift to share", "bits-2001-reunion", 145000],
  ["A warm welcome for the team", "various-dance-schools", 95000],
  ["A thank-you with a personal touch", "various-music-schools", 75000],
] as const;
export function demoCatalogue() {
  const products: AarlaProduct[] = examples.map(([title, slug, price], i) => ({
    id: String(990000000100 + i),
    title: `Sample · ${title}`,
    href: "/account/rewards/checkout?benefit=saving",
    image: `/images/gyvft/case-studies/${slug}/hero.png`,
    pricePaise: price,
    comparePaise: i % 2 === 0 ? price + 15000 : null,
    available: true,
    createdAt: "2026-11-01T00:00:00.000Z",
  }));
  return {
    allProducts: products,
    products,
    offers: products.filter((p) => p.comparePaise),
    available: true,
  };
}
