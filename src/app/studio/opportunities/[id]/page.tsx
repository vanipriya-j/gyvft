import { notFound } from "next/navigation";
import {
  addOpportunityNoteAction,
  addOpportunityTaskAction,
  archiveOpportunityAction,
  assignOpportunityAction,
  changeOpportunityStageAction,
  markOpportunityLostAction,
  markOpportunityWonAction,
  updateOpportunityPriorityAction,
} from "@/actions/studio-opportunities";
import { OPPORTUNITY_STAGES } from "@/config/constants";
import {
  Badge,
  Card,
  DefinitionList,
  EmptyState,
  Field,
  PageHeader,
  SubmitButton,
  formatDate,
  formatDateTime,
  humanize,
  inputClassName,
  selectClassName,
  statusTone,
} from "@/components/studio/ui";
import { getOpportunityDetail, listProfiles } from "@/repositories/studio";
import type { PriorityLevel } from "@/types/domain";

const priorities = ["low", "medium", "high", "urgent"] as const satisfies readonly PriorityLevel[];

export default async function StudioOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, profiles] = await Promise.all([getOpportunityDetail(id), listProfiles()]);
  if (!detail) notFound();
  const { opportunity } = detail;

  return (
    <div className="space-y-6">
      <PageHeader
        title={opportunity.story_title || "Untitled opportunity"}
        description={`Created ${formatDateTime(opportunity.created_at)} from ${opportunity.source}`}
        action={
          <div className="flex flex-wrap gap-2">
            <form action={markOpportunityWonAction}>
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <SubmitButton>Mark won</SubmitButton>
            </form>
            <form action={markOpportunityLostAction}>
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <SubmitButton destructive>Mark lost</SubmitButton>
            </form>
            <form action={archiveOpportunityAction}>
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <SubmitButton destructive>Archive</SubmitButton>
            </form>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="flex flex-wrap gap-2">
              <Badge tone={statusTone(opportunity.stage)}>{humanize(opportunity.stage)}</Badge>
              <Badge tone={statusTone(opportunity.priority)}>{humanize(opportunity.priority)}</Badge>
              <Badge>{humanize(opportunity.intent_type)}</Badge>
            </div>
            <DefinitionList
              items={[
                { label: "Relationship", value: humanize(opportunity.relationship_type) },
                { label: "Occasion", value: opportunity.occasion_other || opportunity.occasion_type },
                { label: "Target date", value: formatDate(opportunity.target_date) },
                { label: "Budget", value: opportunity.budget_range },
                { label: "Quantity", value: opportunity.quantity_range },
                { label: "Value", value: opportunity.confirmed_value || opportunity.estimated_value },
                { label: "City", value: opportunity.primary_city },
                { label: "Locations", value: opportunity.multiple_locations ? opportunity.location_notes || "Multiple locations" : "Single / not specified" },
                { label: "Audiences", value: detail.audiences.length ? detail.audiences.join(", ") : null },
                { label: "Formats", value: detail.formats.length ? detail.formats.join(", ") : null },
              ]}
            />
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-950">AI summary</h2>
            {detail.summary ? (
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
                <p className="text-base font-medium text-slate-950">{detail.summary.story_title || "Generated summary"}</p>
                <p>{detail.summary.story_summary || "No story summary recorded."}</p>
                <DefinitionList
                  items={[
                    { label: "Why it matters", value: detail.summary.why_it_matters },
                    { label: "Occasion", value: detail.summary.occasion },
                    { label: "Recommended action", value: detail.summary.recommended_next_action },
                    { label: "Provider", value: `${detail.summary.provider} / ${detail.summary.model}` },
                  ]}
                />
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState title="No AI summary yet" description={`Summary status is ${humanize(opportunity.ai_summary_status)}.`} />
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Original submission</h2>
            {detail.submission ? (
              <div className="mt-4">
                <p className="mb-3 text-sm text-slate-500">
                  Immutable {detail.submission.form_key} submission from {formatDateTime(detail.submission.created_at)}
                </p>
                <pre className="max-h-[32rem] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {JSON.stringify(detail.submission.payload, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState title="No submission payload" description="This opportunity does not have an original form submission record." />
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Notes</h2>
            <form action={addOpportunityNoteAction} className="mt-4 space-y-3">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <textarea className={inputClassName} name="body" rows={4} placeholder="Add an internal note" required />
              <SubmitButton>Add note</SubmitButton>
            </form>
            {detail.notes.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No notes recorded.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {detail.notes.map((note) => (
                  <li key={note.id} className="py-3">
                    <p className="whitespace-pre-wrap text-sm text-slate-800">{note.body}</p>
                    <p className="mt-2 text-xs text-slate-400">{formatDateTime(note.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Workflow</h2>
            <form action={changeOpportunityStageAction} className="mt-4 space-y-4">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <Field label="Stage">
                <select className={selectClassName} name="stage" defaultValue={opportunity.stage}>
                  {OPPORTUNITY_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {humanize(stage)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lost reason">
                <input className={inputClassName} name="lostReason" defaultValue={opportunity.lost_reason ?? ""} />
              </Field>
              <Field label="Confirmed value">
                <input className={inputClassName} name="confirmedValue" type="number" step="0.01" defaultValue={opportunity.confirmed_value ?? ""} />
              </Field>
              <SubmitButton>Update stage</SubmitButton>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Assignment</h2>
            <form action={assignOpportunityAction} className="mt-4 space-y-4">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <Field label="Owner">
                <select className={selectClassName} name="assignedUserId" defaultValue={opportunity.assigned_user_id ?? ""}>
                  <option value="">Unassigned</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton>Save assignment</SubmitButton>
            </form>
            <form action={updateOpportunityPriorityAction} className="mt-6 space-y-4">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <Field label="Priority">
                <select className={selectClassName} name="priority" defaultValue={opportunity.priority}>
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {humanize(priority)}
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton>Save priority</SubmitButton>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Create task</h2>
            <form action={addOpportunityTaskAction} className="mt-4 space-y-4">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <Field label="Title">
                <input className={inputClassName} name="title" required />
              </Field>
              <Field label="Due">
                <input className={inputClassName} name="dueAt" type="datetime-local" />
              </Field>
              <Field label="Assignee">
                <select className={selectClassName} name="assignedUserId" defaultValue={opportunity.assigned_user_id ?? ""}>
                  <option value="">Me</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select className={selectClassName} name="priority" defaultValue="medium">
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {humanize(priority)}
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton>Create task</SubmitButton>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Tasks</h2>
            {detail.tasks.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No tasks attached.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {detail.tasks.map((task) => (
                  <li key={task.id} className="py-3">
                    <p className="font-medium text-slate-950">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {humanize(task.status)} · {humanize(task.priority)} · {formatDateTime(task.due_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Activities</h2>
            {detail.activities.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No activities recorded.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {detail.activities.map((activity) => (
                  <li key={activity.id} className="py-3">
                    <p className="text-sm font-medium text-slate-950">{activity.summary}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {activity.activity_type} · Immutable · {formatDateTime(activity.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
