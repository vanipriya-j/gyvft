-- Private proposal drafts and revocable GPT connections. No data deletion or backfill.
ALTER TABLE gyvft_gift_options ADD COLUMN IF NOT EXISTS draft_version integer NOT NULL DEFAULT 1 CHECK (draft_version > 0);
ALTER TABLE gyvft_gift_options ADD COLUMN IF NOT EXISTS draft_revision_key uuid;
ALTER TABLE gyvft_gift_options ADD COLUMN IF NOT EXISTS draft_revision_hash text;
ALTER TABLE gyvft_gift_options ALTER COLUMN image_data DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='gyvft_gift_options'::regclass AND conname='gyvft_published_option_cover') THEN
    ALTER TABLE gyvft_gift_options ADD CONSTRAINT gyvft_published_option_cover CHECK (NOT published OR image_data IS NOT NULL);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS gyvft_gift_option_draft_versions (
  option_id uuid NOT NULL REFERENCES gyvft_gift_options(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  document jsonb NOT NULL CHECK (jsonb_typeof(document)='object'),
  revision_key uuid NOT NULL UNIQUE,
  input_hash text NOT NULL,
  source text NOT NULL CHECK (source IN ('operations','mcp')),
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (option_id,version)
);
CREATE TABLE IF NOT EXISTS gyvft_mcp_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO gyvft_mcp_settings(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS gyvft_mcp_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  resource text NOT NULL,
  scopes text[] NOT NULL,
  code_challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  refresh_hash text UNIQUE,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE gyvft_gift_option_draft_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_mcp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyvft_mcp_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gyvft_gift_option_draft_versions,gyvft_mcp_settings,gyvft_mcp_grants FROM anon,authenticated;
