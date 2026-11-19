# Customer authentication verification · 19 November 2026

Customer authentication uses GYVFT-owned password hashes and database sessions. Supabase Auth identities and the Operations secret are separate from customer accounts.

## Verified scope

`tests/e2e/customer-auth-browser.spec.ts` starts with an unregistered email and uses the actual browser forms and a disposable PostgreSQL database. It verifies registration, salted password storage, sign-in/out, invalid credentials, duplicate-registration protection, reset-email content/link origin, hashed single-use reset tokens, password replacement and revocation of existing sessions. A second browser case verifies that repeated recovery requests show the rate-limit wait. Only the outbound email transport is captured locally; this does not prove delivery by the production email provider.

The current `approved-gifting.spec.ts` and `approved-planning.spec.ts` browser suites cover seeded-account customer/Operations journeys, persisted seven-step briefs, private drafts, recipient/profile invitations, occasions, curated option selection, version-specific quote/artwork approval, payment proof and bank-verification gates, official-order handoff, production/dispatch locks, and individual photo-permission withdrawal. Shopify writes use a blocking fixture. Some operator setup/state checks use the application API; these are not wholly unprompted human usability sessions.

Operations dashboard and frame checks also run against the production build locally. Geometry checks hold data reads open at 320/390/1024/1440 CSS pixels and compare toolbar, navigation and heading positions.

## Remaining automated coverage work

The older `customer-gift-flow.spec.ts` still targets the pre-Revision-4 controls. Its current rerun failed at an ambiguous heading before completing that older journey; it is not counted as a passing acceptance test. The current approved gifting/planning replacements passed. The legacy test needs migration or retirement after checking its distinct assertions. Automated browser coverage must not be described as all flows passing.

## Production investigation: unresolved

The live login page rendered and its create-account/recovery controls hydrated. One recovery request for the reported customer returned the deliberate generic response; no matching reset email was found in the connected mailbox afterward. Health reports configuration present, which does not establish provider acceptance or mailbox delivery. Production signup, successful password recovery and live Shopify writes are **not signed off** by these local checks.

This environment has no production database credential or Vercel runtime-log connection. The generic recovery response alone cannot distinguish an absent/inactive account, rate limiting, a database failure or email-provider rejection. Do not infer a root cause or repeatedly send email from that response.

## Diagnostics and retry behaviour

Authentication failures now emit `Customer authentication operation failed` with a random request ID, operation, processing phase, classified code and status. Rate limits use `Customer authentication operation limited`. The same classified failure is recorded in application error events when the database permits it. No form input, password, email address, reset token, URL or raw error message is passed to these diagnostic logs.

Recovery logs distinguish `Customer password reset lookup completed` (`no_active_account`) from `Customer password reset email accepted`. Acceptance means the provider accepted the send; it is not a delivery receipt. Look at the matching request's Vercel runtime logs and, for accepted mail, the email-provider delivery log.

The recovery form now displays the 15-minute wait when throttled. This check runs before account lookup and behaves the same for registered and unregistered addresses. Other recovery responses remain generic so they do not disclose account existence.

## Reproduce locally

Use the disposable fixture instructions in `CUSTOMER-PORTAL.md`, adding `GYVFT_AUTH_MAIL_FIXTURE=1` to the **development server** and Playwright commands. Set `NEXT_PUBLIC_APP_URL` to that server's exact origin and supply `PLAYWRIGHT_WORKFLOW_DB`, `PLAYWRIGHT_BASE_URL` and the Chromium executable if needed. Run:

```
npx playwright test tests/e2e/customer-auth-browser.spec.ts --workers=1
```

The fixture refuses production/non-local databases, blocks real Shopify writes and limits reset-mail captures to `@example.test` recipients. Captures under `work/auth-mail-fixture/` contain usable local reset links and must stay private. The test deletes its account and captured email afterward; `work/` and browser-result directories are ignored by Git.
