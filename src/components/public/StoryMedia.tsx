import Image from "next/image";
import type { StoryMedia as StoryMediaType } from "@/content/stories";
import { cn } from "@/lib/utils/cn";

type StoryMediaProps = {
  media: StoryMediaType;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

/**
 * Renders story imagery. While `media.isPlaceholder` is true, an elegant
 * reserve block is shown so layout stays stable until real assets arrive.
 */
export function StoryMedia({
  media,
  className,
  priority = false,
  sizes = "(max-width: 1024px) 100vw, 50vw",
}: StoryMediaProps) {
  if (media.isPlaceholder) {
    return (
      <div
        aria-label={media.alt}
        className={cn(
          "relative flex h-full w-full items-end overflow-hidden border border-border bg-surface",
          className,
        )}
        role="img"
      >
        {/*
          TODO: Replace this placeholder with the final asset at media.src
          (set isPlaceholder: false in src/content/stories.ts).
        */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(112,113,91,0.12),transparent_40%),linear-gradient(160deg,#fbf7f0_0%,#efe7da_55%,#e7dfd0_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(rgba(43,43,43,0.06) 0.7px, transparent 0.7px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative z-10 w-full border-t border-border/70 bg-paper/70 px-5 py-4 backdrop-blur-sm">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-olive">Image forthcoming</p>
          <p className="mt-1 font-display text-lg text-ink">{media.alt.replace(/^Placeholder for /i, "")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden border border-border bg-surface", className)}>
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
