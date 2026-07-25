import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, DefinitionList, EmptyState, PageHeader, formatDateTime, humanize, statusTone } from "@/components/studio/ui";
import { getContactDetail } from "@/repositories/studio";

export default async function StudioContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getContactDetail(id);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={detail.contact.full_name} description="Contact profile and related CRM history." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <DefinitionList
            items={[
              { label: "Email", value: detail.contact.email },
              { label: "Phone", value: detail.contact.phone },
              { label: "Designation", value: detail.contact.designation },
              { label: "Preferred method", value: detail.contact.preferred_contact_method },
              { label: "Source", value: detail.contact.source },
              { label: "Organisation", value: detail.organisation ? <Link className="underline" href={`/studio/organisations/${detail.organisation.id}`}>{detail.organisation.name}</Link> : null },
              { label: "Communication consent", value: detail.contact.communication_consent ? "Yes" : "No" },
              { label: "Marketing consent", value: detail.contact.marketing_consent ? "Yes" : "No" },
              { label: "Last activity", value: formatDateTime(detail.contact.last_activity_at) },
            ]}
          />
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Tasks</h2>
          {detail.tasks.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No contact tasks.</p>
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
            <EmptyState title="No linked opportunities" description="No opportunity records are linked to this contact yet." />
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

      <Card>
        <h2 className="text-lg font-semibold text-slate-950">Activities</h2>
        {detail.activities.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No contact-level activities recorded.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {detail.activities.map((activity) => (
              <li key={activity.id} className="py-3">
                <p className="text-sm font-medium text-slate-950">{activity.summary}</p>
                <p className="text-xs text-slate-500">{formatDateTime(activity.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
