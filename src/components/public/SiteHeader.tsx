import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

const nav = [
  { href: "/tell-your-story", label: "Tell your story" },
  { href: "/for-organisations", label: "For organisations" },
  { href: "/upload-a-brief", label: "Upload a brief" },
  { href: "/book-a-discovery", label: "Book discovery" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 lg:px-8"
      >
        <Link className="group inline-flex items-baseline gap-3" href="/">
          <span className="font-display text-xl tracking-[0.04em] text-ink">GYVFT</span>
          <span className="hidden text-sm text-muted-text transition group-hover:text-olive-dark sm:inline">
            Your story. Our telling.
          </span>
        </Link>
        <div className="hidden items-center gap-7 lg:flex">
          {nav.map((item) => (
            <Link
              className="text-sm font-medium text-muted-text transition hover:text-ink"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <ButtonLink className="hidden sm:inline-flex" href="/become-a-merch-partner" variant="dark">
          Merch partner
        </ButtonLink>
      </nav>
      <div className="flex gap-5 overflow-x-auto border-t border-border/70 px-5 py-3 text-sm lg:hidden">
        {nav.map((item) => (
          <Link className="shrink-0 font-medium text-muted-text" href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
