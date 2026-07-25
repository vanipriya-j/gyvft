import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "focus-ring min-h-12 w-full rounded-2xl border border-ink/15 bg-paper/80 px-4 py-3 text-base text-ink shadow-sm transition focus:border-copper",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
