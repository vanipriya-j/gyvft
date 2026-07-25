import { Card, EmptyState, Field, PageHeader, Pagination, formatDateTime, inputClassName } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { listAnalyticsEvents } from "@/repositories/events";

type SearchParams = Record<string, string | string[] | undefined>;

function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function maskId(value: string | null): string {
  if (!value) return "Not set";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export default async function StudioEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStudioUser({ roles: ["owner", "admin"] });
  const params = await searchParams;
  const page = Math.max(1, Number(first(params, "page") ?? "1"));
  const pageSize = 50;
  const eventName = first(params, "eventName");
  const result = await listAnalyticsEvents({ eventName, limit: pageSize, offset: (page - 1) * pageSize });

  return (
    <div className="space-y-6">
      <PageHeader title="Events" description="Observability console for analytics events. Visitor and session IDs are masked." />
      <Card>
        <form className="flex flex-col gap-3 sm:flex-row">
          <Field label="Event name">
            <input className={inputClassName} name="eventName" defaultValue={eventName} placeholder="story_form_submitted" />
          </Field>
          <button className="self-end rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="submit">
            Filter
          </button>
        </form>
      </Card>
      {result.rows.length === 0 ? (
        <EmptyState title="No events found" description="No real analytics events match this filter." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Visitor</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Consent</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950">{event.event_name}</p>
                    <p className="text-xs text-slate-500">{maskId(event.event_id)}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{maskId(event.anonymous_visitor_id)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{maskId(event.session_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{event.source_route || "Not set"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    Analytics: {event.consent_analytics ? "yes" : "no"} · Ads: {event.consent_advertising ? "yes" : "no"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(event.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/studio/events" page={page} pageSize={pageSize} total={result.total} params={{ eventName }} />
    </div>
  );
}
