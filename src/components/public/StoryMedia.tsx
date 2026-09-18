import Image from "next/image";
import type { Story, StoryMedia as StoryMediaType } from "@/content/stories";
import { StoryStatusBadge } from "@/components/public/StoryStatusBadge";
import { isProductionRuntime, publicAssetExists } from "@/lib/public-asset";
import { cn } from "@/lib/utils/cn";

type StoryMediaProps = {
  media: StoryMediaType;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** When provided, shows a non-production review badge and enforces reference rules. */
  story?: Pick<Story, "status">;
};

function shouldUsePlaceholder(media: StoryMediaType, story?: Pick<Story, "status">): boolean {
  if (media.isPlaceholder) return true;
  if (!publicAssetExists(media.src)) return true;
  if (story?.status === "reference-required" && isProductionRuntime()) return true;
  return false;
}

/**
 * Renders story imagery. Missing assets and production reference-required
 * entries show an elegant reserve block so layout stays stable.
 */
export function StoryMedia({
  media,
  className,
  priority = false,
  sizes = "(max-width: 1024px) 100vw, 50vw",
  story,
}: StoryMediaProps) {
  const placeholder = shouldUsePlaceholder(media, story);
  const badge = story ? (
    <div className="absolute left-3 top-3 z-20">
      <StoryStatusBadge status={story.status} />
    </div>
  ) : null;

  if (placeholder) {
    return (
      <div
        aria-label={media.alt}
        className={cn(
          "relative flex h-full w-full items-end overflow-hidden border border-border bg-surface",
          className,
        )}
        role="img"
      >
        {badge}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(112,113,91,0.12),transparent_40%),linear-gradient(160deg,#fbf7f0_0%,#efe7da_55%,#e7dfd0_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(43,43,43,0.06) 0.7px, transparent 0.7px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative z-10 w-full border-t border-border/70 bg-paper/70 px-5 py-4 backdrop-blur-sm">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-olive">Image forthcoming</p>
          <p className="mt-1 font-display text-lg text-ink">
            {media.alt.replace(/^Placeholder for /i, "")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden border border-border bg-surface", className)}>
      {badge}
      <Image
        alt={media.alt}
        className="object-cover"
        fill
        priority={priority}
        sizes={sizes}
        src={media.src}
      />
    </div>
  );
}
