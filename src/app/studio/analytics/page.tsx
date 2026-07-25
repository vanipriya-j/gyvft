import Link from "next/link";
import { Card, EmptyState, MetricCard, PageHeader, formatDate } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { getAnalyticsOverview } from "@/repositories/studio";

export default async function StudioAnalyticsPage() {
  await requireStudioUser({ roles: ["owner", "admin"] });
  const overview = await getAnalyticsOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Real analytics event and opportunity counts. No generated charts or placeholder trends are shown."
        action={
          <div className="flex gap-2">
            <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700" href="/studio/analytics/funnels">
              Funnels
            </Link>
            <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700" href="/studio/analytics/campaigns">
              Campaigns
            </Link>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Events" value={overview.eventCount} />
        <MetricCard label="Visitors" value={overview.visitorCount} description="Distinct anonymous visitor IDs" />
        <MetricCard label="Sessions" value={overview.sessionCount} description="Distinct session IDs" />
        <MetricCard label="Opportunities" value={overview.opportunityCount} />
        <MetricCard label="Won / Lost" value={`${overview.wonCount} / ${overview.lostCount}`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Top events</h2>
          {overview.topEvents.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No events recorded" description="Analytics events will appear after real public interactions are recorded." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {overview.topEvents.map((event) => (
                <li key={event.event_name} className="flex justify-between py-3 text-sm">
                  <span className="font-medium text-slate-950">{event.event_name}</span>
                  <span className="text-slate-500">{event.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Daily event counts</h2>
          {overview.dailyEvents.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No daily counts" description="No analytics events are available to aggregate by day." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {overview.dailyEvents.map((day) => (
                <li key={day.day} className="flex justify-between py-3 text-sm">
                  <span className="font-medium text-slate-950">{formatDate(day.day)}</span>
                  <span className="text-slate-500">{day.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
