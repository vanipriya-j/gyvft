import { updateFormConfigurationAction } from "@/actions/studio-forms";
import { Card, EmptyState, Field, PageHeader, SubmitButton, humanize, inputClassName, selectClassName } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { listFormConfigurations, listProfiles } from "@/repositories/studio";

export default async function StudioFormsPage() {
  await requireStudioUser();
  const [forms, profiles] = await Promise.all([listFormConfigurations(), listProfiles()]);

  return (
    <div className="space-y-6">
      <PageHeader title="Forms" description="Public form configuration records and routing defaults." />
      {forms.length === 0 ? (
        <EmptyState title="No form configurations" description="No form configuration rows exist in the database." />
      ) : (
        <div className="space-y-6">
          {forms.map((form) => (
            <Card key={form.id}>
              <form action={updateFormConfigurationAction} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="formKey" value={form.form_key} />
                <div className="md:col-span-2">
                  <h2 className="text-lg font-semibold text-slate-950">{humanize(form.form_key)}</h2>
                  <p className="mt-1 text-sm text-slate-500">Updated {form.updated_at}</p>
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" name="enabled" defaultChecked={form.enabled} />
                  Enabled
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" name="autoResponseEnabled" defaultChecked={form.auto_response_enabled} />
                  Auto response enabled
                </label>
                <Field label="Public headline">
                  <input className={inputClassName} name="publicHeadline" defaultValue={form.public_headline ?? ""} />
                </Field>
                <Field label="Success message">
                  <input className={inputClassName} name="successMessage" defaultValue={form.success_message ?? ""} />
                </Field>
                <Field label="Supporting copy">
                  <textarea className={inputClassName} name="supportingCopy" defaultValue={form.supporting_copy ?? ""} rows={3} />
                </Field>
                <Field label="Consent copy">
                  <textarea className={inputClassName} name="consentCopy" defaultValue={form.consent_copy ?? ""} rows={3} />
                </Field>
                <Field label="Notification recipients" hint="Comma-separated email list">
                  <input className={inputClassName} name="notificationRecipients" defaultValue={form.notification_recipients.join(", ")} />
                </Field>
                <Field label="Default assignee">
                  <select className={selectClassName} name="defaultAssigneeUserId" defaultValue={form.default_assignee_user_id ?? ""}>
                    <option value="">None</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Default priority">
                  <select className={selectClassName} name="defaultPriority" defaultValue={form.default_priority}>
                    {["low", "medium", "high", "urgent"].map((priority) => (
                      <option key={priority} value={priority}>
                        {humanize(priority)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <SubmitButton>Save form</SubmitButton>
                </div>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
