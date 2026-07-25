import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteHeader } from "@/components/public/SiteHeader";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsProvider>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <ConsentBanner />
    </AnalyticsProvider>
  );
}
