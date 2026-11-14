# My GYVFT customer portal

## Routes and scope

- `/account/login`: email/password login, customer registration, email-code verification and password recovery.
- `/account`: verified-email enquiry/project overview.
- `/account/projects/[id]`: brief, current stage, next action, public timeline, customer/team messages and payment status.
- Public navigation and enquiry acknowledgement emails link to My GYVFT.

This is the GYVFT customer side. No Aarla OS endpoints, staff workflows, Razorpay link creation/webhooks or Shopify order creation have been added. Existing lead forwarding remains unchanged. Never treat customer-submitted payment references as proof of receipt.

## Setup before production

1. Set `DATABASE_URL` and a separate random `SETUP_SECRET` (at least 32 characters) in the GYVFT Vercel environment, redeploy, and open `/setup`. Enter the secret, choose **Check migrations**, review the list, check the confirmation box and choose **Run pending migrations**. No Studio account or app login is required. `/api/setup` uses secret authentication with a timing-safe comparison; GET only exposes readiness booleans, and POST checks the secret before database access. The route runs only packaged SQL through the existing transactional runner and lock. It never seeds demo data or provisions staff users. Remove `SETUP_SECRET` and redeploy to disable setup access. The optional owner-only Studio migration page and `npm run db:migrate` remain available for installations using Studio.
2. Configure the existing Supabase URL and publishable key and `DATABASE_URL` on the server. Configure `NEXT_PUBLIC_APP_URL` to the production origin.
3. Enable customer email/password signup and mandatory email confirmation in Supabase. The prior Studio-only setup disabled public signup; this must change deliberately for customer registration. Customer signup does not create a Studio profile or grant staff roles. Check that deployed Auth hooks do not auto-provision staff profiles.
4. Configure Supabase **Confirm signup** and **Reset password** email templates to display `{{ .Token }}` as an email code. This portal verifies codes in-page rather than relying on email callback links. Keep email-change confirmation enabled; a customer must prove control of an address before its enquiries are accessible.
5. Configure production SMTP and Supabase authentication rate limits/CAPTCHA as appropriate for the deployment. The customer forms surface generic errors and do not list which emails have enquiries.
6. Test signup, verification, sign-in, recovery, sign-out, customer ownership isolation, message persistence and UPI submission against a staging Supabase/database before launch.

No production credentials or database are present in the development environment. Database migration and live authentication/payment checks have not been performed here.

## Customer data boundary for future Aarla OS integration

The `customer_*` tables are a customer-visible projection. All tables have RLS enabled and browser roles have no direct grants. Current access is through server code, requiring a Supabase `getUser()` result with a confirmed email and an exact normalized email ownership match. Studio authorization still separately requires an active staff profile.

- `customer_projects`: one enquiry/project per row. `submission_key` provides idempotency for public form capture; `external_lead_id` links to Aarla OS. New public submissions are mirrored after email delivery when a database is configured. Mirroring failure does not fail a successfully emailed enquiry; errors are logged. Historical enquiries require a separate backfill and failed captures require reconciliation.
- `customer_email`: exact verified customer access address, normalized to lowercase. Do not grant access by organisation name or email domain. Multi-contact organisation access is future work and needs explicit membership authorization.
- `kind`: `enquiry` or `project`; `customer_type`: `b2b` or `b2c`; `organisation_name` labels B2B records. Actual organisation/individual conversion is owned by the future team/Aarla workflow.
- `stage`: index into `src/lib/customer/model.ts` stages, 0 through 11. `next_action` is the customer-facing instruction; `target_date` is optional.
- `customer_project_events`: only explicitly published milestone titles/descriptions. Never mirror internal notes into this table.
- `customer_project_approvals`: versioned proposal/design snapshots with customer decisions (`pending`, `approved`, `changes_requested`). Each decision is ownership-scoped, accepted only once, and atomically appended to the public timeline. Publish new versions as new rows; never edit the contents of an already approved snapshot. The integration must supersede obsolete pending versions and separately handle conversion, payment gates and production release. Customer approval alone does not change stage or create an order.
- `customer_project_messages`: customer messages are saved here with `sender=customer`; future team sync should read these and insert customer-visible replies with `sender=team`. No external delivery or automatic polling is implemented; refresh to load updates.
- Payment amounts are integer INR paise. `total_paise=NULL` means not quoted. Every order requires a 50% advance (rounded up to a whole paise). `paid_paise` counts verified receipts only; show any refunds/adjustments through published updates until a fuller ledger is integrated.
- `razorpay_url`: an existing HTTPS Razorpay payment link. Only approved Razorpay hosts are rendered. Link creation and webhook verification belong to the later integration.
- `upi_id`: the business UPI ID. Customers submit amount and UTR into `customer_payment_submissions`, initially `pending`. A future trusted verification workflow must reconcile the bank receipt, atomically update the submission and verified paid total, and prevent double counting.
- `shopify_order_reference`: optional display-only order reference, supplied after order creation elsewhere.

Future sync must use trusted server credentials, authenticate requests, enforce idempotency, and derive ownership from trusted records. No customer-supplied email or record ID may override ownership. This implementation intentionally exposes no unauthenticated sync endpoint.

## Development validation

The existing lockfile installs with `npm ci --legacy-peer-deps`. Unit tests, lint, TypeScript and the production build are checked locally. The full existing integration suite requires a running Postgres test database. Browser QA requires the managed browser tools, which were unavailable in this session.

The `/setup` secret gate is separate from Supabase customer authentication. The endpoint has per-instance in-memory attempt limiting; use deployment-level rate limits for shared enforcement across serverless instances. The SQL file trace includes `/api/setup`; there is no duplicate bundled SQL copy to drift. Migration failures are not silently marked applied.
