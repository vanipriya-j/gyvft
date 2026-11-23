import Link from "@/components/ui/navigation-link";
import { BrandLogo } from "@/components/public/BrandLogo";

const links = [
  { href: "/tell-your-story", label: "Share a gift brief" },
  { href: "/book-a-discovery", label: "Talk to Aarla" },
  { href: "/upload-a-brief", label: "Upload a brief" },
  { href: "/become-a-merch-partner", label: "Merch partnerships" },
  { href: "/why-gyvft", label: "About GYVFT" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/terms", label: "Terms" },
  { href: "mailto:hello@gyvft.com", label: "Contact" },
  { href: "/studio", label: "Team access" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface text-ink">
      <div className="mx-auto grid max-w-7xl gap-7 px-5 py-9 md:grid-cols-[1.3fr_1fr] lg:px-8">
        <div>
          <BrandLogo height={30} className="h-[30px] w-[123px]" />
          <p className="mt-3 max-w-md font-display text-xl italic text-olive-dark">
            Your story. Our telling.
          </p>
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-text">
            Your people. Their moments. Gifts that mean something. Thoughtfully
            brought together with Aarla.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 md:justify-end">
          {links.map((link) => (
            <Link
              className="inline-flex min-h-11 items-center text-sm font-medium text-muted-text transition hover:text-olive-dark"
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
