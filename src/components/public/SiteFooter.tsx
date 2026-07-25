import Link from "next/link";

const links = [
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/terms", label: "Terms" },
  { href: "mailto:hello@gyvft.com", label: "Contact" },
  { href: "/studio", label: "Studio Login" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface text-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.3fr_1fr] lg:px-8">
        <div>
          <p className="font-display text-3xl tracking-[0.04em]">GYVFT</p>
          <p className="mt-3 max-w-md font-display text-xl italic text-olive-dark">
            Your story. Our telling.
          </p>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-text">
            We turn people, milestones and memories into gifts, books, merchandise and experiences.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 md:justify-end">
          {links.map((link) => (
            <Link
              className="text-sm font-medium text-muted-text transition hover:text-olive-dark"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
