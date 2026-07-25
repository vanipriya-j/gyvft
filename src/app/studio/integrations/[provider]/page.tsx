import { notFound } from "next/navigation";
import { saveIntegrationAction } from "@/actions/studio-integrations";
import { Badge, Card, Field, PageHeader, SubmitButton, humanize, inputClassName, selectClassName, statusTone } from "@/components/studio/ui";
import { canConfigureSecretIntegrations, canManageIntegrations } from "@/lib/auth/roles";
import { requireStudioUser } from "@/lib/auth/session";
import { getIntegration } from "@/repositories/studio";

const providerFields: Record<string, { config: string[]; secrets: string[] }> = {
  gtm: { config: ["container_id"], secrets: [] },
  ga4: { config: ["measurement_id"], secrets: [] },
  meta_pixel: { config: ["pixel_id"], secrets: [] },
  meta_capi: { config: ["dataset_id"], secrets: ["access_token"] },
  clarity: { config: ["project_id"], secrets: [] },
  resend: { config: ["from_email", "from_name"], secrets: ["api_key"] },
  openai: { config: ["model"], secrets: ["api_key"] },
  supabase_storage: { config: ["briefs_bucket"], secrets: [] },
  webhooks: { config: ["default_timeout_ms", "max_attempts"], secrets: ["signing_secret"] },
};

function configValue(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

export default async function StudioIntegrationProviderPage({ params }: { params: Promise<{ provider: string }> }) {
  const profile = await requireStudioUser();
  if (!canManageIntegrations(profile.role)) throw new Error("You do not have permission to manage integrations");
  const { provider } = await params;
  const integration = await getIntegration(provider);
  if (!integration) notFound();
  const fields = providerFields[provider] ?? { config: [], secrets: [] };
  const canEditSecrets = canConfigureSecretIntegrations(profile.role);

  return (
    <div className="space-y-6">
      <PageHeader title={integration.display_name} description="Update non-secret config and owner-only secrets. Stored secret values are not displayed." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <form action={saveIntegrationAction} className="space-y-5">
            <input type="hidden" name="provider" value={integration.provider} />
            <Field label="Display name">
              <input className={inputClassName} name="displayName" defaultValue={integration.display_name} required />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Status">
                <select className={selectClassName} name="status" defaultValue={integration.status}>
                  {["not_configured", "configured", "connected", "error", "disabled"].map((status) => (
                    <option key={status} value={status}>
                      {humanize(status)}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                <input type="checkbox" name="enabled" defaultChecked={integration.enabled} />
                Enabled
              </label>
            </div>
            {fields.config.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {fields.config.map((field) => (
                  <Field key={field} label={humanize(field)}>
                    <input className={inputClassName} name={`config.${field}`} defaultValue={configValue(integration.config, field)} />
                  </Field>
                ))}
              </div>
            ) : null}
            {fields.secrets.length > 0 && canEditSecrets ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="font-semibold text-amber-950">Owner-only secrets</h2>
                <p className="mt-1 text-sm text-amber-800">Leave blank to keep the current encrypted value.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {fields.secrets.map((field) => (
                    <Field key={field} label={humanize(field)}>
                      <input className={inputClassName} name={`secret.${field}`} type="password" autoComplete="off" />
                    </Field>
                  ))}
                </div>
              </div>
            ) : fields.secrets.length > 0 ? (
              <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Only owners can update integration secrets.</p>
            ) : null}
            <SubmitButton>Save integration</SubmitButton>
          </form>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Current status</h2>
          <div className="mt-4">
            <Badge tone={statusTone(integration.status)}>{humanize(integration.status)}</Badge>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-slate-500">Secrets</dt>
              <dd className="mt-1 text-slate-900">
                {integration.secrets.length === 0
                  ? "Not configured"
                  : integration.secrets.map((secret) => `${humanize(secret.secret_name)} configured (...${secret.last_four ?? "----"})`).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Last error</dt>
              <dd className="mt-1 text-slate-900">{integration.last_error || "None recorded"}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
