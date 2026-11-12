import { requireStudioUser } from "@/lib/auth/session";
import { getSql } from "@/lib/database/client";
import { listMigrations } from "@/lib/database/migrations";
import {
  Badge,
  Card,
  PageHeader,
  formatDateTime,
} from "@/components/studio/ui";
import { MigrationsForm } from "@/components/studio/migrations-form";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function MigrationsPage() {
  await requireStudioUser({ roles: ["owner"] });
  let migrations;
  try {
    migrations = await listMigrations(getSql());
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Database migrations"
          description="Owner-only database updates."
        />
        <Card>
          <p role="alert" className="text-sm text-slate-700">
            Migration status is unavailable. Check this deployment’s
            DATABASE_URL, database access, and bundled migration files, then
            refresh.
          </p>
        </Card>
      </div>
    );
  }
  const pending = migrations.filter((m) => !m.appliedAt).length;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Database migrations"
        description={`${pending} pending · ${migrations.length - pending} applied`}
      />
      <Card>
        <MigrationsForm pendingCount={pending} />
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-950">
          Migration history
        </h2>
        <ul className="divide-y divide-slate-100">
          {migrations.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <p className="break-all font-mono text-xs text-slate-800">
                  {m.id}
                </p>
                {m.appliedAt && (
                  <p className="mt-1 text-xs text-slate-500">
                    Applied {formatDateTime(m.appliedAt)}
                  </p>
                )}
              </div>
              <Badge tone={m.appliedAt ? "green" : "amber"}>
                {m.appliedAt ? "Applied" : "Pending"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
