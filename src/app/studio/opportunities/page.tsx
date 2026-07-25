import { INTENT_TYPES, OPPORTUNITY_STAGES } from "@/config/constants";
import { OpportunityKanban, OpportunityTable } from "@/components/studio/opportunities";
import { Card, Field, PageHeader, Pagination, inputClassName, selectClassName, humanize } from "@/components/studio/ui";
import { listOpportunities, type OpportunityFilters } from "@/repositories/opportunities";
import type { IntentType, OpportunityStage, PriorityLevel } from "@/types/domain";

type SearchParams = Record<string, string | string[] | undefined>;

const priorities = ["low", "medium", "high", "urgent"] as const satisfies readonly PriorityLevel[];

function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function option<T extends string>(input: string | undefined, allowed: readonly T[]): T | undefined {
  return input && allowed.includes(input as T) ? (input as T) : undefined;
}

export default async function StudioOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(first(params, "page") ?? "1"));
  const pageSize = 25;
  const filters: OpportunityFilters = {
    query: first(params, "query"),
    stage: option(first(params, "stage"), OPPORTUNITY_STAGES),
    intentType: option(first(params, "intentType"), INTENT_TYPES),
    priority: option(first(params, "priority"), priorities),
    sort: option(first(params, "sort"), ["created_at", "updated_at", "target_date", "priority"] as const) ?? "created_at",
    sortDir: option(first(params, "sortDir"), ["asc", "desc"] as const) ?? "desc",
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
  const view = option(first(params, "view"), ["table", "kanban"] as const) ?? "table";
  const result = await listOpportunities(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunities"
        description="Search, filter, sort, and work all Studio opportunities from real CRM records."
      />
      <Card>
        <form className="grid gap-4 lg:grid-cols-7">
          <Field label="Search">
            <input className={inputClassName} name="query" defaultValue={filters.query} placeholder="Title or source" />
          </Field>
          <Field label="Stage">
            <select className={selectClassName} name="stage" defaultValue={(filters.stage as OpportunityStage | undefined) ?? ""}>
              <option value="">All stages</option>
              {OPPORTUNITY_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {humanize(stage)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Intent">
            <select className={selectClassName} name="intentType" defaultValue={(filters.intentType as IntentType | undefined) ?? ""}>
              <option value="">All intents</option>
              {INTENT_TYPES.map((intent) => (
                <option key={intent} value={intent}>
                  {humanize(intent)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className={selectClassName} name="priority" defaultValue={filters.priority ?? ""}>
              <option value="">All priorities</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {humanize(priority)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort">
            <select className={selectClassName} name="sort" defaultValue={filters.sort}>
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
              <option value="target_date">Target date</option>
              <option value="priority">Priority</option>
            </select>
          </Field>
          <Field label="Direction">
            <select className={selectClassName} name="sortDir" defaultValue={filters.sortDir}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </Field>
          <Field label="View">
            <select className={selectClassName} name="view" defaultValue={view}>
              <option value="table">Table</option>
              <option value="kanban">Kanban</option>
            </select>
          </Field>
          <div className="lg:col-span-7">
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="submit">
              Apply filters
            </button>
          </div>
        </form>
      </Card>

      {view === "kanban" ? <OpportunityKanban opportunities={result.rows} /> : <OpportunityTable opportunities={result.rows} />}
      <Pagination
        basePath="/studio/opportunities"
        page={page}
        pageSize={pageSize}
        total={result.total}
        params={{
          query: filters.query,
          stage: typeof filters.stage === "string" ? filters.stage : undefined,
          intentType: filters.intentType,
          priority: filters.priority,
          sort: filters.sort,
          sortDir: filters.sortDir,
          view,
        }}
      />
    </div>
  );
}
