# My GYVFT — implementation and setup

## Customer login

Customer authentication is owned by GYVFT. Supabase is the PostgreSQL host; customer signup/sign-in does not call Supabase Auth or require browser API keys.

- `gyvft_customer_accounts`: unique normalized email username and salted scrypt password hash. Passwords contain 8–128 characters and are never stored or logged in plaintext.
- `gyvft_customer_sessions`: SHA-256 digest of a random session token, linked account and seven-day expiry. The raw token is stored only in a host-only HttpOnly, SameSite=Lax cookie, Secure in production. Logout removes the server record; password reset revokes all sessions.
- `gyvft_customer_password_resets`: hashed, single-use reset token, one-hour expiry. Reset links are sent through the existing Resend service. Signup/sign-in require no email OTP.
- `gyvft_customer_auth_limits`: persistent per-IP and per-IP/email attempt limits before expensive hashing or email delivery.

The legacy Studio authentication code remains separate and is not a prerequisite for this customer portal.

## Deployment

Required existing variables:

- `DATABASE_URL`: server-side PostgreSQL connection.
- `SETUP_SECRET`: existing operator secret of at least 11 characters for `/setup` and `/operations`.
- `NEXT_PUBLIC_APP_URL`: production GYVFT origin, used in password reset links.
- `RESEND_API_KEY` and existing sending configuration: enquiry emails and password recovery. Login and signup do not depend on email delivery.

After deploying, open `/setup`, enter the setup secret and choose **Start setup** once. The server-owned customer manifest installs only customer-portal tables, GYVFT account/session tables, explicitly requested sample enquiries and operational events. It skips recorded migrations, supports `id` or `filename` history keys, and uses a transaction/advisory lock. It does not run the legacy Studio CRM schema or change existing campaigns/contacts/Aarla login tables. CLI equivalent: `npm run db:migrate -- --customer`.

Create a customer account at `/account/login`. For the requested canned data use `aarla@aarla.in`; three clearly marked fictional enquiries appear after account creation. No account or password is embedded in migrations. Existing Supabase Auth passwords are not imported into GYVFT's independent account table; use Create account for this version.

No new Vercel variables or external authentication service are required to enable this change beyond the existing database/setup configuration.

## Ownership and public enquiries

All request reads and writes use `customer_account_id`, derived from the authenticated database session. A self-registered email alone never claims another person's real enquiry.

- Requests submitted while signed in with the matching contact email are linked to that account.
- Anonymous submissions receive an unguessable HttpOnly browser claim cookie; only its hash is stored on the enquiry. Registering/signing in from that browser with the matching email links those unowned requests. Already owned requests are never reassigned.
- Requests submitted before this mechanism, or from another browser without the claim cookie, require an explicit ownership-recovery/import process. There is no historical import in this fresh launch.
- The three exact fictional sample UUID/key pairs may be linked by their matching email; that exception does not apply to real enquiries.
- Later company membership/work-email verification is a separate product phase. Signing up does not grant staff or employer access.

The `customer_*` and `gyvft_customer_*` tables have RLS enabled and direct anon/authenticated table grants revoked. Browser clients use server actions rather than raw database access. The application database role must have the intended server permissions.

## Backend matching the existing story form

The original `/tell-your-story` questions, seven-step flow and validation remain unchanged. `storyRequestSchema` creates an allowlisted, versioned snapshot of every validated form answer, excluding honeypot/idempotency/attribution/analytics metadata. The existing `customer_projects.gift_brief` JSONB column stores this snapshot with `source: tell_your_story` and `version: 1`; no additional migration is required beyond the already shipped `20261114000004_customer_gift_brief.sql`.

The customer request shows occasion/other, audiences, preferred formats, target date and precision, quantity/budget ranges, city/multiple-location notes, contact details and contact/marketing preferences. The narrative stays in `brief`. Only valid exact dates are projected into the DATE column. Budget ranges are not converted into numeric quotes or assigned an invented per-recipient/total basis. Recipient likes/dislikes are not inferred from audience categories. Previously saved structured records remain readable; no real request is rewritten or deleted.

Lead emails already render the form answers. Aarla's existing fields retain their original values; `additional_context` additionally preserves occasion-other, date precision and multiple-location details. Aarla's application UI remains separate work.

## Customer-visible content

`customer_projects` holds enquiries/projects and current status. Published events and conversations are separate customer-visible tables; never copy internal notes into them. New public submissions still email the existing inbox and forward to Aarla OS, with a secondary customer-portal mirror. Mirror failure is logged rather than turning a successfully emailed submission into a duplicate retry.

Enquiry pages show the request, status, timeline and conversations. Payment/production sidebars appear only after an explicit project conversion. B2B/B2C conversion, operational replies/status syncing, payment receipt verification and Shopify order creation remain separate integration work.

## Canned data and cleanup

`20261114000002_customer_demo_requests.sql` inserts three fictional enquiries for `aarla@aarla.in`: received, requirements review, and quote accepted/awaiting advance, plus sample timeline events. It creates no Auth provider user, emails, payment or real order. Fixed IDs and `ON CONFLICT DO NOTHING` make repeat execution safe without overwriting edited records.

`scripts/sql/remove-customer-demo.sql` deletes only the exact demo owner/key/UUID records and their dependent rows. It does not truncate shared tables or clear migration history. No cleanup has been run.

## Customer dashboard v1

`/account` provides Overview, Requests, Occasions and Ideas. Request summaries omit internal integration identifiers and raw brief text; all server reads remain account-scoped. Pending approvals include only the latest version of each kind. `paid_paise` on real converted projects is the source of recorded-spend totals; budget preferences, pending payment references and sample data are not counted. Monthly charts count request creation in Asia/Kolkata; requested formats are explicitly not purchase rankings.

`20261114000005_customer_dashboard.sql` adds nullable `occasion_date` / `delivery_date` to customer projects, plus RLS-protected `gyvft_customer_occasions` and `gyvft_customer_saved_ideas`. Mutation actions derive ownership from the app session and bind account IDs in SQL. The existing public form is untouched. Yearly date recurrence is opt-in and does not dispatch emails/orders. Leap-day display uses 28 February outside leap years while retaining the original date.

Ideas use existing ready portfolio content and published assets, with private save/remove actions. External Aarla collection links carry only static campaign attribution, never customer identity or request details. They open a separate store; shared order history is not claimed. Source suggestions are editorial, not an AI recommendation or inventory integration.

Missing new tables leave the established requests available with a setup-needed notice; unexpected database failures are not converted into fake empty reports. Repeat the existing `/setup` once after deployment. Only exact fictional fixture IDs receive demo occasion/delivery dates. Real requests keep dates unset until explicitly saved.

## App reporting and logging

Open `/operations` and unlock it with the existing operator setup secret. It shows account/session counts, real enquiries by stage, accounts with enquiries, actual converted project records, event counts and recent safe error/sign-in-failure summaries. Demo enquiries are excluded from real enquiry/conversion counts. CSV exports contain aggregate counts only. The secret stays in tab memory and is removed by locking/closing the page.

`gyvft_customer_events` stores allowlisted event types and metadata only: route, operation, safe error code/status and duration. It does not store passwords, raw session/reset tokens, raw IP addresses, email addresses or arbitrary payloads. Event recording fails open so a reporting failure cannot reject a customer action.

The native Next.js request-error hook writes structured JSON to Vercel logs and a safe app error record with a correlation ID. `/api/health` reports database/account-schema readiness and mail configuration, without returning credentials. Infrastructure/deployment/performance monitoring stays in Vercel. No Grafana/ELK/OpenTelemetry service or SDK is installed for this release.

Keep `SETUP_SECRET` configured if using the operator dashboard. Removing it and redeploying disables both operator entrypoints. Restrict operator-secret access to the people who manage the app. Event/session cleanup and retention policy should be set before sustained production traffic; event summaries currently use a 30-day window.
