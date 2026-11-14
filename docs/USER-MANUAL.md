# GYVFT user manual

## Customers

### Create your account

1. Open **My GYVFT → Create account**.
2. Enter your email address and choose a password of **8–128 characters**.
3. Choose **Create your account**. You are signed in immediately.

This creates a GYVFT login in the application's database. No Supabase dashboard account or email OTP is required. If you already have an account, use **Sign in**. If you previously tested the Supabase Auth version, create an account again for this app-managed version; passwords are not imported from that service.

### Your seven-step story request

Use the existing **Tell your story** form. Its questions and seven-step layout are unchanged: story, occasion, audiences, preferred formats, timing/quantity/budget, locations, and contact details/permissions.

The backend saves every validated answer. Open the request in My GYVFT to see the story and **Your request details**, including the original ranges and date precision. Flexible/month/quarter preferences do not become promised delivery dates. The current budget-range question does not specify per-recipient versus total; the system does not invent that distinction or unknown recipient preferences.

The same answers remain in the lead email and Aarla intake. Aarla context also carries occasion-other text, date precision and location details. Internal tracking identifiers are not copied into the customer-visible snapshot.

### View your requests

After signing in, open an enquiry to see its submitted brief, current status, next action, public timeline and conversations. Use **Start a new story** to submit another enquiry. Requests submitted while signed in with the matching contact email appear in your account.

If you submitted before registering, create/sign into the account from the same browser so that request can be connected safely. Merely entering another person's email does not grant access to their requests. Older requests without a browser claim need help from GYVFT to verify ownership.

### Use the sample enquiries

The pre-launch test account email is **aarla@aarla.in**. Create a GYVFT account with that email and your chosen password after setup completes. The three DEMO records show:

- A family celebration request received.
- Team welcome gifts under requirements review.
- Anniversary gifting with a fictional accepted quote, awaiting advance.

These are examples only. They do not collect payment, send customer emails or create a real Shopify order.

### Sign out and reset a password

Choose **Sign out** from the account overview when finished. To recover access, choose **Forgot password?**, enter your account email and use the link sent by GYVFT. The link expires in one hour and works once. After saving the new password, sign in again; earlier sessions are revoked.

A generic recovery message does not reveal whether an email has an account. If the email does not arrive, the owner should check the existing Resend sending configuration and logs.

### Conversations, approvals and payments

Customer messages are saved against the request. The operational delivery/reply integration with Aarla OS is separate work. Do not rely on the portal for urgent communication until that loop is connected.

When a real project has a published versioned proposal/design, approve that version or request changes with comments. Payment/production views appear only on converted projects. The agreed business policy remains 50% advance and the remaining 50% before dispatch; direct UPI references are pending until receipt is verified. These operational/payment/Shopify integrations are not completed merely by loading this portal.

## App owner

### Deploy and initialize

1. Confirm GYVFT's Vercel Production environment has `DATABASE_URL` and `SETUP_SECRET` (at least 11 characters).
2. Deploy the new app version.
3. Open `/setup`, enter the secret and choose **Start setup** once.
4. Watch the check → apply → save progress. Wait for **Your database is ready**. Do not repeatedly click while it runs.
5. Open `/account/login` and create the customer account for the test journey.

Customer login uses GYVFT's own account/session tables. It does not require `NEXT_PUBLIC_SUPABASE_URL`, a Supabase publishable key, Supabase Auth signup settings, or OTP email templates. Supabase remains the PostgreSQL host.

Set `NEXT_PUBLIC_APP_URL` to the correct production origin for reset links. Existing Resend configuration handles enquiry and password reset emails. If deployment reports setup errors, share only the diagnostic code/filename, not the setup secret or database password.

The setup runner applies only its explicit customer manifest, skips completed migrations and supports both `id` and `filename` history formats. Existing campaigns/contacts/HR/auth tables are left unchanged. No Studio owner account is needed.

### Reports and app errors

1. Open `/operations`.
2. Enter the existing setup secret to unlock the owner view.
3. Review customer-account counts, active sessions, real enquiry/conversion counts and status/event breakdowns.
4. Review the bounded recent error/sign-in-failure list for safe codes and correlation IDs. Use Vercel logs to inspect the matching request/deployment.
5. Refresh when needed or download the aggregate-count CSV. Lock the page when finished.

Demo enquiries are excluded from real enquiry and conversion metrics. The reporting screen contains no customer email list or raw request/password/session payloads. The secret is held only in the current tab, not browser storage. Keep it private and configured while using `/setup` or `/operations`.

`/api/health` is the public readiness endpoint. Database/account readiness and email configuration are reported separately. Vercel handles infrastructure, deployment, hosting logs and platform performance monitoring; GYVFT records application-level events and reports. There is no separate Grafana/Kibana/OpenTelemetry deployment in this release.

### Clean up sample data

Use the reviewed `scripts/sql/remove-customer-demo.sql` only when the three DEMO enquiries are no longer needed. It matches exact sample IDs, keys and owner email. It does not truncate tables, delete real enquiries or clear migration history.

### Launch checks

- Create/sign in, refresh and sign in again successfully.
- Confirm the expected sample requests and a newly submitted request appear.
- Try a second account and a logged-out browser against the first account's request URL; both must be denied.
- Sign out and confirm the previous session no longer works.
- Test recovery with a controlled address and confirm an old session/reset link cannot be reused.
- Review mobile loading, empty, success and error states.
- Verify operator reports exclude DEMO enquiries and require the secret.

The staged product scope remains in `docs/PRODUCT-BACKLOG.md` and the product roadmap. Company onboarding, accepted circles and cross-company gifting are future steps after this customer journey passes.
