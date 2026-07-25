import Link from "next/link";
import { getDashboardMetrics, listOpportunities } from "@/repositories/opportunities";
import { listTasks } from "@/repositories/tasks";
import { Card, EmptyState, MetricCard, PageHeader, formatDateTime, formatPercent, humanize } from "@/components/studio/ui";
import { OpportunityTable } from "@/components/studio/opportunities";

export default async function StudioDashboardPage() {
  const [metrics, recentOpportunities, dueTasks] = await Promise.all([
    getDashboardMetrics(),
    listOpportunities({ limit: 5, sort: "created_at", sortDir: "desc" }),
    listTasks({ due: "overdue", status: ["open", "in_progress"], limit: 5 }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="A real-time operating view of Studio opportunities, tasks, form submissions, and integration health."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="New opportunities" value={metrics.newOpportunities} description="Currently in the new stage" />
        <MetricCard label="Follow-up queue" value={metrics.followUp} description="Reviewing or contacted" />
        <MetricCard label="Proposals" value={metrics.proposals} description="Proposal sent or negotiation" />
        <MetricCard label="Tasks due" value={metrics.tasksDue} description="Open or in-progress due today/earlier" />
        <MetricCard label="Won" value={metrics.won} description="All-time won opportunities" />
        <MetricCard label="Form submissions" value={metrics.formSubmissions} description="Immutable submission records" />
        <MetricCard label="Story conversion" value={formatPercent(metrics.storyConversionRate)} description="Submits divided by starts" />
        <MetricCard label="Partner conversion" value={formatPercent(metrics.partnerConversionRate)} description="Submits divided by starts" />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Recent opportunities</h2>
          <Link href="/studio/opportunities" className="text-sm font-medium text-slate-700 hover:text-slate-950">
            View all
          </Link>
        </div>
        <OpportunityTable opportunities={recentOpportunities.rows} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Overdue tasks</h2>
          {dueTasks.rows.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No overdue tasks" description="There are no open or in-progress tasks past their due time." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {dueTasks.rows.map((task) => (
                <li key={task.id} className="py-3">
                  <p className="font-medium text-slate-950">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {humanize(task.priority)} priority · Due {formatDateTime(task.due_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Recent integration failures</h2>
          {metrics.recentFailures.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No recent failures" description="No failed integration log entries are currently recorded." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {metrics.recentFailures.map((failure) => (
                <li key={failure.id} className="py-3">
                  <p className="font-medium text-slate-950">
                    {failure.provider} · {failure.operation}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{failure.sanitised_error || "No sanitised error recorded"}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(failure.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
