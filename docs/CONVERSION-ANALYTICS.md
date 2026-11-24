# Website analytics and gift conversions

The owner requested GA-style visits/new visitors alongside gift conversion and abandoned-proposal follow-up. The agreed default follow-up threshold is **3 days**. This release adds no tables, migrations, backfill or deletion. An inactive request is never automatically cancelled.

## Google Analytics 4

GA4 supplies sessions/visits, new and returning users, source/medium/campaign, popular pages, device breakdown, engagement and the consented visitor funnel. GYVFT sends manual page views for App Router navigation, including safe account-screen names, and these success/intent events:

| Event                  | Trigger                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `cta_clicked`          | Account creation, sign-in, new gift or story link selected    |
| `sign_up` / `login`    | Successful account action, not just a click or failed attempt |
| `gift_brief_started`   | New-gift screen visited                                       |
| `gift_brief_saved`     | Private draft successfully saved                              |
| `gift_brief_submitted` | Gift brief successfully submitted                             |
| `gift_quote_requested` | Gift selection successfully submitted for a quote             |
| `generate_lead`        | Existing public story/partner/discovery submission success    |
| `shop_aarla`           | Successful, validated Aarla handoff before redirect           |

Existing public-form step events are also forwarded with bounded, allowlisted parameters. Payment proof is not a `purchase`. Google tracking is not the source of truth for money, quotes or orders.

### Activation

The owner supplied public Measurement ID `G-XFWQJZM0RN` on 24 November and confirmed Enhanced measurement is switched off. The earlier live check found no Google tag request even with analytics consent enabled; that describes the pre-release state, not current ingestion verification.

1. In Google Analytics, use/create the GYVFT GA4 property and add a web stream for `https://www.gyvft.com`. Select India time zone and INR as appropriate for the business. Copy its public `G-…` Measurement ID.
2. **For this manual App Router integration, turn off Enhanced Measurement’s automatic page/history, form and outbound-click collection in the web stream before enabling the tag.** The app supplies its own page views and explicit conversions. Google’s history-based Enhanced Measurement can still generate duplicate page views despite `send_page_view:false`; automatic form/link events can include private values. No automatic collection is required for GA’s baseline new-user/session/engagement measurement.
3. The shared configuration defaults to the owner-supplied public stream `G-XFWQJZM0RN`, so it does not require Vercel credentials to configure this identifier. `NEXT_PUBLIC_GA4_MEASUREMENT_ID` can override it; an explicit empty value disables direct GA4. If that variable already exists in Vercel, use the supplied ID or remove the override before redeploying. Direct GA4 takes precedence over `NEXT_PUBLIC_GTM_ID`, so the app installs only one Google-tag path. Remove/adjust an old duplicate GA tag in any separately managed container before activation.
4. Leave `NEXT_PUBLIC_GA4_DEBUG=false` in production. QA can enable it only with a test property or intercepted tag transport. Default host gating excludes localhost and Vercel preview traffic.
5. Mark `sign_up` and `gift_brief_submitted` as key events in GA; add `generate_lead` if public enquiries are a key outcome. In Explore, create a funnel from signup CTA → `sign_up` → `gift_brief_started` → `gift_brief_submitted` → `gift_quote_requested`. Account/proposal screens can be distinguished through the sanitised `page_location`, including the allowlisted `view=quote` tab.
6. With analytics consent, verify one page view per navigation and the success events in Realtime/DebugView. Then verify rejection/withdrawal prevents further tracking. Historical visitors cannot be reconstructed from a tag that was not collecting.

If only GTM is configured, the app pushes prefixed `gyvft_*` events to `dataLayer`; the owner’s container must map those to GA4 and avoid parallel automatic page/form triggers. The normal direct-GA4 setup above needs no GTM container and no paid analytics intermediary.

Official references: [SPA measurement](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications), [manual page views and history duplication](https://developers.google.com/analytics/devguides/collection/ga4/views), [recommended events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events), [consent](https://developers.google.com/tag-platform/security/guides/privacy).

### Data boundaries

Analytics loads only with the visitor’s analytics consent. Public and account routes share one provider, avoiding missed signup/account navigation or duplicate providers. Operator/Studio/setup/API/invitation routes are excluded. Account/gift/recipient IDs, reset tokens, full referrer URLs, names, emails, addresses, brief text, quoted amounts, coupon codes and payment details are not sent to Google. Page titles are generic; safe campaign tags remain usable. Revocation disables the Google tag and clears its analytics cookies without clearing the customer session. Subsequent automatic engagement events inherit the current sanitised page context.

Google startup policy (`send_page_view:false`) and the sanitised page context must be queued globally **before** `gtag('js', ...)`, as well as disabling config page views. A live-runtime replay with all Google collection intercepted reproduced an early automatic view when those settings followed `js`; moving them before `js` produced exactly one sanitised view. A unit regression enforces this order. Do not move these settings back after startup.

The optional existing `/api/events` sink now accepts consented, validated anonymous visitor/session IDs and bounded metadata. Its legacy Studio `analytics_events` table is not created by this release; an absent table does not block Google or the customer flow. Counts in GA are browser/device and consent based, not a count of identifiable people or every customer record.

## Operations

Open **Analytics & conversions** in the existing desk, or `/operations/analytics`. The existing operator credential is required. The reusable `conversionReport` service reads the gift object model through `op: conversion_report`; there is no new source of truth for the UI.

- GA traffic is reached through **Open Google Analytics**. This release does not claim to read GA’s reporting API or display its visit counts inside GYVFT without a reporting connection. A missing Measurement ID is shown as setup required, not zero traffic.
- Request cohorts cover records **created** in the last 30/90/365 days or all time, including requests whose private draft began earlier. Milestones count distinct request records and actual options/selections/quotes/approvals/verified receipts/Shopify links/delivery stages. Manual workflows may skip milestones; no inferred stages are manufactured to make a funnel look smooth.
- Approval and paid conversion denominators are the same quoted-request cohort. Money comes only from verified payment submissions attached to those requests, not screenshots or inferred paid stages. Amounts are summed as integer paise. The UI avoids displaying unsafe numeric totals.
- Signup conversion uses a separate signup cohort: real accounts registered in that period that now own a submitted real request. It must not be presented as the same denominator as the request funnel.
- Follow-ups cover **all open pre-production requests**, including older requests outside the selected cohort. Three days after the last relevant exchange/share/selection/brief revision/payment submission triggers a follow-up. Customer questions and requested changes belong to Aarla; pending bank checks belong to Aarla; published options and pending quotes can belong to the customer. A team response restarts the wait; internal notes/task edits do not. Once production begins, an item is not labelled an abandoned proposal.
- Saved private briefs appear only as an aggregate count. Their titles, contents and customer details are not exposed to Operations through this report, and their age is not guessed from creation time.
- Demo-account IDs and labelled samples are excluded. A CSV exports the selected follow-up view with spreadsheet-formula protection. The UI shows the oldest 50 waits; CSV contains all matches. The service fails explicitly above its 10,000-record safety bound rather than returning plausible-looking partial conversion totals.

Schema execution is not part of build/start/deployment. No automated emails, customer messages, cancellations or Shopify changes are sent by analytics.

## Verification scope

Build and 324 unit tests passed; database-dependent suites without their dedicated fixtures were skipped. The dedicated PostgreSQL report test passed against isolated `127.0.0.1:55437/gyvft_analytics_test`, checking real SQL, demo/draft exclusion and repeated quote/payment records. No production database was used. Lint passed with two pre-existing image warnings in a homepage test fixture.

Browser checks passed at 320/390/1440px: consent-gated tag installation, one page view per SPA navigation, signup clicks distinct from successful signup, consent withdrawal, no Operations collection even with analytics consent, the 3-day report default, proposal filtering, CSV download and error/retry. Mobile controls meet the existing 44px minimum and no horizontal overflow or browser exceptions occurred. Local QA intercepted Google transport with an empty tag script and fictional report data; it cannot establish live GA ingestion. The owner’s Measurement ID and confirmation of web-stream settings have been received. A deployed browser check and owner-side Realtime confirmation remain necessary to establish live collection.
