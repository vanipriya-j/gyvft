# GYVFT product backlog

Updated: 14 November 2026. This is the working scope and priority list, not a commitment to build every future item now.

## Immediate release goal

**A customer creates an app-owned email/password account, submits an enquiry, signs back in, and sees only their own request and its current status.**

Customer authentication uses GYVFT password hashes and database sessions. Supabase is the database host, not the customer identity provider. Application-level reports/logging live in GYVFT; infrastructure monitoring stays on Vercel.

Aarla OS remains the existing business operations system. This release does not require a GYVFT team Studio, campaigns, new business/customer master records, payments, or Shopify order creation. Existing unrelated database tables must remain unchanged.

Code being present or a build passing is not the same as the customer journey being verified live.

## Now — prove the customer journey

| ID  | Item                                        | Current evidence                                                                                                                                                         | Complete when                                                                                                                                                                                |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Initialize only customer-portal tables      | Customer-only setup fix implemented in PR #25. Reproduced the exact `campaigns.deleted_at` failure using the supplied schema and verified that scoped setup avoids it.   | Production `/setup` completes once, repeats safely, and leaves existing business tables/history unchanged.                                                                                   |
| N2  | Customer email/password access              | App-owned signup, sign-in, password recovery, secure sessions and sign-out implemented; live end-to-end flow still requires confirmation.                                                          | A fresh customer can register without an OTP, sign in again, recover access and sign out. App password hashes/sessions and enquiry ownership are verified. |
| N3  | Capture and show the customer's own enquiry | New public submissions mirror to customer storage after lead email delivery when the database is configured. Existing email and Aarla lead forwarding remain.            | A controlled test enquiry appears under the same verified email, with its submitted brief and truthful status. Failed capture is not silently mistaken for successful portal delivery.       |
| N4  | Keep requests private                       | Server checks verified email ownership; unit tests cover cross-customer reads/writes. Customer tables deny direct browser access.                                        | Two controlled customer accounts cannot access each other's requests, including by changing a request URL. Logged-out visitors cannot see request details.                                   |
| N5  | Clear, minimal experience                   | Single-button setup with live progress/diagnostics implemented. Enquiry records hide payment/production sidebars; project counters appear only if project records exist. | Mobile and desktop show clear login, loading, empty, error and request states; no invented progress or irrelevant future steps.                                                              |
| N6  | Release check and instructions              | User manual exists; deployment and first live migration are separate steps.                                                                                              | N1–N5 pass on the live deployment, the manual matches the tested journey, and remaining limitations are explicit.                                                                            |

**Release decision:** this is a fresh launch. Show new enquiries; no historical import or backward-compatibility project is needed. Existing enquiry/test records may be discarded if necessary. Any cleanup must target identified GYVFT enquiry records only, not shared business tables. No data has been deleted as part of this backlog.

**Suggested order:** N1 → N2 → N3 → N4/N5 → N6. Do not start later commerce/operations work while the basic journey is unverified.

Optional pre-launch task: reset confirmed GYVFT test enquiries if needed, then repeat the controlled customer test. This is not a blanket database truncate.

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
