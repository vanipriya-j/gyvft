# GYVFT — Codex continuation guide

**Start here when picking up this repo in Codex.**

Repo: `vanipriya-j/gyvft` · Branch of truth: `main` · Tagline: _Your story. Our telling._

## Orient and BITS case-study update — 24 November 2026

The owner requested retaining the existing Stories collection, adding Orient Star’s Diwali curation at the top, then restaging finished BITS yearbook photographs in GYVFT’s visual language and publishing the result. See [Orient provenance](gyvft/orient-star.md) and [BITS provenance](gyvft/bits-2001.md). Orient is featured once above the category sections; the earlier story order is retained. BITS replaces its interim visual with two clearly labelled styled product mockups, updates its narrative around the 25-year reunion and adds an illustrated-spread gallery. The other 15 existing story records and all redirects are unchanged. Gallery images preserve their aspect ratios and the Orient card has a readable transcript. A confirmed reduced-motion hydration issue in `MotionReveal` is fixed without changing ordinary animations or layouts. No migration, data deletion or Shopify operation accompanies this content release.

## Account-first customer website launch — 23 November 2026

24 November update: the owner supplied the new 59-second solution film. Its web copy, frame poster, Drive fallback link and visible-text alternative replace the earlier 86-second version. The original problem film is preserved. The new MP4 has no embedded captions; the timed track is explicitly labelled as descriptions of on-screen text, with a readable alternative, rather than retaining the old narration captions. See the film provenance in [CUSTOMER-WEBSITE.md](CUSTOMER-WEBSITE.md).

See [CUSTOMER-WEBSITE.md](CUSTOMER-WEBSITE.md). The owner approved production integration; PR #65 deployed successfully and live HTTP checks confirmed the new homepage, section links, registration/sign-in/recovery entries, hero image and film files. The site explains people/occasions/gifts/Circles, opens registration directly via `/account/login?mode=signup`, retains Aarla portfolio proof and separates the ongoing 5% store benefit from custom quotes. Each code is single-use and expires after 24 hours; the benefit remains available on subsequent shopping visits. Public navigation, privacy choices and the post-enquiry account invitation support signup. Media is click-to-play and static, with no new runtime filesystem reads. The owner’s revised 59-second solution film is integrated as described above. No migration or customer-data operation is involved. HTTP/build/unit checks do not establish desktop/mobile browser or submitted-signup verification; consult the review document for that limit.

## Confirmed coupon-create defect — 23 November 2026

A direct live reproduction of the coupon payload returned `INVALID` for both `customerGets.appliesOnSubscription` and `customerGets.appliesOnOneTimePurchase`: Shopify forbids supplying either field when Aarla does not use subscriptions, including a false value. Removing both inputs succeeded in the same store: ACTIVE, 5%, one specified customer, usage limit one, exactly 24-hour expiry, minimum requirement null, and returned ordinary-purchase/subscription defaults true/false. The app now omits the unsupported inputs but still validates those returned defaults. Unit and browser fixtures enforce the real merchant restriction rather than echoing the invalid input flags. One controlled diagnostic coupon was created through the connector to establish this evidence, tagged outside the app's `gyvft` namespace; no order/payment, production SQL or deletion occurred. Application handoff/reuse still requires a real authenticated retry after release.

## Pinned Aarla Shopify domain — 23 November 2026

The owner's live Operations result identified the configured store-domain value as invalid. The Shopify connector verified `aarla-merch.myshopify.com`; the owner explicitly requested hardcoding it. `shopifyStoreDomain()` now returns that fixed host for token exchange, Admin requests and coupon identity. `SHOPIFY_SHOP_DOMAIN` is retired and ignored, including stale values already in Vercel. Only the server credentials remain configurable. Fixture transports intercept the pinned host and continue blocking live writes. No credential, schema or data change is made. A subsequent live check must still establish authentication, permissions and the coupon handoff; removing the confirmed domain blocker alone is not full sign-off.

## Live Aarla handoff investigation — 23 November 2026

The owner hit a generic handoff error. A read-only store audit found one exact existing customer and no GYVFT coupons; that does not identify the deployed credential's failure or verify a live handoff. Matching now uses current `defaultEmailAddress.emailAddress` instead of deprecated `Customer.email`; creation reads only the new ID. Operations' read-only connection check also probes protected email access and requires customer-write capability, rather than checking discounts alone. Failures carry a support reference correlated with a safe runtime log (phase, operation, classified code/status/provider enum). Raw provider messages, input values, credentials and coupon strings are not logged. The event allowlist retains this route/operation. Same-code reconciliation still runs before surfacing coupon-create rejection; no retries create another generation. No production DB access/log access, migration, credential rotation, coupon or order write was performed by the agent. The owner's live Operations result/retry remains required; do not call the incident resolved from simulated tests.

## Aarla OS client credentials — 21 November 2026

GYVFT reuses the owner's installed Aarla OS Shopify app through server-only `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` (with the store now pinned as described above). See [AARLA-SHOPPING-SAVING.md](AARLA-SHOPPING-SAVING.md). The app/store must share a Shopify organization. Runtime authentication caches tokens by credential/store hash, coalesces concurrent exchange and renews from the returned expiry. Legacy static tokens remain supported when no client pair is set. Never request secrets in chat, put them in public env vars, rotate/uninstall the shared app or replay financial mutations automatically. Builds never authenticate/migrate; no schema change accompanies this support.

## Personal Aarla shopping saving — 21 November 2026

Read [AARLA-SHOPPING-SAVING.md](AARLA-SHOPPING-SAVING.md). Signed-in retail links open a private handoff, reuse a live 5% coupon or create a 24-hour single-redemption code restricted to the linked Shopify customer, then use Shopify's discount redirect URL. Shopify stores coupon state; no migration is added. Canonical customer-specific codes protect concurrent/uncertain creation. Operations has a read-only deployed-credential scope check. Demo users never mint real coupons. The API rejects arbitrary redirects/identities and fails closed on changed native eligibility. Actual merchant checkout remains a live verification step; local fixture results do not establish redemption/inbox/order behaviour in production.

## Shipping-only setup and live verification — 20 November 2026

The user approved the exact shipping SQL, with no deletions or existing-record changes. `/setup/shipping` uses the existing operator secret to read status first, then run only that checksum-verified file. The server blocks if an earlier customer migration is missing. Generic `/setup` still applies all pending customer migrations; direct the owner to the shipping-only page for this approval. No build/startup migrations were added. Production database access remains unconnected in this workspace; do not claim the SQL has run without live evidence. See [PRODUCTION-VERIFICATION.md](PRODUCTION-VERIFICATION.md) for the owner/developer acceptance gates and unresolved original-account lookup.

## Parcel shipping — 20 November 2026

See [SHIPPING.md](SHIPPING.md). Operations has encrypted Delhivery staging/live key settings, per-parcel manifests and batch pickup requests, safe reference reconciliation, tracking refresh/recovery and manual Porter/other-courier/store collection. Customer Delivery reads the same owned parcel records. Whole-order progress cannot bypass a partial allocation. Shopify's single batch line is not auto-fulfilled. Production activation requires separately approved additive SQL `20261120000001_shipping.sql`; opening pages/builds never applies it. No live carrier booking or production data write occurred during development. B2B entities/GST/bill-to implementation remains outside this shipping release.

## Function bundle storage — 20 November 2026

Public image existence/dimensions use `public-assets.generated.json`, generated by the metadata-only build/dev step. Do not reintroduce a dynamic runtime filesystem walk/check under `public`; it made Next trace the image tree into route dependencies. The demo seed must keep its two exact literal file reads and explicit tracing includes. See [DEPLOYMENT-STORAGE.md](DEPLOYMENT-STORAGE.md) for measured local reductions and the distinction from Vercel's all-projects/retained-deployment meter. No deployment history or images were deleted. Metadata generation is not a migration hook.

## B2B entity, billing and delivery decisions — 20 November 2026

Read [BUSINESS-ENTITIES-AND-DELIVERY.md](BUSINESS-ENTITIES-AND-DELIVERY.md) before expanding B2B. An individual can buy personally or for an explicitly authorised legal entity; circles are community/access-to-occasions context, not bill-to records or purchasing authority. The plan covers legal/trading names, several GST registrations, registered/office/billing addresses, versioned billing snapshots and one/multiple/individual delivery allocations. `/business-review.html` is an interactive fictional-data review, **not a working B2B application**. The existing Shopify adapter is B2C-only, with one address and one custom batch line; the new handoff must not simply remove its guard or imply multi-address fulfilment works. Production entity persistence/APIs and GST invoicing remain implementation work after UX review and separate approval of any exact production SQL. No migration, backfill or deletion accompanies this plan.

## Customer email recovery — 19 November 2026

Email-first notifications reuse the existing outbox with no migration. Immediate attempts have bounded transient retry; a dedicated customer cron and Operations controls recover due batches independently of legacy Studio tables. Operations shows configuration, attempts and queue counts; provider acceptance is not labelled inbox delivery. Demo identities and sample requests never send. WhatsApp is deferred at the user's request. See [CUSTOMER-NOTIFICATIONS.md](CUSTOMER-NOTIFICATIONS.md) for coverage, deployment checks and daily recovery limits, and [CUSTOMER-PILOT-REVIEW.md](CUSTOMER-PILOT-REVIEW.md) for the copyable review brief. No production migration or data deletion is part of this release.

## Completing disconnected sample data — 19 November 2026

`/operations/demo-data/circles` completes existing demo memberships without customer passwords. The explicit operator command also corrects untouched v1 occasion relationships/recipient links using the canonical fixture context map. No migration or deletion is involved. Existing memberships, consent and account passwords are preserved; production data changes still require the operator to submit the command. See [CIRCLES.md](CIRCLES.md).

## Real Circles implementation — 19 November 2026

See [CIRCLES.md](CIRCLES.md). Real circle records, navigation, creation, accepted memberships, invitations, admin-only recipients, shared occasions, per-circle profile consent, owner/admin controls and institutional verification are implemented on the Circles release branch. Production activation is held for explicit approval of additive migration `20261119000002_circles.sql`. No production migration or deletion was performed. Builds/startup never migrate. The explicit demo action adds five circles without resetting existing passwords or membership choices.

## Explicit customer demo workspaces — 19 November 2026

`/operations/demo-data` is an explicit data-only operator command for four fictional accounts with rich history. It uses the approved schema, preserves existing passwords and records, links only known fictional gifts to their new circles, and does not run migrations or external writes. See the four-workspace section in [CUSTOMER-PORTAL.md](CUSTOMER-PORTAL.md). Before the Circles release, organisation/community labels were context only; the new explicit seed adds real memberships after its separately approved schema update. Demo customer money is labelled and scoped to those four identities; live Operations totals exclude it.

## Customer authentication verification — 19 November 2026

See [CUSTOMER-AUTH-VERIFICATION.md](CUSTOMER-AUTH-VERIFICATION.md) for actual browser/database coverage and unresolved live recovery. Reset throttling now shows the retry wait; classified auth diagnostics record operation and failure stage without input or raw errors. Local/captured-mail success does not establish production signup or reset delivery. Do not describe the application as fully browser-verified.

## Shared theme, navigation and Operations dashboard — 19 November 2026

The public site and applications now use one approved root palette; Customer Home no longer keeps its own brown actions. Account navigation has pending feedback/loading states, Home defers external catalogue reads, and request aggregates load related data concurrently after ownership checks. `/operations` starts with the live dashboard, while `/operations/requests` remains the queue. See [OPERATIONS-DASHBOARD.md](OPERATIONS-DASHBOARD.md) for definitions, exclusions and next design work. Rich analytics/report exports, customer administration and named team roles remain separate follow-up work. Circles is covered by the proposed release above.

## Approved individual gifting application — 19 November 2026

The Revision 4 customer and Operations flow is now implemented in the application. Start at [APPROVED-GIFTING-RELEASE.md](APPROVED-GIFTING-RELEASE.md) for routes, the shared object model, release migration, permissions, Shopify boundaries and verification. `/design-review.html` remains a fictional-data reference, separate from `/account` and `/operations`.

The release adds private brief drafts/history, people/invitations/profiles, linked recurring occasions, version-specific changes, private operator approval drafts/notes/tasks, and independently revocable feedback/photo publication. Customer quote approval unlocks the 50% advance; the balance is due before dispatch. Production and official-order locks are enforced on the server. Named dialogs and 44px mobile targets carry into the real screens.

Apply the explicit customer manifest manually through the secret-protected `/setup` workflow. Builds and deployments do not run migrations. The automatic production-build hook from PR #45 was removed on 19 November 2026; do not reintroduce migration execution into build, deployment or startup hooks. The user requires explicit approval before each production migration or data-deletion operation. Approval to build/deploy or add demo records does not authorize either action. Removing the hook does not roll back applied SQL or restore missing records. Application authentication remains DB-owned, and Shopify requires its own deployment credential. AI curation remains future work; the proposed Circles release is described above.

## Working customer and Operations gifting flow — 17 November 2026

The individual gift workspace is implemented: compact Overview, Options, Quote & payment, Activity and Messages, with separate occasion/delivery details. Operations groups the same request into brief/next steps, options, quote/design, payments, fulfilment, messages and activity. `request.ts` reads the owned request aggregate; `request-workflow.ts` resolves its domain state for both roles. Existing commands retain authoritative ownership, immutable selections/approval versions and payment/fulfilment checks. No screen-specific endpoint or migration was added. See [CUSTOMER-PORTAL.md](CUSTOMER-PORTAL.md#working-gift-workspace-and-operations) for usage, testing and Shopify limitations. AI curation remains future work.

## Approved customer Home backend — 17 November 2026

The desktop/mobile Home designs share a new authenticated section API and data service. See [`CUSTOMER-HOME-ARCHITECTURE.md`](CUSTOMER-HOME-ARCHITECTURE.md) for contracts, ownership, carousel pagination, financial-year semantics and rollout. Apply `20261117000001_customer_home.sql` through customer setup for saved Aarla products. The approved desktop/mobile Home is connected to these services, using tighter [application typography and spacing](APPLICATION-UI-STANDARDS.md). Request history and occasion management remain reachable; saved ideas and verified-payment history have dedicated views. The individual gift detail workspace is now implemented; see the working-flow note above.

## Gift options and workspace — 16 November 2026

The reviewed customer flow now includes a two-column curated options page, separate saved customer workspaces, optional indicative pricing, Show/Hide controls and immutable quote selections. Operations publishes manual hamper visuals/contents and links quotes to the latest selected snapshot. Start at [`GIFT-WORKSPACE.md`](GIFT-WORKSPACE.md) for rollout, customer/admin usage and local verification. Apply `20261116000001_gift_workspace.sql` through the customer-only `/setup` manifest before using the new screens.

## Customer portal update — 14 November 2026

The current customer release uses **GYVFT-owned email/password accounts and database sessions**, independent of the legacy Studio Supabase Auth code described below. Start with [`CUSTOMER-PORTAL.md`](CUSTOMER-PORTAL.md), [`USER-MANUAL.md`](USER-MANUAL.md) and [`PRODUCT-BACKLOG.md`](PRODUCT-BACKLOG.md). `/setup` installs only the explicit customer migration manifest; `/operations` provides app reports using the existing operator secret. Infrastructure monitoring remains on Vercel; no OpenTelemetry/Grafana service is required. Production still needs the new migrations applied before accounts can be created.

| Doc                                             | Use for                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| **This file (`docs/CODEX.md`)**                 | Current state, what to build next, gotchas                            |
| [`README.md`](../README.md)                     | Full setup: Studio, DB, Auth, integrations, deploy, env table         |
| [`docs/gyvft/IMPLEMENT.md`](gyvft/IMPLEMENT.md) | Public imagery / case-study rules                                     |
| [`docs/gyvft/review.md`](gyvft/review.md)       | Editorial backlog for stories                                         |
| [`AGENTS.md`](../AGENTS.md)                     | Next.js caveat (custom version — read `node_modules/next/dist/docs/`) |

---

## 1. What the product is

Two surfaces in one Next.js App Router app:

1. **Public marketing + lead capture** (`src/app/(public)`) — brand site, storytelling portfolio, forms.
2. **GYVFT Studio** (`src/app/studio`) — authenticated CRM / ops (opportunities, contacts, orgs, campaigns, landing pages, tasks, integrations, consent, security).

Public site can send lead emails **without** a database. Studio needs Postgres + Supabase Auth/Storage.

---

## 2. Stack (quick)

- **Next.js** (custom/breaking — do not assume stock Next APIs; check local docs)
- **React**, **Tailwind**, **Framer Motion**, **Zod**, **react-hook-form**
- **Postgres** via `postgres` + repositories
- **Supabase** Auth + Storage (publishable/secret keys preferred over legacy JWT)
- **Resend** (public + Studio email)
- **OpenAI** (opportunity summaries, fail-open)
- **Meta CAPI / Pixel**, GTM, GA4, Clarity (consent-gated)
- **Vitest** unit tests · **Playwright** e2e · Vercel crons for email/webhook retries

---

## 3. Current `main` status (as of docs refresh)

### Done and merged

- Public site pages: home, why-gyvft, stories (portfolio), orgs, forms, legal.
- Storytelling content in `src/content/stories.ts` (16 case studies after Kumon merge).
- GYVFT image system under `public/images/gyvft/` + docs in `docs/gyvft/`.
- Homepage hero → `/images/gyvft/homepage/01-home-hero_01.png` (no legacy fallback; no logo in hero).
- Brand logo → `/images/brand/GYVFT_3x.png` (header/footer only).
- Form emails → `aarla@aarla.in` with Resend unverified-domain fallback to `onboarding@resend.dev`.
- After email: fail-open forward to **Aarla OS** story leads (`STORY_LEADS_API_KEY`; URL hardcoded).
- Kumon consolidated to **Kumon Gifting** at `/stories/kumon-delegate-gifting`; `/stories/kumon-winner-gifts` redirects there.
- Photo Gauge, Veeramakaliamman, Diwali heroes wired to uploaded assets (Diwali file lives at `diwali-gifting/hero.png` while slug stays `private-diwali-hampers`).
- Studio CRM foundation, RLS migrations, integrations, consent banner, crons.

### Permanent story redirects (`next.config.ts`)

| From                                  | To                                   |
| ------------------------------------- | ------------------------------------ |
| `/stories/dancer-gift-sets`           | `/stories/various-dance-schools`     |
| `/stories/sishyakulam`                | `/stories/various-music-schools`     |
| `/stories/barclays-team-award-badges` | `/stories/natwest-team-event-badges` |
| `/stories/kumon-winner-gifts`         | `/stories/kumon-delegate-gifting`    |

### Open product / editorial work

See `docs/gyvft/review.md`. Highest signal:

- Various Dance Schools / Various Music Schools still `review`
- BITS 2001 still `review`
- Several “ready” stories still have provisional copy
- Studio: deepen polish, retention jobs, real malware scan, richer analytics→GTM bridging (gaps noted in README)

No open PRs required for the imagery/Kumon work — that is on `main`.

---

## 4. Public site map

| Route                                          | Notes                                             |
| ---------------------------------------------- | ------------------------------------------------- |
| `/`                                            | Hero + sections via `publicMedia` / `PublicImage` |
| `/why-gyvft`                                   | Brand story                                       |
| `/stories`                                     | Grouped portfolio listing                         |
| `/stories/[slug]`                              | Case study detail + related stories               |
| `/for-organisations`                           | Org page + hero from gyvft homepage assets        |
| `/tell-your-story`                             | Lead form                                         |
| `/become-a-merch-partner`                      | Partner form                                      |
| `/book-a-discovery`                            | Discovery form                                    |
| `/upload-a-brief`                              | Brief + file upload                               |
| `/l/[slug]`                                    | Published campaign landing pages                  |
| `/thank-you`, `/privacy`, `/cookies`, `/terms` | Utility / legal                                   |

**Content source of truth for stories:** `src/content/stories.ts`  
**Homepage image registry:** `src/config/public-media.ts`  
**Asset inventory:** `docs/gyvft/homepage.json`, `docs/gyvft/case-studies.json`

### Imagery rules (do not violate)

1. Prefer `public/images/gyvft/...`. Do **not** move assets into `aarla-source` or `brand`.
2. Do **not** move/rename/regenerate uploaded PNGs unless the user asks. If folder ≠ slug (e.g. Diwali), point the story hero at the existing path (`heroAsset()`).
3. Statuses: `ready` | `review` | `reference-required`. In production, `reference-required` forces a placeholder in `StoryMedia` even if a file exists.
4. Homepage **hero** must not use `fallbackSrc`. Other homepage sections may still fall back to `aarla-source/optimized` until their gyvft files exist.
5. Never put a second GYVFT logo inside the hero; nav/footer only.

Accuracy rules from IMPLEMENT (still in force): dance totes framing; music school product mappings; Thambi = posthumous 100th year; NatWest not Barclays; keep cardiologist commissions distinct; Kumon product list constraints.

---

## 5. Lead capture path (public)

```
Form (Zod) → src/actions/public-forms.ts
  → src/services/leads/submit-public-lead.ts
      → email via src/services/email/public-resend.ts  (inbox defaults aarla@aarla.in)
      → Aarla OS via src/services/leads/aarla-story-leads.ts  (fail-open)
```

If Studio DB is configured, full CRM opportunity capture also runs through `src/services/opportunities/lead-capture.ts` (AI, Meta, webhooks, storage — all fail-open secondary effects).

Health: `GET /api/health` reports public Resend config status.

---

## 6. Studio map (summary)

Auth: Supabase (`/studio/login`, forgot/reset). No public signup. Middleware protects `/studio/*`.

Roles: `owner` | `admin` | `contributor` (RLS + app checks).

Areas: dashboard, opportunities, contacts, organisations, tasks, analytics, campaigns, landing pages, forms, integrations + logs, settings (workspace, users, security, consent).

Deeper setup: **README.md** sections 4–25.

---

## 7. Environment (public vs Studio)

Copy `.env.example` → `.env.local`.

**Public site minimum:** `RESEND_API_KEY` (+ optional from/leads overrides). Defaults: from/inbox `aarla@aarla.in`.

**Aarla OS CRM forward:** `STORY_LEADS_API_KEY` (aliases `GYVFT_LEADS_API_KEY` / deprecated `AARLA_STORY_LEADS_API_KEY`). Intake URL is hardcoded in `aarla-story-leads.ts`.

**Studio / production:** `DATABASE_URL`, Supabase URL + publishable + secret keys, `INTEGRATION_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`, optional OpenAI/Meta/GTM/GA4/Clarity, `CRON_SECRET`.

Full table: README §21.

---

## 8. Commands

```bash
npm install
cp .env.example .env.local
npm run dev                 # http://localhost:3000
npm run lint
npm run typecheck
npm test                    # vitest unit
npm run test:e2e            # playwright
npm run build               # prefer NODE_ENV=production npm run build
npm run db:migrate          # needs DATABASE_URL
npm run create-owner -- --email=owner@example.com
npm run seed:dev / reset:dev  # local only; production-guarded
```

---

## 9. Suggested next work for Codex

Priority order unless the user redirects:

1. **Editorial / content** — clear `review` stories (dance, music, BITS); tighten provisional copy on new ready pages (`docs/gyvft/review.md`).
2. **Homepage completeness** — confirm every `homepage.json` asset is on disk and drop unnecessary `fallbackSrc` entries once files exist.
3. **Public QA** — desktop/mobile crops on home + all story heroes; redirects; forms still email + Aarla forward.
4. **Studio hardening** — retention/purge jobs, real brief malware scan, consent_records persistence, GTM `dataLayer` bridging (README gaps).
5. **Tests** — extend unit coverage for new lead/email paths; keep e2e forms green.

When adding images: place under the existing folder names; wire paths in `stories.ts` / `public-media.ts`; update `docs/gyvft/*.json` + `review.md`.

Branch naming if using Cursor-style agents: `cursor/<descriptive-name>-3f8c`.

---

## 10. File map

```text
README.md                          Full platform setup & ops
docs/CODEX.md                      ← You are here (continuation)
docs/CURSOR-HANDOFF.md             Historical Cursor session notes (superseded by this file for “what next”)
docs/gyvft/IMPLEMENT.md            Imagery implementation brief
docs/gyvft/homepage.json           Homepage asset names
docs/gyvft/case-studies.json       Case-study inventory
docs/gyvft/review.md               Editorial matrix
AGENTS.md / CLAUDE.md              Next.js agent rules

src/app/(public)/                  Public pages
src/app/studio/                    Studio pages
src/app/api/                       Health, events, consent, uploads, crons
src/actions/                       Server actions (public forms + studio)
src/content/stories.ts             Story portfolio
src/config/public-media.ts         Homepage media registry
src/config/env.ts                  Zod env schema
src/services/email/public-resend.ts
src/services/leads/*               Public lead email + Aarla forward
src/services/opportunities/*       Full CRM lead capture
src/components/public/*            Hero, StoryMedia, PublicImage, brand, sections
public/images/gyvft/               Public marketing assets
public/images/brand/               Logo masters
public/images/aarla-source/        Legacy fallbacks only
supabase/migrations/               Schema + RLS + storage
tests/unit|e2e|integration         Automated tests
```

---

## 11. Do / don’t for agents

**Do**

- Read Next local docs before framework changes.
- Fail-open on secondary integrations (email CRM forward, AI, Meta, webhooks).
- Keep story slug stable when only the asset folder differs.
- Preserve human PR description edits if updating PRs.

**Don’t**

- Deploy unless asked.
- Invent Barclays claims; merge the two cardiologist doctors; reassign music-school products.
- Layer new hero images over old ones or reintroduce hero-embedded logos.
- Use `gh` for write operations if Cursor ManagePullRequest is the project’s PR tool (when in Cursor Cloud).
