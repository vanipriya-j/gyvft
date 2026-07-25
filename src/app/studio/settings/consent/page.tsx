import { createConsentVersionAction, updateConsentSettingsAction } from "@/actions/studio-settings";
import { Card, Field, PageHeader, SubmitButton, formatDateTime, inputClassName } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { getWorkspaceSettings, listConsentVersions } from "@/repositories/studio";

export default async function StudioConsentSettingsPage() {
  await requireStudioUser({ roles: ["owner"] });
  const [settings, versions] = await Promise.all([getWorkspaceSettings(), listConsentVersions()]);

  return (
    <div className="space-y-6">
      <PageHeader title="Consent" description="Owner-only consent banner settings and version records." />
      <Card>
        <h2 className="text-lg font-semibold text-slate-950">Banner settings</h2>
        {settings ? (
          <form action={updateConsentSettingsAction} className="mt-4 grid gap-5 md:grid-cols-2">
            <Field label="Banner title">
              <input className={inputClassName} name="bannerTitle" defaultValue={settings.consent_banner_title} required />
            </Field>
            <Field label="Active version">
              <input className={inputClassName} name="activeVersion" defaultValue={settings.active_consent_version} required />
            </Field>
            <Field label="Privacy URL">
              <input className={inputClassName} name="privacyUrl" defaultValue={settings.consent_privacy_url} required />
            </Field>
            <Field label="Cookies URL">
              <input className={inputClassName} name="cookiesUrl" defaultValue={settings.consent_cookies_url} required />
            </Field>
            <Field label="Default region behaviour">
              <input className={inputClassName} name="defaultRegionBehaviour" defaultValue={settings.consent_default_region_behaviour} required />
            </Field>
            <Field label="Retention days">
              <input className={inputClassName} name="retentionDays" type="number" defaultValue={settings.consent_retention_days} required />
            </Field>
            <Field label="Banner body">
              <textarea className={inputClassName} name="bannerBody" defaultValue={settings.consent_banner_body} rows={4} required />
            </Field>
            <div className="md:col-span-2">
              <SubmitButton>Save consent settings</SubmitButton>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No workspace settings row exists.</p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-950">Create consent version</h2>
        <form action={createConsentVersionAction} className="mt-4 grid gap-5 md:grid-cols-2">
          <Field label="Version">
            <input className={inputClassName} name="version" required />
          </Field>
          <Field label="Banner title">
            <input className={inputClassName} name="bannerTitle" required />
          </Field>
          <Field label="Privacy URL">
            <input className={inputClassName} name="privacyUrl" defaultValue="/privacy" required />
          </Field>
          <Field label="Cookies URL">
            <input className={inputClassName} name="cookiesUrl" defaultValue="/cookies" required />
          </Field>
          <Field label="Banner body">
            <textarea className={inputClassName} name="bannerBody" rows={4} required />
          </Field>
          <label className="flex items-center gap-3 self-end text-sm font-medium text-slate-700">
            <input type="checkbox" name="isActive" />
            Make active
          </label>
          <div className="md:col-span-2">
            <SubmitButton>Create version</SubmitButton>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-950">Versions</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {versions.map((version) => (
            <li key={version.id} className="py-3 text-sm">
              <p className="font-medium text-slate-950">
                {version.version} {version.is_active ? "(active)" : ""}
              </p>
              <p className="mt-1 text-slate-500">{version.banner_title}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDateTime(version.created_at)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
