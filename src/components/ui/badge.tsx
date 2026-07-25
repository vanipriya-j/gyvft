import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-copper/30 bg-copper/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-copper-deep",
        className,
      )}
      {...props}
    />
  );
}
