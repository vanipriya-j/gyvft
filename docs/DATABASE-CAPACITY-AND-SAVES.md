# Database capacity and resilient saves

26 November 2026. The owner requested transaction pooling, intelligent load reduction and safe deferred saves after a production Supabase session-pool exhaustion incident. No production migration, deletion or infrastructure purchase accompanies these changes.

## Connection sharing

All deployed application SQL comes from `src/lib/database/client.ts`, cached once per process. On Vercel, managed Supabase pooler endpoints using 5432 are directed to the same host, credentials, project and database on transaction port 6543. The application pool has one connection, prepared statements disabled, five-second idle release and a 60-second connection lifetime. Other endpoints are preserved.

A database pool size is not a customer count. Supavisor shares database connections between transactions across independent Vercel instances. Long transactions, slow queries, locks and bursts can still cause queuing. Keep provider network requests outside SQL transactions. Do not implement session-level locks or rely on connection-local state with transaction pooling.

## Avoiding work

Private Account, Operations, Studio and setup links no longer prefetch pages merely because the links are visible. Query-relative links are covered as well. Public page links retain normal Next behaviour. Click progress and native keyboard/link semantics remain.

React `cache` deduplicates Circles readiness checks within a server render; account identity was already cached per render. Customer data is never put in a cross-customer shared cache. Existing Home section pagination and deferred catalogue loading remain. The four exact fictional accounts receive a local demonstration catalogue instead of fetching live Aarla data.

Authentication/Home/API telemetry runs through Next `after`, with one secondary job at a time and an eight-job waiting limit. Saturated secondary telemetry can be dropped. Core business records and notification-outbox entries are still committed before success; email delivery and Shopify customer synchronisation already run after the response and retain their durable recovery states. `after` alone is not a durable job queue.

## Backpressure

The shared customer JSON API boundary admits two requests at a time per process, with at most 24 waiting. A waiter expires after four seconds; disconnected waiters are removed. Saturation returns 503 `BUSY` with `Retry-After: 2`, private/no-store headers and no mutation execution. Work already executing is not blindly cancelled or replayed.

This admission guard covers APIs using `customerApi`. It is neither a global Vercel semaphore nor a replacement for Supavisor, nor does it place every server component, Operations API or server action behind a common queue. Postgres still enforces the single application connection. There is deliberately no unbounded memory queue and no claim that a queued memory job survives a process restart.

## Submitted private details

Profile, private person notes and occasions use `/api/customer/private-details`. After the customer presses Save, the submitted document is retained in **sessionStorage for the current tab**, scoped to the authenticated account. The UI says “Kept in this tab · syncing” until the server confirms “Saved to GYVFT.” It does not promise a server save while offline.

Only these idempotent metadata edits enter the browser outbox. It does not contain passwords, files, messages, approvals, invitations, public consent actions on gift photos, payments, rewards redemptions or orders. Profile sharing is part of the explicit profile submission and takes effect only on a confirmed server save.

The outbox combines repeated submissions to the same record and sends one request at a time per tab. Network uncertainty, 429 and transient 502/503/504 responses use exponential backoff with jitter and bounded Retry-After. Six unsuccessful attempts pause automatic retry. Conflicts, validation and authentication failures pause immediately. The current tab must remain available for recovery; drafts are not durable across closing the tab, clearing browser data or changing devices. Only drafts under 24 hours old are offered for retry. Explicit sign-out clears the tab’s pending private details. Storage failure never produces a local-save success message.

The server validates identity, origin, input size, ownership and the document through existing domain schemas. A transaction-scoped advisory lock serialises each record. A hash of editable fields detects a changed server document. Replaying an already-applied document succeeds without another record; a stale different document returns 409 and leaves the local draft intact. The customer can reopen the form, inspect the current data, restore the submitted draft and explicitly save it. A draft created under a different account is forbidden. Existing person/email ownership and occasion/person ownership rules remain.

## Demo feature coverage

Existing seeded rows/passwords are preserved. Read models recognise only the four exact demo identities and deterministic, ownership-checked `gyvft-demo-v1-*` projects. They provide fictional requirement PDFs, additional proposal gallery images and shipping history using the existing briefs/covers/stages. A fixture ID alone does not grant access. Asset routes retain ownership, publication and hidden-option checks and private/no-store responses.

Demo rewards have fictional balances, pending/history entries, self occasion offers, reservation, expiry/release, a local sample checkout and an explicit wallet reset. This is session-bound signed-cookie state and requires no live rewards activation or import. It cannot credit real customer wallets, create native Shopify coupons/orders, contact carriers or send email. Real account rewards paths retain their activation and verified-identity requirements. No automatic seed, production backfill or password reset occurs when loading a page.

## Validation and limits

Automated unit checks cover bounded admission/cancellation, outbox coalescing/backoff/unknown responses/conflicts/storage failure and signed demo rewards. A guarded disposable localhost PostgreSQL test checks all 28 owned sample projects, private assets, galleries, shipping, foreign-account denial, duplicate replay and concurrent conflicting saves. Existing baseline security/session/integration tests run against a separate disposable database.

A local production-build browser sweep covered 103 pages/detail views across four demo accounts at desktop/mobile sizes, plus a sample reward checkout. No private-page prefetch requests were observed. The local load experiment sent a burst of 60 authenticated read requests: all completed after bounded retry, using one application database connection (two including the monitoring connection); 34 initial requests received backpressure. Total observed duration was about 2.45 seconds, p95 about 2.37 seconds. These numbers describe this disposable localhost fixture only. They are **not production capacity certification**.

Production capacity still needs an agreed traffic target and a controlled production-like test of latency, errors, active connections, lock waits and queue saturation, including long-running provider failures. No paid external load service or real financial/provider action is implied by this implementation.
