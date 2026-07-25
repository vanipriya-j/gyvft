import Link from "next/link";
import type { Opportunity } from "@/types/domain";
import { Badge, EmptyState, formatDate, humanize, statusTone } from "@/components/studio/ui";
import { OPPORTUNITY_STAGES } from "@/config/constants";

export function OpportunityTable({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) {
    return (
      <EmptyState
        title="No opportunities match this view"
        description="Adjust the search or filters, or wait for the next submitted form to create a new opportunity."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Opportunity</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Intent</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Target date</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {opportunities.map((opportunity) => (
              <tr key={opportunity.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/studio/opportunities/${opportunity.id}`} className="font-medium text-slate-950 hover:underline">
                    {opportunity.story_title || "Untitled opportunity"}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">{opportunity.primary_city || "No city recorded"}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(opportunity.stage)}>{humanize(opportunity.stage)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(opportunity.priority)}>{humanize(opportunity.priority)}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{humanize(opportunity.intent_type)}</td>
                <td className="px-4 py-3 text-slate-600">{opportunity.source}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(opportunity.target_date)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(opportunity.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OpportunityKanban({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) {
    return (
      <EmptyState
        title="No cards for this kanban"
        description="There are no opportunities in the current filter set. The board will populate from real CRM records."
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {OPPORTUNITY_STAGES.map((stage) => {
        const cards = opportunities.filter((opportunity) => opportunity.stage === stage);
        if (cards.length === 0) return null;
        return (
          <section key={stage} className="rounded-2xl border border-slate-200 bg-slate-100/70 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">{humanize(stage)}</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{cards.length}</span>
            </div>
            <div className="space-y-3">
              {cards.map((opportunity) => (
                <Link
                  key={opportunity.id}
                  href={`/studio/opportunities/${opportunity.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="font-medium text-slate-950">{opportunity.story_title || "Untitled opportunity"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={statusTone(opportunity.priority)}>{humanize(opportunity.priority)}</Badge>
                    <Badge>{humanize(opportunity.intent_type)}</Badge>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Created {formatDate(opportunity.created_at)}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
