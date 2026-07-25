import { Card, EmptyState, Field, PageHeader, Pagination, formatDateTime, inputClassName, selectClassName } from "@/components/studio/ui";
import { canManageIntegrations } from "@/lib/auth/roles";
import { requireStudioUser } from "@/lib/auth/session";
import { listIntegrationLogs } from "@/repositories/studio";

type SearchParams = Record<string, string | string[] | undefined>;

function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function successFilter(input: string | undefined): boolean | undefined {
  if (input === "true") return true;
  if (input === "false") return false;
  return undefined;
}

export default async function StudioIntegrationLogsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireStudioUser();
  if (!canManageIntegrations(profile.role)) throw new Error("You do not have permission to view integration logs");
  const params = await searchParams;
  const page = Math.max(1, Number(first(params, "page") ?? "1"));
  const pageSize = 50;
  const provider = first(params, "provider");
  const success = first(params, "success");
  const result = await listIntegrationLogs({
    provider,
    success: successFilter(success),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Integration logs" description="Provider delivery and test logs with sanitised errors only." />
      <Card>
        <form className="grid gap-4 md:grid-cols-3">
          <Field label="Provider">
            <input className={inputClassName} name="provider" defaultValue={provider} placeholder="ga4, resend, meta_capi" />
          </Field>
          <Field label="Success">
            <select className={selectClassName} name="success" defaultValue={success ?? ""}>
              <option value="">All</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
          </Field>
          <button className="self-end rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="submit">
            Filter
          </button>
        </form>
      </Card>
      {result.rows.length === 0 ? (
        <EmptyState title="No integration logs" description="No real log entries match this filter." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Operation</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">HTTP</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-medium text-slate-950">{log.provider}</td>
                  <td className="px-4 py-3 text-slate-600">{log.operation}</td>
                  <td className="px-4 py-3 text-slate-600">{log.event_name || "Not set"}</td>
                  <td className="px-4 py-3 text-slate-600">{log.success ? "Success" : "Failed"}</td>
                  <td className="px-4 py-3 text-slate-600">{log.http_status ?? "Not set"}</td>
                  <td className="px-4 py-3 text-slate-600">{log.sanitised_error || "None"}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/studio/integration-logs" page={page} pageSize={pageSize} total={result.total} params={{ provider, success }} />
    </div>
  );
}
