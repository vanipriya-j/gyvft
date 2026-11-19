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

Enquiry pages show the request, status, timeline and conversations. Payment/production sidebars appear only after an explicit project conversion. The B2C Operations desk provides conversion, replies, versioned approvals, verified receipts and fulfilment. Shopify handoff is optional and requires its server connection; B2B circles and Aarla OS synchronisation remain later work.

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

## Approved Home API — 17 November 2026

The approved Home backend is described in [CUSTOMER-HOME-ARCHITECTURE.md](CUSTOMER-HOME-ARCHITECTURE.md). `GET /api/customer/home` composes account-scoped gifts, upcoming occasions, Aarla catalogue cards, saved ideas, editorial inspiration and verified-payment summaries with independent section states and carousel totals/pagination. `PUT`/`DELETE /api/customer/saved-ideas` save explicit story/product references. The new customer-only migration adds private saved Aarla products without changing existing stories, occasions or public forms. The approved desktop/mobile Home is now connected, with separate compact mobile and fuller desktop presentations; see the architecture guide for navigation, loading/error states and rollout.

## Working gift workspace and Operations

Open a gift from Home or My gifts. Overview shows the actual current action, latest available option/approval image, a brief summary and the latest team message. Original images can be opened at full size. Generic imagery is labelled as inspiration and is never represented as a prepared option. The current status replaces the redundant journey strip.

- **Options** opens the existing curated options/customer workspace. Visible curated-option counts respect Show/Hide; a customised draft and its submitted selection remain separate from the team's original.
- **Quote & payment** contains versioned quotes/designs, the linked selection snapshot, decisions and, after conversion, payment instructions and receipt history. Only the latest eligible version can receive a decision. A pending receipt never counts as paid.
- **Edit details** opens the original brief plus separate occasion/requested-delivery dates and the delivery address after conversion. The public enquiry form is unchanged. Address edits lock after dispatch.
- **Activity** and **Messages** provide focused history and conversation views without repeating the whole request page.

At `/operations/requests`, unlock with the existing operator secret and select a request. The tabs operate on the same request, options, selections, approval versions, receipts and fulfilment records. **Use this selection in quote** opens the quote editor with the exact composition. **Convert approved quote to B2C order** becomes available after the latest selection's quote is approved. **Refresh desk** refreshes both the request list and the selected request. Switching requests resets quote-editing state so one customer's items cannot carry into another request.

Use **Payments** to inspect proof and explicitly confirm receipt in the receiving bank/provider. Use **Quote & design** to publish revised artwork; production requires the latest design approval plus verified 50% advance. **Fulfilment** holds shipping details, progress/tracking and optional Shopify actions. Dispatch requires the full verified balance, approved design, address and tracking reference. Server rules enforce these prerequisites even if a client submits a command directly.

### Optional Shopify handoff

GYVFT orders, UPI proof and verification work without Shopify. When configured, Shopify customer matching/creation and order creation continue through the existing server integration. Order creation records the verified advance. Once the full GYVFT total is verified, sync records Shopify's outstanding balance as a manual payment. The API's specified partial-payment amount is Shopify Plus-only, so the standard-plan flow omits that argument and never marks a partially verified total fully paid. Additional partial receipts after creation remain verified in GYVFT until the full balance is verified, or an operator reconciles them manually in Shopify. Sync does not initiate a new customer charge.

### Local verification

`tests/e2e/customer-gift-flow.spec.ts` creates fictional local accounts/requests, drives both customer and Operations UI, verifies payment/approval gates and cross-account privacy, and tests duplicate-safe Shopify order/payment handoff against a blocking mock. No real Shopify orders or emails are sent. It checks a local fixture-process marker before running writes and cleans up its records. Use a disposable database with customer migrations already applied:

```sh
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55433/postgres \
SETUP_SECRET=local-complete-flow-secret-123 \
NEXT_PUBLIC_APP_URL=http://localhost:3102 \
NODE_OPTIONS='--import ./tests/fixtures/gift-flow-preload.mjs' \
npx next dev --port 3102
```

Then in another terminal:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3102 \
PLAYWRIGHT_WORKFLOW_DB=postgresql://postgres:postgres@127.0.0.1:55433/postgres \
PLAYWRIGHT_OPERATOR_SECRET=local-complete-flow-secret-123 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
npx playwright test tests/e2e/customer-gift-flow.spec.ts --workers=1
```

The fixture refuses production/non-local database use, forces the Shopify fixture domain/token and disables email. Customer and operator state rules have unit coverage in `request-workflow.test.ts`; quote/selection boundaries retain the disposable database tests in `gift-workspace-db.test.ts`. The legacy Studio integration suites use their own separate PostgreSQL database; they cannot run against the customer-only fixture schema.


## Four fictional customer workspaces

The explicit operator tool at `/operations/demo-data` adds four demo customers using existing tables. Enter the Operations secret, choose a password for newly inserted demo accounts and confirm the addition. Account aliases are `aarla+demo-single@aarla.in`, `aarla+demo-business@aarla.in`, `aarla+demo-communities@aarla.in` and `aarla+demo-family@aarla.in`. Plus-address delivery to `aarla@aarla.in` depends on that Google Workspace inbox's routing; the tool sends no email and does not depend on email to establish the initial password.

The fixtures include 28 gifts, 22 recipient records and 20 occasions, with curated visuals, immutable chosen compositions, versioned sample quotes/artwork, timeline entries, conversations, historical sample receipts, saved inspiration and private feedback/photos. The single-gift scenario has only one active request; the other scenarios cover business gifting, several community contexts, and family/friend occasions. Existing Aarla photographs illustrate fictional proposals and memories; they are not represented as actual photographs of the sample customers or deliveries.

The command uses a single transaction and an advisory lock. It runs no migrations, updates, deletion, notifications or Shopify writes. A repeat fills only missing fixture rows and never resets an existing password. Collisions with pre-existing accounts or another record's ownership abort the batch. The existing `aarla@aarla.in` identity is not created, replaced or recovered by this action.

Every seeded request has the established `gyvft-demo-` marker. Operations live workload and financial summaries continue excluding sample requests. The four explicitly identified demo customers can see their own fictional payment totals, with a demo notice on every account page; ordinary customer totals continue excluding sample money. Shopify customer syncing skips these four accounts. Sample quotes do not display live payment instructions.

Organisation and community names are profile/recipient/request context labels in the current object model. This command does not add an organisation or circle table, verified membership, circle invitations or administrators. Those features require their own design and explicitly approved schema work.

Browser verification uses only a disposable local PostgreSQL database and blocked external integrations. It exercises the manual seed form, repeat-run/password preservation, customer sign-in, populated screens, ownership isolation and unchanged live Operations totals. Its fictional local fixture records are retained; the test performs no deletion. Production records are added only after the operator explicitly submits the live tool.
