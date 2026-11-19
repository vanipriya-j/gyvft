# Customer email notifications

This release uses the existing customer notification outbox. It requires **no migration**, does not delete data and does not change account credentials. WhatsApp is deferred; no WhatsApp provider is connected.

## What sends an email

The existing domain commands queue transactional notifications in the same database transaction as the update:

| Event                                                                                                 | Recipient  |
| ----------------------------------------------------------------------------------------------------- | ---------- |
| Submitted account gift brief or version-change request                                                | Team inbox |
| Customer message, selected option/quote request, approval decision or payment proof                   | Team inbox |
| Published gift option, quote/artwork, team reply, payment verification/rejection or fulfilment update | Customer   |

Private operator notes, task assignments and unpublished drafts do not notify customers. Public Tell Your Story acknowledgement and password-reset emails keep their existing separate paths. This release does not create accounts or repair a missing account; a reset email still requires an active existing account.

## Sending and recovery

`RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` enable delivery. The sender defaults to `aarla@aarla.in`; the team inbox uses `GYVFT_LEADS_EMAIL`, falling back to the sender. Customer notifications do not fall back to Resend's testing sender, which cannot reliably deliver to arbitrary customers.

Next.js `after()` attempts the email after the action response. Transient network/provider errors get one prompt retry with the same Resend idempotency key and request body. Atomic row claims stop concurrent workers from sending the same event. Persisted retries wait at least two minutes; interrupted claims become eligible after five minutes. Workers process at most four events per invocation, with bounded provider timeouts. The attempt counter acts as the claim generation when saving results.

The dedicated `/api/cron/customer-notifications` job recovers the **customer** outbox independently of legacy Studio email tables. Its bundled schedule is daily at 03:30 UTC and requires `CRON_SECRET`. Configuration is not evidence that Vercel has invoked it: check Cron Jobs in the deployed project. If the Vercel plan permits frequent jobs, an operator can deliberately change this schedule to every five minutes. The daily schedule does not promise near-real-time outage recovery or drain a large backlog in one run; Operations can process additional due batches manually.

Retries stop after eight claims or, conservatively, 23 hours from event creation once a send has been attempted. Resend retains idempotency keys for 24 hours; blindly retrying an old ambiguous send could duplicate an email. Such records remain visible for a human delivery check. Never reset their state or issue a new key without inspecting the provider's delivery log. A never-attempted queued event may still be sent after 23 hours.

Exact fictional demo identities and `gyvft-demo-` sample requests are excluded at queue and delivery time. Local tests mock the provider; no real customer email is sent by those tests.

## Operator check

Open **Operations → Settings & connections → Email updates**. Configuration, queue counts and recent notification attempts load automatically. **Send test email to team inbox** sends only to the configured team inbox; it cannot accept a caller-supplied customer address. Tests are limited to three per hour and have a stable idempotency key for an uncertain retry. Check the actual inbox before treating this as verified delivery.

**Process due notifications** processes one bounded batch. The Activity tab on each request shows its own email states and can process a due batch for that gift. These controls show loading state and prevent duplicate clicks.

`sent` in the existing table means **accepted by the email provider**, not inbox delivery. The UI states this explicitly. Delivery/bounce details remain in Resend; signed delivery callbacks and WhatsApp can be added later with a separately reviewed data model. Logs record a safe provider error code and notification ID, never the recipient, message body, token or raw provider error.

Production inbox delivery, verified sender/domain and deployed cron invocation must be confirmed in the connected deployment. A successful build or local captured-email test does not prove them.

## Verification

The new local PostgreSQL suite checks transaction rollback, duplicate event keys, concurrent dispatch, customer/team routing, immediate transient retry, delayed recovery, interrupted claims, expiry, attempt caps, disabled accounts and demo exclusions. Transport and route tests cover timeouts, provider deduplication keys, unverified sender rejection, operator-only controls, fixed test destination, rate limiting and cron authorization.

Use `GYVFT_NOTIFICATION_TEST_DB=postgresql://postgres:postgres@127.0.0.1:55434/gyvft_test npx vitest run tests/unit/customer-notifications-db.test.ts` only against the disposable local fixture. It creates a new test database and applies customer SQL there; it never uses production.
