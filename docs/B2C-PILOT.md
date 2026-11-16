# B2C pilot: customer and operations workflow

## Deploy

Deploy the app, then open `/setup` and run the pending customer migration with the existing `SETUP_SECRET`. The only new migration is `20261115000001_b2c_pilot.sql`; it adds approvals with private mockup images, receipt screenshots, delivery addresses, order items, operator audit events, notification outbox, Shopify associations and occasion photos. It does not initialize the legacy Studio CRM or erase existing enquiries.

`DATABASE_URL` and `SETUP_SECRET` remain required. Resend uses the existing mail settings. Shopify additionally needs server-only `SHOPIFY_ADMIN_ACCESS_TOKEN` from an offline Admin API app with customer/order read and write scopes and protected customer-data access. `SHOPIFY_SHOP_DOMAIN` defaults to `aarla-merch.myshopify.com`. Redeploy after changing environment variables. No Supabase Auth customer is needed.

## Customer UI

The original seven-step Tell Your Story form is unchanged. My GYVFT puts active gift requests and their latest available published mockups first, followed by private occasions, available Aarla products and actual product markdowns. Operational counts, charts and compact request lists follow. Real records take precedence over clearly marked samples. Missing mockups use event artwork, never an invented product preview.

Customers can add a photo to a private occasion. These dates are not shared with an accepted circle yet. Aarla discovery links open the separate store; purchases there are not silently imported. The public product feed is cached for 15 minutes and only available variants are promoted; checkout confirms current price and stock. If the feed fails, a collection link keeps the dashboard usable.

## Team workflow

Open `/operations/requests` (also linked from Operations), enter the existing operator secret, and select a request. Customer accounts cannot open the desk. The operator secret stays in tab memory and is never placed in a URL or browser storage. This pilot uses one operator permission level; named staff roles remain later work.

1. Read the original brief and reply in the same conversation the customer sees.
2. Publish a proposal with item quantities, unit prices, personalisation and any agreed fees. Prices are in INR. Include all agreed charges and tax treatment in the quote; this is not an automatic tax calculation engine. Optionally attach a PNG/JPEG/WebP mockup, up to 2 MB.
3. Customer approves the latest quote or requests changes. Publish a new version for changes. Older versions cannot be approved after replacement.
4. Convert the latest approved quote to a B2C order. Conversion copies the agreed items and locks that quote price. The customer must have connected their account to the request.
5. Configure the receiving UPI ID and payee name under payment settings. Optionally upload your merchant QR and confirm it pays the same account. Changing the UPI ID clears a previous QR unless a replacement is supplied. A per-request UPI override and manual Razorpay link are optional.
6. Customer pays using a UPI app or the QR, then uploads their screenshot, amount and UTR/reference. They see **Pending verification — allow up to 24 hours**. This is a review target, never automatic approval. Pending submissions do not change verified payments.
7. Compare the UTR and amount with the actual receiving bank/provider record. Confirm receipt before verifying. Reject incorrect evidence, or record an independently verified manual receipt. Duplicate references cannot increase receipts twice. Pending reviews older than 24 hours are highlighted in the desk.
8. Publish a versioned design/mockup. The customer approves or requests changes. Production requires the latest design approval and a verified advance of at least 50%, rounded up to the next paise.
9. Customer supplies recipient, phone and Indian delivery address. Move through production and quality check. Dispatch requires the full verified balance, address and tracking reference. The customer sees tracking and status. Delivery details lock after dispatch; changes then need team assistance.
10. Mark delivered/completed and reply as needed. Timeline, receipts, messages and approvals use the same database records on both sides. Operator mutations have idempotency keys and an audit trail.

Sample requests are read-only for operator workflow and cannot generate live Shopify orders or notification emails. Use a real enquiry for the pilot.

## Shopify

Account creation/sign-in schedules customer association when configured. Existing customers are matched by exact normalized email; absent customers are created. The operator can retry per customer or process small pending batches. Association does not share GYVFT passwords with Shopify and does not expose historical Shopify orders to the customer.

After the approved design, verified advance, quote items and delivery address are ready, choose **Create Shopify order** and review the confirmation. It creates a custom-line-item INR order with the verified amount recorded as manual payment. It does not charge the customer or send an extra Shopify receipt. Additional verified balance payments can be explicitly synced. An uncertain response blocks blind duplicate creation/payment; reconcile Shopify before retrying. A unique GYVFT tag helps recover orders created before a response was lost.

Manual Shopify order reference entry remains available. Automated sync does not infer an actual Shopify order ID from a manually typed reference. Reconcile manual references in Shopify before switching to automatic creation. Refunds, automatic fulfilment/webhook sync, catalogue inventory reservation and GST calculation are outside this pilot.

## Logging and mail

Operator changes are audited per request. Customer/team update emails enter a durable outbox with retry state; the desk can retry delivery. Emails contain a secure portal link rather than the private brief, address, screenshot or design. Existing Operations reporting and structured application logs remain available; infrastructure logs and metrics stay on Vercel.

## Release check

Use two local customer accounts and a local database to verify isolation, quote approval, conversion, screenshot submission, independent verification, design approval, payment gates, tracking and the operator view. Mock external mail and Shopify during automated tests. A live Shopify smoke check still requires the server token and an explicitly reviewed real pilot order.
