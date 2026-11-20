-- Additive customer fulfilment storage. Production execution requires explicit approval.
-- No existing-row update, account creation, backfill or deletion.
CREATE TABLE IF NOT EXISTS gyvft_shipping_settings (
 environment text PRIMARY KEY CHECK(environment IN ('staging','production')),
 client_name text NOT NULL,
 warehouse_name text NOT NULL,
 origin_pin text NOT NULL CHECK(origin_pin ~ '^[1-9][0-9]{5}$'),
 seller_name text NOT NULL,
 seller_gstin text NOT NULL,
 ciphertext bytea NOT NULL,
 iv bytea NOT NULL,
 auth_tag bytea NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1,
 tested_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gyvft_shipping_plans (
 project_id uuid PRIMARY KEY REFERENCES customer_projects(id),
 expected_sets integer NOT NULL CHECK(expected_sets BETWEEN 1 AND 100000),
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gyvft_shipments (
 id uuid PRIMARY KEY,
 project_id uuid NOT NULL REFERENCES gyvft_shipping_plans(project_id),
 method text NOT NULL CHECK(method IN ('delhivery','porter','other','pickup')),
 label text NOT NULL,
 gift_sets integer NOT NULL CHECK(gift_sets BETWEEN 1 AND 100000),
 recipient_name text NOT NULL,
 phone text NOT NULL,
 address text NOT NULL,
 city text NOT NULL,
 state text NOT NULL,
 postal_code text NOT NULL,
 courier_name text NOT NULL DEFAULT '',
 tracking_reference text NOT NULL DEFAULT '',
 tracking_url text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','booked','ready_for_pickup','in_transit','out_for_delivery','delivered','collected','exception','returned')),
 booking_state text NOT NULL DEFAULT 'draft' CHECK(booking_state IN ('draft','creating','booked','uncertain')),
 provider_reference text NOT NULL UNIQUE,
 provider_status text,
 provider_time timestamptz,
 provider_account text,
 booking_document jsonb,
 booking_started_at timestamptz,
 archived_at timestamptz,
 dispatched_at timestamptz,
 last_sync_at timestamptz,
 last_sync_error text,
 sync_claimed_at timestamptz,
 pickup_state text NOT NULL DEFAULT 'none' CHECK(pickup_state IN ('none','requesting','requested','uncertain')),
 pickup_reference text,
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS gyvft_shipments_awb_idx ON gyvft_shipments(tracking_reference) WHERE method='delhivery' AND tracking_reference<>'';
CREATE INDEX IF NOT EXISTS gyvft_shipments_project_idx ON gyvft_shipments(project_id,created_at);
CREATE TABLE IF NOT EXISTS gyvft_shipping_events (
 request_id uuid PRIMARY KEY,
 project_id uuid REFERENCES customer_projects(id),
 shipment_id uuid REFERENCES gyvft_shipments(id),
 operation text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE gyvft_shipping_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_shipping_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_shipping_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_shipping_settings,gyvft_shipping_plans,gyvft_shipments,gyvft_shipping_events FROM anon,authenticated;
