import { updateUserAccessAction } from "@/actions/studio-settings";
import { Badge, Card, PageHeader, SubmitButton, formatDateTime, humanize, selectClassName, statusTone } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { listProfiles } from "@/repositories/studio";

export default async function StudioUsersSettingsPage() {
  await requireStudioUser();
  const profiles = await listProfiles();

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Studio profile access. User creation remains invite/auth-system controlled; no public signup is exposed." />
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Owner action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950">{profile.full_name}</p>
                    <p className="text-xs text-slate-500">{profile.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(profile.role)}>{humanize(profile.role)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{profile.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(profile.last_login_at)}</td>
                  <td className="px-4 py-3">
                    <form action={updateUserAccessAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="profileId" value={profile.id} />
                      <select className={selectClassName} name="role" defaultValue={profile.role}>
                        {["owner", "admin", "contributor"].map((role) => (
                          <option key={role} value={role}>
                            {humanize(role)}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" name="isActive" defaultChecked={profile.is_active} />
                        Active
                      </label>
                      <SubmitButton>Save</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
