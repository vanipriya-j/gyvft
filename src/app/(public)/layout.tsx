import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteHeader } from "@/components/public/SiteHeader";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1" id="public-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
      <ConsentBanner />
    </>
  );
}
