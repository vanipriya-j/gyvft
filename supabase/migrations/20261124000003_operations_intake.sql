-- Operations-assisted customer onboarding and private requirement attachments.
-- Adds new tables only. No existing customer or gift record is changed or deleted.
CREATE TABLE IF NOT EXISTS gyvft_operations_intakes (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES gyvft_customer_accounts(id),
  project_id uuid UNIQUE REFERENCES customer_projects(id),
  created_account boolean NOT NULL DEFAULT false,
  input_hash text NOT NULL CHECK (length(input_hash)=64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gyvft_operations_intakes_account_idx ON gyvft_operations_intakes(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS gyvft_operations_created_account_idx ON gyvft_operations_intakes(account_id) WHERE created_account;
CREATE TABLE IF NOT EXISTS gyvft_requirement_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES customer_projects(id),
  filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 160),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/png','image/jpeg','image/webp')),
  file_data bytea NOT NULL CHECK (octet_length(file_data) BETWEEN 12 AND 2097152),
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,position)
);
CREATE TABLE IF NOT EXISTS gyvft_customer_setup_emails (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES gyvft_customer_accounts(id),
  token_hash text NOT NULL UNIQUE REFERENCES gyvft_customer_password_resets(token_hash),
  token_ciphertext text NOT NULL,
  recipient text NOT NULL,
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','sent','failed')),
  attempted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gyvft_customer_setup_emails_account_idx ON gyvft_customer_setup_emails(account_id);
ALTER TABLE gyvft_operations_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_requirement_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_customer_setup_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_operations_intakes,gyvft_requirement_attachments,gyvft_customer_setup_emails FROM anon,authenticated;
