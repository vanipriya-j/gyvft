import Link from "next/link";
import { Suspense } from "react";
import { AccountNavigation } from "@/components/customer/account-navigation";
import { getCustomerAccount } from "@/lib/customer/session";
export const metadata = {
  title: "My GYVFT",
  robots: { index: false, follow: false },
};
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getCustomerAccount();
  return (
    <>
      <Suspense>
        <AccountNavigation email={account?.email || null} />
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
    </>
  );
}
