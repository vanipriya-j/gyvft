import "server-only";
import { stories } from "@/content/stories";
/** Public editorial content only; a saved unpublished story stops being exposed. */
export function publishedIdeas() {
  return stories
    .filter((s) => s.status === "ready" && !s.hero.isPlaceholder)
    .map((s) => ({
      id: s.slug,
      kind: "story" as const,
      title: s.title,
      summary: s.summary,
      image: s.hero.src,
      alt: s.hero.alt,
      href: `/stories/${s.slug}`,
    }));
}
export function homeInspiration() {
  const ideas = publishedIdeas();
  return (
    ideas.find((s) => s.id === "private-diwali-hampers") || ideas[0] || null
  );
}
