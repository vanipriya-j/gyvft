-- Additive, opt-in D2C rewards. No production execution during build/deployment.
CREATE TABLE gyvft_reward_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
 collection_id text, activated_at timestamptz, sync_cursor text, sync_since timestamptz,
 sync_until timestamptz, lease_until timestamptz, last_sync_at timestamptz,
 last_error text, revision integer NOT NULL DEFAULT 1
);
INSERT INTO gyvft_reward_settings(id) VALUES(true);
CREATE TABLE gyvft_reward_wallets (
 customer_id text PRIMARY KEY, email text NOT NULL,
 account_id uuid UNIQUE REFERENCES gyvft_customer_accounts(id), verified_email text,
 verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE gyvft_reward_verifications (
 token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES gyvft_customer_accounts(id),
 email text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON gyvft_reward_verifications(account_id,created_at);
CREATE TABLE gyvft_reward_orders (
 id text PRIMARY KEY, customer_id text, email text, created_at timestamptz NOT NULL,
 paid_at timestamptz, updated_at timestamptz NOT NULL, classification text NOT NULL CHECK(classification IN ('d2c','review','excluded')),
 reason text NOT NULL, eligible_paise bigint NOT NULL CHECK(eligible_paise>=0),
 reviewed_paise bigint CHECK(reviewed_paise>=0), reviewed_version timestamptz,
 authorised boolean NOT NULL DEFAULT false, authorised_at timestamptz,
 codes text[] NOT NULL DEFAULT '{}', snapshot_hash text NOT NULL,
 is_historical boolean NOT NULL, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON gyvft_reward_orders(customer_id,created_at);
CREATE TABLE gyvft_reward_lots (
 order_id text PRIMARY KEY REFERENCES gyvft_reward_orders(id), customer_id text NOT NULL REFERENCES gyvft_reward_wallets(customer_id),
 earned integer NOT NULL DEFAULT 0 CHECK(earned>=0), spent integer NOT NULL DEFAULT 0 CHECK(spent>=0),
 held integer NOT NULL DEFAULT 0 CHECK(held>=0), expired integer NOT NULL DEFAULT 0 CHECK(expired>=0),
 available_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, last_calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON gyvft_reward_lots(customer_id,expires_at);
CREATE TABLE gyvft_reward_coupons (
 id uuid PRIMARY KEY, customer_id text NOT NULL REFERENCES gyvft_reward_wallets(customer_id),
 kind text NOT NULL CHECK(kind IN ('points','birthday','anniversary')), event_year integer,
 code text UNIQUE NOT NULL, points integer NOT NULL CHECK(points>0), minimum_paise bigint NOT NULL,
 collection_id text NOT NULL, state text NOT NULL DEFAULT 'creating' CHECK(state IN ('creating','active','uncertain','redeemed','released','expired')),
 shopify_id text, order_id text, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz, checked_at timestamptz,
 UNIQUE(customer_id,kind,event_year)
);
CREATE UNIQUE INDEX gyvft_reward_one_pending_points ON gyvft_reward_coupons(customer_id) WHERE kind='points' AND state IN ('creating','active','uncertain');
CREATE TABLE gyvft_reward_allocations (
 coupon_id uuid NOT NULL REFERENCES gyvft_reward_coupons(id), order_id text NOT NULL REFERENCES gyvft_reward_lots(order_id),
 points integer NOT NULL CHECK(points>0), PRIMARY KEY(coupon_id,order_id)
);
CREATE TABLE gyvft_reward_dates (
 customer_id text PRIMARY KEY REFERENCES gyvft_reward_wallets(customer_id),
 birthday text CHECK(birthday ~ '^[0-9]{2}-[0-9]{2}$'), anniversary text CHECK(anniversary ~ '^[0-9]{2}-[0-9]{2}$'),
 consent boolean NOT NULL DEFAULT false, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE gyvft_reward_ledger (
 id bigserial PRIMARY KEY, customer_id text NOT NULL REFERENCES gyvft_reward_wallets(customer_id),
 kind text NOT NULL, points integer NOT NULL, reference text NOT NULL, detail text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON gyvft_reward_ledger(customer_id,id DESC);
CREATE TABLE gyvft_reward_imports (
 id uuid PRIMARY KEY, state text NOT NULL CHECK(state IN ('preview','applied')),
 fingerprint text NOT NULL, order_ids text[] NOT NULL, order_count integer NOT NULL,
 points integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz
);
-- Private service data. No anonymous/authenticated Supabase client access.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['gyvft_reward_settings','gyvft_reward_wallets','gyvft_reward_verifications','gyvft_reward_orders','gyvft_reward_lots','gyvft_reward_coupons','gyvft_reward_allocations','gyvft_reward_dates','gyvft_reward_ledger','gyvft_reward_imports'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON %I FROM anon',t); END IF;
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON %I FROM authenticated',t); END IF;
 END LOOP;
END $$;
