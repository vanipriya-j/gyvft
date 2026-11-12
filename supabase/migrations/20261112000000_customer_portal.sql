-- Customer-facing projection only. Never copy private CRM notes here.
CREATE TABLE IF NOT EXISTS customer_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 submission_key text UNIQUE,
 external_lead_id text,
 customer_email text NOT NULL CHECK (customer_email = lower(trim(customer_email))),
 title text NOT NULL,
 brief text NOT NULL DEFAULT '',
 kind text NOT NULL DEFAULT 'enquiry' CHECK (kind IN ('enquiry','project')),
 customer_type text CHECK (customer_type IN ('b2b','b2c')),
 organisation_name text,
 stage integer NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 11),
 next_action text NOT NULL DEFAULT 'Our team will get in touch to understand your story.',
 target_date date,
 total_paise bigint CHECK (total_paise >= 0),
 paid_paise bigint NOT NULL DEFAULT 0 CHECK (paid_paise >= 0),
 razorpay_url text,
 upi_id text,
 shopify_order_reference text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_projects_email_idx ON customer_projects(customer_email);
CREATE TABLE IF NOT EXISTS customer_project_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 title text NOT NULL,
 body text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customer_project_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 sender text NOT NULL CHECK (sender IN ('customer','team')),
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customer_payment_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 amount_paise bigint NOT NULL CHECK (amount_paise > 0),
 reference text NOT NULL CHECK (char_length(reference) BETWEEN 6 AND 100),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id, reference)
);
-- All customer operations go through authenticated server code with explicit
-- verified-email ownership checks. No direct browser table access is granted.
ALTER TABLE customer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payment_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON customer_projects, customer_project_events, customer_project_messages, customer_payment_submissions FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS customer_project_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES customer_projects(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('proposal','design')),
 version integer NOT NULL CHECK (version > 0),
 title text NOT NULL,
 description text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested')),
 customer_response text,
 decided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id, kind, version)
);
ALTER TABLE customer_project_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON customer_project_approvals FROM anon, authenticated;
