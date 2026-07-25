import { Card, EmptyState, PageHeader } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { getCampaignAnalytics } from "@/repositories/studio";

export default async function StudioCampaignAnalyticsPage() {
  await requireStudioUser({ roles: ["owner", "admin"] });
  const rows = await getCampaignAnalytics();

  return (
    <div className="space-y-6">
      <PageHeader title="Campaign analytics" description="Campaign performance from real campaign, analytics event, and opportunity records." />
      {rows.length === 0 ? (
        <EmptyState title="No campaign analytics" description="No campaign records, UTM events, or linked opportunities are available yet." />
      ) : (
        <Card>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">UTM campaign</th>
                <th className="px-4 py-3">Events</th>
                <th className="px-4 py-3">Opportunities</th>
                <th className="px-4 py-3">Won</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.campaign_id ?? "utm"}-${row.utm_campaign ?? "none"}`}>
                  <td className="px-4 py-3 font-medium text-slate-950">{row.campaign_name || "Unmatched UTM"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.utm_campaign || "Not set"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.events}</td>
                  <td className="px-4 py-3 text-slate-600">{row.opportunities}</td>
                  <td className="px-4 py-3 text-slate-600">{row.won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
