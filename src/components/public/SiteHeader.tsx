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
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/80 backdrop-blur-xl">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8"
      >
        <Link className="group inline-flex items-baseline gap-3" href="/">
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">GYVFT</span>
          <span className="hidden text-sm italic text-ink/62 transition group-hover:text-copper-deep sm:inline">
            Your story. Our telling.
          </span>
        </Link>
        <div className="hidden items-center gap-6 lg:flex">
          {nav.map((item) => (
            <Link
              className="text-sm font-semibold text-ink/70 transition hover:text-copper-deep"
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
      <div className="flex gap-4 overflow-x-auto px-5 pb-4 text-sm lg:hidden">
        {nav.map((item) => (
          <Link className="shrink-0 text-ink/70" href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
