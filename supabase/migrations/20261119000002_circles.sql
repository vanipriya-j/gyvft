-- Proposed additive Circles schema. Production execution requires owner approval.
-- No existing customer rows are updated, deleted, truncated or replaced.
CREATE TABLE IF NOT EXISTS public.gyvft_circles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(char_length(name) BETWEEN 2 AND 120),
 category text NOT NULL CHECK(category IN ('family','friends','corporate','school','college','alumni','community','other')),
 description text NOT NULL DEFAULT '',owner_account_id uuid NOT NULL REFERENCES public.gyvft_customer_accounts(id),
 is_demo boolean NOT NULL DEFAULT false,archived_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gyvft_circle_members (
 circle_id uuid NOT NULL REFERENCES public.gyvft_circles(id),account_id uuid NOT NULL REFERENCES public.gyvft_customer_accounts(id),
 role text NOT NULL CHECK(role IN ('admin','member')),state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','left','removed')),
 display_name text NOT NULL CHECK(char_length(display_name) BETWEEN 2 AND 120),share_profile boolean NOT NULL DEFAULT false,
 joined_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(circle_id,account_id)
);
CREATE INDEX IF NOT EXISTS gyvft_circle_members_account ON public.gyvft_circle_members(account_id,state);
-- The institutional circle represents the organisation; no separate organisation login.
CREATE TABLE IF NOT EXISTS public.gyvft_circle_organisations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),circle_id uuid NOT NULL UNIQUE REFERENCES public.gyvft_circles(id),
 name text NOT NULL,website text NOT NULL,domain text NOT NULL,
 verification_state text NOT NULL DEFAULT 'unverified' CHECK(verification_state IN ('unverified','verified','needs_review')),
 verification_note text NOT NULL DEFAULT '',verified_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gyvft_circle_recipients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),circle_id uuid NOT NULL REFERENCES public.gyvft_circles(id),name text NOT NULL,
 email text NOT NULL DEFAULT '' CHECK(email=lower(trim(email))),about text NOT NULL DEFAULT '',likes text NOT NULL DEFAULT '',avoid text NOT NULL DEFAULT '',
 linked_account_id uuid REFERENCES public.gyvft_customer_accounts(id),created_by uuid NOT NULL REFERENCES public.gyvft_customer_accounts(id),
 archived_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gyvft_circle_recipient_email ON public.gyvft_circle_recipients(circle_id,email) WHERE email<>'' AND archived_at IS NULL;
CREATE TABLE IF NOT EXISTS public.gyvft_circle_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),circle_id uuid NOT NULL REFERENCES public.gyvft_circles(id),
 email text NOT NULL CHECK(email=lower(trim(email))),display_name text NOT NULL,role text NOT NULL CHECK(role IN ('admin','member')),
 token_hash text NOT NULL UNIQUE,invited_by uuid NOT NULL REFERENCES public.gyvft_customer_accounts(id),
 recipient_id uuid REFERENCES public.gyvft_circle_recipients(id),expires_at timestamptz NOT NULL,
 accepted_at timestamptz,accepted_by uuid REFERENCES public.gyvft_customer_accounts(id),revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gyvft_circle_pending_email ON public.gyvft_circle_invitations(circle_id,email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS public.gyvft_circle_occasions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),circle_id uuid NOT NULL REFERENCES public.gyvft_circles(id),title text NOT NULL,
 occasion_date date NOT NULL,repeats_annually boolean NOT NULL DEFAULT false,description text NOT NULL DEFAULT '',
 created_by uuid NOT NULL REFERENCES public.gyvft_customer_accounts(id),archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,circle_id)
);
CREATE TABLE IF NOT EXISTS public.gyvft_circle_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),circle_id uuid NOT NULL REFERENCES public.gyvft_circles(id),
 actor_account_id uuid REFERENCES public.gyvft_customer_accounts(id),operation text NOT NULL,subject_id uuid,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_projects ADD COLUMN IF NOT EXISTS circle_id uuid REFERENCES public.gyvft_circles(id);
ALTER TABLE public.customer_projects ADD COLUMN IF NOT EXISTS circle_occasion_id uuid;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.customer_projects'::regclass AND conname='customer_projects_circle_occasion_fk') THEN
  ALTER TABLE public.customer_projects ADD CONSTRAINT customer_projects_circle_occasion_fk FOREIGN KEY(circle_occasion_id,circle_id) REFERENCES public.gyvft_circle_occasions(id,circle_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.customer_projects'::regclass AND conname='customer_projects_circle_context_check') THEN
  ALTER TABLE public.customer_projects ADD CONSTRAINT customer_projects_circle_context_check CHECK(circle_occasion_id IS NULL OR circle_id IS NOT NULL);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS gyvft_gifts_circle_context ON public.customer_projects(circle_id,customer_account_id);
CREATE INDEX IF NOT EXISTS gyvft_circle_occasions_circle ON public.gyvft_circle_occasions(circle_id,occasion_date);
ALTER TABLE public.gyvft_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyvft_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyvft_circle_organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyvft_circle_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyvft_circle_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyvft_circle_occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyvft_circle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gyvft_circles,public.gyvft_circle_members,public.gyvft_circle_organisations,public.gyvft_circle_recipients,public.gyvft_circle_invitations,public.gyvft_circle_occasions,public.gyvft_circle_events FROM anon,authenticated;
