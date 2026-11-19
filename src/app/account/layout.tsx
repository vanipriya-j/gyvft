import Link from "next/link";
import "@/components/customer/application.css";
import { Suspense } from "react";
import { AccountNavigation } from "@/components/customer/account-navigation";
import { getCustomerAccount } from "@/lib/customer/session";
import { BrandLogo } from "@/components/public/BrandLogo";
export const metadata = {
  title: "My GYVFT",
  robots: { index: false, follow: false },
};
async function AccountHeader() {
  const account = await getCustomerAccount();
  return <AccountNavigation email={account?.email || null} />;
}
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="gyvft-app customer-application">
      <Suspense
        fallback={
          <header className="border-b border-border bg-paper">
            <div className="mx-auto flex h-16 max-w-7xl items-center px-4 md:h-[72px] md:px-6">
              <Link href="/" aria-label="GYVFT home">
                <BrandLogo height={28} className="h-7 w-[115px]" />
              </Link>
            </div>
          </header>
        }
      >
        <AccountHeader />
      </Suspense>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 md:px-6 md:py-6">
        {children}
      </main>
      <footer className="hidden border-t border-border px-6 py-4 text-xs text-muted-text md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span>Your story. Our telling.</span>
          <div className="flex gap-5">
            <Link href="/book-a-discovery">Help & contact</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
