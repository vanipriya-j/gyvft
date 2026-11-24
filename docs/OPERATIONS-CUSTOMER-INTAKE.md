# Operations-assisted customers and requirements

The owner requested creating customer accounts from Operations and entering requirements on their behalf, with both pasted text and PDF/image attachments.

## Customer flow

- **Customers → Add customer** creates a named customer account. Optionally add a requirement in the same save.
- **Requests & orders → Add requirement** selects an existing customer or creates a new one.
- Each customer row also has **Add requirement**, with that customer already selected.
- Existing accounts are selected explicitly. Duplicate email creation is rejected; passwords, names and profile preferences on existing accounts are preserved.
- Saving creates no customer session and sends no email. New accounts receive a random, hashed initial password that is never returned, logged or emailed.
- **Send setup email** is a separate explicit action. It sends a one-hour, single-use link through the existing password-reset mechanism. The customer chooses their own password, then signs in normally. Ops never chooses or sees it.
- The Customers list identifies accounts awaiting password setup and lets Ops retry the setup email. Existing self-registered or already-activated accounts use normal sign-in/recovery rather than an Ops password replacement.

The final save opens the existing request workspace without requiring the operator to unlock the desk again. The new request is a submitted enquiry attached to the selected account and can use the existing options, quote and delivery workflow. The customer sees that GYVFT recorded the requirement on their behalf. No Shopify operation accompanies intake.

## Requirements and files

A title and either requirement text or at least one attachment are required. Known quantities, budget, budget basis, city, phone, occasion, organisation context and requested dates can be supplied without inventing missing details. Organisation context does not create a legal entity, GST registration or purchasing authorisation.

The uploader supports file selection, drag/drop and native image paste. It accepts at most six PDFs/PNG/JPEG/WebP files, PDFs up to 2 MB each, and approximately 2.5 MB total after image optimisation. Images use the existing bounded preview conversion; source artwork should be retained separately. Invalid additions preserve the existing selections and form.

Files are stored privately in the database and downloaded through `/api/customer-assets/requirement/:id`. Only the owning customer or an authenticated operator can access them. Responses are private/no-store, force attachment download and apply nosniff and a sandbox policy. Neither filenames nor image/PDF bytes enter public static assets or analytics.

The submitted brief, structured fields and attachment list are also available through the existing MCP request read. This does not perform OCR or parse attached PDFs automatically; their contents remain available to the operator/customer through the request.

## Reliability and email

Customer, request, revision, event and attachment creation share one transaction. A UUID save key, canonical input fingerprint and transaction-scoped advisory lock protect retries and simultaneous requests. Reusing a key with different data is rejected.

Setup emails have durable delivery records. The reset token is hashed in the existing reset table; its retryable email payload is encrypted using a purpose-specific key derived from the server Operations secret. Neither raw tokens nor links are returned to Ops, logged or exposed in search results. Retries use the same provider idempotency key and body. Used/expired links cannot be sent as new invitations. Provider acceptance is reported separately from confirmed inbox delivery.

## Explicit activation

`20261124000003_operations_intake.sql` adds three private tables: intake save/audit records, requirement attachments and setup-email records. It performs no update, backfill or deletion of existing customer, password, gift or image records. Existing password-reset and customer-account schemas are unchanged.

The owner must review this exact SQL through **`/setup/operations-intake`**. Status checks are read-only. An explicit approval checkbox and apply action run only this checksum-pinned file; missing account/journey prerequisites need their own review. Builds, deployment and startup never run SQL. Other pending migrations are not applied by this page.

Before activation, existing customer/request pages and authentication keep working. The new intake action explains the missing update and links to its review page. Existing customer reads return an empty attachment list and do not query missing tables.

## Verification

370 automated tests passed; 62 unrelated database-dependent tests were skipped. The new PostgreSQL checks cover preservation of existing credentials/profiles, repeatable additive DDL, atomic saves and concurrent retries, duplicate emails, file-only and standalone intake, attachment bounds/ownership, setup-email retries and encryption, token expiry/use, actual password setup and API authentication/body limits. Build, typecheck and lint passed; lint retains two pre-existing image-fixture warnings.

Production-build browser QA passed using fictional localhost PostgreSQL records and a stubbed mail provider: new/existing customer flows, native clipboard and file uploads, invalid-file preservation, metadata fields, explicit invitation, password setup and sign-in, owned downloads, retained operator session, dialog focus/reset and 320/390/1440px layouts. A local OAuth/MCP request read returned the same structured requirement and three attachment records. No browser errors occurred.

No production SQL, customer record, real email or Shopify operation was executed during development. Live customer inbox receipt remains an owner-side acceptance check after activation.
