-- Customer-facing B2C operations only; independent of the legacy Studio CRM.
ALTER TABLE customer_project_approvals ADD COLUMN IF NOT EXISTS amount_paise bigint CHECK(amount_paise > 0);
ALTER TABLE customer_project_approvals ADD COLUMN IF NOT EXISTS items jsonb;
ALTER TABLE customer_project_approvals ADD COLUMN IF NOT EXISTS image_data bytea;
ALTER TABLE customer_project_approvals ADD COLUMN IF NOT EXISTS image_type text CHECK(image_type IN ('image/png','image/jpeg','image/webp'));
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS tracking_reference text;
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS tracking_url text;
CREATE TABLE IF NOT EXISTS gyvft_customer_admin_events (
 request_id uuid PRIMARY KEY,
 project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 operation text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customer_order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 approval_id uuid NOT NULL REFERENCES customer_project_approvals(id),
 name text NOT NULL,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100000),
 unit_paise bigint NOT NULL CHECK(unit_paise >= 0),
 item_type text NOT NULL CHECK(item_type IN ('gift','fee')),
 personalisation text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS customer_delivery_addresses (
 project_id uuid PRIMARY KEY REFERENCES customer_projects(id) ON DELETE CASCADE,
 recipient_name text NOT NULL,
 phone text NOT NULL,
 address text NOT NULL,
 city text NOT NULL,
 state text NOT NULL,
 postal_code text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gyvft_customer_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text NOT NULL UNIQUE,
 project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 recipient text NOT NULL,
 destination text NOT NULL CHECK(destination IN ('customer','team')),
 subject text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0,
 attempted_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_order_items_project_idx ON customer_order_items(project_id);
CREATE INDEX IF NOT EXISTS customer_notifications_pending_idx ON gyvft_customer_notifications(state,created_at);
ALTER TABLE gyvft_customer_admin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_delivery_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_customer_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_customer_admin_events,customer_order_items,customer_delivery_addresses,gyvft_customer_notifications FROM anon,authenticated;
ALTER TABLE customer_payment_submissions ADD COLUMN IF NOT EXISTS evidence_data bytea;
ALTER TABLE customer_payment_submissions ADD COLUMN IF NOT EXISTS evidence_type text CHECK(evidence_type IN ('image/png','image/jpeg','image/webp'));
ALTER TABLE customer_payment_submissions ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE gyvft_customer_accounts ADD COLUMN IF NOT EXISTS shopify_customer_id text UNIQUE;
ALTER TABLE gyvft_customer_accounts ADD COLUMN IF NOT EXISTS shopify_sync_state text NOT NULL DEFAULT 'pending' CHECK(shopify_sync_state IN ('pending','syncing','synced','failed'));
ALTER TABLE gyvft_customer_accounts ADD COLUMN IF NOT EXISTS shopify_sync_attempted_at timestamptz;
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS shopify_order_id text UNIQUE;
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS shopify_order_state text NOT NULL DEFAULT 'pending' CHECK(shopify_order_state IN ('pending','creating','linked','uncertain'));
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS shopify_order_attempted_at timestamptz;
CREATE TABLE IF NOT EXISTS gyvft_customer_upi_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 upi_id text NOT NULL,
 payee_name text NOT NULL,
 qr_data bytea,
 qr_type text CHECK(qr_type IN ('image/png','image/jpeg','image/webp')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE gyvft_customer_upi_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_customer_upi_settings FROM anon,authenticated;

ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS shopify_payment_state text NOT NULL DEFAULT 'idle' CHECK(shopify_payment_state IN ('idle','syncing','uncertain'));

ALTER TABLE gyvft_customer_occasions ADD COLUMN IF NOT EXISTS photo_data bytea;
ALTER TABLE gyvft_customer_occasions ADD COLUMN IF NOT EXISTS photo_type text CHECK(photo_type IN ('image/png','image/jpeg','image/webp'));

ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS shopify_payment_version integer NOT NULL DEFAULT 0;
