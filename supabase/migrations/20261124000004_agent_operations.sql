-- Explicitly approved agent/Operations actions. New private records only.
-- No existing customer, approval, payment or order data is changed or deleted.
CREATE TABLE IF NOT EXISTS gyvft_agent_commands (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES customer_projects(id),
  operation text NOT NULL,
  input_hash text NOT NULL CHECK(length(input_hash)=64),
  actor_id uuid,
  result jsonb CHECK(result IS NULL OR jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS gyvft_offline_approvals (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES customer_projects(id),
  approval_id uuid NOT NULL UNIQUE REFERENCES customer_project_approvals(id),
  approval_version integer NOT NULL CHECK(approval_version>0),
  channel text NOT NULL CHECK(channel IN ('whatsapp','email','in_person','phone','other')),
  customer_approved_at timestamptz,
  note text NOT NULL CHECK(char_length(note) BETWEEN 1 AND 2000),
  recorded_by text NOT NULL CHECK(char_length(recorded_by) BETWEEN 2 AND 120),
  source text NOT NULL CHECK(source IN ('operations','mcp')),
  actor_id uuid,
  input_hash text NOT NULL CHECK(length(input_hash)=64),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gyvft_offline_approval_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offline_approval_id uuid NOT NULL REFERENCES gyvft_offline_approvals(id),
  image_data bytea NOT NULL CHECK(octet_length(image_data) BETWEEN 12 AND 2097152),
  image_type text NOT NULL CHECK(image_type IN ('image/png','image/jpeg','image/webp')),
  position smallint NOT NULL CHECK(position BETWEEN 1 AND 3),
  UNIQUE(offline_approval_id,position)
);
CREATE TABLE IF NOT EXISTS gyvft_payment_requests (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES customer_projects(id),
  approval_id uuid NOT NULL REFERENCES customer_project_approvals(id),
  approval_version integer NOT NULL CHECK(approval_version>0),
  phase text NOT NULL CHECK(phase IN ('advance','balance')),
  amount_paise bigint NOT NULL CHECK(amount_paise>0),
  paid_paise bigint NOT NULL CHECK(paid_paise>=0),
  total_paise bigint NOT NULL CHECK(total_paise>0),
  input_hash text NOT NULL CHECK(length(input_hash)=64),
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gyvft_agent_commands_project_idx ON gyvft_agent_commands(project_id,created_at);
CREATE INDEX IF NOT EXISTS gyvft_offline_approvals_project_idx ON gyvft_offline_approvals(project_id,recorded_at);
CREATE INDEX IF NOT EXISTS gyvft_payment_requests_project_idx ON gyvft_payment_requests(project_id,created_at);
ALTER TABLE gyvft_agent_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_offline_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_offline_approval_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_agent_commands,gyvft_offline_approvals,gyvft_offline_approval_files,gyvft_payment_requests FROM anon,authenticated;
