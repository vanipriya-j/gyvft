import {
  HomeDashboard,
  SavedIdeasPage,
  PaymentsPage,
} from "@/components/customer/home-dashboard";
import { customerHome, homeQuery } from "@/lib/customer/home";
import { aarlaCatalogue } from "@/lib/customer/catalogue";

import { projectsFor } from "@/lib/customer/data";
import { requireCustomerAccount } from "@/lib/customer/session";
import { dashboardExtrasFor } from "@/lib/customer/dashboard-data";
import { indiaToday, summarizeRequests } from "@/lib/customer/dashboard-model";
import { GiftingDashboard } from "@/components/customer/dashboard";
import { stories } from "@/content/stories";

export const dynamic = "force-dynamic";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const account = await requireCustomerAccount();
  const { view = "home" } = await searchParams;
  if (
    ["home", "saved", "payments"].includes(view) ||
    !["requests", "occasions", "ideas"].includes(view)
  ) {
    const query = homeQuery.parse(
      view === "saved"
        ? { section: "saved", limit: 20 }
        : view === "payments"
          ? { section: "payments", limit: 20 }
          : {},
    );
    const data = await customerHome(account, query);
    if (view === "saved")
      return <SavedIdeasPage key={data.generatedAt} data={data} />;
    if (view === "payments")
      return <PaymentsPage key={data.generatedAt} data={data} />;
    return <HomeDashboard key={data.generatedAt} data={data} />;
  }
  const [projects, extras, catalogue] = await Promise.all([
    projectsFor(account.id),
    dashboardExtrasFor(account.id),
    aarlaCatalogue(),
  ]);
  const selected = [
    "private-diwali-hampers",
    "photo-gauge-summer-care-pack",
    "veeramakaliamman-temple-colouring-book",
    "kumon-delegate-gifting",
    "tm-karthik-crew-gifting",
    "jannal-oram",
    "root360",
    "sruti-40",
  ];
  const groups = {
    "celebrating-people": "People & milestones",
    "building-communities": "Communities",
    "institutions-heritage": "Learning & culture",
    "organisations-events": "For teams",
    "seasonal-personal-gifting": "Gatherings & occasions",
  };
  const ideas = selected
    .map((slug) => stories.find((s) => s.slug === slug))
    .filter((s) => s && s.status === "ready" && !s.hero.isPlaceholder)
    .map((s) => ({
      slug: s!.slug,
      title: s!.title,
      summary: s!.summary,
      group: groups[s!.groupId],
      image: s!.hero.src,
      alt: s!.hero.alt,
    }));
  return (
    <GiftingDashboard
      key={view}
      initialView={
        view === "requests"
          ? "requests"
          : view === "ideas"
            ? "ideas"
            : "occasions"
      }
      showNavigation={false}
      products={catalogue.products}
      offers={catalogue.offers}
      requests={summarizeRequests(projects)}
      {...extras}
      ideas={ideas}
      today={indiaToday()}
    />
  );
}
