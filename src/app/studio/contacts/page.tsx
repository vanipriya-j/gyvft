import Link from "next/link";
import { Card, EmptyState, Field, PageHeader, Pagination, formatDate, inputClassName } from "@/components/studio/ui";
import { listContacts } from "@/repositories/contacts";

type SearchParams = Record<string, string | string[] | undefined>;

function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudioContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(first(params, "page") ?? "1"));
  const pageSize = 25;
  const query = first(params, "query");
  const result = await listContacts({ query, limit: pageSize, offset: (page - 1) * pageSize });

  return (
    <div className="space-y-6">
      <PageHeader title="Contacts" description="People captured through forms, submissions, and CRM activity." />
      <Card>
        <form className="flex flex-col gap-3 sm:flex-row">
          <Field label="Search contacts">
            <input className={inputClassName} name="query" defaultValue={query} placeholder="Name, email, or phone" />
          </Field>
          <button className="self-end rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="submit">
            Search
          </button>
        </form>
      </Card>
      {result.rows.length === 0 ? (
        <EmptyState title="No contacts found" description="Contacts will appear here when real submissions or CRM records exist." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Consent</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((contact) => (
                <tr key={contact.id}>
                  <td className="px-4 py-3">
                    <Link className="font-medium text-slate-950 hover:underline" href={`/studio/contacts/${contact.id}`}>
                      {contact.full_name}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">{contact.designation || "No designation"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{contact.email || "Not set"}</td>
                  <td className="px-4 py-3 text-slate-600">{contact.phone || "Not set"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    Communication: {contact.communication_consent ? "yes" : "no"} · Marketing: {contact.marketing_consent ? "yes" : "no"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(contact.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/studio/contacts" page={page} pageSize={pageSize} total={result.total} params={{ query }} />
    </div>
  );
}
