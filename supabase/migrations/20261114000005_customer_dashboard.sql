-- Private customer planning, collected after the existing enquiry form.
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS occasion_date date;
ALTER TABLE customer_projects ADD COLUMN IF NOT EXISTS delivery_date date;
CREATE TABLE IF NOT EXISTS gyvft_customer_occasions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES gyvft_customer_accounts(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 160),
 occasion_date date NOT NULL,
 repeats_annually boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,title,occasion_date,repeats_annually)
);
CREATE INDEX IF NOT EXISTS gyvft_customer_occasions_owner_date_idx ON gyvft_customer_occasions(account_id, occasion_date);
CREATE TABLE IF NOT EXISTS gyvft_customer_saved_ideas (
 account_id uuid NOT NULL REFERENCES gyvft_customer_accounts(id) ON DELETE CASCADE,
 story_slug text NOT NULL CHECK (char_length(story_slug) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id, story_slug)
);
ALTER TABLE gyvft_customer_occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_customer_saved_ideas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_customer_occasions, gyvft_customer_saved_ideas FROM anon, authenticated;

-- Dates only for the exact fictional fixtures. Never infer dates for real requests.
UPDATE customer_projects p SET occasion_date = current_date + demo.days,
 delivery_date = current_date + demo.days - 2
FROM (VALUES
 ('d3e00000-0000-4000-8000-000000000001'::uuid,'gyvft-demo-v1-received',14),
 ('d3e00000-0000-4000-8000-000000000002'::uuid,'gyvft-demo-v1-review',30),
 ('d3e00000-0000-4000-8000-000000000003'::uuid,'gyvft-demo-v1-accepted',45)
) AS demo(id,submission_key,days)
WHERE p.id=demo.id AND p.submission_key=demo.submission_key
 AND p.customer_email='aarla@aarla.in' AND p.occasion_date IS NULL AND p.delivery_date IS NULL;
