import { PUBLIC_EVENT_NAMES } from "@/config/constants";
import { Card, EmptyState, MetricCard, PageHeader } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { getFunnelCounts } from "@/repositories/events";

const funnelEvents = [
  "page_view",
  "story_form_started",
  "story_step_completed",
  "story_form_submitted",
  "partner_form_started",
  "partner_form_submitted",
  "discovery_requested",
];

export default async function StudioFunnelsPage() {
  await requireStudioUser({ roles: ["owner", "admin"] });
  const rows = await getFunnelCounts(funnelEvents.filter((event) => PUBLIC_EVENT_NAMES.includes(event as (typeof PUBLIC_EVENT_NAMES)[number])));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Funnels" description="Event funnel counts from analytics_events. Steps with no events remain zero." />
      <MetricCard label="Tracked funnel events" value={total} />
      <Card>
        <h2 className="text-lg font-semibold text-slate-950">Event counts</h2>
        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No funnel events configured" description="No configured public event names matched this funnel." />
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Step</th>
                  <th className="px-4 py-3">Events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.eventName}>
                    <td className="px-4 py-3 font-medium text-slate-950">{row.eventName}</td>
                    <td className="px-4 py-3 text-slate-600">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
