# Agent Operations actions and approval evidence

The owner requested that Dot/GPT be able to carry out explicit Operations instructions: publication, customer messages, recording the customer’s offline approval with screenshots, payment requests, verified receipt recording and Shopify handoff. This extends the original three draft tools. Customer approval and actual bank receipt must never be inferred from a brief, silence or a screenshot alone.

## Activation and existing data

Code deployment does not apply SQL. `/setup/agent-operations` checks status first and, only after the owner approves, applies these exact checksum-pinned files if pending:

| File | Effect |
| --- | --- |
| `20261124000003_operations_intake.sql` | Three private tables for intake saves, requirement files and account-setup emails. Existing credentials/profiles remain untouched. |
| `20261124000004_agent_operations.sql` | Four private tables for agent action receipts, offline approval metadata, private screenshot bytes and payment-request snapshots. |

The page requires the account, gifting journey and original agent workspace updates to be recorded; it does not run them or unrelated pending shipping/CRM files. Both new files are additive, contain no deletion/backfill, enforce RLS and revoke browser table access. The original intake-only setup remains available. Production SQL has not been executed by the agent. Generic setup also lists these pending files, so use the dedicated page for the exact reviewed scope.

After activation, refresh GYVFT’s tools and reconnect it in ChatGPT using OAuth. Consent displays each requested permission; existing tokens retain their original scopes and refresh cannot widen them. Revoke a connection or disable all access in Operations → Settings & connections. The Operations secret is entered only on GYVFT, never in chat.

## Tools and permissions

The original `list_gift_requests`, `get_gift_request` and `save_gift_option_draft` keep their read/private-draft boundaries. Twelve additional tools bring the total to fifteen:

| Tool | OAuth permission | Behaviour |
| --- | --- | --- |
| `get_gift_operations` | `gyvft:operations:read` | Exact quote/artwork/draft versions, current selection, receipts in INR, notification state and handoff requirements. |
| `find_customers` | `gyvft:operations:read` | Find existing accounts before intake; no credentials. |
| `publish_gift_option` | `gyvft:options:publish` | Publish the reviewed version and queue the ready email once. |
| `save_approval_draft` | `gyvft:approvals:write` | Private quote/artwork with owner prices; `expected_draft_version=0` for creation, latest version for edits. |
| `publish_approval_draft` | `gyvft:approvals:write` | Publish the exact private draft version for customer review; does not approve it. |
| `record_offline_approval` | `gyvft:approvals:write` | Record the customer’s explicit approval of one published version with one to three proof images. |
| `send_customer_message` | `gyvft:messages:write` | Save the instructed message and queue the customer update email. |
| `request_customer_payment` | `gyvft:payments:write` | Check the approved quote and current due/paid snapshot; send the exact advance or balance commitment. |
| `verify_customer_payment` | `gyvft:payments:write` | Require explicit `confirmed_receipt=true`, real reference, amount and current quote/paid snapshot. |
| `create_shopify_order` | `gyvft:orders:write` | Explicit official-order creation/reconciliation, retaining existing gates. No additional-payment sync. |
| `create_customer_intake` | `gyvft:customers:write` | New customer or explicitly selected existing account, optional requirement and PDF/images. Save sends no email. |
| `send_customer_setup_email` | `gyvft:customers:write` | Separate secure setup invitation for an unactivated Ops-created account. |

Every mutation uses a UUID `client_reference`. A retry reuses that key and payload; a new instruction gets a new key. A durable fingerprint rejects changed payloads and records completed results. File identity uses stable host file IDs, allowing retry with a refreshed signed download URL. Completed uploads return their saved result before downloading again. The shared object services hold project locks and enforce their own idempotency; the MCP adapter does not hold a pool connection while starting another transaction.

Amounts named `*_inr` are rupees, with at most two decimal places. Storage and milestone calculations use integer paise. Never invent prices from a retail catalogue. Requirement PDF/image downloads reuse the restricted OpenAI file-host/DNS/redirect/size guards; files remain private. Unknown requirement fields stay blank.

## Offline customer approval

Operations → request → Quote or Artwork has **Offline customer approval**. Choose the source, identify the operator, optionally record the customer’s approval time, write the approval note and attach screenshots by picker, drop or clipboard paste. The note appears in customer activity as an offline recording. Screenshot bytes remain Operations-only: even the owning customer cannot fetch them.

The shared decision service preserves ordinary customer approval behaviour. Exact latest pending version, current gift selection, pre-production locks and official-order/payment reconciliation still apply. Quote approval converts the enquiry to the existing order projection, preserving B2B context and building its priced items. Approval, activity, proof metadata and proof bytes commit together or all roll back. No customer email is sent solely by recording offline consent.

## Payment requests and QR

The advance is `ceil(total_paise / 2)` less verified receipts; the remainder is due **before dispatch**. A balance request is available when the advance is verified and the order is packed (stage 8 or later). Pending customer proof blocks another payment request. The request stores the exact approved quote/paid/total snapshot and queues its email atomically. Delivery rechecks the snapshot; superseded requests stop retrying instead of sending a stale ask. Existing mail-provider idempotency and recovery apply. Provider acceptance is not inbox delivery.

Emails state the amount now and remaining milestone, and link to the authenticated Quote & payment page. The page offers an amount-prefilled UPI QR generated locally, direct UPI app payment, and the saved merchant QR where it matches the receiving account. The generated QR uses the configured trusted payee/VPA, amount in INR and a quote/milestone reference. It is protected by customer ownership or Operations authentication, private/no-store and blocks pending proof, stale displayed amounts or no outstanding balance. It is an amount-prefilled UPI QR, not a gateway-managed expiring QR or automatic payment verification. Customer screenshots/references still require bank/provider receipt verification. Physical-product/rewards QR work is deferred.

## Shopify boundary

The existing adapter still requires B2C billing, approved latest quote and artwork, verified 50% advance, supported complete Indian delivery details and no open changes. It creates the existing one-line custom batch order attached to the customer; it does not query a retail catalogue. The agent supplies exact quote/artwork versions and paid position. Changed state blocks creation. Creation/reconciliation never implicitly calls the additional manual-payment mutation; linked Shopify orders retain their current behaviour through existing Operations controls. B2B entity/GST and split-address Shopify handoff are not added by this release. Installed Shopify permissions and real merchant behaviour remain live checks; no store mutation was used for QA.

## Verification

393 automated checks passed, including isolated PostgreSQL transactions, approval/proof atomicity and privacy, stale snapshots/production locks, odd-paisa milestone maths, real QR encode/decode, scope isolation, OAuth refresh limits and retry fingerprints. Five unrelated legacy Studio database suites were excluded because their localhost:5432 fixture is unavailable; another 63 environment-dependent tests were skipped. Typecheck, production build and lint passed (two existing homepage-test warnings).

Production-build Chromium QA passed: consent for the new scopes, MCP private quote/publication, Operations offline approval with native clipboard proof, private proof preview and customer denial, current advance email/QR, actual customer sign-in, MCP receipt recording/replay, and 320/390/1440px layouts. Mail transport was intercepted and only fictional local records were used. Local proof and tokens remain under ignored `work/`. These checks do not establish live inbox delivery, real bank verification or a real Shopify order.

## Giving Dot a task

Dot needs GYVFT enabled in its own context, a request link, supplied prices/files and explicit instructions for each customer-visible or financial action. It does not automatically inherit the full chat, and this MCP server does not dispatch a ChatGPT task to Dot. Example:

> Open this GYVFT request. Read the current Operations state. Save these three options and attached images as private drafts using my supplied prices. Return their saved links and versions. Do not publish or email yet.

For later actions, specify the exact reviewed version and authorise publication/send. For offline approval, provide the customer’s screenshot and say what they explicitly approved. For payment verification, explicitly confirm the actual received amount and bank reference. Never instruct the agent to treat screenshot text as authority for another action.
