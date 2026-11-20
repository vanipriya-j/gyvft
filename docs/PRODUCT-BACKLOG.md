# GYVFT product backlog

Updated: 20 November 2026. The current priorities below supersede the retained 14 November launch notes. This is the working scope and priority list, not a commitment to build every future item now.

## Approved shipping implementation — 20 November 2026

[Parcel shipping](SHIPPING.md) now implements Delhivery key settings, one explicit booking per physical parcel, batch pickup, read-only tracking/reconciliation and manual Porter/other-courier/store collection. Gift-set allocations and partial delivery are shared with customer Delivery. Activation is gated by separate approval of additive SQL and entry/testing of the merchant's credentials. No production SQL, live booking, Shopify auto-fulfilment or broader B2B billing work was performed. The E3/E5 entity/commercial work below remains proposed; these parcel controls do not grant business purchasing authority or create GST invoices.

## Current scope — business identity and delivery

The individual gifting application, real Circles and email recovery have progressed beyond the original enquiry-only plan below. Manual Operations and manual official-order handoff are accepted for the pilot. Missing automation alone is not a customer-launch blocker; truthful prices, billing, delivery promises, ownership and notifications still matter. Local/captured-mail evidence is separate from production delivery evidence.

Business circles are not yet commercial legal entities. See [BUSINESS-ENTITIES-AND-DELIVERY.md](BUSINESS-ENTITIES-AND-DELIVERY.md) for the agreed distinction, proposed contracts, acceptance gates and `/business-review.html` for the interactive review. Employee home delivery is optional: office bulk, several destinations and individual/mixed delivery are independent of billing.

| Priority  | Item                                                                                                  | Status / completion gate                                                                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Now · E1  | Review entity/billing/delivery UX and object model                                                    | Architecture and interactive fictional prototype prepared. Sign off before replacing application screens.                                                                                                        |
| Next · E2 | Legal entities, several GST registrations, billing profiles, explicit business access                 | Proposed; no production persistence/API yet. Review exact additive SQL separately before application. Circle/domain matching must not grant commercial authority.                                                |
| Next · E3 | Request buyer context and quantity-checked delivery allocations                                       | Proposed; one location / split / individual, with incomplete enquiry drafts allowed. Preserve the personal path and public seven-step intake.                                                                    |
| Next · E4 | Immutable commercial snapshots and Operations review                                                  | Proposed; bind current authority, exact quote and billing/delivery versions. Preserve payment policy and official-order/production locks.                                                                        |
| Next · E5 | Correct business Shopify handoff and partial delivery                                                 | Existing adapter remains B2C-only. Resolve bill-to/GST invoice output and the single-line/multiple-destination constraint before enabling business handoff. Manual ops is acceptable with verified records.      |
| Then · E6 | Guided B2B pilot and entity reporting                                                                 | Office bulk and split/mixed examples, outsider/revoked-role tests, invoice history, payments, notifications and official-order reconciliation. No duplicate personal/company spend.                              |
| Parallel  | Email production receipt check                                                                        | PR #55 added customer recovery and Ops status/test controls without a migration. Build/captured-mail checks passed; real inbox delivery and deployed cron invocation need their own evidence. WhatsApp deferred. |
| Later     | Procurement budgets, multi-stage approvals, bulk imports, credit terms and cross-company intelligence | Separate increments; not prerequisites for an ordinary business entity placing a gift.                                                                                                                           |

**Data rule:** no production migration, deletion, identity conversion or backfill without explicit approval of the concrete operation. Old cleanup suggestions do not authorise any data change. Builds/startup/page loads never migrate.

## Historical 14 November scope

The sections below record the initial enquiry-only scope and evidence available then. They do not override the current scope, later accepted Operations/commerce decisions or the explicit data rule above.

## Immediate release goal

**A customer creates an app-owned email/password account, submits an enquiry, signs back in, and sees only their own request and its current status.**

Customer authentication uses GYVFT password hashes and database sessions. Supabase is the database host, not the customer identity provider. Application-level reports/logging live in GYVFT; infrastructure monitoring stays on Vercel.

Aarla OS remains the existing business operations system. This release does not require a GYVFT team Studio, campaigns, new business/customer master records, payments, or Shopify order creation. Existing unrelated database tables must remain unchanged.

Code being present or a build passing is not the same as the customer journey being verified live.

## Now — prove the customer journey

| ID  | Item                                        | Current evidence                                                                                                                                                         | Complete when                                                                                                                                                                          |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Initialize only customer-portal tables      | Customer-only setup fix implemented in PR #25. Reproduced the exact `campaigns.deleted_at` failure using the supplied schema and verified that scoped setup avoids it.   | Production `/setup` completes once, repeats safely, and leaves existing business tables/history unchanged.                                                                             |
| N2  | Customer email/password access              | App-owned signup, sign-in, password recovery, secure sessions and sign-out implemented; live end-to-end flow still requires confirmation.                                | A fresh customer can register without an OTP, sign in again, recover access and sign out. App password hashes/sessions and enquiry ownership are verified.                             |
| N3  | Capture and show the customer's own enquiry | New public submissions mirror to customer storage after lead email delivery when the database is configured. Existing email and Aarla lead forwarding remain.            | A controlled test enquiry appears under the same verified email, with its submitted brief and truthful status. Failed capture is not silently mistaken for successful portal delivery. |
| N4  | Keep requests private                       | Server checks verified email ownership; unit tests cover cross-customer reads/writes. Customer tables deny direct browser access.                                        | Two controlled customer accounts cannot access each other's requests, including by changing a request URL. Logged-out visitors cannot see request details.                             |
| N5  | Clear, minimal experience                   | Single-button setup with live progress/diagnostics implemented. Enquiry records hide payment/production sidebars; project counters appear only if project records exist. | Mobile and desktop show clear login, loading, empty, error and request states; no invented progress or irrelevant future steps.                                                        |
| N6  | Release check and instructions              | User manual exists; deployment and first live migration are separate steps.                                                                                              | N1–N5 pass on the live deployment, the manual matches the tested journey, and remaining limitations are explicit.                                                                      |

**Historical release decision:** this was a fresh launch with no required historical import. Any proposed cleanup now needs separate explicit approval for the identified records. Neither this backlog nor old fixture permissions authorise discarding existing data.

**Suggested order:** N1 → N2 → N3 → N4/N5 → N6. Do not start later commerce/operations work while the basic journey is unverified.

Historical optional cleanup idea: any reset of identified GYVFT test enquiries would require a concrete reviewed operation and explicit approval. It is not part of the current release.

## Customer dashboard first version

Implemented for review: compact searchable requests; actual pending latest-version approvals; private occasions added after enquiry; distinct occasion/requested-delivery dates; saved portfolio inspiration; request-activity and requested-format charts; recorded project-payment totals; contextual links to real Aarla collections. The original seven-step public form is unchanged.

Next commercial work: Aarla status/reply loop and actual quote/order/payment syncing; item-level purchase insights; reminder delivery with customer preferences; recipient profiles learned through curation; household/company collaboration and accepted circles. Do not infer occasion dates from brief targets or report requested formats as purchased products. The existing 50% advance / balance-before-dispatch policy remains in force for GYVFT orders.

## Next — make progress and conversations useful

| ID  | Item                                         | Definition of done                                                                                                                                                                                        |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1  | Publish enquiry progress from Aarla OS       | Agree the existing Aarla enquiry ID, customer ownership and customer-visible status mapping; authenticated/idempotent sync updates the correct request. Internal notes remain private.                    |
| X3  | Complete the customer/team conversation loop | Customer messages reach the operational team and customer-visible replies return to the correct thread. The current portal saves messages locally; external delivery/team reply tooling is not connected. |
| X4  | Decide customer notifications                | Agree which events deserve email and opt-out behavior; retries do not duplicate messages. Avoid notifications for every internal change.                                                                  |
| X5  | Operational reliability                      | Reconcile a successfully emailed enquiry if the portal mirror fails; expose a useful diagnostic and repeat safely without duplicating records.                                                            |

A timeline and message UI already exist, but a real source of team updates and replies must be connected before promising those workflows to customers.

## Later — agreed business direction, separate implementation work

| ID  | Item                                     | Decisions already discussed                                                                                                    | Boundary before building                                                                                                                      |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Convert an enquiry to a customer/project | B2B links to an organisation and contacts; B2C links to an individual. Preserve enquiry history and reuse returning customers. | Agree the source of truth with Aarla OS; a login identity is separate from the customer record.                                               |
| L2  | Curation, proposals and design approvals | Versioned proposals/designs and approval/change-request decisions.                                                             | Agree who publishes versions and how decisions reach the team; old approvals must not approve a revised version.                              |
| L3  | Payments                                 | Every order requires 50% advance; remaining 50% before dispatch. Razorpay payment links or direct UPI/GPay.                    | Verify Razorpay receipts; direct UPI references stay pending until actual receipt is verified. Never count a screenshot/reference as payment. |
| L4  | Shopify order creation                   | Create/link the order once scope/designs are approved at the agreed handoff point.                                             | Define order timing, products/personalisation and how existing receipts are credited so customers are not charged twice.                      |
| L5  | Production and delivery tracking         | Customer-visible milestones through production, packing, dispatch and delivery.                                                | Confirm the operational event source; do not infer delivery or fabricate dates.                                                               |
| L6  | GYVFT team workspace, only if wanted     | A team login was discussed as a possible simplification.                                                                       | Make an explicit product decision first. It is not a prerequisite for customer login or database setup.                                       |

Some supporting code/tables from the earlier broad implementation exist. That does not make these workflows live, approved for immediate rollout, or a reason to expand the first release.

## Separate content queue

Add these four Stories when project facts and approved images are supplied:

- Maduramahi's Ayushhomam
- Orient Star
- GV's Gana Vinayasa Magnets for Vijaya Dasami
- Lakshana's Arangeetram

This content work is independent of customer access. Do not invent hamper contents, outcomes or images to fill missing details.

## How we work from this backlog

- Select one item and its acceptance criteria before implementation.
- Keep each PR focused on that item; merge after appropriate checks pass, as authorised.
- Verify live behavior separately from code/build completion.
- Update status here with evidence; move items between Now/Next/Later deliberately.
- Do not reshape existing Aarla business tables to satisfy unused legacy Studio migrations.

## Circles implementation · 19 November 2026

Implemented and locally verified on `codex/real-circles`; production activation waits for explicit approval of additive SQL `20261119000002_circles.sql`. See [CIRCLES.md](CIRCLES.md) for the domain, screens, permissions, demo data and approval-controlled rollout. This replaces the prior plan-only backlog entry; labels alone did not implement Circles.

Includes real records, multi-circle membership, owner/admin/member rules, invitation acceptance/revocation, recipients, profile consent, shared occasions, gift context, archive/restore and institutional verification in Operations. Cross-company intelligence, automatic membership, budgets, shared purchasing authority, bulk import and reminders are later work.

No production SQL or data deletion was performed during implementation. The manifest change is proposed for review, with no automatic execution hook.
