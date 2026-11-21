# Production verification for the first GYVFT pilot

20 November 2026. Code deployment and local tests do not establish a working production journey. The pilot is ready when the checks below have evidence from the live environment. Manual Operations is acceptable; the record and customer promise must be correct.

## Current evidence

- Shipping release #58 is deployed. Local unit/database tests and two simulated-courier browser flows passed.
- The owner approved the exact additive shipping SQL on 20 November. Its production application is not yet verified.
- The earlier `aarla@aarla.in` account lookup returned no active account. Its history is unresolved. Establish the existing identity before treating sign-in or recovery as verified; replacing it is not an incident investigation.
- Actual reset/notification inbox delivery, merchant Shopify handoff and a real courier parcel remain live checks.

## Activate the approved schema

Use **`/setup/shipping`**, enter the existing Setup/Operations secret, then **Check pending updates**. This first action only reads migration history. The shipping page executes only `20261120000001_shipping.sql`, compares its SHA-256 with the exact approved file, and blocks if earlier customer migrations are missing. It never applies those missing files on the operator's behalf. The shared database migration lock and transaction remain in force.

If status says ready, select **Apply approved shipping update**. Confirm that shipping is recorded as applied and the Operations shipping controls load. If earlier updates need review, stop at that result and review them separately. Generic `/setup` still runs all pending customer migrations and is not the shipping-only entrypoint.

## Run one controlled live journey

Use a small genuine internal gifting order with a known customer and operator, so any actual payments, Shopify records and courier charges have an agreed purpose. Use the real customer interface and a separate Operations browser session. Demo accounts intentionally suppress email and real external writes; they cannot establish those live checks. Agree the order and courier charge before executing external bookings. Do not label simulated payments or provider responses as production evidence.

| Gate                      | What to do                                                                                                                       | Required evidence                                                                                                          | Who supplies the external confirmation                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Access and recovery       | Resolve the original account lookup, sign in/out, request reset, receive it, reset once and sign in again                        | Matching account, usable delivered email, used link rejected, former sessions revoked                                      | Owner confirms inbox access; developer checks application result/log reference |
| Brief and curation        | Submit a gift, find the same brief in Operations, publish visual options; choose an option or customise a copy                   | Shared request ID and matching recipients/budget/dates; published original preserved                                       | Customer and operator                                                          |
| Quote and artwork         | Review composition, quantities, taxes, packaging and delivery charges; approve exact quote/artwork versions                      | Clear total, 50% now and remaining 50% before dispatch; production locks approved contents                                 | Customer and operator                                                          |
| Payment                   | Make an agreed genuine payment, upload its proof, check the receiving bank, then verify it in Operations                         | Matching actual receipt, amount/reference, pending→verified state visible to customer; balance gate blocks unpaid dispatch | Owner/operator verifies the bank, not the screenshot alone                     |
| Official order            | Match the existing Shopify customer and create/link the one custom batch order; refresh/repeat the action                        | Correct customer, single order, one batch line, correct total/payment record, no duplicate order                           | Operator compares Shopify and GYVFT                                            |
| Delivery                  | Enter actual parcel allocations; use manual Porter/courier/collection or an authorised Delhivery parcel                          | Correct contact/warehouse, booking/reference, pickup and actual status; full payment before dispatch/collection            | Operator confirms physical handover/carrier result                             |
| Partial completion        | For a genuine split order, complete one destination first                                                                        | Partial counts in both views; whole order stays incomplete until all sets finish                                           | Customer and operator                                                          |
| Notifications             | Trigger a team reply, quote/artwork/payment/delivery update                                                                      | Correct recipient and secure request link, actual inbox receipt, failed-send visibility/recovery                           | Recipient confirms inbox; logs alone show provider acceptance                  |
| Isolation and interaction | Use a second account, try another customer's request/media URL, test mobile, double-click and retry after an interrupted request | No cross-account data, usable controls/loading/error feedback, no duplicate financial/courier action                       | Developer/browser runner                                                       |

A single genuine shipment can verify the first courier path. Simulated split tests remain useful evidence for quantity/status rules; they do not establish that a merchant's live courier account accepts all delivery modes. Porter and store collection can remain manual for the pilot. Delhivery live validation waits for the entered merchant credentials and an authorised parcel.

## Aarla shopping benefit

After **Check Aarla savings connection** passes in Operations, use one real signed-in customer to select an Aarla product. Confirm one customer-only 5% code with a 24-hour lifetime in Shopify, a repeated click reusing that code, and the selected product opening through its discount URL. Confirm checkout identifies the linked customer, applies the saving and allows only one redemption. Use a second account to confirm separate eligibility. Local simulated redirects and GraphQL validation do not verify the merchant's live checkout. Coupon state lives in Shopify; this feature adds no database migration.

## Sign off and share

For each gate record the live date/time (IST), request/order reference, result, screenshot/log reference, and any defect. Keep passwords, keys, reset links, bank screenshots and private addresses out of shared review material. Mark **passed**, **blocked**, **failed**, or **not in this pilot**; do not mark a skipped check passed.

Launch a small invited pilot when sign-in/recovery, private ownership, accurate approvals/charges, bank verification and the chosen manual or API delivery path pass. Fix blockers before expanding. Broader B2B legal entities, multi-registration GST billing and real-time courier/webhook automation are separate scope; the circles prototype or local tests do not establish those features in production.
