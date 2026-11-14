import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { projectsFor } from "@/lib/customer/data";
import { requireCustomerAccount } from "@/lib/customer/session";
import { dashboardExtrasFor } from "@/lib/customer/dashboard-data";
import { indiaToday, summarizeRequests } from "@/lib/customer/dashboard-model";
import { GiftingDashboard } from "@/components/customer/dashboard";
import { stories } from "@/content/stories";
import { signOut } from "./actions";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const account = await requireCustomerAccount();
  const [projects, extras] = await Promise.all([
    projectsFor(account.id),
    dashboardExtrasFor(account.id),
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
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-[10px] uppercase tracking-[.22em] text-olive">
            My GYVFT
          </p>
          <h1 className="mt-2 font-serif text-3xl leading-tight md:text-4xl">
            A little thought. A lasting connection.
          </h1>
          <p className="mt-2 text-sm text-muted-text">
            Your gifting space, for home, work and the people who matter.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/tell-your-story"
            className="inline-flex items-center gap-2 rounded-full bg-olive-dark px-5 py-2.5 text-sm text-white"
          >
            <Plus size={15} /> Start a new story
          </Link>
          <form action={signOut}>
            <button className="rounded-full border border-border px-4 py-2.5 text-xs">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <GiftingDashboard
        requests={summarizeRequests(projects)}
        {...extras}
        ideas={ideas}
        today={indiaToday()}
      />
      <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-text">
        <span className="min-w-0 break-all">Signed in as {account.email}</span>
        <Link href="/stories" className="inline-flex items-center gap-1">
          More stories worth sharing <ArrowUpRight size={13} />
        </Link>
      </div>
    </>
  );
}
