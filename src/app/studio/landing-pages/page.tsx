import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, SecondaryLink, formatDateTime, humanize, statusTone } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { listLandingPages } from "@/repositories/studio";

export default async function StudioLandingPagesPage() {
  await requireStudioUser();
  const pages = await listLandingPages();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Landing pages"
        description="Manage Studio landing page metadata and publishing state."
        action={<SecondaryLink href="/studio/landing-pages/new">New landing page</SecondaryLink>}
      />
      {pages.length === 0 ? (
        <EmptyState
          title="No landing pages"
          description="No landing page records exist yet."
          action={<SecondaryLink href="/studio/landing-pages/new">Create landing page</SecondaryLink>}
        />
      ) : (
        <Card>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pages.map((page) => (
                <tr key={page.id}>
                  <td className="px-4 py-3">
                    <Link className="font-medium text-slate-950 hover:underline" href={`/studio/landing-pages/${page.id}`}>
                      {page.internal_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">/{page.slug}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(page.status)}>{humanize(page.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(page.published_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(page.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
