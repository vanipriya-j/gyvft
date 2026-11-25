# Aarla rewards in GYVFT

Implemented on 25 November 2026. Code activation and real financial allocation are separate owner actions. No production migration, historical allocation, price change, real verification email or live coupon accompanied development.

## Ownership and customer flow

GYVFT owns the policy, integer-paise calculations, verified customer connection, wallet, earning lots, ledger, reservations and coupon issuance. It creates a native customer-specific coupon through the existing Shopify Admin API credential. Aarla handles the cart and checkout; Shopify remains authoritative for order, payment, refund and coupon-use facts. No Shopify loyalty subscription, Shopify Plus feature, checkout extension or parallel GYVFT checkout is required.

`/account/rewards` is linked from desktop/mobile account navigation and the profile. A customer confirms ownership of their email before connecting historical purchases. Logging in with an address, or an existing Shopify customer ID on the account, does not prove ownership. Confirmation emails contain a one-hour opaque token in the URL fragment. The public `/rewards/verify` landing preserves it for the sign-in flow in tab-scoped storage; no GET consumes it. A same-origin authenticated POST consumes the hash once, checks the current Shopify customer email and binds one wallet to one GYVFT account. Provider acceptance is described as acceptance, not delivery.

The customer chooses points in GYVFT, sees their exact saving and minimum eligible merchandise purchase, then opens Aarla with the coupon applied. A wallet lock reserves the points before the provider call. The handoff does not spend points. An authenticated “Check Aarla checkout” action or the daily reconciliation confirms the matching customer's paid order before spending. Retry uses the same canonical code, including a lost create response. An uncertain provider result keeps the reservation until usage can be established.

## Version-one policy

| Rule | Implementation |
| --- | --- |
| Scope | Owner-selected Aarla D2C retail collection; custom quotes and wholesale excluded |
| Earn | 1 point per ₹50 eligible merchandise spend, after normal discounts; 1 point = ₹1 |
| Exclusions | GST, shipping, gift cards and non-catalogue fees; no earning on any points/occasion redemption order |
| Carry | Sub-point eligible spend carries across the customer's authorised purchases |
| Hold | 14 days after the latest successful sale/capture payment, not draft creation |
| Expiry | 365 days after availability; historical opening points receive 365 days from allocation approval where later |
| Redeem | Whole points, up to 25% of eligible merchandise subtotal; a ₹100 coupon requires ₹400 eligible merchandise |
| Coupon | Specific customer, one use total, one use per customer, fixed total amount, selected collection only |
| Combination | All product/order/shipping discount combination flags false; choose normal 5%, points or an occasion offer |
| Points coupon life | 24 hours |
| Ordinary refunds | Stop/reverse earning pending review of the retained ex-tax merchandise value; spent points produce a debt covered by later earnings |
| Expired reservations | Return only after matching Shopify policy, usage and orders establish non-use, with a 48-hour safety interval; original point expiry still applies |

The native collection minimum counts eligible items only. This prevents unrelated items from satisfying a rewards minimum. Marked-down catalogue prices are product prices; Shopify's discount combination controls govern codes and automatic discounts. Do not claim these controls can detect every manual price change.

Redemption-order refunds do not automatically restore already-spent points in this version. Partial refunds, order edits, an unclear retail channel, missing payment evidence, missing identity or an oversized/incomplete line snapshot require Operations review. The system chooses no credit while facts are unresolved. This is a deliberate conservative pilot boundary, not a claim of automatic returns settlement.

A normal 5% Aarla saving remains available through the existing shopping flow. Reward orders earn nothing on the whole order, including its cash-funded portion. No 7% repricing is performed by this release.

## Own birthday and anniversary

Customers optionally enter month/day for their own birthday and own anniversary, separately from recipients and occasions. They can withdraw consent. A verified customer with a completed eligible retail purchase can claim ₹150 off ₹1,500+ eligible retail merchandise once per occasion/event year, from seven days before through seven days after. The coupon expires at the end of that occasion window. Dates are fixed for 365 days after an occasion coupon is issued; consent can still be switched off. Leap-day birthdays use 28 February in non-leap years. Calendar calculations use Asia/Kolkata. Annual uniqueness uses the event year, including a window crossing New Year.

This release implements coupons, not automatically shipped physical birthday gifts. Such a gift still needs an item, stock/cost policy and fulfilment decision.

## Operations

`/operations/rewards` uses the existing separate operator access and stable Operations frame. It provides:

- Programme on/off and an existing Shopify retail collection ID. Collection changes require a new complete scan before redemption or historical approval.
- Posted rewards liability and reserved points, identity and order counters, last complete scan and an incomplete-scan warning.
- Bounded resumable order scans, reserved-coupon reconciliation and daily maturity/expiry processing.
- Exact-version review of uncertain orders, with an approved ex-tax retained merchandise amount and a reason/evidence reference. ₹0 excludes that amount. Test/cancelled/business/redemption exclusions cannot be overridden here.
- A historical preview of purchases past their 14-day hold, with per-customer allocation and a safe CSV download. Approval is tied to the complete snapshot and cannot silently follow changed orders. Applying the same approved preview twice does not credit twice.

The eligible collection must contain only ordinary retail products. The owner remains responsible for collection membership. A manual/draft order is held for review, not automatically called wholesale. Orders with more than 20 lines, 30 discount applications or an incomplete transaction snapshot require review rather than truncated earning calculations.

Pausing rewards stops new issuance; native coupons already created retain their Shopify terms. Retain the published customer promise when handling outstanding codes. Historical records are mirrored without credit. The current initial scan may take several “Scan next batch” actions; a server function checks up to 25 orders within its time budget, then saves its cursor. Do not interpret “scan complete” as “all historical points allocated.”

## Daily pull and recovery

`GET /api/cron/rewards` requires `Authorization: Bearer $CRON_SECRET`. Vercel schedules it at `45 3 * * *` UTC, 9:15 am IST. It skips when rewards tables or the collection are not configured. The job fetches orders by updated time, preserves a stable upper bound/cursor, overlaps the previous watermark by one hour and resumes failed pages. There is no `created_at:last24h` shortcut that would miss refunds or edited orders. Initial history may span multiple invocations. Operator scans can finish that bootstrap immediately.

Coupons use the existing credential exchange in `src/services/shopify/admin-auth.ts`, pinned to `aarla-merch.myshopify.com` and API `2026-10`. Required capabilities include orders/history (`read_orders` plus `read_all_orders`), products/collections, customer lookup/current protected email and discount read/write. Existing GYVFT-to-Shopify customer creation still requires `write_customers`. A ChatGPT connector grant does not establish these permissions on the deployed app credential.

A 90-second database lease prevents overlapping scan batches. Wallet row locks and unique pending/annual indexes protect concurrent redemption. Lots spend earliest expiry first. The immutable journal explains earning, refunds, expiry, reservations, spending, release and owner reviews. Provider errors use safe classifications/support references rather than logging customer details, tokens or raw GraphQL payloads.

A paid matching order spends the reservation once. A timer alone never releases it. A modified native coupon, consumed code without a trustworthy matching order or a cancelled-but-counted use stays held for review. Native queries are read-only during reconciliation; there is no automatic coupon deletion.

## Owner activation: separate from deployment

1. Review `supabase/migrations/20261125000001_d2c_rewards.sql` and its checksum in `src/lib/database/rewards-activation.ts`.
2. At `/setup/rewards`, check installation status, review the exact additive SQL and explicitly approve that file only. The dedicated `rewards` migration scope enforces its checksum and customer-account prerequisite. Generic customer setup deliberately excludes it. No startup/build/deploy hook runs migrations.
3. In Operations rewards, select an existing retail-only collection. Start/finish the Shopify scan. Enable the programme when ready to honour earning and redemption. New programme purchases are authorised separately from historical purchases.
4. Download/review the historical customer preview. Apply only the exact allocation you approve. Recent historical purchases remain held and need a later preview once 14 days have passed. This step credits balances; checking status, deployment and scanning do not authorise it.
5. Complete a controlled real customer verification and coupon handoff at Aarla. Confirm customer eligibility, minimum, non-combination and one paid order before describing live checkout/credit as production-verified.

Existing customer, request, quote, payment, circle and Shopify order tables are not erased or rebuilt. The migration creates private rewards tables, enables RLS and revokes browser roles. The programme defaults off. There is no bulk reprice, historical balance overwrite, marketing blast or Kelvi integration in activation.

## Validation and references

The automated suites cover integer earning/carry, inclusive GST and discount allocations, gift cards and collection eligibility, source classification, native coupon policy tampering, customer-only binding, concurrent reservation, uncertain response recovery, paid-order settlement, expiry, refund debt, annual offers, exact historical approval and customer/operator/cron boundaries. PostgreSQL tests require the dedicated `127.0.0.1:55438/gyvft_gallery_test` fixture and create isolated schemas; they refuse other database hosts/ports. Provider calls are mocked and real customer domains are blocked in browser fixtures.

All seven generated Admin GraphQL operations were validated against the configured `2026-10` schema. Production-build browser coverage and final suite counts are recorded in the pull request/release notes. Controlled browser provider results establish the app flow, not real Shopify checkout or email delivery.

- [Shopify amount-off discount rules and eligible-item minimum](https://help.shopify.com/en/manual/discounts/discount-types/percentage-fixed-amount)
- [DiscountCodeBasicInput](https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/DiscountCodeBasicInput)
- [DiscountMinimumRequirementInput](https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/DiscountMinimumRequirementInput)
- [Order](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/Order)
- [LineItem](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/LineItem)
- [Existing personal 5% saving](AARLA-SHOPPING-SAVING.md)
