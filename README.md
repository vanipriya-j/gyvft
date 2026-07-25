# GYVFT

**GYVFT - Your story. Our telling.**

GYVFT is a Next.js application for public story-led lead capture and an authenticated internal Studio for managing opportunities, contacts, organisations, campaigns, landing pages, tasks, integrations, tracking, consent, and security settings.

## 1. Product architecture

### Public site

Public routes live under `src/app/(public)` and include:

- `/` - brand landing page.
- `/tell-your-story` - story opportunity capture.
- `/for-organisations` - organisation-facing public page.
- `/become-a-merch-partner` - merch partnership capture.
- `/upload-a-brief` - brief metadata and file upload capture.
- `/book-a-discovery` - discovery conversation request.
- `/l/[slug]` - published campaign landing pages.
- `/privacy`, `/cookies`, `/terms`, `/thank-you`.

Public form actions validate with Zod, create or match CRM records, and create opportunities. Lead capture is designed to fail open for secondary integrations: the lead is preserved even if AI, email, Meta CAPI, storage, or webhooks fail.

### Authentication

Studio auth uses Supabase Auth through `@supabase/ssr`:

- `/studio/login`
- `/studio/forgot-password`
- `/studio/reset-password`

`src/middleware.ts` protects `/studio` routes and redirects unauthenticated users to `/studio/login?next=...`. The app exposes no public signup page.

### GYVFT Studio

Authenticated Studio routes live under `src/app/studio`:

- Dashboard, opportunities, contacts, organisations, tasks.
- Analytics and event views.
- Campaign and landing-page management.
- Integration configuration and integration logs.
- Workspace, user, security, and consent settings.

Roles are `owner`, `admin`, and `contributor`. Owners can manage users, secrets, and security settings. Admins can manage most integrations and tracking rules but cannot edit owner-only secrets. Contributors have operational access scoped by RLS and app role checks.

### Service boundaries

The application keeps side effects behind service modules:

- `src/services/opportunities/lead-capture.ts` - form submission orchestration.
- `src/services/email/send.ts` - Resend transactional email.
- `src/services/ai/summary.ts` - OpenAI opportunity summary generation.
- `src/services/meta/conversions.ts` - Meta Conversions API events.
- `src/services/storage/briefs.ts` - Supabase Storage uploads and signed URLs.
- `src/services/webhooks/dispatch.ts` - outgoing webhook delivery and signing.
- `src/services/integrations/logs.ts` - integration log writes.

Database access is centralised in `src/lib/database/client.ts` and repository modules under `src/repositories`.

## 2. Repository structure

```text
src/app/                 Next.js App Router pages, layouts, API routes, middleware-facing UI
src/actions/             Server actions for public forms and Studio workflows
src/components/          Public, Studio, analytics, consent, and UI components
src/config/              Runtime env schema and constants
src/hooks/               Browser hooks for consent and attribution
src/lib/                 Database, auth, Supabase, encryption, validation, logging, utilities
src/repositories/        Database query layer
src/services/            Integration and product service boundaries
src/types/               Domain types
supabase/migrations/     SQL schema, local auth stub, and RLS policies
scripts/                 Migration, owner creation, dev seed/reset scripts
```

## 3. Local setup

Prerequisites:

- Node.js 22+
- npm
- PostgreSQL

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

For local Postgres, create a database and set `DATABASE_URL` in `.env.local`, for example:

```env
DATABASE_URL=postgresql://gyvft:gyvft_dev@127.0.0.1:5432/gyvft
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
IS_PRODUCTION=false
```

Apply migrations:

```bash
npm run db:migrate
```

Create the initial owner profile:

```bash
npm run create-owner -- --email=owner@example.com
```

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## 4. Supabase setup

GYVFT uses Supabase for Auth and Storage. The app also connects directly to Postgres through `DATABASE_URL`.

1. Create a Supabase project.
2. Set these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...` from Settings → API Keys)
   - `SUPABASE_SECRET_KEY` (`sb_secret_...` from Settings → API Keys)
   - `DATABASE_URL` (Session Pooler URI recommended for Vercel)
   - Legacy fallback only: `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
3. In Supabase Auth settings:
   - Set the Site URL to the production app URL, for example `https://gyvft.com`.
   - Add redirect URLs:
     - `https://gyvft.com/studio/reset-password`
     - `https://gyvft.com/studio/login`
     - Local equivalents during development, for example `http://localhost:3000/studio/reset-password`.
   - Disable public signup. Studio access should be invitation/admin controlled.
4. Create / verify the private Storage bucket:
   - Bucket name: `opportunity-briefs`
   - Public access: disabled/private
   - Migration `20260725000003_storage.sql` attempts to create this bucket when the Supabase `storage` schema exists; still verify it in the Dashboard.

### Supabase API keys (publishable / secret)

Supabase deprecated the legacy JWT `anon` and `service_role` keys. This app prefers:

| Role | Env var | Dashboard value |
| --- | --- | --- |
| Public / Auth client | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| Server admin / Storage | `SUPABASE_SECRET_KEY` | `sb_secret_...` |

Find them under **Project Settings → API Keys → Publishable and secret API keys**. Newer projects may only expose these keys.

Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` still work as temporary fallbacks if the new keys are unset, but new deployments should not use them.

## 5. Database migrations

Run:

```bash
npm run db:migrate
```

`scripts/migrate.ts`:

- Loads `.env.local` and `.env`.
- Requires `DATABASE_URL`.
- Creates `schema_migrations` if needed.
- Applies SQL files in `supabase/migrations` in sorted order.
- Records applied filenames to avoid re-running migrations.

Current migrations:

- `20260725000000_local_auth_stub.sql` - local `auth.uid()` and role stubs for non-Supabase local Postgres.
- `20260725000001_init.sql` - schema, indexes, triggers, default integration definitions, tracking rules, form configurations, workspace settings, and consent version.
- `20260725000002_rls.sql` - RLS helper functions and policies.

## 6. RLS policies overview

RLS is enabled across the application tables.

Important policy boundaries:

- Public lead creation is performed server-side by trusted application code. Anonymous users cannot read opportunities, submissions, files, or integration secrets.
- Published landing pages and enabled form configurations are readable by `anon`.
- Active Studio users can read operational CRM data according to role.
- Owners/admins can see most operational records; contributors are scoped for opportunities and tasks they are assigned to, plus shared operational data where policies allow it.
- Integration definitions and logs are owner/admin visible.
- Integration secrets and webhook secrets are owner-only for authenticated access; trusted server-side runtime code reads ciphertext for integration use.
- Files are authenticated-only in database policy and stored in a private bucket.
- Audit and auth-attempt logs are restricted to owner/admin or owner depending on table.

The service role key bypasses RLS. Keep it server-only.

## 7. Authentication setup

The app has no public signup flow. Configure Supabase Auth so only invited/admin-created users can authenticate.

Routes:

- `/studio/login` - email/password sign-in.
- `/studio/forgot-password` - sends a Supabase password reset email.
- `/studio/reset-password` - sets a new password after the Supabase recovery redirect.

Initial owner creation is handled by `npm run create-owner`. Additional users currently rely on the auth system/admin process and profile records; the Studio Users page manages role and active status for existing profiles.

## 8. Initial Owner creation

Run:

```bash
npm run create-owner -- --email=owner@example.com
```

Optional name:

```bash
npm run create-owner -- --email=owner@example.com --name="Owner Name"
```

Behavior:

- Requires `DATABASE_URL`.
- If Supabase Auth is configured, creates a confirmed Auth user with a generated temporary password or falls back to a Supabase invitation.
- Inserts or updates the matching `profiles` row with role `owner`.
- Sets `workspace_settings.default_opportunity_owner_id`.
- Writes an `owner.created` audit log.
- Never prints the generated password. Use the invitation email or `/studio/forgot-password` to set credentials.

If Supabase Auth is not configured, the script creates a local profile ID only. That is useful for local development, not production authentication.

## 9. Resend setup

Resend is used by `src/services/email/send.ts` for transactional acknowledgements and internal opportunity notifications. The renderer also contains templates for assignments, invitation copy, and test emails.

Configuration options:

- Environment fallback:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `RESEND_FROM_NAME`
- Studio-managed encrypted secret:
  - Provider: `resend`
  - Secret: `api_key`
  - Config fields: `from_email`, `from_name`

Production checklist:

1. Verify the sending domain in Resend.
2. Set SPF, DKIM, and DMARC.
3. Configure `RESEND_FROM_EMAIL` or Studio `from_email` to use the verified domain.
4. Enable the `resend` integration in Studio.
5. Monitor `/studio/integration-logs` and `email_deliveries`.

If Resend is not configured, email sends are logged as failed and the lead capture path continues where the email is a secondary effect.

## 10. Meta Pixel and Conversions API setup

Browser Pixel:

- Set `NEXT_PUBLIC_META_PIXEL_ID`.
- Pixel loads only in the public layout and only after advertising consent.
- Current browser loader initializes the Pixel and sends `PageView`.

Conversions API:

- Environment fallback:
  - `META_ACCESS_TOKEN`
  - `META_DATASET_ID`
- Studio-managed encrypted secret:
  - Provider: `meta_capi`
  - Secret: `access_token`
  - Config fields: `dataset_id`, optional `api_version`, optional `test_event_code`, optional `server_events_enabled`

Server events are sent by `src/services/meta/conversions.ts` when:

- Advertising consent is present.
- The tracking rule enables Meta server delivery.
- Meta CAPI is configured and enabled.

Event ID deduplication:

- Lead capture generates an `eventId` and passes it to Meta CAPI as `event_id`.
- If browser-side conversion events are added beyond the current `PageView`, send the same `event_id` to `fbq` and CAPI for Meta deduplication.
- Do not generate separate browser and server IDs for the same conversion.

Failures are written to `integration_logs` with `next_retry_at`; see the retry section for current limitations.

## 11. GTM / GA4 setup

Set one or both public variables:

- `NEXT_PUBLIC_GTM_ID`
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`

Current behavior:

- GTM loads only after analytics consent.
- GA4 loads only after analytics consent and configures `anonymize_ip`.
- Public events are recorded internally through `/api/events`.
- The database has tracking-rule flags for GA4 and browser destinations; the current client implementation loads the tags but does not yet push every internal public event into `dataLayer`/`gtag`.

For production, configure GTM/GA4 containers to respect consent mode and avoid collecting form PII.

## 12. Clarity setup

Set:

```env
NEXT_PUBLIC_CLARITY_PROJECT_ID=...
```

Current behavior:

- Clarity loads only after analytics consent.
- Clarity is mounted in `src/app/(public)/layout.tsx`, so Studio routes are excluded by application structure.

Production configuration:

- In Microsoft Clarity, mask all form inputs and text areas.
- Exclude `/studio/*` in the Clarity project settings as a defense-in-depth rule.
- Do not record uploaded brief contents or private Studio pages.

## 13. Consent setup

Consent is implemented through:

- `src/components/consent/ConsentBanner.tsx`
- `src/lib/consent/client.ts`
- `src/hooks/use-consent.ts`
- Studio consent settings under `/studio/settings/consent`

Current behavior:

- Necessary storage is always enabled.
- Analytics and advertising default to false.
- Consent is stored in browser `localStorage` under `gyvft.consent.v1`.
- Public tracking tags load only after the relevant consent category is true.
- Public form submissions include a consent snapshot.
- Migrations create `consent_versions` and `consent_records`; the current banner stores consent client-side and does not yet persist every banner choice to `consent_records`.

Use Studio to manage consent copy, privacy/cookie URLs, active consent version, default region behavior, and retention days.

## 14. OpenAI setup

OpenAI is used for opportunity summaries after story and partner submissions.

Configuration options:

- Environment fallback: `OPENAI_API_KEY`
- Studio-managed encrypted secret:
  - Provider: `openai`
  - Secret: `api_key`
  - Config fields: `model`, optional `summary_generation_enabled`

Allowed models are defined in `src/config/constants.ts`:

- `gpt-4o-mini`
- `gpt-4o`
- `gpt-4.1-mini`
- `gpt-4.1`

If a configured model is not in the allowlist, the service falls back to `gpt-4o-mini`.

Lead capture is fail-open for AI: summaries are generated after the opportunity is created. AI failure updates `ai_summary_status`, writes an integration log, and does not reject the public submission.

The AI service strips direct personal identifiers from the summary payload where possible before sending to OpenAI.

## 15. Secret encryption and precedence

Studio-managed integration secrets use AES-256-GCM in `src/lib/encryption/secrets.ts`.

Required for Studio-managed secrets:

```env
INTEGRATION_ENCRYPTION_KEY=replace_with_a_long_random_secret_key_32+
```

The key must be at least 32 characters. The implementation uses the first 32 bytes as the AES-256 key.

Secret precedence:

1. Studio encrypted secret in `integration_secrets`.
2. Environment fallback.

Implemented fallback mappings:

- `resend` -> `RESEND_API_KEY`
- `openai` -> `OPENAI_API_KEY`
- `meta_capi` -> `META_ACCESS_TOKEN`

Encrypted secret values are not displayed in Studio; only metadata such as last four characters is shown.

## 16. Webhook signing

Outgoing webhooks are dispatched by `src/services/webhooks/dispatch.ts`.

Signing algorithm:

```text
signature = hex(hmac_sha256(signing_secret, timestamp + "." + raw_body))
```

Headers:

- `X-GYVFT-Timestamp` - Unix timestamp in seconds.
- `X-GYVFT-Signature` - hex HMAC SHA-256 signature.
- `X-GYVFT-Event` - event name.

Payload shape:

```json
{
  "id": "event-delivery-id",
  "event": "opportunity.created",
  "created_at": "2026-07-25T00:00:00.000Z",
  "data": {}
}
```

Consumers should verify the timestamp freshness and recompute the HMAC over `timestamp.body` using the raw request body.

Supported webhook event names are defined in `WEBHOOK_EVENTS` in `src/config/constants.ts`.

## 17. Storage setup

Brief uploads use Supabase Storage.

Required setup:

- Bucket: `opportunity-briefs`
- Visibility: private
- Runtime key: `SUPABASE_SECRET_KEY` (legacy fallback: `SUPABASE_SERVICE_ROLE_KEY`)

Allowed brief file types:

- PDF
- DOCX
- PNG
- JPEG/JPG
- WebP

Default max upload size is `10,485,760` bytes and can be configured with `MAX_UPLOAD_BYTES` or Studio security settings.

Signed URLs:

- Created by `createSignedBriefUrl`.
- Expire after 5 minutes (`SIGNED_URL_EXPIRES_SECONDS = 300`).
- Use the service role client and the private bucket.

The malware scanning hook is currently a boundary placeholder and returns `pending`; wire a real scanning provider before treating `scan_status` as authoritative in production.

## 18. Testing

Scripts:

```bash
npm run lint
npm run typecheck
npm test
npm run test:watch
npm run test:e2e
```

Current repository state:

- Vitest is configured as the unit test runner by script, but there are no `*.test.ts`/`*.spec.ts` files in the repo at the time of writing.
- Playwright is installed and `npm run test:e2e` is defined, but no Playwright config or e2e specs are currently present.

Recommended coverage:

- Unit tests for validation schemas, utility functions, and secret/webhook signing.
- Integration tests against a disposable Postgres database for lead capture, migrations, and repositories.
- E2E tests for public form submission, auth redirect, Studio login, opportunity review, and integration settings.

## 19. Development seed and reset

Seed fictional local data:

```bash
npm run seed:dev
```

Reset local database and reapply migrations:

```bash
npm run reset:dev
```

Production guards:

- `seed:dev` refuses to run when `IS_PRODUCTION=true`, `NODE_ENV=production`, or `workspace_settings.production_mode` is true.
- `reset:dev` refuses to run when `IS_PRODUCTION=true` or `NODE_ENV=production`.
- `reset:dev` also refuses any `DATABASE_URL` that does not include `localhost` or `127.0.0.1`.

`seed:dev` requires an owner profile first:

```bash
npm run create-owner -- --email=owner@example.com
npm run seed:dev
```

## 20. Deployment: Vercel and domains

Recommended Vercel setup:

1. Create a Vercel project for this repository.
2. Use Node.js 22+.
3. Set all required environment variables in Vercel.
4. Set `NEXT_PUBLIC_APP_URL` to the production domain.
5. Deploy.
6. Run migrations against the production `DATABASE_URL` from a trusted environment:
   ```bash
   npm run db:migrate
   ```
7. Create the initial owner:
   ```bash
   npm run create-owner -- --email=owner@example.com
   ```
8. Configure Supabase Auth Site URL and redirect URLs for the final domain.
9. Configure DNS for the primary domain and any `www` redirect/canonical preference in Vercel.
10. Verify public pages, Studio login, password reset, lead capture, file upload, and integration logs.

Do not expose server-only variables with a `NEXT_PUBLIC_` prefix.

## 21. Environment variables

From `.env.example`:

| Variable | Required | Scope | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Public | Canonical app URL used by metadata and redirects. |
| `NODE_ENV` | Yes | Server | `development`, `test`, or `production`. |
| `IS_PRODUCTION` | Recommended | Server | Extra production guard. `true`/`1` enables production checks. |
| `DATABASE_URL` | Yes | Server | Postgres connection string for migrations and runtime database access. |
| `NEXT_PUBLIC_SUPABASE_URL` | Production yes | Public | Supabase project URL. Required for Auth and browser Supabase client. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production yes | Public | Supabase publishable key (`sb_publishable_...`). Required for Auth/browser client. |
| `SUPABASE_SECRET_KEY` | Production yes | Server | Supabase secret key (`sb_secret_...`) for owner creation, storage, and admin operations. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy fallback | Public | Deprecated JWT anon key. Used only if publishable key is unset. |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy fallback | Server | Deprecated JWT service_role key. Used only if secret key is unset. |
| `INTEGRATION_ENCRYPTION_KEY` | Required for Studio secrets | Server | At least 32 characters. Encrypts Studio-managed integration secrets. |
| `RESEND_API_KEY` | Optional fallback | Server | Resend API key when no Studio encrypted secret exists. |
| `RESEND_FROM_EMAIL` | Recommended | Server | Default sending address. |
| `RESEND_FROM_NAME` | Recommended | Server | Default sending name. |
| `OPENAI_API_KEY` | Optional fallback | Server | OpenAI API key when no Studio encrypted secret exists. |
| `META_ACCESS_TOKEN` | Optional fallback | Server | Meta CAPI access token when no Studio encrypted secret exists. |
| `META_DATASET_ID` | Optional fallback | Server | Meta dataset/pixel ID for CAPI. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Optional | Public | Browser Meta Pixel ID. |
| `NEXT_PUBLIC_GTM_ID` | Optional | Public | Google Tag Manager container ID. |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Optional | Public | GA4 measurement ID. |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Optional | Public | Microsoft Clarity project ID. |
| `MAX_UPLOAD_BYTES` | Optional | Server | Max brief upload size. Defaults to `10485760`. |
| `DEFAULT_CURRENCY` | Optional | Server | ISO currency code. Defaults to `INR`. |
| `CRON_SECRET` | Optional | Server | Reserved for cron endpoints. Must be at least 16 characters if set. |

## 22. Troubleshooting

### `DATABASE_URL is required`

Set `DATABASE_URL` in `.env.local` for local development or in the deployment environment for production.

### `Invalid environment configuration`

`src/config/env.ts` validates environment variables with Zod. Check URL formats, email format for `RESEND_FROM_EMAIL`, minimum lengths, and numeric values.

### Studio redirects back to login

Check:

- Supabase URL and anon key.
- Supabase Auth Site URL and redirect URLs.
- Browser cookies.
- Matching `profiles.id` for the authenticated Supabase user.
- `profiles.is_active = true` and `deleted_at IS NULL`.

### Owner created but cannot sign in

The owner script never prints the password. Use the invitation email if sent, or `/studio/forgot-password` to set a password.

### File upload creates an opportunity but no file appears

Check:

- `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`)
- Private bucket `opportunity-briefs`
- File extension, MIME type, and size
- `/studio/integration-logs` for `supabase_storage` failures

The current upload flow preserves the lead even when storage fails.

### Resend/OpenAI/Meta failures

Check `/studio/integration-logs`, provider status in `/studio/integrations`, encrypted secret configuration, and environment fallbacks.

### `reset:dev` refuses to run

This is expected unless `DATABASE_URL` points to `localhost` or `127.0.0.1` and production flags are off.

### RLS denies expected reads

Confirm the session user has a matching active `profiles` row and the correct role. Remember that direct database clients without Supabase JWT claims will not behave like authenticated Studio sessions.

## 23. Security checklist: production

- Disable public signup in Supabase Auth.
- Configure Auth Site URL and reset redirect URLs.
- Keep `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `META_ACCESS_TOKEN`, `INTEGRATION_ENCRYPTION_KEY`, and `CRON_SECRET` server-only.
- Use a high-entropy `INTEGRATION_ENCRYPTION_KEY` of at least 32 characters.
- Create `opportunity-briefs` as a private bucket.
- Verify RLS migrations are applied.
- Create exactly the required owner/admin users.
- Set `IS_PRODUCTION=true` and `NODE_ENV=production`.
- Turn on Studio Security `production_mode`.
- Verify Resend domain authentication.
- Configure Clarity masking and exclude `/studio/*`.
- Verify consent gating for analytics and advertising tags.
- Verify webhook consumers validate `X-GYVFT-*` signatures.
- Review integration logs after first production submissions.
- Keep dependency and platform security updates current.

## 24. Data-retention considerations

The schema stores operational CRM data, form submissions, analytics events, attribution, consent versions, email delivery records, integration logs, audit logs, auth attempt logs, files metadata, and private storage objects.

Current retention support:

- `workspace_settings.consent_retention_days` exists and is editable in Studio.
- Soft deletes exist on many operational tables through `deleted_at`.
- Signed brief URLs expire after 5 minutes.

Current gaps to plan for production:

- No automated purge job is present in this repo.
- No automated storage-object retention worker is present.
- No automated anonymisation job is present for analytics or attribution.

Before production launch, define retention periods for leads, submissions, analytics, audit logs, email logs, integration logs, and uploaded briefs. Implement scheduled deletion/anonymisation where required by policy or law.

## 25. Integration failure handling and retry

Lead capture separates primary writes from secondary effects:

- Primary: contact/organisation/opportunity/submission/activity/task writes.
- Secondary: internal analytics event, AI summary, acknowledgement email, internal email, Meta CAPI, webhooks, and storage.

Secondary failures are caught, logged, and returned internally without rejecting successful public lead capture where implemented.

Current retry behavior:

- Email failures set `email_deliveries.status = failed` and `next_retry_at = now + 15 minutes`.
- Meta CAPI failures write `integration_logs.next_retry_at = now + 15 minutes`.
- Webhook failures set `webhook_deliveries.next_retry_at` with exponential backoff up to 60 minutes and increment `attempt_number` until `max_attempts`.
- Storage failures write integration logs and preserve the opportunity.

Scheduled retry processors:

- `vercel.json` defines two Vercel Cron Jobs:
  - `/api/cron/webhooks` daily at 03:00 UTC
  - `/api/cron/email-retries` daily at 03:15 UTC
- These schedules are Hobby-plan compatible (once per day). On Pro you can increase frequency later.
- Both endpoints require `Authorization: Bearer $CRON_SECRET`.

## First-run production setup flow

1. Create the Supabase project and copy the project URL, publishable key (`sb_publishable_...`), secret key (`sb_secret_...`), and Session Pooler Postgres connection string.
2. Configure Supabase Auth Site URL and redirect URLs; disable public signup.
3. Create the private `opportunity-briefs` Storage bucket.
4. Create the Vercel project, attach the production domain, and set `NEXT_PUBLIC_APP_URL`.
5. Add all production environment variables in Vercel, including `DATABASE_URL`, Supabase keys, `INTEGRATION_ENCRYPTION_KEY`, and production flags.
6. Deploy the app on Vercel.
7. Run `npm run db:migrate` against the production database from a trusted environment.
8. Run `npm run create-owner -- --email=owner@example.com`; set the owner password via invitation or forgot-password.
9. Sign in to `/studio`, set Security defaults including default opportunity owner, upload limit, bot protection, and `production_mode`.
10. Configure consent, Resend, OpenAI, Meta, GTM/GA4, Clarity, storage, and webhooks in Studio or environment variables; submit a test lead and verify Studio records plus integration logs.
