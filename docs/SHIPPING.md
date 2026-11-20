# Shipping in GYVFT

Each customer gift/order has one optional delivery plan: a confirmed gift-set total allocated across physical parcels or collection batches. Every parcel has its own destination, method, quantity and progress. Multiple parcels may share the same destination. There is no employee-home-address requirement for bulk office delivery. Blank address/contact fields can be saved during planning; dispatch/booking requires the completed destination.

## Operations workflow

In **Requests & orders → a request → Order & delivery → Shipments & collection**:

1. Confirm the gift-set total against the approved order.
2. Add each physical parcel or collection batch and allocate its gift sets. Choose **Delhivery**, **Porter**, **Other courier** or **Store pickup** separately for each one. Remove an incorrect unbooked parcel from the plan if needed; the record is archived, never deleted. Booked destinations/quantities are locked.
3. Complete packing, full verified payment, artwork approval and the official order before dispatch. All sets must be allocated. The full balance remains due before dispatch.
4. For Delhivery, enter actual packed weight (grams), dimensions (cm), this parcel's invoice value, contents, HSN and invoice reference. Enter an existing e-waybill when required (the API requires it for declared value at least ₹50,000). This integration does not issue tax invoices or generate e-waybills. Authorise the explicit **Book live Delhivery parcel** action.
5. Request one warehouse pickup for the eligible booked parcels only if an existing pickup does not already cover them. This counts physical parcels, not gift sets. A manifest or pickup request is not dispatch confirmation.
6. For Porter/another courier, book outside GYVFT and record the booking reference, optional HTTPS tracking link and verified movement/delivery status. For store pickup, record the collection address, mark ready, then confirm actual collection. No external API is called for these methods.
7. Customers see the same per-destination statuses in **My gifts → gift → Delivery**. The legacy single-address form is replaced when a plan exists. A 60/40 split at 60 delivered stays incomplete. The whole order advances only when the complete allocation has dispatched or been delivered/collected.

Shopify remains the official order and payment record. Its one custom batch line is unchanged. These shipment actions **do not automatically fulfil that Shopify line**, because one completed destination must not fulfil the entire batch. This release does not implement B2B entities, GST registrations or multiple bill-to profiles.

## Configure the connection

**Operations → Settings & connections → Delhivery connection** contains the API key field, staging/live environment, exact client name, registered pickup warehouse, origin PIN and seller details. The warehouse name is case-sensitive and must already exist in Delhivery One. Saving settings and testing the connection do not create shipments. The read-only test checks authentication and PIN serviceability; it does not validate warehouse existence or the commercial contract.

Tokens are encrypted server-side using the existing AES-256-GCM helper. `INTEGRATION_ENCRYPTION_KEY` must be set once on the server (at least 32 characters; use a random ASCII value, and the existing helper uses its first 32 UTF-8 bytes). Keep that key stable and private. It is distinct from `SETUP_SECRET`. The courier token is entered in Operations and is never returned to the browser, logs or customer APIs. Blank input preserves the existing token; entering a new token replaces it. Saving settings uses version checks to prevent another tab's changes being overwritten.

Staging and production credentials are separate. Staging supports connection testing; this initial release books real customer parcels only against the explicitly enabled production account. Demo identities and sample requests cannot book or record real shipments. Live booking requires both the connection's enable switch and the individual booking confirmation.

## Tracking, labels and uncertain results

Tracking checks use the original carrier account, AWB and stable order reference. Responses for a different shipment are rejected. Older scans cannot replace newer scans. Return-to-sender scans never count as customer delivery. Unknown carrier scans surface as needing attention. Previously confirmed data remains visible when a refresh fails.

Opening customer Delivery triggers a background, throttled refresh (at most once every five minutes for an active parcel), with one follow-up page fetch. Operations also has explicit refresh. The authenticated `/api/cron/shipping` route refreshes up to 20 eligible parcels daily at **08:50 IST / 03:20 UTC**, compatible with the current Hobby schedule; it is recovery, not real-time tracking. Carrier changes queue the existing customer email notifications (the same status across parcels of one order is grouped within a five-minute window to avoid duplicate batch emails); the separate email-recovery cron runs ten minutes later. No webhook or minute-by-minute polling is claimed.

A manifest/pickup timeout can mean the provider saved the booking but its reply was lost. The app marks this **uncertain**, retains the stable reference and blocks another booking. **Check booking by reference** can adopt an existing AWB. If no result is found, that does not authorise retrying the POST. Check Delhivery One/support before any manual reconciliation. There is intentionally no automatic cancel/rebook or retry-POST control. Labels and warehouse pickup reconciliation currently open Delhivery One; label download and cancellation APIs are not implemented. Regular parcel service is implemented, not B2B freight or multi-piece consignments.

## Database activation — separate approval required

`supabase/migrations/20261120000001_shipping.sql` adds four tables (settings, plans, shipments, action audit) and two shipment indexes, with RLS and no public browser grants. It does not update/delete existing rows, backfill orders or create accounts. Existing gifts keep their current delivery controls until the schema is available. Neither startup nor builds run migrations. The user explicitly approved this exact SQL on 20 November 2026. Use `/setup/shipping` to check status and apply this fixed, checksum-verified file only; production application has not yet been verified. Review the pending list first: approval for this SQL does not approve other pending migrations.

Activation order: approve/apply the additive SQL; confirm the server encryption key; enter/test credentials in Operations; verify the registered warehouse/account contract; enable live bookings when ready. A separately authorised real parcel test is still needed to verify the merchant's live account, pickup and label process. No real courier booking was made during development.

## Verification

- `tests/unit/delhivery.test.ts`: documented auth/form payload, exact PIN, manifest identity, timestamps, return mapping, pickup count and safe errors.
- `tests/unit/shipping-db.test.ts`: opt-in dedicated localhost PostgreSQL, additive/repeatable setup, encrypted credentials, ownership, allocation, 60/40 manual/pickup progress, concurrent booking, lost reply/reconciliation, stale scans and batched refresh. Set `SHIPPING_TEST_DATABASE_URL` to a disposable database named `gyvft_shipping_*`.
- `tests/unit/shipping-api.test.ts`: customer session/ownership, operator-only commands, cron authentication.
- `tests/e2e/shipping.spec.ts`: opt-in local browser integration with `tests/fixtures/shipping-preload.mjs`. It exercises Operations key entry/masking, connection test, split allocation, two parcel bookings, one pickup, partial/final delivery and customer readback. All courier responses are simulated; the fixture rejects external network access. Seed a dedicated local `gyvft_shipping_browser_*` database with `DATABASE_URL=... npx tsx tests/fixtures/shipping-seed.mts`; it writes the ignored local fixture manifest. Start Next against that same database with `NODE_OPTIONS="--import ./tests/fixtures/shipping-preload.mjs"`, a local operator/encryption key, and `NEXT_PUBLIC_APP_URL` matching the test origin. Run Playwright with `GYVFT_SHIPPING_BROWSER=1`, `PLAYWRIGHT_OPERATOR_SECRET` and `PLAYWRIGHT_BASE_URL`. No production testing is implied.

Primary API references: [Delhivery developer portal](https://one.delhivery.com/developer-portal/documents/b2c/), [order creation](https://delhivery-express-api-doc.readme.io/reference/order-creation-api), [pickup requests](https://delhivery-express-api-doc.readme.io/reference/pickup-request-creation-api), [tracking](https://one.delhivery.com/developer-portal/document/b2c/detail/order-tracking).

For live acceptance and owner participation, see [PRODUCTION-VERIFICATION.md](PRODUCTION-VERIFICATION.md).
