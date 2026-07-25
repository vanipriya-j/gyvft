import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import type {
  IntentType,
  Opportunity,
  OpportunityStage,
  PriorityLevel,
  RelationshipType,
} from "@/types/domain";

export type OpportunityFilters = {
  query?: string;
  stage?: OpportunityStage | OpportunityStage[];
  intentType?: IntentType;
  assigneeId?: string;
  priority?: PriorityLevel;
  occasionType?: string;
  budgetRange?: string;
  source?: string;
  campaignId?: string;
  organisationId?: string;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
  offset?: number;
  sort?: "created_at" | "updated_at" | "target_date" | "priority";
  sortDir?: "asc" | "desc";
};

export async function createOpportunity(
  input: {
    storyTitle?: string | null;
    intentType: IntentType;
    relationshipType?: RelationshipType;
    stage?: OpportunityStage;
    priority?: PriorityLevel;
    source: string;
    campaignId?: string | null;
    contactId?: string | null;
    organisationId?: string | null;
    assignedUserId?: string | null;
    occasionType?: string | null;
    occasionOther?: string | null;
    targetDate?: string | null;
    targetDatePrecision?: string | null;
    quantityRange?: string | null;
    budgetRange?: string | null;
    primaryCity?: string | null;
    multipleLocations?: boolean;
    locationNotes?: string | null;
    formKey?: string | null;
    idempotencyKey: string;
    attributionId?: string | null;
    audiences?: string[];
    formats?: string[];
  },
  db: Sql = getSql(),
): Promise<Opportunity> {
  const rows = await db<Opportunity[]>`
    INSERT INTO opportunities (
      story_title, intent_type, relationship_type, stage, priority, source, campaign_id,
      contact_id, organisation_id, assigned_user_id, occasion_type, occasion_other,
      target_date, target_date_precision, quantity_range, budget_range, primary_city,
      multiple_locations, location_notes, form_key, idempotency_key, attribution_id
    ) VALUES (
      ${input.storyTitle ?? null},
      ${input.intentType},
      ${input.relationshipType ?? "unknown"},
      ${input.stage ?? "new"},
      ${input.priority ?? "medium"},
      ${input.source},
      ${input.campaignId ?? null}::uuid,
      ${input.contactId ?? null}::uuid,
      ${input.organisationId ?? null}::uuid,
      ${input.assignedUserId ?? null}::uuid,
      ${input.occasionType ?? null},
      ${input.occasionOther ?? null},
      ${input.targetDate ?? null},
      ${input.targetDatePrecision ?? null},
      ${input.quantityRange ?? null},
      ${input.budgetRange ?? null},
      ${input.primaryCity ?? null},
      ${input.multipleLocations ?? false},
      ${input.locationNotes ?? null},
      ${input.formKey ?? null},
      ${input.idempotencyKey},
      ${input.attributionId ?? null}::uuid
    )
    RETURNING *
  `;

  const opportunity = rows[0]!;

  if (input.audiences?.length) {
    for (const audience of input.audiences) {
      await db`
        INSERT INTO opportunity_audiences (opportunity_id, audience)
        VALUES (${opportunity.id}::uuid, ${audience})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  if (input.formats?.length) {
    for (const format of input.formats) {
      await db`
        INSERT INTO opportunity_formats (opportunity_id, format)
        VALUES (${opportunity.id}::uuid, ${format})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  return opportunity;
}

export async function findByIdempotencyKey(
  key: string,
  db: Sql = getSql(),
): Promise<Opportunity | null> {
  const rows = await db<Opportunity[]>`
    SELECT * FROM opportunities WHERE idempotency_key = ${key} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getOpportunityById(
  id: string,
  db: Sql = getSql(),
): Promise<Opportunity | null> {
  const rows = await db<Opportunity[]>`
    SELECT * FROM opportunities WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listOpportunities(
  filters: OpportunityFilters = {},
): Promise<{ rows: Opportunity[]; total: number }> {
  const sql = getSql();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const sort = filters.sort ?? "created_at";
  const sortDir = filters.sortDir ?? "desc";

  // Use a pragmatic filter approach with optional clauses
  const rows = await sql<Opportunity[]>`
    SELECT *
    FROM opportunities
    WHERE deleted_at IS NULL
      AND (${filters.query ?? null}::text IS NULL OR story_title ILIKE ${"%" + (filters.query ?? "") + "%"} OR source ILIKE ${"%" + (filters.query ?? "") + "%"})
      AND (${filters.intentType ?? null}::text IS NULL OR intent_type = ${filters.intentType ?? null})
      AND (${filters.assigneeId ?? null}::uuid IS NULL OR assigned_user_id = ${filters.assigneeId ?? null}::uuid)
      AND (${filters.priority ?? null}::text IS NULL OR priority = ${filters.priority ?? null})
      AND (${filters.occasionType ?? null}::text IS NULL OR occasion_type = ${filters.occasionType ?? null})
      AND (${filters.budgetRange ?? null}::text IS NULL OR budget_range = ${filters.budgetRange ?? null})
      AND (${filters.source ?? null}::text IS NULL OR source = ${filters.source ?? null})
      AND (${filters.campaignId ?? null}::uuid IS NULL OR campaign_id = ${filters.campaignId ?? null}::uuid)
      AND (${filters.organisationId ?? null}::uuid IS NULL OR organisation_id = ${filters.organisationId ?? null}::uuid)
      AND (${filters.createdFrom ?? null}::timestamptz IS NULL OR created_at >= ${filters.createdFrom ?? null}::timestamptz)
      AND (${filters.createdTo ?? null}::timestamptz IS NULL OR created_at <= ${filters.createdTo ?? null}::timestamptz)
      AND (
        ${Array.isArray(filters.stage) ? filters.stage : filters.stage ? [filters.stage] : null}::text[] IS NULL
        OR stage = ANY(${Array.isArray(filters.stage) ? filters.stage : filters.stage ? [filters.stage] : null}::text[])
      )
    ORDER BY
      CASE WHEN ${sort} = 'created_at' AND ${sortDir} = 'asc' THEN created_at END ASC,
      CASE WHEN ${sort} = 'created_at' AND ${sortDir} = 'desc' THEN created_at END DESC,
      CASE WHEN ${sort} = 'updated_at' AND ${sortDir} = 'asc' THEN updated_at END ASC,
      CASE WHEN ${sort} = 'updated_at' AND ${sortDir} = 'desc' THEN updated_at END DESC,
      CASE WHEN ${sort} = 'target_date' AND ${sortDir} = 'asc' THEN target_date END ASC NULLS LAST,
      CASE WHEN ${sort} = 'target_date' AND ${sortDir} = 'desc' THEN target_date END DESC NULLS LAST,
      CASE WHEN ${sort} = 'priority' AND ${sortDir} = 'asc' THEN
        CASE priority WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 WHEN 'urgent' THEN 4 END
      END ASC,
      CASE WHEN ${sort} = 'priority' AND ${sortDir} = 'desc' THEN
        CASE priority WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 WHEN 'urgent' THEN 4 END
      END DESC,
      created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const totalRows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM opportunities
    WHERE deleted_at IS NULL
      AND (${filters.query ?? null}::text IS NULL OR story_title ILIKE ${"%" + (filters.query ?? "") + "%"} OR source ILIKE ${"%" + (filters.query ?? "") + "%"})
      AND (${filters.intentType ?? null}::text IS NULL OR intent_type = ${filters.intentType ?? null})
      AND (${filters.assigneeId ?? null}::uuid IS NULL OR assigned_user_id = ${filters.assigneeId ?? null}::uuid)
      AND (${filters.priority ?? null}::text IS NULL OR priority = ${filters.priority ?? null})
      AND (${filters.occasionType ?? null}::text IS NULL OR occasion_type = ${filters.occasionType ?? null})
      AND (${filters.budgetRange ?? null}::text IS NULL OR budget_range = ${filters.budgetRange ?? null})
      AND (${filters.source ?? null}::text IS NULL OR source = ${filters.source ?? null})
      AND (${filters.campaignId ?? null}::uuid IS NULL OR campaign_id = ${filters.campaignId ?? null}::uuid)
      AND (${filters.organisationId ?? null}::uuid IS NULL OR organisation_id = ${filters.organisationId ?? null}::uuid)
      AND (${filters.createdFrom ?? null}::timestamptz IS NULL OR created_at >= ${filters.createdFrom ?? null}::timestamptz)
      AND (${filters.createdTo ?? null}::timestamptz IS NULL OR created_at <= ${filters.createdTo ?? null}::timestamptz)
      AND (
        ${Array.isArray(filters.stage) ? filters.stage : filters.stage ? [filters.stage] : null}::text[] IS NULL
        OR stage = ANY(${Array.isArray(filters.stage) ? filters.stage : filters.stage ? [filters.stage] : null}::text[])
      )
  `;

  return { rows, total: Number(totalRows[0]?.count ?? 0) };
}

export async function updateOpportunityStage(
  id: string,
  stage: OpportunityStage,
  extras: {
    lostReason?: string | null;
    lostNotes?: string | null;
    competitor?: string | null;
    revisitDate?: string | null;
    estimatedValue?: number | null;
    confirmedValue?: number | null;
    expectedStartDate?: string | null;
  } = {},
  db: Sql = getSql(),
): Promise<Opportunity> {
  const rows = await db<Opportunity[]>`
    UPDATE opportunities
    SET
      stage = ${stage},
      lost_reason = COALESCE(${extras.lostReason ?? null}, lost_reason),
      lost_notes = COALESCE(${extras.lostNotes ?? null}, lost_notes),
      competitor = COALESCE(${extras.competitor ?? null}, competitor),
      revisit_date = COALESCE(${extras.revisitDate ?? null}, revisit_date),
      estimated_value = COALESCE(${extras.estimatedValue ?? null}, estimated_value),
      confirmed_value = COALESCE(${extras.confirmedValue ?? null}, confirmed_value),
      expected_start_date = COALESCE(${extras.expectedStartDate ?? null}, expected_start_date),
      updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING *
  `;
  return rows[0]!;
}

export async function getDashboardMetrics() {
  const sql = getSql();
  const [counts] = await sql<
    {
      new_opportunities: string;
      follow_up: string;
      discovery_pending: string;
      proposals: string;
      won: string;
      tasks_due: string;
      form_submissions: string;
    }[]
  >`
    SELECT
      (SELECT COUNT(*) FROM opportunities WHERE deleted_at IS NULL AND stage = 'new')::text AS new_opportunities,
      (SELECT COUNT(*) FROM opportunities WHERE deleted_at IS NULL AND stage IN ('reviewing','contacted'))::text AS follow_up,
      (SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL AND status IN ('open','in_progress') AND title = 'Schedule discovery conversation')::text AS discovery_pending,
      (SELECT COUNT(*) FROM opportunities WHERE deleted_at IS NULL AND stage IN ('proposal_sent','negotiation'))::text AS proposals,
      (SELECT COUNT(*) FROM opportunities WHERE deleted_at IS NULL AND stage = 'won')::text AS won,
      (SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL AND status IN ('open','in_progress') AND due_at::date <= CURRENT_DATE)::text AS tasks_due,
      (SELECT COUNT(*) FROM opportunity_submissions)::text AS form_submissions
  `;

  const [conversions] = await sql<
    {
      story_starts: string;
      story_submits: string;
      partner_starts: string;
      partner_submits: string;
    }[]
  >`
    SELECT
      (SELECT COUNT(*) FROM analytics_events WHERE event_name = 'story_form_started')::text AS story_starts,
      (SELECT COUNT(*) FROM analytics_events WHERE event_name = 'story_form_submitted')::text AS story_submits,
      (SELECT COUNT(*) FROM analytics_events WHERE event_name = 'partner_form_started')::text AS partner_starts,
      (SELECT COUNT(*) FROM analytics_events WHERE event_name = 'partner_form_submitted')::text AS partner_submits
  `;

  const recentFailures = await sql<
    {
      id: string;
      provider: string;
      operation: string;
      sanitised_error: string | null;
      created_at: string;
    }[]
  >`
    SELECT id, provider, operation, sanitised_error, created_at
    FROM integration_logs
    WHERE success = FALSE
    ORDER BY created_at DESC
    LIMIT 5
  `;

  const storyStarts = Number(conversions?.story_starts ?? 0);
  const storySubmits = Number(conversions?.story_submits ?? 0);
  const partnerStarts = Number(conversions?.partner_starts ?? 0);
  const partnerSubmits = Number(conversions?.partner_submits ?? 0);

  return {
    newOpportunities: Number(counts?.new_opportunities ?? 0),
    followUp: Number(counts?.follow_up ?? 0),
    discoveryPending: Number(counts?.discovery_pending ?? 0),
    proposals: Number(counts?.proposals ?? 0),
    won: Number(counts?.won ?? 0),
    tasksDue: Number(counts?.tasks_due ?? 0),
    formSubmissions: Number(counts?.form_submissions ?? 0),
    storyConversionRate: storyStarts === 0 ? null : storySubmits / storyStarts,
    partnerConversionRate: partnerStarts === 0 ? null : partnerSubmits / partnerStarts,
    recentFailures,
  };
}
