-- Small, namespaced operational event stream. Never store request payloads,
-- passwords, session/reset tokens, raw IP addresses or customer email here.
CREATE TABLE IF NOT EXISTS gyvft_customer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'account.created', 'session.started', 'session.failed', 'enquiry.created',
    'message.sent', 'app.error', 'setup.completed', 'setup.failed'
  )),
  account_id uuid REFERENCES gyvft_customer_accounts(id) ON DELETE SET NULL,
  request_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gyvft_customer_events_time_idx ON gyvft_customer_events(created_at DESC);
CREATE INDEX IF NOT EXISTS gyvft_customer_events_type_time_idx ON gyvft_customer_events(event_type, created_at DESC);
ALTER TABLE gyvft_customer_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_customer_events FROM anon, authenticated;
