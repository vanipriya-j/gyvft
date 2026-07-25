-- Row Level Security policies for GYVFT
-- Public lead creation is performed via trusted server-side service role only.
-- Authenticated Studio users access data according to role.

-- Helper: current profile
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.uid()::text, '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles
  WHERE id = auth.uid()
    AND is_active = TRUE
    AND deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_studio_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = TRUE
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(allowed user_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = ANY(allowed), FALSE);
$$;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution_touches ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoint_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_attempt_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_page_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY profiles_select_active ON profiles
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user());

CREATE POLICY profiles_update_owner_admin ON profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY profiles_insert_owner ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(ARRAY['owner']::user_role[]));

-- Opportunities: contributors see assigned or unassigned operational records
CREATE POLICY opportunities_select ON opportunities
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY['owner','admin']::user_role[])
    OR (
      public.has_role(ARRAY['contributor']::user_role[])
      AND (assigned_user_id = auth.uid() OR assigned_user_id IS NULL)
      AND deleted_at IS NULL
    )
  );

CREATE POLICY opportunities_insert_admin ON opportunities
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY opportunities_update ON opportunities
  FOR UPDATE TO authenticated
  USING (
    public.has_role(ARRAY['owner','admin']::user_role[])
    OR (
      public.has_role(ARRAY['contributor']::user_role[])
      AND assigned_user_id = auth.uid()
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    public.has_role(ARRAY['owner','admin']::user_role[])
    OR (
      public.has_role(ARRAY['contributor']::user_role[])
      AND assigned_user_id = auth.uid()
    )
  );

CREATE POLICY opportunities_delete_owner ON opportunities
  FOR DELETE TO authenticated
  USING (public.has_role(ARRAY['owner']::user_role[]));

-- Contacts / orgs
CREATE POLICY contacts_select ON contacts
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user());

CREATE POLICY contacts_write_admin ON contacts
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner','admin','contributor']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin','contributor']::user_role[]));

CREATE POLICY organisations_select ON organisations
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user());

CREATE POLICY organisations_write ON organisations
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner','admin','contributor']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin','contributor']::user_role[]));

CREATE POLICY organisation_locations_all ON organisation_locations
  FOR ALL TO authenticated
  USING (public.is_active_studio_user())
  WITH CHECK (public.is_active_studio_user());

-- Tasks
CREATE POLICY tasks_select ON tasks
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY['owner','admin']::user_role[])
    OR assigned_user_id = auth.uid()
    OR created_by_user_id = auth.uid()
  );

CREATE POLICY tasks_write ON tasks
  FOR ALL TO authenticated
  USING (
    public.has_role(ARRAY['owner','admin']::user_role[])
    OR assigned_user_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(ARRAY['owner','admin']::user_role[])
    OR assigned_user_id = auth.uid()
  );

-- Notes / activities / related opportunity children
CREATE POLICY notes_all ON notes
  FOR ALL TO authenticated
  USING (public.is_active_studio_user())
  WITH CHECK (public.is_active_studio_user());

CREATE POLICY activities_select ON activities
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user());

CREATE POLICY activities_insert ON activities
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_studio_user());

CREATE POLICY opportunity_audiences_all ON opportunity_audiences
  FOR ALL TO authenticated
  USING (public.is_active_studio_user())
  WITH CHECK (public.is_active_studio_user());

CREATE POLICY opportunity_formats_all ON opportunity_formats
  FOR ALL TO authenticated
  USING (public.is_active_studio_user())
  WITH CHECK (public.is_active_studio_user());

CREATE POLICY opportunity_submissions_select ON opportunity_submissions
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user());

CREATE POLICY opportunity_summaries_all ON opportunity_summaries
  FOR ALL TO authenticated
  USING (public.is_active_studio_user())
  WITH CHECK (public.is_active_studio_user());

-- Files: authenticated only; never public
CREATE POLICY files_select ON files
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user() AND deleted_at IS NULL);

CREATE POLICY files_write ON files
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner','admin','contributor']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin','contributor']::user_role[]));

-- Analytics / attribution: studio read
CREATE POLICY visitor_identities_select ON visitor_identities
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY visitor_sessions_select ON visitor_sessions
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY attribution_touches_select ON attribution_touches
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user());

CREATE POLICY analytics_events_select ON analytics_events
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]));

-- Integrations
CREATE POLICY integration_definitions_select ON integration_definitions
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY integration_definitions_write ON integration_definitions
  FOR ALL TO authenticated
  USING (
    public.has_role(ARRAY['owner']::user_role[])
    OR (public.has_role(ARRAY['admin']::user_role[]) AND provider NOT IN ('meta_capi','openai','resend'))
  )
  WITH CHECK (
    public.has_role(ARRAY['owner']::user_role[])
    OR (public.has_role(ARRAY['admin']::user_role[]) AND provider NOT IN ('meta_capi','openai','resend'))
  );

-- Secrets: no SELECT of ciphertext for non-service roles via ordinary policies.
-- Deny all authenticated access to secret payloads; only service role may read.
CREATE POLICY integration_secrets_owner_metadata ON integration_secrets
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner']::user_role[]));

CREATE POLICY integration_secrets_owner_write ON integration_secrets
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner']::user_role[]));

-- Force column-level protection via view for app reads
CREATE OR REPLACE VIEW integration_secrets_public AS
SELECT
  id,
  provider,
  secret_name,
  last_four,
  key_version,
  created_by_user_id,
  replaced_at,
  created_at,
  updated_at,
  TRUE AS configured
FROM integration_secrets;

CREATE POLICY integration_logs_select ON integration_logs
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY tracking_rules_select ON tracking_rules
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY tracking_rules_write ON tracking_rules
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY webhook_endpoints_admin ON webhook_endpoints
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY webhook_endpoint_secrets_owner ON webhook_endpoint_secrets
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner']::user_role[]));

CREATE POLICY webhook_deliveries_select ON webhook_deliveries
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]));

-- Consent / settings
CREATE POLICY consent_versions_select ON consent_versions
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user());

CREATE POLICY consent_versions_write ON consent_versions
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY consent_records_select ON consent_records
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY workspace_settings_select ON workspace_settings
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user());

CREATE POLICY workspace_settings_write ON workspace_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY email_deliveries_select ON email_deliveries
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY auth_attempt_logs_owner ON auth_attempt_logs
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['owner']::user_role[]));

CREATE POLICY campaigns_all ON campaigns
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY campaigns_select_contributor ON campaigns
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user());

CREATE POLICY landing_pages_studio ON landing_pages
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY landing_page_blocks_studio ON landing_page_blocks
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin']::user_role[]));

-- Public can read published landing pages only via anon policy
CREATE POLICY landing_pages_public_read ON landing_pages
  FOR SELECT TO anon
  USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY landing_page_blocks_public_read ON landing_page_blocks
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM landing_pages lp
      WHERE lp.id = landing_page_id
        AND lp.status = 'published'
        AND lp.deleted_at IS NULL
    )
  );

CREATE POLICY form_configurations_select ON form_configurations
  FOR SELECT TO authenticated
  USING (public.is_active_studio_user());

CREATE POLICY form_configurations_write ON form_configurations
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner','admin']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner','admin']::user_role[]));

CREATE POLICY form_configurations_public_read ON form_configurations
  FOR SELECT TO anon
  USING (enabled = TRUE);

CREATE POLICY user_invitations_owner ON user_invitations
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['owner']::user_role[]))
  WITH CHECK (public.has_role(ARRAY['owner']::user_role[]));

-- Explicit deny: public/anon cannot read opportunities
CREATE POLICY opportunities_deny_anon ON opportunities
  FOR SELECT TO anon
  USING (FALSE);

CREATE POLICY opportunity_submissions_deny_anon ON opportunity_submissions
  FOR SELECT TO anon
  USING (FALSE);

CREATE POLICY files_deny_anon ON files
  FOR SELECT TO anon
  USING (FALSE);

CREATE POLICY integration_secrets_deny_anon ON integration_secrets
  FOR SELECT TO anon
  USING (FALSE);
