import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "focus-ring min-h-36 w-full rounded-2xl border border-ink/15 bg-paper/80 px-4 py-3 text-base text-ink placeholder:text-ink/45 shadow-sm transition focus:border-copper",
        className,
      )}
      {...props}
    />
  );
}
