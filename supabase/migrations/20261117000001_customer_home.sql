-- Add only the missing saved-product capability. Keep existing saved stories,
-- private occasions and transactional records as their sources of truth.
CREATE TABLE IF NOT EXISTS gyvft_customer_saved_products (
 account_id uuid NOT NULL REFERENCES gyvft_customer_accounts(id) ON DELETE CASCADE,
 product_id text NOT NULL CHECK(product_id ~ '^[0-9]{1,30}$'),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND snapshot ?& ARRAY['title','image','href']),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,product_id)
);
ALTER TABLE gyvft_customer_saved_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_customer_saved_products FROM anon,authenticated;
CREATE INDEX IF NOT EXISTS gyvft_customer_saved_products_recent ON gyvft_customer_saved_products(account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS customer_projects_owner_active ON customer_projects(customer_account_id,delivery_date,created_at DESC) WHERE stage<10;
CREATE INDEX IF NOT EXISTS customer_payments_verified ON customer_payment_submissions(project_id,verified_at DESC) WHERE status='verified';
CREATE INDEX IF NOT EXISTS customer_payments_pending ON customer_payment_submissions(project_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS customer_approvals_latest ON customer_project_approvals(project_id,kind,version DESC);
