import Link from "next/link";
import { Card, EmptyState, Field, PageHeader, Pagination, formatDate, inputClassName, humanize } from "@/components/studio/ui";
import { listOrganisations } from "@/repositories/organisations";

type SearchParams = Record<string, string | string[] | undefined>;

function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudioOrganisationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(first(params, "page") ?? "1"));
  const pageSize = 25;
  const query = first(params, "query");
  const result = await listOrganisations({ query, limit: pageSize, offset: (page - 1) * pageSize });

  return (
    <div className="space-y-6">
      <PageHeader title="Organisations" description="Companies, institutions, families, and partner organisations in Studio." />
      <Card>
        <form className="flex flex-col gap-3 sm:flex-row">
          <Field label="Search organisations">
            <input className={inputClassName} name="query" defaultValue={query} placeholder="Organisation name" />
          </Field>
          <button className="self-end rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="submit">
            Search
          </button>
        </form>
      </Card>
      {result.rows.length === 0 ? (
        <EmptyState title="No organisations found" description="Organisation records will appear when real contacts and opportunities are linked." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Relationship</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((organisation) => (
                <tr key={organisation.id}>
                  <td className="px-4 py-3">
                    <Link className="font-medium text-slate-950 hover:underline" href={`/studio/organisations/${organisation.id}`}>
                      {organisation.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{organisation.type || "Not set"}</td>
                  <td className="px-4 py-3 text-slate-600">{organisation.primary_city || "Not set"}</td>
                  <td className="px-4 py-3 text-slate-600">{humanize(organisation.relationship_status)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(organisation.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/studio/organisations" page={page} pageSize={pageSize} total={result.total} params={{ query }} />
    </div>
  );
}
