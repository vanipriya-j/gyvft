import Link from "next/link";
import { createStudioTaskAction, updateTaskStatusAction } from "@/actions/studio-tasks";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  PageHeader,
  SubmitButton,
  formatDateTime,
  humanize,
  inputClassName,
  selectClassName,
  statusTone,
} from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { listProfiles } from "@/repositories/studio";
import { listTasks } from "@/repositories/tasks";
import type { TaskStatus } from "@/types/domain";

type SearchParams = Record<string, string | string[] | undefined>;
type TaskView = "my" | "all" | "today" | "upcoming" | "overdue" | "completed";

function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function taskView(input: string | undefined): TaskView {
  return ["my", "all", "today", "upcoming", "overdue", "completed"].includes(input ?? "") ? (input as TaskView) : "my";
}

export default async function StudioTasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireStudioUser();
  const params = await searchParams;
  const view = taskView(first(params, "view"));
  const filters = {
    assignedUserId: view === "my" ? profile.id : undefined,
    status: view === "completed" ? ("completed" as TaskStatus) : view === "all" ? undefined : (["open", "in_progress"] as TaskStatus[]),
    due: view === "today" || view === "upcoming" || view === "overdue" ? view : undefined,
    limit: 100,
  };
  const [tasks, profiles] = await Promise.all([listTasks(filters), listProfiles()]);
  const views: TaskView[] = ["my", "all", "today", "upcoming", "overdue", "completed"];

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Work personal and team tasks by due date and completion state." />
      <div className="flex flex-wrap gap-2">
        {views.map((item) => (
          <Link
            key={item}
            href={`/studio/tasks?view=${item}`}
            className={`rounded-full px-4 py-2 text-sm font-medium ${view === item ? "bg-slate-950 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {humanize(item)}
          </Link>
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-950">Create task</h2>
        <form action={createStudioTaskAction} className="mt-4 grid gap-4 md:grid-cols-4">
          <Field label="Title">
            <input className={inputClassName} name="title" required />
          </Field>
          <Field label="Due">
            <input className={inputClassName} name="dueAt" type="datetime-local" />
          </Field>
          <Field label="Priority">
            <select className={selectClassName} name="priority" defaultValue="medium">
              {["low", "medium", "high", "urgent"].map((priority) => (
                <option key={priority} value={priority}>
                  {humanize(priority)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assignee">
            <select className={selectClassName} name="assignedUserId" defaultValue={profile.id}>
              {profiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.full_name}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-4">
            <SubmitButton>Create task</SubmitButton>
          </div>
        </form>
      </Card>

      {tasks.rows.length === 0 ? (
        <EmptyState title="No tasks in this view" description="There are no real task records matching this filter." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Related</th>
                <th className="px-4 py-3">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.rows.map((task) => (
                <tr key={task.id}>
                  <td className="px-4 py-3 font-medium text-slate-950">{task.title}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(task.priority)}>{humanize(task.priority)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(task.status)}>{humanize(task.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(task.due_at)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {task.opportunity_id ? (
                      <Link className="underline" href={`/studio/opportunities/${task.opportunity_id}`}>
                        Opportunity
                      </Link>
                    ) : (
                      "None"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateTaskStatusAction} className="flex gap-2">
                      <input type="hidden" name="taskId" value={task.id} />
                      <select className={selectClassName} name="status" defaultValue={task.status}>
                        {["open", "in_progress", "completed", "cancelled"].map((status) => (
                          <option key={status} value={status}>
                            {humanize(status)}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
