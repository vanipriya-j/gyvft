import { updateTrackingRuleAction } from "@/actions/studio-integrations";
import { Card, EmptyState, PageHeader } from "@/components/studio/ui";
import { canManageIntegrations } from "@/lib/auth/roles";
import { requireStudioUser } from "@/lib/auth/session";
import { getDeliveryMatrix } from "@/repositories/studio";

export default async function StudioTrackingPage() {
  const profile = await requireStudioUser();
  if (!canManageIntegrations(profile.role)) throw new Error("You do not have permission to manage tracking");
  const rows = await getDeliveryMatrix();

  return (
    <div className="space-y-6">
      <PageHeader title="Event delivery matrix" description="Tracking rule destinations with recent real integration delivery counts." />
      {rows.length === 0 ? (
        <EmptyState title="No tracking rules" description="No tracking rules are configured in the database." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Internal</th>
                  <th className="px-4 py-3">GA4</th>
                  <th className="px-4 py-3">Meta browser</th>
                  <th className="px-4 py-3">Meta server</th>
                  <th className="px-4 py-3">Recent logs</th>
                  <th className="px-4 py-3">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.event_name}>
                    <td className="px-4 py-3 font-medium text-slate-950">{row.event_name}</td>
                    <td className="px-4 py-3">
                      <form id={`tracking-${row.event_name}`} action={updateTrackingRuleAction}>
                        <input type="hidden" name="eventName" value={row.event_name} />
                        <input type="checkbox" name="internalEnabled" defaultChecked={row.internal_enabled} />
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <input form={`tracking-${row.event_name}`} type="checkbox" name="ga4Enabled" defaultChecked={row.ga4_enabled} />
                    </td>
                    <td className="px-4 py-3">
                      <input form={`tracking-${row.event_name}`} type="checkbox" name="metaBrowserEnabled" defaultChecked={row.meta_browser_enabled} />
                    </td>
                    <td className="px-4 py-3">
                      <input form={`tracking-${row.event_name}`} type="checkbox" name="metaServerEnabled" defaultChecked={row.meta_server_enabled} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.recent_logs} total · {row.successful_logs} ok · {row.failed_logs} failed
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                        form={`tracking-${row.event_name}`}
                        type="submit"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
