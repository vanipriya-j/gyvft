import { cn } from "@/lib/utils/cn";

type ProgressProps = {
  value: number;
  max?: number;
  label?: string;
  className?: string;
};

export function Progress({ value, max = 100, label, className }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("w-full", className)}>
      {label ? <p className="mb-2 text-sm text-ink/65">{label}</p> : null}
      <div
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={value}
        className="h-2 overflow-hidden rounded-full bg-ink/10"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-copper transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
