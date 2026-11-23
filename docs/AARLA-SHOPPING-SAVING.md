# GYVFT → Aarla: personal 5% shopping saving

21 November 2026. Approved behaviour: **Shop at Aarla → find the user's live coupon → reuse it, or create one for 24 hours for that customer only → open Aarla with the code applied.** A coupon has one redemption. A subsequent shopping click after expiry/redemption can issue a replacement. This is a per-customer shopping benefit, independent of GYVFT's longer sign-in cookie.

## Implementation

Shopify holds the coupon record, expiry, customer eligibility and redemption limit. No new database table, migration, shared fixed coupon, Shopify theme change, Plus-only API or checkout extension is needed. Existing GYVFT→Shopify customer matching remains the identity link. The server looks up the exact email, creates a Shopify customer record if none exists, and stores its returned ID before issuing a coupon for it. A separate storefront signup is not a prerequisite for creating that record. This does not set a Shopify password or transfer the GYVFT browser session; checkout must identify the same email. Fictional demo identities never create real store coupons.

Authenticated Aarla product/collection links and saved products open `/account/shop` in the existing new-tab flow. Its small handoff screen shows progress, then posts to the same-origin, session-authenticated `/api/customer/aarla-shop`. A GET/prefetch renders the screen without server-side coupon creation. The API accepts only a destination; it takes the customer identity from the secure GYVFT session. It never trusts a browser-supplied customer ID, coupon code, amount or expiry.

The native Admin API uses the pinned `2026-10` schema:

- Verify the configured shop's primary domain is Aarla and inspect the calling app's granted discount scope.
- Find the latest GYVFT coupon tagged for the linked identity. Validate the specific customer, 5% value, all ordinary product items, one redemption, exactly 24-hour lifetime and no minimum requirement before reuse. A changed/broadened coupon fails closed.
- Create with `discountCodeBasicCreate`, `context.customers.add: [customer GID]`, `customerGets.value.percentage: 0.05`, `usageLimit: 1`, `appliesOncePerCustomer: true`, explicit start/end and ordinary one-time purchases. Shopify's default discount-combination behaviour is retained; this feature adds no separate stacking policy.
- An opaque customer-specific code prefix and generation number make concurrent/retried creation converge on the same native code. Shopify enforces code uniqueness. Direct lookup by that code recovers a lost creation response or lagging search result; an unconfirmed POST does not move to another code.
- Scheduled activation waits rather than issuing another generation. Expired/redeemed codes can advance to a replacement. No coupon is marked used merely by clicking.
- Confirm success before redirecting to `https://aarla.in/discount/CODE?redirect=ENCODED_STORE_PATH`. Only store home, products and collections are allowed. Variant selection and GYVFT attribution survive; arbitrary return URLs, credentials, ports and external destinations are rejected.

Shopify's usage/search indexes update asynchronously. The read can briefly lag a just-placed order; Shopify checkout remains authoritative for the single redemption. This release does not claim a real-time redemption webhook or automatically disable/delete discount history. Customer-only eligibility still requires Shopify checkout to identify the eligible customer; GYVFT does not silently sign the customer into Shopify. The handoff tells the buyer to use the linked email.

GYVFT's quoted custom gifting orders and direct-UPI payment workflow are unchanged. This benefit applies to shopping on Aarla's storefront. Product feed prices are not rewritten to claim a discounted checkout total.

## Merchant connection

Use the already-installed Aarla OS app. In Vercel's GYVFT project, set these server-only Production variables and redeploy:

- `SHOPIFY_CLIENT_ID`: the app's Client ID.
- `SHOPIFY_CLIENT_SECRET`: the app's Client secret.
- `SHOPIFY_SHOP_DOMAIN`: Aarla's full `*.myshopify.com` domain, without `https://` or a path (existing default: `aarla-merch.myshopify.com`).

The app and store must belong to the same Shopify organization for the client-credentials grant. Release/approve **Discounts read/write (`write_discounts`)** on the existing app installation; existing customer read/write and customer-data access remain necessary for customer matching. Reuse the credentials without rotating, uninstalling or replacing the Aarla OS app. No manual coupon creation is required. The chat connector does not supply runtime credentials.

The server exchanges the ID/secret with `POST /admin/oauth/access_token`, `grant_type=client_credentials`; it uses the returned token for Admin API requests. Tokens stay in server memory, are shared by concurrent calls within that instance, and are renewed before the returned `expires_in` elapses. Each Vercel instance can authenticate independently; no database, cron, build-time token request or manual daily replacement is required. Credential/store changes cannot reuse a different configuration's cached token. Credentials are never sent through query parameters, returned to the browser or included in error messages. Token and Admin requests disable caching and redirect following.

An existing `SHOPIFY_ADMIN_ACCESS_TOKEN` remains supported when neither client credential is supplied. A complete client pair takes precedence; an incomplete pair is reported as unconfigured. Do not store the client secret under the access-token variable or use `NEXT_PUBLIC_` names. A rejected cached token is invalidated for the next explicit attempt; the app does not automatically replay an order/customer/discount mutation.

Reference: [Shopify client-credentials authentication](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant?lang=node).

Use **Operations → Settings & connections → Connections & access → Check Aarla savings connection**. This read-only check uses the deployed credential, confirms Aarla's domain and reports discount-creation permission. It creates no coupon. A configured token alone is not a successful connection test. Ordinary browsing remains available when the server connection is not configured; sample accounts use ordinary links without the benefit. Provider errors preserve the handoff screen with Retry and Back; the app does not redirect while falsely claiming a saving.

No production SQL change accompanies this feature. No merchant coupon or order was created during development. The first real authenticated shopping click and the eligible customer's checkout should be confirmed in production after the connection check passes.

## Diagnosing a failed handoff

The customer screen shows a support reference on provider failure. Search Vercel runtime logs for that reference and `Aarla shopping handoff failed`. The safe log identifies authentication, customer linking or coupon handling, the named operation, a classified error code, HTTP status when present and an enum from Shopify when available. It does not include email, a token, a coupon, query variables or raw provider messages. The application event stores the same reference, route and classified code; no schema change is required.

Operations' connection check uses the deployed credential and probes the current protected customer-email field as well as discount scope. It requires `write_customers` for new-user linking and `write_discounts` for issuance. Its success reports no coupon created. Its safe failure code distinguishes authentication/HTTP failure from a GraphQL access denial. A failure while selecting customer email can still require the installed app's customer-data permission/approval, beyond the declared scope. The Shopify connector in chat is a separate identity and cannot establish those deployed permissions.

The 23 November live store audit found one exact customer and no GYVFT coupon after the owner's failed attempt. Deprecated email selection and missing diagnostics were corrected, but the actual runtime failure is not established until the owner supplies the connection result or correlated log. Do not claim that source correction alone proves the incident resolved.

References: [customer email field](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/Customer), [customer queries](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/customers).

## Validation

- GraphQL lookup, connection and create documents validated against Shopify's official public Admin `2026-10` introspection schema. The connected schema tool supplied types and field contracts; the shipped validator required its missing local assets to be populated from the same official public schema endpoint.
- `tests/unit/aarla-coupon.test.ts`: creation policy, live reuse, expiry, redemption, concurrent requests, lost reply, pending activation, changed-policy rejection, distinct users and safe redirect paths.
- `tests/unit/aarla-shop-api.test.ts`: authentication, same-origin writes, server-owned identity, strict request fields and private responses.
- `tests/e2e/aarla-shop.spec.ts` with `tests/fixtures/aarla-shop-preload.mjs`: opt-in disposable localhost PostgreSQL and simulated Shopify. Covers the actual Home click/new-tab loading/API/discount redirect, existing-customer matching, automatic new Shopify customer creation and persisted ID linking before coupon issuance, reuse of both the customer and coupon, distinct customers, unauthenticated access, mobile error handling and the read-only Operations scope check. The fixture blocks external writes/network; storefront navigation is intercepted, so this is not a live Shopify checkout test.

References: [discountCodeBasicCreate](https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/discountCodeBasicCreate), [discountNodes](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/discountNodes), [codeDiscountNodeByCode](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/codeDiscountNodeByCode), [checking access scopes](https://shopify.dev/docs/api/usage/access-scopes#checking-granted-access-scopes), [shareable discount links](https://help.shopify.com/en/manual/discounts/discounts-promoting).
