-- GYVFT gift proposals and customer experiments are independent of Shopify products.
CREATE TABLE IF NOT EXISTS gyvft_gift_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 title text NOT NULL,description text NOT NULL DEFAULT '',contents jsonb NOT NULL CHECK(jsonb_typeof(contents)='array'),
 image_data bytea NOT NULL,image_type text NOT NULL CHECK(image_type IN ('image/png','image/jpeg','image/webp')),
 pricing jsonb NOT NULL DEFAULT '{"mode":"none","basis":"per_set","quantity":1,"low_paise":null,"high_paise":null,"packaging_included":false}'::jsonb,
 published boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),
 request_id uuid NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS gyvft_gift_drafts (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gyvft_gift_selections (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 draft_id uuid NOT NULL REFERENCES gyvft_gift_drafts(id),draft_version integer NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(draft_id,draft_version)
);
ALTER TABLE customer_project_approvals ADD COLUMN IF NOT EXISTS gift_selection_id uuid REFERENCES gyvft_gift_selections(id);
CREATE INDEX IF NOT EXISTS gyvft_gift_options_project ON gyvft_gift_options(project_id,created_at);
CREATE INDEX IF NOT EXISTS gyvft_gift_drafts_project ON gyvft_gift_drafts(project_id,updated_at);
CREATE INDEX IF NOT EXISTS gyvft_gift_selections_project ON gyvft_gift_selections(project_id,created_at);
ALTER TABLE gyvft_gift_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_gift_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_gift_selections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_gift_options,gyvft_gift_drafts,gyvft_gift_selections FROM anon,authenticated;

CREATE TABLE IF NOT EXISTS gyvft_gift_visibility (
 project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 option_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('curated','draft')),
 hidden boolean NOT NULL DEFAULT false,PRIMARY KEY(project_id,option_id,kind)
);
ALTER TABLE gyvft_gift_visibility ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_gift_visibility FROM anon,authenticated;

ALTER TABLE gyvft_customer_events DROP CONSTRAINT IF EXISTS gyvft_customer_events_event_type_check;
ALTER TABLE gyvft_customer_events ADD CONSTRAINT gyvft_customer_events_event_type_check CHECK(event_type IN ('account.created','session.started','session.failed','enquiry.created','message.sent','app.error','setup.completed','setup.failed','gift.quote_requested'));
