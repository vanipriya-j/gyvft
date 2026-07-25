import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, DefinitionList, EmptyState, PageHeader, formatDateTime, humanize, statusTone } from "@/components/studio/ui";
import { getOrganisationDetail } from "@/repositories/studio";

export default async function StudioOrganisationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getOrganisationDetail(id);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={detail.organisation.name} description="Organisation profile and related Studio records." />
      <Card>
        <DefinitionList
          items={[
            { label: "Type", value: detail.organisation.type },
            { label: "Website", value: detail.organisation.website },
            { label: "Industry", value: detail.organisation.industry },
            { label: "Primary city", value: detail.organisation.primary_city },
            { label: "Relationship", value: humanize(detail.organisation.relationship_status) },
            { label: "Notes", value: detail.organisation.notes },
            { label: "Last activity", value: formatDateTime(detail.organisation.last_activity_at) },
          ]}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Contacts</h2>
          {detail.contacts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No contacts linked.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {detail.contacts.map((contact) => (
                <li key={contact.id} className="py-3">
                  <Link className="font-medium text-slate-950 hover:underline" href={`/studio/contacts/${contact.id}`}>
                    {contact.full_name}
                  </Link>
                  <p className="text-sm text-slate-500">{contact.email || contact.phone || "No contact detail"}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Tasks</h2>
          {detail.tasks.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No organisation tasks.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {detail.tasks.map((task) => (
                <li key={task.id} className="py-3">
                  <p className="font-medium text-slate-950">{task.title}</p>
                  <p className="text-xs text-slate-500">{humanize(task.status)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-950">Opportunities</h2>
        {detail.opportunities.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No linked opportunities" description="No opportunity records are linked to this organisation yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {detail.opportunities.map((opportunity) => (
              <li key={opportunity.id} className="flex items-center justify-between gap-4 py-3">
                <Link className="font-medium text-slate-950 hover:underline" href={`/studio/opportunities/${opportunity.id}`}>
                  {opportunity.story_title || "Untitled opportunity"}
                </Link>
                <Badge tone={statusTone(opportunity.stage)}>{humanize(opportunity.stage)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
