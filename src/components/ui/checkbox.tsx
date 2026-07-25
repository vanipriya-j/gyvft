import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring mt-1 h-5 w-5 rounded border-ink/25 text-copper accent-copper",
        className,
      )}
      type="checkbox"
      {...props}
    />
  );
}
