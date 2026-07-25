import Link from "next/link";
import { Card, DefinitionList, PageHeader, formatDateTime } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { getWorkspaceSettings, listProfiles } from "@/repositories/studio";

export default async function StudioSettingsPage() {
  await requireStudioUser();
  const [settings, profiles] = await Promise.all([getWorkspaceSettings(), listProfiles()]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace, user, security, and consent configuration." />
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/studio/settings/users">
          <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <h2 className="font-semibold text-slate-950">Users</h2>
            <p className="mt-2 text-sm text-slate-600">{profiles.length} active profile records</p>
          </Card>
        </Link>
        <Link href="/studio/settings/security">
          <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <h2 className="font-semibold text-slate-950">Security</h2>
            <p className="mt-2 text-sm text-slate-600">Production mode, bot protection, defaults</p>
          </Card>
        </Link>
        <Link href="/studio/settings/consent">
          <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <h2 className="font-semibold text-slate-950">Consent</h2>
            <p className="mt-2 text-sm text-slate-600">Banner copy and consent versions</p>
          </Card>
        </Link>
      </div>
      <Card>
        <h2 className="text-lg font-semibold text-slate-950">Workspace snapshot</h2>
        {settings ? (
          <DefinitionList
            items={[
              { label: "Currency", value: settings.default_currency },
              { label: "Production mode", value: settings.production_mode ? "Enabled" : "Disabled" },
              { label: "Bot protection", value: settings.bot_protection_enabled ? "Enabled" : "Disabled" },
              { label: "Active consent version", value: settings.active_consent_version },
              { label: "Updated", value: formatDateTime(settings.updated_at) },
            ]}
          />
        ) : (
          <p className="mt-4 text-sm text-slate-500">No workspace settings row exists.</p>
        )}
      </Card>
    </div>
  );
}
