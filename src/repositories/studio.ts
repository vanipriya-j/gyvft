import type { JSONValue, Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import type {
  CampaignStatus,
  Contact,
  IntegrationStatus,
  LandingPageStatus,
  Opportunity,
  Organisation,
  PriorityLevel,
  Profile,
  TaskStatus,
} from "@/types/domain";
import type { Activity } from "@/repositories/activities";
import type { Task } from "@/repositories/tasks";
import type { EncryptedSecret } from "@/lib/encryption/secrets";

export type JsonRecord = Record<string, unknown>;

export type Note = {
  id: string;
  opportunity_id: string | null;
  contact_id: string | null;
  organisation_id: string | null;
  author_user_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type OpportunitySubmission = {
  id: string;
  opportunity_id: string;
  form_key: string;
  payload: JsonRecord;
  idempotency_key: string;
  created_at: string;
};

export type OpportunitySummaryRow = {
  id: string;
  opportunity_id: string;
  story_title: string | null;
  story_summary: string | null;
  why_it_matters: string | null;
  people_or_organisations: unknown[];
  occasion: string | null;
  audiences: unknown[];
  emotional_intent: unknown[];
  key_themes: unknown[];
  constraints: unknown[];
  suggested_directions: unknown[];
  recommended_next_action: string | null;
  prompt_version: string;
  provider: string;
  model: string;
  is_manual: boolean;
  generated_at: string;
  created_at: string;
  updated_at: string;
};

export type OpportunityDetail = {
  opportunity: Opportunity;
  contact: Contact | null;
  organisation: Organisation | null;
  assignee: Profile | null;
  notes: Note[];
  tasks: Task[];
  activities: Activity[];
  submission: OpportunitySubmission | null;
  summary: OpportunitySummaryRow | null;
  audiences: string[];
  formats: string[];
};

export type ContactDetail = {
  contact: Contact;
  organisation: Organisation | null;
  opportunities: Opportunity[];
  notes: Note[];
  tasks: Task[];
  activities: Activity[];
};

export type OrganisationDetail = {
  organisation: Organisation;
  contacts: Contact[];
  opportunities: Opportunity[];
  notes: Note[];
  tasks: Task[];
  activities: Activity[];
};

export type IntegrationDefinition = {
  id: string;
  provider: string;
  display_name: string;
  enabled: boolean;
  status: IntegrationStatus;
  config: JsonRecord;
  last_successful_test_at: string | null;
  last_failed_test_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationSecretSummary = {
  provider: string;
  secret_name: string;
  last_four: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationWithSecrets = IntegrationDefinition & {
  secrets: IntegrationSecretSummary[];
};

export type TrackingRule = {
  id: string;
  event_name: string;
  internal_enabled: boolean;
  ga4_enabled: boolean;
  meta_browser_enabled: boolean;
  meta_server_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type IntegrationLog = {
  id: string;
  provider: string;
  integration_id: string | null;
  operation: string;
  event_name: string | null;
  correlation_id: string | null;
  attempt_number: number;
  request_started_at: string;
  request_completed_at: string | null;
  success: boolean;
  http_status: number | null;
  provider_response_id: string | null;
  sanitised_error: string | null;
  next_retry_at: string | null;
  metadata: JsonRecord;
  created_at: string;
};

export type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  landing_page: string | null;
  start_date: string | null;
  end_date: string | null;
  owner_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LandingPage = {
  id: string;
  internal_name: string;
  slug: string;
  status: LandingPageStatus;
  seo_title: string | null;
  seo_description: string | null;
  social_image_path: string | null;
  primary_cta_label: string | null;
  primary_cta_href: string | null;
  form_destination: string | null;
  campaign_id: string | null;
  published_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LandingPageBlock = {
  id: string;
  landing_page_id: string;
  block_type: string;
  position: number;
  content: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type LandingPageDetail = {
  page: LandingPage;
  blocks: LandingPageBlock[];
};

export type FormConfiguration = {
  id: string;
  form_key: string;
  enabled: boolean;
  public_headline: string | null;
  supporting_copy: string | null;
  success_message: string | null;
  notification_recipients: string[];
  default_assignee_user_id: string | null;
  default_priority: PriorityLevel;
  consent_copy: string | null;
  auto_response_enabled: boolean;
  optional_fields: JsonRecord;
  budget_options: unknown[];
  quantity_options: unknown[];
  created_at: string;
  updated_at: string;
};

export type WorkspaceSettings = {
  id: string;
  default_opportunity_owner_id: string | null;
  default_currency: string;
  max_upload_bytes: string;
  production_mode: boolean;
  consent_banner_title: string;
  consent_banner_body: string;
  consent_privacy_url: string;
  consent_cookies_url: string;
  consent_default_region_behaviour: string;
  consent_retention_days: number;
  active_consent_version: string;
  bot_protection_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ConsentVersion = {
  id: string;
  version: string;
  banner_title: string;
  banner_body: string;
  privacy_url: string;
  cookies_url: string;
  is_active: boolean;
  created_at: string;
};

export type AnalyticsOverview = {
  eventCount: number;
  visitorCount: number;
  sessionCount: number;
  opportunityCount: number;
  wonCount: number;
  lostCount: number;
  topEvents: Array<{ event_name: string; count: number }>;
  dailyEvents: Array<{ day: string; count: number }>;
};

export type CampaignAnalyticsRow = {
  campaign_id: string | null;
  campaign_name: string | null;
  utm_campaign: string | null;
  events: number;
  opportunities: number;
  won: number;
};

export type DeliveryMatrixRow = {
  event_name: string;
  internal_enabled: boolean;
  ga4_enabled: boolean;
  meta_browser_enabled: boolean;
  meta_server_enabled: boolean;
  recent_logs: number;
  successful_logs: number;
  failed_logs: number;
};

export async function listProfiles(): Promise<Profile[]> {
  const sql = getSql();
  return sql<Profile[]>`
    SELECT id, email, full_name, role, is_active, last_login_at, created_at, updated_at, deleted_at
    FROM profiles
    WHERE deleted_at IS NULL
    ORDER BY full_name ASC
  `;
}

export async function updateProfileAccess(
  id: string,
  input: { role?: string | null; isActive?: boolean | null },
): Promise<Profile> {
  const sql = getSql();
  const rows = await sql<Profile[]>`
    UPDATE profiles
    SET
      role = COALESCE(${input.role ?? null}::user_role, role),
      is_active = COALESCE(${input.isActive ?? null}::boolean, is_active),
      updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING id, email, full_name, role, is_active, last_login_at, created_at, updated_at, deleted_at
  `;
  return rows[0]!;
}

export async function getOpportunityDetail(id: string): Promise<OpportunityDetail | null> {
  const sql = getSql();
  const opportunityRows = await sql<Opportunity[]>`
    SELECT * FROM opportunities WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  const opportunity = opportunityRows[0];
  if (!opportunity) return null;

  const [contactRows, organisationRows, assigneeRows, notes, tasks, activities, submissions, summaries, audienceRows, formatRows] =
    await Promise.all([
      opportunity.contact_id
        ? sql<Contact[]>`SELECT * FROM contacts WHERE id = ${opportunity.contact_id}::uuid AND deleted_at IS NULL LIMIT 1`
        : Promise.resolve([]),
      opportunity.organisation_id
        ? sql<Organisation[]>`SELECT * FROM organisations WHERE id = ${opportunity.organisation_id}::uuid AND deleted_at IS NULL LIMIT 1`
        : Promise.resolve([]),
      opportunity.assigned_user_id
        ? sql<Profile[]>`
            SELECT id, email, full_name, role, is_active, last_login_at, created_at, updated_at, deleted_at
            FROM profiles WHERE id = ${opportunity.assigned_user_id}::uuid AND deleted_at IS NULL LIMIT 1
          `
        : Promise.resolve([]),
      sql<Note[]>`
        SELECT * FROM notes
        WHERE opportunity_id = ${id}::uuid AND deleted_at IS NULL
        ORDER BY created_at DESC
      `,
      sql<Task[]>`
        SELECT * FROM tasks
        WHERE opportunity_id = ${id}::uuid AND deleted_at IS NULL
        ORDER BY due_at ASC NULLS LAST, created_at DESC
      `,
      sql<Activity[]>`
        SELECT * FROM activities
        WHERE opportunity_id = ${id}::uuid
        ORDER BY created_at DESC
      `,
      sql<OpportunitySubmission[]>`
        SELECT * FROM opportunity_submissions
        WHERE opportunity_id = ${id}::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `,
      sql<OpportunitySummaryRow[]>`
        SELECT * FROM opportunity_summaries
        WHERE opportunity_id = ${id}::uuid
        ORDER BY generated_at DESC
        LIMIT 1
      `,
      sql<{ audience: string }[]>`
        SELECT audience FROM opportunity_audiences WHERE opportunity_id = ${id}::uuid ORDER BY audience ASC
      `,
      sql<{ format: string }[]>`
        SELECT format FROM opportunity_formats WHERE opportunity_id = ${id}::uuid ORDER BY format ASC
      `,
    ]);

  return {
    opportunity,
    contact: contactRows[0] ?? null,
    organisation: organisationRows[0] ?? null,
    assignee: assigneeRows[0] ?? null,
    notes,
    tasks,
    activities,
    submission: submissions[0] ?? null,
    summary: summaries[0] ?? null,
    audiences: audienceRows.map((row) => row.audience),
    formats: formatRows.map((row) => row.format),
  };
}

export async function updateOpportunityAssignment(
  id: string,
  assignedUserId: string | null,
  db: Sql = getSql(),
): Promise<Opportunity> {
  const rows = await db<Opportunity[]>`
    UPDATE opportunities
    SET assigned_user_id = ${assignedUserId ?? null}::uuid, updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING *
  `;
  return rows[0]!;
}

export async function updateOpportunityPriority(
  id: string,
  priority: PriorityLevel,
  db: Sql = getSql(),
): Promise<Opportunity> {
  const rows = await db<Opportunity[]>`
    UPDATE opportunities
    SET priority = ${priority}, updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING *
  `;
  return rows[0]!;
}

export async function createNote(
  input: {
    body: string;
    authorUserId: string;
    opportunityId?: string | null;
    contactId?: string | null;
    organisationId?: string | null;
  },
  db: Sql = getSql(),
): Promise<Note> {
  const rows = await db<Note[]>`
    INSERT INTO notes (opportunity_id, contact_id, organisation_id, author_user_id, body)
    VALUES (
      ${input.opportunityId ?? null}::uuid,
      ${input.contactId ?? null}::uuid,
      ${input.organisationId ?? null}::uuid,
      ${input.authorUserId}::uuid,
      ${input.body}
    )
    RETURNING *
  `;
  return rows[0]!;
}

export async function getContactDetail(id: string): Promise<ContactDetail | null> {
  const sql = getSql();
  const contacts = await sql<Contact[]>`
    SELECT * FROM contacts WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  const contact = contacts[0];
  if (!contact) return null;
  const [organisationRows, opportunities, notes, tasks, activities] = await Promise.all([
    contact.organisation_id
      ? sql<Organisation[]>`SELECT * FROM organisations WHERE id = ${contact.organisation_id}::uuid AND deleted_at IS NULL LIMIT 1`
      : Promise.resolve([]),
    sql<Opportunity[]>`
      SELECT * FROM opportunities
      WHERE contact_id = ${id}::uuid AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 25
    `,
    sql<Note[]>`
      SELECT * FROM notes WHERE contact_id = ${id}::uuid AND deleted_at IS NULL ORDER BY created_at DESC
    `,
    sql<Task[]>`
      SELECT * FROM tasks WHERE contact_id = ${id}::uuid AND deleted_at IS NULL ORDER BY due_at ASC NULLS LAST, created_at DESC
    `,
    sql<Activity[]>`
      SELECT * FROM activities WHERE contact_id = ${id}::uuid ORDER BY created_at DESC LIMIT 50
    `,
  ]);
  return { contact, organisation: organisationRows[0] ?? null, opportunities, notes, tasks, activities };
}

export async function getOrganisationDetail(id: string): Promise<OrganisationDetail | null> {
  const sql = getSql();
  const organisations = await sql<Organisation[]>`
    SELECT * FROM organisations WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  const organisation = organisations[0];
  if (!organisation) return null;
  const [contacts, opportunities, notes, tasks, activities] = await Promise.all([
    sql<Contact[]>`
      SELECT * FROM contacts
      WHERE organisation_id = ${id}::uuid AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50
    `,
    sql<Opportunity[]>`
      SELECT * FROM opportunities
      WHERE organisation_id = ${id}::uuid AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50
    `,
    sql<Note[]>`
      SELECT * FROM notes WHERE organisation_id = ${id}::uuid AND deleted_at IS NULL ORDER BY created_at DESC
    `,
    sql<Task[]>`
      SELECT * FROM tasks WHERE organisation_id = ${id}::uuid AND deleted_at IS NULL ORDER BY due_at ASC NULLS LAST, created_at DESC
    `,
    sql<Activity[]>`
      SELECT * FROM activities WHERE organisation_id = ${id}::uuid ORDER BY created_at DESC LIMIT 50
    `,
  ]);
  return { organisation, contacts, opportunities, notes, tasks, activities };
}

export async function getAnalyticsOverview(from?: string, to?: string): Promise<AnalyticsOverview> {
  const sql = getSql();
  const [totals, topEvents, dailyEvents] = await Promise.all([
    sql<
      {
        event_count: string;
        visitor_count: string;
        session_count: string;
        opportunity_count: string;
        won_count: string;
        lost_count: string;
      }[]
    >`
      SELECT
        (SELECT COUNT(*) FROM analytics_events WHERE (${from ?? null}::timestamptz IS NULL OR created_at >= ${from ?? null}::timestamptz) AND (${to ?? null}::timestamptz IS NULL OR created_at <= ${to ?? null}::timestamptz))::text AS event_count,
        (SELECT COUNT(DISTINCT anonymous_visitor_id) FROM analytics_events WHERE anonymous_visitor_id IS NOT NULL AND (${from ?? null}::timestamptz IS NULL OR created_at >= ${from ?? null}::timestamptz) AND (${to ?? null}::timestamptz IS NULL OR created_at <= ${to ?? null}::timestamptz))::text AS visitor_count,
        (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE session_id IS NOT NULL AND (${from ?? null}::timestamptz IS NULL OR created_at >= ${from ?? null}::timestamptz) AND (${to ?? null}::timestamptz IS NULL OR created_at <= ${to ?? null}::timestamptz))::text AS session_count,
        (SELECT COUNT(*) FROM opportunities WHERE deleted_at IS NULL AND (${from ?? null}::timestamptz IS NULL OR created_at >= ${from ?? null}::timestamptz) AND (${to ?? null}::timestamptz IS NULL OR created_at <= ${to ?? null}::timestamptz))::text AS opportunity_count,
        (SELECT COUNT(*) FROM opportunities WHERE deleted_at IS NULL AND stage = 'won' AND (${from ?? null}::timestamptz IS NULL OR updated_at >= ${from ?? null}::timestamptz) AND (${to ?? null}::timestamptz IS NULL OR updated_at <= ${to ?? null}::timestamptz))::text AS won_count,
        (SELECT COUNT(*) FROM opportunities WHERE deleted_at IS NULL AND stage = 'lost' AND (${from ?? null}::timestamptz IS NULL OR updated_at >= ${from ?? null}::timestamptz) AND (${to ?? null}::timestamptz IS NULL OR updated_at <= ${to ?? null}::timestamptz))::text AS lost_count
    `,
    sql<{ event_name: string; count: string }[]>`
      SELECT event_name, COUNT(*)::text AS count
      FROM analytics_events
      WHERE (${from ?? null}::timestamptz IS NULL OR created_at >= ${from ?? null}::timestamptz)
        AND (${to ?? null}::timestamptz IS NULL OR created_at <= ${to ?? null}::timestamptz)
      GROUP BY event_name
      ORDER BY COUNT(*) DESC, event_name ASC
      LIMIT 10
    `,
    sql<{ day: string; count: string }[]>`
      SELECT created_at::date::text AS day, COUNT(*)::text AS count
      FROM analytics_events
      WHERE (${from ?? null}::timestamptz IS NULL OR created_at >= ${from ?? null}::timestamptz)
        AND (${to ?? null}::timestamptz IS NULL OR created_at <= ${to ?? null}::timestamptz)
      GROUP BY created_at::date
      ORDER BY created_at::date DESC
      LIMIT 14
    `,
  ]);
  const total = totals[0];
  return {
    eventCount: Number(total?.event_count ?? 0),
    visitorCount: Number(total?.visitor_count ?? 0),
    sessionCount: Number(total?.session_count ?? 0),
    opportunityCount: Number(total?.opportunity_count ?? 0),
    wonCount: Number(total?.won_count ?? 0),
    lostCount: Number(total?.lost_count ?? 0),
    topEvents: topEvents.map((row) => ({ event_name: row.event_name, count: Number(row.count) })),
    dailyEvents: dailyEvents.map((row) => ({ day: row.day, count: Number(row.count) })),
  };
}

export async function getCampaignAnalytics(): Promise<CampaignAnalyticsRow[]> {
  const sql = getSql();
  const rows = await sql<
    {
      campaign_id: string | null;
      campaign_name: string | null;
      utm_campaign: string | null;
      events: string;
      opportunities: string;
      won: string;
    }[]
  >`
    SELECT
      c.id AS campaign_id,
      c.name AS campaign_name,
      COALESCE(c.campaign, (ae.properties ->> 'utm_campaign')) AS utm_campaign,
      COUNT(DISTINCT ae.id)::text AS events,
      COUNT(DISTINCT o.id)::text AS opportunities,
      COUNT(DISTINCT CASE WHEN o.stage = 'won' THEN o.id END)::text AS won
    FROM campaigns c
    FULL OUTER JOIN analytics_events ae ON ae.properties ->> 'utm_campaign' = c.campaign
    LEFT JOIN opportunities o ON o.campaign_id = c.id AND o.deleted_at IS NULL
    WHERE c.deleted_at IS NULL OR c.id IS NULL
    GROUP BY c.id, c.name, c.campaign, (ae.properties ->> 'utm_campaign')
    HAVING COUNT(DISTINCT ae.id) > 0 OR COUNT(DISTINCT o.id) > 0 OR c.id IS NOT NULL
    ORDER BY events DESC, opportunities DESC
    LIMIT 50
  `;
  return rows.map((row) => ({
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    utm_campaign: row.utm_campaign,
    events: Number(row.events),
    opportunities: Number(row.opportunities),
    won: Number(row.won),
  }));
}

export async function listIntegrations(): Promise<IntegrationWithSecrets[]> {
  const sql = getSql();
  const [definitions, secrets] = await Promise.all([
    sql<IntegrationDefinition[]>`
      SELECT * FROM integration_definitions ORDER BY display_name ASC
    `,
    sql<IntegrationSecretSummary[]>`
      SELECT provider, secret_name, last_four, created_at, updated_at
      FROM integration_secrets
      WHERE replaced_at IS NULL
      ORDER BY secret_name ASC
    `,
  ]);
  return definitions.map((definition) => ({
    ...definition,
    secrets: secrets.filter((secret) => secret.provider === definition.provider),
  }));
}

export async function getIntegration(provider: string): Promise<IntegrationWithSecrets | null> {
  const sql = getSql();
  const [definitions, secrets] = await Promise.all([
    sql<IntegrationDefinition[]>`
      SELECT * FROM integration_definitions WHERE provider = ${provider} LIMIT 1
    `,
    sql<IntegrationSecretSummary[]>`
      SELECT provider, secret_name, last_four, created_at, updated_at
      FROM integration_secrets
      WHERE provider = ${provider} AND replaced_at IS NULL
      ORDER BY secret_name ASC
    `,
  ]);
  const definition = definitions[0];
  return definition ? { ...definition, secrets } : null;
}

export async function upsertIntegrationConfig(input: {
  provider: string;
  displayName: string;
  enabled: boolean;
  status: IntegrationStatus;
  config: JsonRecord;
}): Promise<IntegrationDefinition> {
  const sql = getSql();
  const rows = await sql<IntegrationDefinition[]>`
    INSERT INTO integration_definitions (provider, display_name, enabled, status, config)
    VALUES (${input.provider}, ${input.displayName}, ${input.enabled}, ${input.status}, ${sql.json(input.config as JSONValue)})
    ON CONFLICT (provider) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      enabled = EXCLUDED.enabled,
      status = EXCLUDED.status,
      config = EXCLUDED.config,
      last_error = NULL,
      updated_at = NOW()
    RETURNING *
  `;
  return rows[0]!;
}

export async function upsertIntegrationSecret(input: {
  provider: string;
  secretName: string;
  secret: EncryptedSecret;
  createdByUserId: string;
}): Promise<IntegrationSecretSummary> {
  const sql = getSql();
  const rows = await sql<IntegrationSecretSummary[]>`
    INSERT INTO integration_secrets (
      provider, secret_name, ciphertext, iv, auth_tag, key_version, last_four, created_by_user_id
    ) VALUES (
      ${input.provider},
      ${input.secretName},
      ${input.secret.ciphertext},
      ${input.secret.iv},
      ${input.secret.authTag},
      ${input.secret.keyVersion},
      ${input.secret.lastFour},
      ${input.createdByUserId}::uuid
    )
    ON CONFLICT (provider, secret_name) DO UPDATE SET
      ciphertext = EXCLUDED.ciphertext,
      iv = EXCLUDED.iv,
      auth_tag = EXCLUDED.auth_tag,
      key_version = EXCLUDED.key_version,
      last_four = EXCLUDED.last_four,
      created_by_user_id = EXCLUDED.created_by_user_id,
      replaced_at = NULL,
      updated_at = NOW()
    RETURNING provider, secret_name, last_four, created_at, updated_at
  `;
  return rows[0]!;
}

export async function listTrackingRules(): Promise<TrackingRule[]> {
  const sql = getSql();
  return sql<TrackingRule[]>`
    SELECT * FROM tracking_rules ORDER BY event_name ASC
  `;
}

export async function getDeliveryMatrix(): Promise<DeliveryMatrixRow[]> {
  const sql = getSql();
  const rows = await sql<
    {
      event_name: string;
      internal_enabled: boolean;
      ga4_enabled: boolean;
      meta_browser_enabled: boolean;
      meta_server_enabled: boolean;
      recent_logs: string;
      successful_logs: string;
      failed_logs: string;
    }[]
  >`
    SELECT
      tr.event_name,
      tr.internal_enabled,
      tr.ga4_enabled,
      tr.meta_browser_enabled,
      tr.meta_server_enabled,
      COUNT(il.id)::text AS recent_logs,
      COUNT(CASE WHEN il.success THEN 1 END)::text AS successful_logs,
      COUNT(CASE WHEN NOT il.success THEN 1 END)::text AS failed_logs
    FROM tracking_rules tr
    LEFT JOIN integration_logs il
      ON il.event_name = tr.event_name
      AND il.created_at >= NOW() - INTERVAL '14 days'
    GROUP BY tr.id, tr.event_name, tr.internal_enabled, tr.ga4_enabled, tr.meta_browser_enabled, tr.meta_server_enabled
    ORDER BY tr.event_name ASC
  `;
  return rows.map((row) => ({
    event_name: row.event_name,
    internal_enabled: row.internal_enabled,
    ga4_enabled: row.ga4_enabled,
    meta_browser_enabled: row.meta_browser_enabled,
    meta_server_enabled: row.meta_server_enabled,
    recent_logs: Number(row.recent_logs),
    successful_logs: Number(row.successful_logs),
    failed_logs: Number(row.failed_logs),
  }));
}

export async function listIntegrationLogs(filters: {
  provider?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ rows: IntegrationLog[]; total: number }> {
  const sql = getSql();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const rows = await sql<IntegrationLog[]>`
    SELECT * FROM integration_logs
    WHERE (${filters.provider ?? null}::text IS NULL OR provider = ${filters.provider ?? null})
      AND (${filters.success ?? null}::boolean IS NULL OR success = ${filters.success ?? null})
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const totals = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM integration_logs
    WHERE (${filters.provider ?? null}::text IS NULL OR provider = ${filters.provider ?? null})
      AND (${filters.success ?? null}::boolean IS NULL OR success = ${filters.success ?? null})
  `;
  return { rows, total: Number(totals[0]?.count ?? 0) };
}

export async function listCampaigns(options: {
  query?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ rows: Campaign[]; total: number }> {
  const sql = getSql();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const q = options.query?.trim();
  const rows = await sql<Campaign[]>`
    SELECT * FROM campaigns
    WHERE deleted_at IS NULL
      AND (${q ?? null}::text IS NULL OR name ILIKE ${"%" + (q ?? "") + "%"} OR campaign ILIKE ${"%" + (q ?? "") + "%"})
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const totals = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM campaigns
    WHERE deleted_at IS NULL
      AND (${q ?? null}::text IS NULL OR name ILIKE ${"%" + (q ?? "") + "%"} OR campaign ILIKE ${"%" + (q ?? "") + "%"})
  `;
  return { rows, total: Number(totals[0]?.count ?? 0) };
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const sql = getSql();
  const rows = await sql<Campaign[]>`
    SELECT * FROM campaigns WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function upsertCampaign(input: {
  id?: string | null;
  name: string;
  status: CampaignStatus;
  channel?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  landingPage?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  ownerUserId?: string | null;
  notes?: string | null;
}): Promise<Campaign> {
  const sql = getSql();
  if (input.id) {
    const rows = await sql<Campaign[]>`
      UPDATE campaigns
      SET name = ${input.name},
          status = ${input.status},
          channel = ${input.channel ?? null},
          source = ${input.source ?? null},
          medium = ${input.medium ?? null},
          campaign = ${input.campaign ?? null},
          content = ${input.content ?? null},
          term = ${input.term ?? null},
          landing_page = ${input.landingPage ?? null},
          start_date = ${input.startDate ?? null},
          end_date = ${input.endDate ?? null},
          owner_user_id = ${input.ownerUserId ?? null}::uuid,
          notes = ${input.notes ?? null},
          updated_at = NOW()
      WHERE id = ${input.id}::uuid AND deleted_at IS NULL
      RETURNING *
    `;
    return rows[0]!;
  }
  const rows = await sql<Campaign[]>`
    INSERT INTO campaigns (
      name, status, channel, source, medium, campaign, content, term, landing_page,
      start_date, end_date, owner_user_id, notes
    ) VALUES (
      ${input.name},
      ${input.status},
      ${input.channel ?? null},
      ${input.source ?? null},
      ${input.medium ?? null},
      ${input.campaign ?? null},
      ${input.content ?? null},
      ${input.term ?? null},
      ${input.landingPage ?? null},
      ${input.startDate ?? null},
      ${input.endDate ?? null},
      ${input.ownerUserId ?? null}::uuid,
      ${input.notes ?? null}
    )
    RETURNING *
  `;
  return rows[0]!;
}

export async function deleteCampaign(id: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE campaigns SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
  `;
}

export async function listLandingPages(): Promise<LandingPage[]> {
  const sql = getSql();
  return sql<LandingPage[]>`
    SELECT * FROM landing_pages WHERE deleted_at IS NULL ORDER BY created_at DESC
  `;
}

export async function getLandingPageDetail(id: string): Promise<LandingPageDetail | null> {
  const sql = getSql();
  const [pages, blocks] = await Promise.all([
    sql<LandingPage[]>`
      SELECT * FROM landing_pages WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
    `,
    sql<LandingPageBlock[]>`
      SELECT * FROM landing_page_blocks WHERE landing_page_id = ${id}::uuid ORDER BY position ASC
    `,
  ]);
  const page = pages[0];
  return page ? { page, blocks } : null;
}

export async function upsertLandingPage(input: {
  id?: string | null;
  internalName: string;
  slug: string;
  status: LandingPageStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  socialImagePath?: string | null;
  primaryCtaLabel?: string | null;
  primaryCtaHref?: string | null;
  formDestination?: string | null;
  campaignId?: string | null;
  createdByUserId?: string | null;
}): Promise<LandingPage> {
  const sql = getSql();
  const publishedAt = input.status === "published" ? new Date().toISOString() : null;
  if (input.id) {
    const rows = await sql<LandingPage[]>`
      UPDATE landing_pages
      SET internal_name = ${input.internalName},
          slug = ${input.slug},
          status = ${input.status},
          seo_title = ${input.seoTitle ?? null},
          seo_description = ${input.seoDescription ?? null},
          social_image_path = ${input.socialImagePath ?? null},
          primary_cta_label = ${input.primaryCtaLabel ?? null},
          primary_cta_href = ${input.primaryCtaHref ?? null},
          form_destination = ${input.formDestination ?? null},
          campaign_id = ${input.campaignId ?? null}::uuid,
          published_at = CASE WHEN ${input.status} = 'published' THEN COALESCE(published_at, ${publishedAt}) ELSE published_at END,
          updated_at = NOW()
      WHERE id = ${input.id}::uuid AND deleted_at IS NULL
      RETURNING *
    `;
    return rows[0]!;
  }
  const rows = await sql<LandingPage[]>`
    INSERT INTO landing_pages (
      internal_name, slug, status, seo_title, seo_description, social_image_path,
      primary_cta_label, primary_cta_href, form_destination, campaign_id, published_at, created_by_user_id
    ) VALUES (
      ${input.internalName},
      ${input.slug},
      ${input.status},
      ${input.seoTitle ?? null},
      ${input.seoDescription ?? null},
      ${input.socialImagePath ?? null},
      ${input.primaryCtaLabel ?? null},
      ${input.primaryCtaHref ?? null},
      ${input.formDestination ?? null},
      ${input.campaignId ?? null}::uuid,
      ${publishedAt},
      ${input.createdByUserId ?? null}::uuid
    )
    RETURNING *
  `;
  return rows[0]!;
}

export async function deleteLandingPage(id: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE landing_pages SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
  `;
}

export async function listFormConfigurations(): Promise<FormConfiguration[]> {
  const sql = getSql();
  return sql<FormConfiguration[]>`
    SELECT * FROM form_configurations ORDER BY form_key ASC
  `;
}

export async function updateFormConfiguration(input: {
  formKey: string;
  enabled: boolean;
  publicHeadline?: string | null;
  supportingCopy?: string | null;
  successMessage?: string | null;
  notificationRecipients: string[];
  defaultAssigneeUserId?: string | null;
  defaultPriority: PriorityLevel;
  consentCopy?: string | null;
  autoResponseEnabled: boolean;
}): Promise<FormConfiguration> {
  const sql = getSql();
  const rows = await sql<FormConfiguration[]>`
    UPDATE form_configurations
    SET enabled = ${input.enabled},
        public_headline = ${input.publicHeadline ?? null},
        supporting_copy = ${input.supportingCopy ?? null},
        success_message = ${input.successMessage ?? null},
        notification_recipients = ${input.notificationRecipients},
        default_assignee_user_id = ${input.defaultAssigneeUserId ?? null}::uuid,
        default_priority = ${input.defaultPriority},
        consent_copy = ${input.consentCopy ?? null},
        auto_response_enabled = ${input.autoResponseEnabled},
        updated_at = NOW()
    WHERE form_key = ${input.formKey}
    RETURNING *
  `;
  return rows[0]!;
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const sql = getSql();
  const rows = await sql<WorkspaceSettings[]>`
    SELECT * FROM workspace_settings ORDER BY created_at ASC LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function updateWorkspaceSettings(input: {
  defaultOpportunityOwnerId?: string | null;
  productionMode?: boolean | null;
  botProtectionEnabled?: boolean | null;
  defaultCurrency?: string | null;
  maxUploadBytes?: number | null;
}): Promise<WorkspaceSettings> {
  const sql = getSql();
  const rows = await sql<WorkspaceSettings[]>`
    UPDATE workspace_settings
    SET default_opportunity_owner_id = COALESCE(${input.defaultOpportunityOwnerId ?? null}::uuid, default_opportunity_owner_id),
        production_mode = COALESCE(${input.productionMode ?? null}::boolean, production_mode),
        bot_protection_enabled = COALESCE(${input.botProtectionEnabled ?? null}::boolean, bot_protection_enabled),
        default_currency = COALESCE(${input.defaultCurrency ?? null}, default_currency),
        max_upload_bytes = COALESCE(${input.maxUploadBytes ?? null}, max_upload_bytes),
        updated_at = NOW()
    WHERE id = (SELECT id FROM workspace_settings ORDER BY created_at ASC LIMIT 1)
    RETURNING *
  `;
  return rows[0]!;
}

export async function updateConsentSettings(input: {
  bannerTitle: string;
  bannerBody: string;
  privacyUrl: string;
  cookiesUrl: string;
  defaultRegionBehaviour: string;
  retentionDays: number;
  activeVersion: string;
}): Promise<WorkspaceSettings> {
  const sql = getSql();
  const rows = await sql<WorkspaceSettings[]>`
    UPDATE workspace_settings
    SET consent_banner_title = ${input.bannerTitle},
        consent_banner_body = ${input.bannerBody},
        consent_privacy_url = ${input.privacyUrl},
        consent_cookies_url = ${input.cookiesUrl},
        consent_default_region_behaviour = ${input.defaultRegionBehaviour},
        consent_retention_days = ${input.retentionDays},
        active_consent_version = ${input.activeVersion},
        updated_at = NOW()
    WHERE id = (SELECT id FROM workspace_settings ORDER BY created_at ASC LIMIT 1)
    RETURNING *
  `;
  return rows[0]!;
}

export async function listConsentVersions(): Promise<ConsentVersion[]> {
  const sql = getSql();
  return sql<ConsentVersion[]>`
    SELECT * FROM consent_versions ORDER BY created_at DESC
  `;
}

export async function createConsentVersion(input: {
  version: string;
  bannerTitle: string;
  bannerBody: string;
  privacyUrl: string;
  cookiesUrl: string;
  isActive: boolean;
}): Promise<ConsentVersion> {
  const sql = getSql();
  if (input.isActive) {
    await sql`UPDATE consent_versions SET is_active = FALSE`;
  }
  const rows = await sql<ConsentVersion[]>`
    INSERT INTO consent_versions (version, banner_title, banner_body, privacy_url, cookies_url, is_active)
    VALUES (${input.version}, ${input.bannerTitle}, ${input.bannerBody}, ${input.privacyUrl}, ${input.cookiesUrl}, ${input.isActive})
    RETURNING *
  `;
  return rows[0]!;
}

export async function updateTrackingRule(input: {
  eventName: string;
  internalEnabled: boolean;
  ga4Enabled: boolean;
  metaBrowserEnabled: boolean;
  metaServerEnabled: boolean;
}): Promise<TrackingRule> {
  const sql = getSql();
  const rows = await sql<TrackingRule[]>`
    INSERT INTO tracking_rules (
      event_name, internal_enabled, ga4_enabled, meta_browser_enabled, meta_server_enabled
    ) VALUES (
      ${input.eventName},
      ${input.internalEnabled},
      ${input.ga4Enabled},
      ${input.metaBrowserEnabled},
      ${input.metaServerEnabled}
    )
    ON CONFLICT (event_name) DO UPDATE SET
      internal_enabled = EXCLUDED.internal_enabled,
      ga4_enabled = EXCLUDED.ga4_enabled,
      meta_browser_enabled = EXCLUDED.meta_browser_enabled,
      meta_server_enabled = EXCLUDED.meta_server_enabled,
      updated_at = NOW()
    RETURNING *
  `;
  return rows[0]!;
}

export async function updateTask(
  id: string,
  input: { title: string; description?: string | null; dueAt?: string | null; priority: PriorityLevel; status: TaskStatus },
): Promise<Task> {
  const sql = getSql();
  const completedAt = input.status === "completed" ? new Date().toISOString() : null;
  const rows = await sql<Task[]>`
    UPDATE tasks
    SET title = ${input.title},
        description = ${input.description ?? null},
        due_at = ${input.dueAt ?? null},
        priority = ${input.priority},
        status = ${input.status},
        completed_at = ${completedAt},
        updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING *
  `;
  return rows[0]!;
}

