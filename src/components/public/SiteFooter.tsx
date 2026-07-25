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
    <footer className="border-t border-ink/10 bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.2fr_1fr] lg:px-8">
        <div>
          <p className="font-display text-4xl">GYVFT</p>
          <p className="mt-3 max-w-md text-lg italic text-paper/74">Your story. Our telling.</p>
          <p className="mt-6 max-w-xl text-sm leading-6 text-paper/62">
            Premium story-led keepsakes, merchandise, publications, films, and experiences for
            personal milestones and organisational culture.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 md:justify-end">
          {links.map((link) => (
            <Link
              className="text-sm font-semibold text-paper/72 transition hover:text-paper"
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
