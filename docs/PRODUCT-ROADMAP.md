# GYVFT roadmap: customer identity to cross-company gifting

Updated: 14 November 2026.

Source: [GYVFT Product Vision](https://docs.google.com/presentation/d/1AQ-ZCWcMjrmDOKK5yd1udeqbiLLWdE2pW4ilYQ3YPes). The accepted-circle interpretation follows the founder's clarification: both companies are on GYVFT; people connect across companies; occasions are shared within accepted circles and GYVFT surfaces relevant moments for gifting.

## Destination

**Company A and Company B are on GYVFT. Their verified employees form accepted personal connections. A permitted occasion appears in the right person's space, and that person can arrange a gift, use an eligible benefit, pay, and follow delivery without seeing the recipient's private address.**

The existing enquiry-led, service-led gifting process remains a path through this experience. Aarla OS remains the operational system to connect separately. A company workspace is a customer-facing organisation space; it is separate from an internal GYVFT team Studio.

## Identity and buyer classification

A person has one persistent identity and can act in more than one context. B2B/B2C describes the customer/buying context, not a permanent restriction on the person.

| Situation | Customer context | Link records |
| --- | --- | --- |
| A company buys merchandise or gifts using company funds | B2B | Organisation/workspace, authorised company contact, enquiry/project/order |
| An individual buys a gift personally | B2C | Individual customer, enquiry/project/order |
| An employee buys personally for a friend at another company | B2C purchase with verified employment eligibility | Sender's personal identity, sender's company membership/benefits, accepted recipient connection |
| The same employee places an authorised company-funded order | B2B purchase | Their company role and approval permissions, kept separate from personal activity |

At enquiry intake, capture whether the request is personal or on behalf of a company. On conversion, create or link the B2B organisation or B2C individual as already agreed, preserving the enquiry history. Reuse existing people and organisations rather than duplicating them for every order. A corporate email alone does not make a purchase B2B.

## Phase 1 — customer foundation and first real journey

**Build:** verified email/password access; personal/company request context; enquiry capture; own-request details, status and conversation; useful empty/loading/error states. Keep database setup restricted to customer tables.

**Completion check:** two controlled customers can submit, sign in again and see only their own requests. Logging out or changing a request URL does not reveal another person's data. Setup runs safely without modifying existing Aarla business tables. A newly submitted enquiry still reaches the existing operational intake.

**Current position:** the portal and setup code exist, but the full live customer journey still needs verification. Canned enquiry data is being prepared for testing; it is not a substitute for testing a real submission. This is a fresh launch, so no historical enquiry import is required.

## Phase 2 — onboard B2B companies

**Build:** company workspace, domain verification, designated company administrator and authorised buyer roles, employee roster/invitations, and the company's merch/gifting request view. Support basic B2B enquiry-to-project conversion.

**Completion check:** Company A and Company B can be onboarded independently. Each administrator manages only their own workspace and company-funded activity. Onboarding both companies does not automatically connect their employees or share occasions.

**Keep focused:** a full HR system, campaign planner and internal GYVFT CRM are not prerequisites for the pilot.

## Phase 3 — activate employees and their personal space

**Build:** employees accept invitations and verify work email; company membership and benefit eligibility are linked to a persistent personal identity. Provide separate company and personal contexts. Personal profile enrichment is chosen by the employee.

**Completion check:** an employee can access their personal space and eligible employer benefits. Their employer cannot see private purchases, circles, interests or occasions. When employment changes, personal identity/history remain with the person and employer-specific eligibility can be revoked.

**Important data distinction:** account identity, verified email addresses, company memberships, customer records and orders are linked records with separate purposes. They must not collapse into one shared company login.

## Phase 4 — My Circle and accepted connections

**Build:** private circles, person-to-person connection requests, explicit acceptance, removal/blocking and clear connection states. Cross-company discovery/connection must stay within agreed privacy rules.

**Completion check:** an employee at Company A can request a connection with an employee at Company B. Before acceptance, no private occasions are visible. After acceptance, each person can choose what to share. A connection does not grant access to the rest of either company's roster or the other person's circle.

## Phase 5 — occasion-sharing intelligence

**Build:** users maintain birthdays, anniversaries, work anniversaries and custom occasions; choose which accepted connections can see them; set reminder preferences; and receive a permitted upcoming-occasion view.

GYVFT's first intelligence is permission-aware: **whose occasion, shared with whom, occurring when, and what gifting action is relevant**. Employer-held HR dates are not automatically published into personal circles.

**Completion check:** a shared occasion appears for an accepted connection and remains hidden from everyone else. Changes/revocation affect future visibility and reminders. Repeated processing does not send duplicate reminders.

## Phase 6 — turn an occasion into a gift

**Build:** start gifting from a visible occasion; select an actual available gift or request curation; add a personal note; apply eligible Aarla/ Kanakangi benefits under configured rules; collect recipient acceptance and delivery information privately.

Both paths belong in the vision:

- **Service-led:** enquiry → discussion/curation → quote → acceptance → 50% advance verified → design/personalisation → approval.
- **Self-service personal:** an employee chooses from an approved offering and completes the required personal purchase steps without corporate approval. Apply the agreed payment policy; do not introduce a new exception to the 50% rule without a product decision.

**Completion check:** the sender can see the gift, price/quote, applicable benefit and next step. The recipient confirms delivery details through a secure, limited-access flow. The sender cannot retrieve the recipient's address through the UI, APIs or shared links.

## Phase 7 — payment, order handoff and fulfilment

**Build:** Razorpay payment links and/or direct UPI/GPay with receipt verification; a payment ledger; the Shopify handoff at the agreed approved-order point; customer-visible production and delivery updates.

Agreed rules:

- Every order requires **50% advance**; the remaining **50% is due before dispatch**.
- A direct UPI reference is pending until receipt is verified.
- Design approval belongs to a specific version.
- For custom work, create/link the Shopify order after the agreed scope/design approvals and required order details are ready.
- Payments already collected must be credited; retries must not create duplicate Shopify orders or duplicate payment credits.

**Completion check:** one real gift can be paid for, handed to operations/Shopify, fulfilled and tracked to delivery. Inspect sender emails and Shopify order-status links as well as GYVFT screens for recipient-address leakage. Employers see company-funded orders, not employees' private purchases.

## First complete pilot — the launch milestone

Use **two onboarded companies, one verified employee in each, one accepted connection, one consented occasion, and one approved gifting option**.

Prove this full journey:

1. Classify the buyer's context correctly.
2. Verify both employees and their company memberships.
3. Send and accept the personal connection.
4. Share one occasion with that accepted connection.
5. Surface it to the sender and begin the gift request/purchase.
6. Confirm the gift/quote, applicable benefit and payment requirements.
7. Obtain recipient acceptance and private delivery confirmation.
8. Verify advance/payment, complete any proof approval, and hand the order to Shopify/operations.
9. Verify the balance before dispatch and show delivery progress.
10. Confirm that unrelated employees, company administrators and the sender cannot access private information outside their permissions.

The first pilot can use a small approved offering and operator-assisted curation/verification. It does not require an unrestricted product catalogue, a recommendation engine or a full campaign platform.

## After the pilot

Expand employee onboarding/import tools, company-funded budgets/approvals, reusable merch offerings, broader catalogues, wishlists, repeat occasions, gift suggestions, richer experiences and operational automation. Build each from validated use rather than treating every vision slide as a day-one dependency.

## Decisions to settle before the relevant phase

| Decision | Needed by |
| --- | --- |
| Exact B2B conversion trigger and who can authorise company purchases | Phase 2 |
| Employee account portability and verification when employment changes | Phase 3 |
| How people find one another and which connection requests are allowed | Phase 4 |
| Occasion visibility, reminder defaults and revocation behavior | Phase 5 |
| Pilot gift offering, benefit rules, shipping/serviceability and recipient claim rules | Phase 6 |
| Declined/unclaimed gifts, cancellation/refunds, payment verification and Shopify/operations ownership | Phase 7 |

No new implementation is implied by an unresolved decision in this document.

## Working order

**Now:** finish and verify Phase 1 with clearly labelled sample data and controlled customer accounts.

**Next:** the minimum slices of Phases 2–5 needed to establish two companies, verified employees, an accepted circle connection and a shared occasion.

**Then:** the gift, private-address, payment and fulfilment slices in Phases 6–7 that complete the first cross-company pilot.

**Later:** expand breadth and automation after that pilot succeeds.
