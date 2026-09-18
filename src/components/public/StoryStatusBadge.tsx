import { isProductionRuntime } from "@/lib/public-asset";
import type { StoryStatus } from "@/content/stories";
import { cn } from "@/lib/utils/cn";

/**
 * Development/staging-only badge for editorial review states.
 * Never rendered in production.
 */
export function StoryStatusBadge({
  status,
  className,
}: {
  status: StoryStatus;
  className?: string;
}) {
  if (isProductionRuntime()) return null;
  if (status === "ready") return null;

  const label = status === "review" ? "Review" : "Reference required";
  const tone =
    status === "review"
      ? "border-olive/40 bg-olive/15 text-olive-dark"
      : "border-copper/40 bg-copper/10 text-copper-deep";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
