# Owner-run customer and order rewards test

This restores the established workflow: Codex prepares and tests the implementation; the owner enters the existing Operations secret on GYVFT and runs it. No production secret needs to be added to the Codex environment.

## Run after the change is deployed

1. Open **Operations → Rewards → Test selected customers & order rewards**, or `/setup/customer-pilot`.
2. Enter the existing Operations setup secret and select the supplied `GYVFT-first-20-import.json` file. Customer lists remain outside the public source repository and are not hardcoded into the page or API.
3. Select **Check selected customers · no changes saved**. Each customer is checked in sequence against current Shopify orders, the configured retail collection and current GYVFT records. The actual database transaction stages the order mirrors, computes the proposed allocation and **rolls back**. No account, wallet, order mirror, import, journal entry or credit is saved by this check.
4. Review the proposed account creation/preservation, available points, pending points and excluded/review orders. Tick the approval and select **Apply reviewed customers & rewards**.

Each customer commits atomically. A later customer failure does not undo earlier confirmed customers; the page shows that progress and retries the same key for uncertain saves. Rechecking after a refresh also preserves accounts and already-authorised orders, so a new run does not duplicate historical credits. No email invitations are sent in this test. New accounts have a random, undisclosed initial password and use the existing Operations password-setup invitation flow separately.

## Requirements and policy

This page runs **no migrations or schema changes**. Customer accounts/profiles, Operations intake and rewards tables must already exist. Missing installation is reported with links to the existing, separately approved setup paths. Save the eligible retail collection in **Operations → Rewards** before checking. The rewards programme can remain disabled; this test does not enable it or change global scan checkpoints.

Current policy remains one point per ₹50 discounted, ex-tax eligible merchandise, with fractional carry, a 14-day hold after successful payment and historical credit expiry at least 365 days after allocation. Collection membership is read live; lifetime customer spend is not the reward basis. Taxes, shipping, gift cards, non-member products and policy exclusions do not earn. Draft/non-retail source orders, refunds, edited or incomplete line snapshots stay subject to existing exact-version Operations review. No extra 50-point welcome bonus is added.

The import does not establish customer email ownership. Existing verified wallet binding is preserved, and new wallets remain unbound until the customer completes the normal email verification. No Shopify mutation, coupon, price change, invitation or notification runs here.

## Implementation and transaction boundaries

- `/api/operations/customer-pilot` requires the existing `x-setup-secret`, validates exact command fields, rejects foreign browser origins, rate-limits and returns no-store JSON.
- Input is a local JSON array of one to twenty distinct `{shopifyCustomerId,email,name}` records; optional `sourceOrderCount` is informational. Each request handles one selected customer, keeping function work bounded. No customer PII is shipped in application assets.
- Native server Shopify credentials verify the current customer email, full-history permissions and all pages for that customer (ten pages of ten orders maximum, with a time bound). Incomplete or unexpected history fails closed.
- All provider reads and random password hashing finish before the database transaction. The existing one-connection client is reused; no nested pool acquisition occurs.
- The settings row, customer email advisory lock, existing account and wallet are locked. Active global scans, inactive/demo accounts, changed wallet identity and changed already-credited order facts block the test.
- Existing account passwords, profile fields and verification state are never overwritten. Missing accounts get an Operations intake audit row. Only returned live order IDs for the selected customer can become newly authorised; existing authorised rows participate in fractional carry.
- A fingerprint binds the selected identity, live order facts, account state, retail settings and scoped opening snapshot. Apply refetches Shopify and rebuilds that snapshot. Stale checks roll back. The owner-approved import and intake records share a UUID; replay checks that UUID, fingerprint and customer audit journal before returning an existing result.
- Available earning uses the existing lot and ledger reconciliation. Recent orders can be authorised while their points remain pending. Replays and new previews do not duplicate earning.

The executable SQL is parameterised in `src/lib/rewards/pilot.ts` and the existing rewards store. There is no new migration file, automatic deployment hook, production SQL execution or arbitrary SQL upload facility.

## Validation

Local disposable PostgreSQL-compatible tests cover rollback, account/profile preservation, order-scoped allocation, tax/discount basis, collection membership, fractional carry, pending holds, exclusions, missing permissions, stale reviews, atomic failure, replay and concurrent duplicate applies. These are functional checks, not a production concurrency benchmark. Browser checks use a production build at 390px and 1440px, fictional customers and intercepted Operations responses; the unauthenticated endpoint is exercised directly. Live credentials, deployed table/configuration readiness and the real owner-run apply remain production checks.

Verified locally on 28 November: 16 customer-pilot database tests, 22 existing rewards database tests, 25 focused unit checks and three production-build browser/API checks passed. Production build, TypeScript, focused ESLint and formatting checks passed. The disposable PGlite wire fixture uses an explicit test-schema selection because it does not apply PostgreSQL startup `search_path` options; no production configuration is changed.
