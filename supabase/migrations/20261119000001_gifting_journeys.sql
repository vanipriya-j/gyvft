-- Approved individual gifting model. No changes to Aarla/legacy Studio tables.
CREATE TABLE IF NOT EXISTS gyvft_customer_profiles (
 account_id uuid PRIMARY KEY REFERENCES gyvft_customer_accounts(id) ON DELETE CASCADE,
 name text NOT NULL DEFAULT '', about text NOT NULL DEFAULT '', interests text NOT NULL DEFAULT '', avoid text NOT NULL DEFAULT '',
 share_profile boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gyvft_customer_people (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES gyvft_customer_accounts(id) ON DELETE CASCADE,
 name text NOT NULL,relationship text NOT NULL DEFAULT '',about text NOT NULL DEFAULT '',likes text NOT NULL DEFAULT '',avoid text NOT NULL DEFAULT '',
 email text NOT NULL DEFAULT '',linked_account_id uuid REFERENCES gyvft_customer_accounts(id) ON DELETE SET NULL,
 invitation_hash text UNIQUE,invitation_expires_at timestamptz,invitation_accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gyvft_customer_people_owner ON gyvft_customer_people(account_id,created_at);
ALTER TABLE gyvft_customer_occasions ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES gyvft_customer_people(id) ON DELETE SET NULL;
ALTER TABLE gyvft_customer_occasions ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
ALTER TABLE gyvft_customer_occasions ADD COLUMN IF NOT EXISTS relationship text NOT NULL DEFAULT '';
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS occasion_id uuid REFERENCES gyvft_customer_occasions(id) ON DELETE SET NULL;
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES gyvft_customer_people(id) ON DELETE SET NULL;
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS draft_document jsonb;
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS production_started_at timestamptz;
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS task_owner text NOT NULL DEFAULT 'Aarla';
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS task_due_at timestamptz;
UPDATE customer_projects SET production_started_at=created_at WHERE stage>=7 AND production_started_at IS NULL;
ALTER TABLE gyvft_gift_options ADD COLUMN IF NOT EXISTS operator_hidden boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS gyvft_gift_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 approval_id uuid NOT NULL REFERENCES customer_project_approvals(id),body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','addressed')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gyvft_gift_internal_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gyvft_gift_approval_drafts (
 project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('proposal','design')),
 document jsonb NOT NULL,image_data bytea,image_type text,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,kind)
);
CREATE TABLE IF NOT EXISTS gyvft_gift_testimonials (
 project_id uuid PRIMARY KEY REFERENCES customer_projects(id) ON DELETE CASCADE,
 rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 2000),
 public_permission boolean NOT NULL DEFAULT false,featured boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),CHECK(NOT featured OR public_permission)
);
CREATE TABLE IF NOT EXISTS gyvft_gift_photos (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 caption text NOT NULL DEFAULT '',kind text NOT NULL,image_data bytea NOT NULL,image_type text NOT NULL CHECK(image_type IN ('image/png','image/jpeg','image/webp')),
 public_permission boolean NOT NULL DEFAULT false,featured boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),CHECK(NOT featured OR public_permission)
);
CREATE INDEX IF NOT EXISTS gyvft_gift_photos_project ON gyvft_gift_photos(project_id,created_at);
CREATE INDEX IF NOT EXISTS gyvft_gift_changes_project ON gyvft_gift_changes(project_id,status);
ALTER TABLE gyvft_customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_customer_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_gift_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_gift_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_gift_approval_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_gift_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_gift_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_customer_profiles,gyvft_customer_people,gyvft_gift_changes,gyvft_gift_internal_notes,gyvft_gift_approval_drafts,gyvft_gift_testimonials,gyvft_gift_photos FROM anon,authenticated;
ALTER TABLE gyvft_customer_profiles ADD COLUMN IF NOT EXISTS taste_dismissals jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS gyvft_gift_brief_revisions (
 project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 version integer NOT NULL,document jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,version)
);
ALTER TABLE gyvft_gift_brief_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_gift_brief_revisions FROM anon,authenticated;
