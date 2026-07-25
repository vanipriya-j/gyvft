import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "dark";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-olive-dark text-paper shadow-[0_12px_28px_rgba(74,52,41,0.18)] hover:bg-[#3a291f]",
  secondary:
    "border border-ink/15 bg-paper/70 text-ink hover:border-olive/45 hover:bg-paper",
  ghost: "text-ink hover:bg-ink/5",
  dark: "bg-ink text-paper hover:bg-ink-soft",
};

const base =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-md px-6 py-2.5 text-sm font-medium tracking-wide transition duration-200 disabled:pointer-events-none disabled:opacity-50";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], className)} type={type} {...props} />;
}

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
};

export function ButtonLink({
  className,
  href,
  variant = "primary",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], className)} href={href} {...props}>
      {children}
    </Link>
  );
}
