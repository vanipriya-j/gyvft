-- GYVFT-owned customer credentials and sessions. Independent of Supabase Auth
-- and existing Aarla OS login/business tables.
CREATE TABLE IF NOT EXISTS gyvft_customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gyvft_customer_sessions (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES gyvft_customer_accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gyvft_customer_sessions_account_idx ON gyvft_customer_sessions(account_id);
CREATE INDEX IF NOT EXISTS gyvft_customer_sessions_expiry_idx ON gyvft_customer_sessions(expires_at);
CREATE TABLE IF NOT EXISTS gyvft_customer_password_resets (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES gyvft_customer_accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gyvft_customer_resets_account_idx ON gyvft_customer_password_resets(account_id);
CREATE TABLE IF NOT EXISTS gyvft_customer_auth_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS customer_account_id uuid REFERENCES gyvft_customer_accounts(id);
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS browser_claim_hash text;
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS browser_claim_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS customer_projects_account_idx ON customer_projects(customer_account_id);
CREATE INDEX IF NOT EXISTS customer_projects_claim_idx ON customer_projects(browser_claim_hash) WHERE customer_account_id IS NULL;
ALTER TABLE gyvft_customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_customer_password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_customer_auth_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_customer_accounts, gyvft_customer_sessions, gyvft_customer_password_resets, gyvft_customer_auth_limits FROM anon, authenticated;
