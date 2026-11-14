import Link from "next/link";
import { BrandLogo } from "@/components/public/BrandLogo";
export const metadata = {
  title: "My GYVFT",
  robots: { index: false, follow: false },
};
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-border bg-paper">
        <nav
          className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"
          aria-label="Customer navigation"
        >
          <Link href="/" aria-label="GYVFT home">
            <BrandLogo height={30} className="h-[30px] w-[123px]" />
          </Link>
          <div className="flex gap-6 text-sm">
            <Link href="/account">My GYVFT</Link>
            <Link href="/tell-your-story">Start a new story</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-5 lg:py-10">
        {children}
      </main>
      <footer className="border-t border-border px-5 py-6 text-center text-sm text-muted-text">
        Your story. Our telling.{" "}
        <Link href="/privacy" className="ml-4 underline">
          Privacy
        </Link>
      </footer>
    </>
  );
}
