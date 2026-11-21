# Individual gifting release

GYVFT’s approved customer and Operations journeys are implemented against the existing customer database model. The static `/design-review.html` remains the design reference; it is not the application. Start the application at `/account` or `/operations`.

## Customer flow

| Task                                                                                       | Application route                                           |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Home, saved ideas and recorded payments                                                    | `/account`, `/account?view=saved`, `/account?view=payments` |
| Search gifts and continue private drafts                                                   | `/account/gifts`                                            |
| Create a gift using seven steps                                                            | `/account/gifts/new`                                        |
| Gift overview, brief, quote/payment, artwork, delivery, moments, conversation and activity | `/account/projects/[id]` with the section navigation        |
| Curated options, composition and independent editable copies                               | `/account/projects/[id]/options`                            |
| Occasions, recurring history and a new gift from an occasion                               | `/account/occasions`, `/account/occasions/[id]`             |
| Private recipient notes and invitations                                                    | `/account/people`, `/account/people/[id]`                   |
| Own profile, sharing and correctable choice-based suggestions                              | `/account/profile`, `/account/profile/tastes`               |
| Accept an invitation using its addressed email                                             | `/account/invitations/[token]`                              |

Profiles, recipients and occasions are optional. A customer can simply create a gift, choose an option, approve a quote, pay, approve artwork and follow delivery. The existing public `/tell-your-story` form remains available.

An unsent draft is private to its customer and is excluded from the Operations request list. Submitting it keeps the same gift ID. Published curation stays unchanged; customisation produces an independent draft. The chosen composition is an immutable snapshot attached to the exact quote version. Saving an experiment does not approve a price.

## Commercial and production rules

- Approving the current priced quote confirms the internal gifting record and unlocks payment instructions. Every order requires a 50% advance. The remaining 50% is due before dispatch.
- Amounts are stored in integer paise. Screens distinguish order total, verified receipts, pending proof and outstanding balance. Uploading a screenshot never increases verified payments.
- Customers can correct pending/rejected proof. The team checks the receiving bank/provider and explicitly verifies or rejects the reference; allow up to 24 hours.
- Unit prices include taxes and normal product printing. Packaging, additional individual-name/message artwork and delivery are listed separately. One design direction and a minor change are complimentary above ₹4,000; smaller orders are discussed.
- Changes refer to an exact quote or artwork version. A new publication requires fresh approval. Starting production requires the advance, latest artwork approval, the official order reference and no unresolved change requests.
- Once production starts, gift and artwork changes are rejected on the server. Messages and payments remain available. Dispatch requires the full verified payment, an address and tracking.
- Once the official Shopify order is linked, its quoted amount/composition and delivery details are read-only in GYVFT. Use the official order and customer support to resolve corrections.

## Operations

Open `/operations` using the existing operator secret. Customer email/password sessions cannot unlock Operations. The secret is kept in the current tab’s memory and is cleared by **Lock desk**.

The permanent navigation contains Requests & orders, Customers, linked Occasions, Feedback & photos, Reports & health and Settings & connections. Requests belong in the searchable worklist, with next task, waiting party, owner and optional due date.

Inside a request, use Brief, Options, Quote, Artwork, Payments, Order & delivery, Messages & notes, Feedback & photos and Activity. Quote/artwork drafts are private until explicitly published. Internal notes have a separate audience and are never part of the customer aggregate. Message-mode switches retain separate drafts.

In Settings, enter the verified receiving UPI ID/payee and optionally upload the matching QR. A per-gift Razorpay link or UPI override can be supplied in Payments. The app does not issue UPI collect requests or verify a bank transaction automatically.

## Shopify

The connected store is Aarla, `aarla-merch.myshopify.com`, using INR. The deployed app requires its own server credential, independent of the Shopify connector in chat:

- `SHOPIFY_SHOP_DOMAIN=aarla-merch.myshopify.com`
- `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` from the installed Aarla OS app in the same Shopify organization; the server acquires/renews its access token automatically. An existing `SHOPIFY_ADMIN_ACCESS_TOKEN` remains an alternative when neither client credential is set.
- Customer/order read-write permissions and approved customer-data access; `write_discounts` also enables the personal Aarla shopping benefit. Use server-only Production variables and redeploy after saving them. See [shopping connection setup](AARLA-SHOPPING-SAVING.md).

Account creation schedules matching/creation of the Shopify customer. Operations can retry pending customer links. Confirm the final approved quote, verified advance, artwork and delivery details before **Create Shopify order**. It creates one custom batch line for the entire gift order, attached to that customer, then retains the official order reference.

The initial verified advance is part of order creation. On the Basic plan, a specified additional partial manual-payment amount requires Plus; GYVFT therefore records the final outstanding balance only after the entire order total is verified. It never requires a Plus-only partial-payment call. Conflicting totals/customers and uncertain creation outcomes require reconciliation rather than blind order retries.

If an order was created manually, use **Already created this order in Shopify?** and verify the same customer and approved total before linking its reference. Do not create a second order. Production/delivery updates entered in GYVFT must reflect the actual operational and shipping records; this release does not claim automatic carrier event syncing.

## Individual permissions and media

Customer feedback and photos are private by default. Permission to feature feedback is separate from permission for each photo. Operations can feature only specifically permitted content. Withdrawing one photo’s permission removes that photo from public reads and clears its featured state, while preserving its private copy and the other photos’ states. Re-consent does not automatically republish it.

`/gift-moments` contains only permitted, featured photos/testimonials. Photo endpoints recheck permission on every request and return `private, no-store` with `Vary: Cookie`; there are no long-lived public signed URLs that outlast revocation. Customer-only images require ownership, and operator previews require operator authentication. Invited profile information is read only while that person permits sharing; the giver’s own notes remain separate.

Photo uploads are sent individually with progress and stable retry IDs. Each image must be PNG/JPEG/WebP under 2 MB. This fits Vercel’s request limits while allowing several photos per submission.

## Object model and boundaries

The request aggregate remains `customer_projects` plus owned related records. `request.ts` reads that aggregate regardless of which tab displays it. Shared workflow/domain functions resolve next states and validate commands. Layout does not define a separate API or a second customer/project store.

`journeys.ts` handles owned briefs, profiles, people, occasions, invitations and exact-version changes. `moments.ts` handles feedback/media and permissions. `operations-workflow.ts` handles private drafts, task ownership, internal notes and permitted publication. Existing gift-workspace, payment and Shopify modules retain their authoritative records. New tables deny direct browser access through Supabase roles.

## Deployment and checks

The release adds `20261119000001_gifting_journeys.sql` to the explicit customer-only migration manifest. It adds customer tables/columns and backfills production locks for records already in production. It does not install or reshape the legacy Studio/Aarla schema.

`npm run build` compiles the application only. Production, preview and local builds do not run database migrations. Apply customer-scope migrations explicitly through `/setup`, using the separate `SETUP_SECRET`. Setup retains its status check, deliberate run action, one transaction, advisory lock and migration tracking. Do not add migration execution to build, deployment or application startup hooks.

The build-time migration hook introduced in PR #45 was removed on 19 November 2026 to restore the agreed manual setup workflow. Removing that hook does not roll back applied SQL or restore missing data. Missing-account incidents require database history and connection checks; a migration ledger alone cannot establish why a record is absent.

Required runtime configuration remains `DATABASE_URL` and `SETUP_SECRET`; notification email and Shopify require their existing service credentials. Customer authentication uses GYVFT password hashes/sessions, independent of Supabase Auth. Infrastructure monitoring stays in Vercel; application reports and safe diagnostics stay in Operations.

Validation is recorded with the release PR. The real database/browser checks include cross-customer isolation, version approval, production lock, pending versus verified money, single-line Shopify fixtures, invitations/profile withdrawal and individual public-photo revocation. A human first-time usability session is still a useful separate check; automated success does not prove human comprehension.

This individual release is complemented by [real Circles](CIRCLES.md). Commercial legal entities, corporate purchasing and multi-destination delivery are specified separately in [BUSINESS-ENTITIES-AND-DELIVERY.md](BUSINESS-ENTITIES-AND-DELIVERY.md) and remain implementation work. AI-assisted curation/RAG is also separate. Circle membership alone does not change individual gift ownership or implement company billing.
