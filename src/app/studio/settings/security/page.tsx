import { updateSecuritySettingsAction } from "@/actions/studio-settings";
import { Card, Field, PageHeader, SubmitButton, inputClassName, selectClassName } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { getWorkspaceSettings, listProfiles } from "@/repositories/studio";

export default async function StudioSecuritySettingsPage() {
  await requireStudioUser({ roles: ["owner"] });
  const [settings, profiles] = await Promise.all([getWorkspaceSettings(), listProfiles()]);

  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Owner-only workspace security and operating defaults." />
      <Card>
        {settings ? (
          <form action={updateSecuritySettingsAction} className="grid gap-5 md:grid-cols-2">
            <Field label="Default opportunity owner">
              <select className={selectClassName} name="defaultOpportunityOwnerId" defaultValue={settings.default_opportunity_owner_id ?? ""}>
                <option value="">None</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Default currency">
              <input className={inputClassName} name="defaultCurrency" defaultValue={settings.default_currency} maxLength={3} />
            </Field>
            <Field label="Max upload bytes">
              <input className={inputClassName} name="maxUploadBytes" type="number" defaultValue={settings.max_upload_bytes} />
            </Field>
            <div className="space-y-3 self-end">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input type="checkbox" name="productionMode" defaultChecked={settings.production_mode} />
                Production mode
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input type="checkbox" name="botProtectionEnabled" defaultChecked={settings.bot_protection_enabled} />
                Bot protection enabled
              </label>
            </div>
            <div className="md:col-span-2">
              <SubmitButton>Save security settings</SubmitButton>
            </div>
          </form>
        ) : (
          <p className="text-sm text-slate-500">No workspace settings row exists.</p>
        )}
      </Card>
    </div>
  );
}
