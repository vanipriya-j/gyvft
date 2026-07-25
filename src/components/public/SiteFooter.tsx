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
    <footer className="ink-band text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.3fr_1fr] lg:px-8">
        <div>
          <p className="font-brand text-4xl font-bold">GYVFT</p>
          <p className="mt-3 max-w-md font-display text-2xl italic text-saffron/90">
            Your story. Our telling.
          </p>
          <p className="mt-6 max-w-xl text-base leading-7 text-paper/70">
            A design-led studio that turns people, milestones and memories into gifts, books,
            merchandise, packaging and experiences.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 md:justify-end">
          {links.map((link) => (
            <Link
              className="text-sm font-semibold text-paper/72 transition hover:text-saffron"
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
