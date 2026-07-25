-- GYVFT initial schema
-- UUID PKs, timestamps, FKs, indexes, soft deletes where appropriate

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Enums / constrained domains
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'contributor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_stage AS ENUM (
    'new', 'reviewing', 'contacted', 'discovery_scheduled', 'story_discovery',
    'concept_development', 'proposal_sent', 'negotiation', 'won', 'lost', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE intent_type AS ENUM (
    'story_opportunity', 'merch_partnership_opportunity', 'brief_upload', 'discovery_request'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE relationship_type AS ENUM ('one_off', 'recurring', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE landing_page_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE integration_status AS ENUM (
    'not_configured', 'configured', 'connected', 'error', 'disabled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_category AS ENUM ('necessary', 'analytics', 'advertising');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE organisation_relationship_status AS ENUM (
    'prospect', 'active', 'partner', 'inactive', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Workspace settings (single-row style config)
CREATE TABLE IF NOT EXISTS workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_opportunity_owner_id UUID,
  default_currency CHAR(3) NOT NULL DEFAULT 'INR',
  max_upload_bytes BIGINT NOT NULL DEFAULT 10485760,
  production_mode BOOLEAN NOT NULL DEFAULT FALSE,
  consent_banner_title TEXT NOT NULL DEFAULT 'We value your privacy',
  consent_banner_body TEXT NOT NULL DEFAULT 'We use cookies and similar technologies for necessary site operation, analytics, and advertising. You can accept all, reject non-essential, or manage preferences.',
  consent_privacy_url TEXT NOT NULL DEFAULT '/privacy',
  consent_cookies_url TEXT NOT NULL DEFAULT '/cookies',
  consent_default_region_behaviour TEXT NOT NULL DEFAULT 'opt_in',
  consent_retention_days INTEGER NOT NULL DEFAULT 365,
  active_consent_version TEXT NOT NULL DEFAULT '1.0.0',
  bot_protection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY, -- matches auth.users.id when using Supabase Auth
  email CITEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'contributor',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'contributor',
  invited_by_user_id UUID REFERENCES profiles(id),
  token_hash TEXT NOT NULL UNIQUE,
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);

CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalised_name TEXT NOT NULL,
  type TEXT,
  website TEXT,
  industry TEXT,
  primary_city TEXT,
  relationship_status organisation_relationship_status NOT NULL DEFAULT 'prospect',
  notes TEXT,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organisations_name ON organisations(normalised_name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_organisations_normalised_name_active
  ON organisations(normalised_name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS organisation_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  label TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  full_name TEXT NOT NULL,
  email CITEXT,
  normalised_email CITEXT,
  phone TEXT,
  normalised_phone TEXT,
  designation TEXT,
  preferred_contact_method TEXT,
  source TEXT,
  communication_consent BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_version TEXT,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(normalised_email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(normalised_phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_organisation ON contacts(organisation_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  channel TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  content TEXT,
  term TEXT,
  landing_page TEXT,
  start_date DATE,
  end_date DATE,
  owner_user_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_title TEXT,
  intent_type intent_type NOT NULL,
  relationship_type relationship_type NOT NULL DEFAULT 'unknown',
  stage opportunity_stage NOT NULL DEFAULT 'new',
  priority priority_level NOT NULL DEFAULT 'medium',
  source TEXT NOT NULL,
  campaign_id UUID REFERENCES campaigns(id),
  contact_id UUID REFERENCES contacts(id),
  organisation_id UUID REFERENCES organisations(id),
  assigned_user_id UUID REFERENCES profiles(id),
  occasion_type TEXT,
  occasion_other TEXT,
  target_date DATE,
  target_date_precision TEXT,
  quantity_range TEXT,
  budget_range TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  estimated_value NUMERIC(14,2),
  confirmed_value NUMERIC(14,2),
  expected_start_date DATE,
  primary_city TEXT,
  multiple_locations BOOLEAN NOT NULL DEFAULT FALSE,
  location_notes TEXT,
  lost_reason TEXT,
  lost_notes TEXT,
  competitor TEXT,
  revisit_date DATE,
  form_key TEXT,
  idempotency_key TEXT UNIQUE,
  attribution_id UUID,
  ai_summary_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_source ON opportunities(source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_assigned ON opportunities(assigned_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_campaign ON opportunities(campaign_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_org ON opportunities(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_contact ON opportunities(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_created ON opportunities(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_intent ON opportunities(intent_type) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS opportunity_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  audience TEXT NOT NULL,
  UNIQUE (opportunity_id, audience)
);

CREATE TABLE IF NOT EXISTS opportunity_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  UNIQUE (opportunity_id, format)
);

CREATE TABLE IF NOT EXISTS opportunity_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  form_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunity_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  story_title TEXT,
  story_summary TEXT,
  why_it_matters TEXT,
  people_or_organisations JSONB NOT NULL DEFAULT '[]'::jsonb,
  occasion TEXT,
  audiences JSONB NOT NULL DEFAULT '[]'::jsonb,
  emotional_intent JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_directions JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_next_action TEXT,
  prompt_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_summaries_opportunity ON opportunity_summaries(opportunity_id);

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  organisation_id UUID REFERENCES organisations(id),
  author_user_id UUID REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id),
  organisation_id UUID REFERENCES organisations(id),
  assigned_user_id UUID REFERENCES profiles(id),
  created_by_user_id UUID REFERENCES profiles(id),
  due_at TIMESTAMPTZ,
  priority priority_level NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'open',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  organisation_id UUID REFERENCES organisations(id),
  task_id UUID REFERENCES tasks(id),
  actor_user_id UUID REFERENCES profiles(id),
  activity_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_immutable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_opportunity ON activities(opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  organisation_id UUID REFERENCES organisations(id),
  uploaded_by_user_id UUID REFERENCES profiles(id),
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  checksum_sha256 TEXT,
  scan_status TEXT NOT NULL DEFAULT 'pending',
  scan_provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_files_opportunity ON files(opportunity_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS visitor_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_visitor_id UUID NOT NULL UNIQUE,
  first_touch_source TEXT,
  first_touch_medium TEXT,
  first_touch_campaign TEXT,
  first_touch_content TEXT,
  first_touch_term TEXT,
  first_touch_landing_page TEXT,
  first_touch_referrer TEXT,
  last_touch_source TEXT,
  last_touch_medium TEXT,
  last_touch_campaign TEXT,
  last_touch_content TEXT,
  last_touch_term TEXT,
  last_touch_landing_page TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_category TEXT,
  contact_id UUID REFERENCES contacts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_identity_id UUID NOT NULL REFERENCES visitor_identities(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  landing_page TEXT,
  referrer TEXT,
  device_category TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT
);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor ON visitor_sessions(visitor_identity_id);

CREATE TABLE IF NOT EXISTS attribution_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_identity_id UUID NOT NULL REFERENCES visitor_identities(id) ON DELETE CASCADE,
  session_id UUID REFERENCES visitor_sessions(id),
  touch_type TEXT NOT NULL CHECK (touch_type IN ('first', 'last', 'conversion')),
  source TEXT,
  medium TEXT,
  campaign TEXT,
  content TEXT,
  term TEXT,
  landing_page TEXT,
  referrer TEXT,
  opportunity_id UUID REFERENCES opportunities(id),
  contact_id UUID REFERENCES contacts(id),
  campaign_id UUID REFERENCES campaigns(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attribution_opportunity ON attribution_touches(opportunity_id);

ALTER TABLE opportunities
  DROP CONSTRAINT IF EXISTS opportunities_attribution_id_fkey;
ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_attribution_id_fkey
  FOREIGN KEY (attribution_id) REFERENCES attribution_touches(id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_id UUID NOT NULL UNIQUE,
  correlation_id UUID NOT NULL,
  anonymous_visitor_id UUID,
  session_id UUID,
  opportunity_id UUID REFERENCES opportunities(id),
  contact_id UUID REFERENCES contacts(id),
  user_type TEXT NOT NULL DEFAULT 'anonymous',
  source_route TEXT,
  device_category TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_analytics BOOLEAN NOT NULL DEFAULT FALSE,
  consent_advertising BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_correlation ON analytics_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_opportunity ON analytics_events(opportunity_id);

CREATE TABLE IF NOT EXISTS integration_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status integration_status NOT NULL DEFAULT 'not_configured',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_successful_test_at TIMESTAMPTZ,
  last_failed_test_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  secret_name TEXT NOT NULL,
  ciphertext BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  last_four TEXT,
  created_by_user_id UUID REFERENCES profiles(id),
  replaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, secret_name)
);

CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  integration_id UUID REFERENCES integration_definitions(id),
  operation TEXT NOT NULL,
  event_name TEXT,
  correlation_id UUID,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  request_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_completed_at TIMESTAMPTZ,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  http_status INTEGER,
  provider_response_id TEXT,
  sanitised_error TEXT,
  next_retry_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_provider ON integration_logs(provider);
CREATE INDEX IF NOT EXISTS idx_integration_logs_correlation ON integration_logs(correlation_id);

CREATE TABLE IF NOT EXISTS tracking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL UNIQUE,
  internal_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ga4_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  meta_browser_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  meta_server_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  signing_secret_last_four TEXT,
  subscribed_events TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  created_by_user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS webhook_endpoint_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_endpoint_id UUID NOT NULL UNIQUE REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  ciphertext BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  response_status INTEGER,
  response_duration_ms INTEGER,
  failure_reason TEXT,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status, next_retry_at);

CREATE TABLE IF NOT EXISTS consent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  banner_title TEXT NOT NULL,
  banner_body TEXT NOT NULL,
  privacy_url TEXT NOT NULL,
  cookies_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_version TEXT NOT NULL,
  anonymous_visitor_id UUID,
  necessary BOOLEAN NOT NULL DEFAULT TRUE,
  analytics BOOLEAN NOT NULL DEFAULT FALSE,
  advertising BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'banner',
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_records_visitor ON consent_records(anonymous_visitor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'resend',
  template_key TEXT NOT NULL,
  to_addresses TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  opportunity_id UUID REFERENCES opportunities(id),
  status TEXT NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_status ON email_deliveries(status, next_retry_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS auth_attempt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT,
  success BOOLEAN NOT NULL,
  reason TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_attempt_logs_created ON auth_attempt_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempt_logs_email ON auth_attempt_logs(email, created_at DESC);

CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status landing_page_status NOT NULL DEFAULT 'draft',
  seo_title TEXT,
  seo_description TEXT,
  social_image_path TEXT,
  primary_cta_label TEXT,
  primary_cta_href TEXT,
  form_destination TEXT,
  campaign_id UUID REFERENCES campaigns(id),
  published_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS landing_page_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL,
  position INTEGER NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (landing_page_id, position)
);

CREATE TABLE IF NOT EXISTS form_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  public_headline TEXT,
  supporting_copy TEXT,
  success_message TEXT,
  notification_recipients TEXT[] NOT NULL DEFAULT '{}',
  default_assignee_user_id UUID REFERENCES profiles(id),
  default_priority priority_level NOT NULL DEFAULT 'medium',
  consent_copy TEXT,
  auto_response_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  optional_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  budget_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  quantity_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (bucket_key, window_started_at)
);

-- Updated-at triggers
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workspace_settings','profiles','user_invitations','organisations','organisation_locations',
    'contacts','campaigns','opportunities','opportunity_summaries','notes','tasks','files',
    'visitor_identities','integration_definitions','integration_secrets','tracking_rules',
    'webhook_endpoints','webhook_endpoint_secrets','webhook_deliveries','email_deliveries',
    'landing_pages','landing_page_blocks','form_configurations'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- Seed integration definitions and default tracking rules / forms (non-fictional config only)
INSERT INTO integration_definitions (provider, display_name, status)
VALUES
  ('gtm', 'Google Tag Manager', 'not_configured'),
  ('ga4', 'Google Analytics 4', 'not_configured'),
  ('meta_pixel', 'Meta Pixel', 'not_configured'),
  ('meta_capi', 'Meta Conversions API', 'not_configured'),
  ('clarity', 'Microsoft Clarity', 'not_configured'),
  ('resend', 'Resend', 'not_configured'),
  ('openai', 'OpenAI', 'not_configured'),
  ('supabase_storage', 'Supabase Storage', 'not_configured'),
  ('webhooks', 'Outgoing Webhooks', 'not_configured')
ON CONFLICT (provider) DO NOTHING;

INSERT INTO tracking_rules (event_name, internal_enabled, ga4_enabled, meta_browser_enabled, meta_server_enabled)
VALUES
  ('page_view', TRUE, TRUE, TRUE, FALSE),
  ('story_form_started', TRUE, TRUE, TRUE, FALSE),
  ('story_form_submitted', TRUE, TRUE, TRUE, TRUE),
  ('partner_form_submitted', TRUE, TRUE, TRUE, TRUE),
  ('discovery_requested', TRUE, TRUE, TRUE, TRUE),
  ('lead_qualified', TRUE, TRUE, FALSE, TRUE),
  ('proposal_sent', TRUE, TRUE, FALSE, FALSE),
  ('opportunity_won', TRUE, TRUE, FALSE, TRUE),
  ('opportunity_lost', TRUE, TRUE, FALSE, FALSE)
ON CONFLICT (event_name) DO NOTHING;

INSERT INTO form_configurations (form_key, public_headline, supporting_copy, success_message, budget_options, quantity_options)
VALUES
  (
    'tell_your_story',
    'Tell us your story',
    'Share the story, occasion and practical details. We will shape possible expressions with you.',
    'Thank you. Your story has been received.',
    '["Under ₹50,000","₹50,000–₹2,00,000","₹2,00,000–₹10,00,000","₹10,00,000+","Not sure yet"]'::jsonb,
    '["1–25","26–100","101–500","500+","Not sure yet"]'::jsonb
  ),
  (
    'merch_partner',
    'Make us part of your story',
    'Tell us how GYVFT can become your recurring merchandise and storytelling partner.',
    'Thank you. Your partnership enquiry has been received.',
    '["Under ₹2,00,000","₹2,00,000–₹10,00,000","₹10,00,000–₹50,00,000","₹50,00,000+","Flexible / retainer"]'::jsonb,
    '["Under 100","100–500","500–2,000","2,000+","Varies by occasion"]'::jsonb
  ),
  (
    'upload_brief',
    'Upload a brief',
    'Share a short description and your brief file. We will review and follow up.',
    'Thank you. Your brief has been received.',
    '[]'::jsonb,
    '[]'::jsonb
  ),
  (
    'book_discovery',
    'Book a discovery conversation',
    'Tell us what you want to discuss and we will schedule a conversation.',
    'Thank you. Your discovery request has been received.',
    '[]'::jsonb,
    '[]'::jsonb
  )
ON CONFLICT (form_key) DO NOTHING;

INSERT INTO workspace_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM workspace_settings);

INSERT INTO consent_versions (version, banner_title, banner_body, privacy_url, cookies_url, is_active)
VALUES (
  '1.0.0',
  'We value your privacy',
  'We use cookies and similar technologies for necessary site operation, analytics, and advertising. You can accept all, reject non-essential, or manage preferences.',
  '/privacy',
  '/cookies',
  TRUE
)
ON CONFLICT (version) DO NOTHING;
