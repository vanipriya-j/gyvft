import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, formatDateTime, humanize, statusTone } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { canManageIntegrations } from "@/lib/auth/roles";
import { listIntegrations } from "@/repositories/studio";

export default async function StudioIntegrationsPage() {
  const profile = await requireStudioUser();
  if (!canManageIntegrations(profile.role)) throw new Error("You do not have permission to manage integrations");
  const integrations = await listIntegrations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Configured provider status from integration_definitions. Secret values are never returned to the browser."
        action={
          <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700" href="/studio/integrations/tracking">
            Tracking matrix
          </Link>
        }
      />
      {integrations.length === 0 ? (
        <EmptyState title="No integration definitions" description="Seeded integration definitions are not present in the database." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration) => (
            <Link key={integration.provider} href={`/studio/integrations/${integration.provider}`}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-950">{integration.display_name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{integration.provider}</p>
                  </div>
                  <Badge tone={statusTone(integration.status)}>{humanize(integration.status)}</Badge>
                </div>
                <dl className="mt-5 space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <dt>Enabled</dt>
                    <dd>{integration.enabled ? "Yes" : "No"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Secrets</dt>
                    <dd>
                      {integration.secrets.length === 0
                        ? "Not configured"
                        : integration.secrets.map((secret) => `${secret.secret_name} (...${secret.last_four ?? "----"})`).join(", ")}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Last success</dt>
                    <dd>{formatDateTime(integration.last_successful_test_at)}</dd>
                  </div>
                </dl>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
