# Circles implementation · 19 November 2026

Status: implemented on `codex/real-circles`; production activation requires the owner’s explicit migration approval. This document distinguishes implemented code/local verification from a live release.

## Customer experience

One individual account can own or join multiple circles. Main navigation is Home / My gifts / Occasions / Circles on desktop and mobile. Profile, private people notes and saved ideas remain available under the account menu.

- `/account/circles`: accepted memberships, category, role, member count, creation and archived-circle filter.
- `/account/circles/new`: family, friends, company, school, college, alumni, community or other. The creator becomes owner and admin. Institutional circles require organisation name, HTTPS website and matching email domain; they start unverified.
- `/account/circles/[id]`: Overview, People, Occasions and Settings. Members see shared occasions and consenting members’ profiles. Admins also maintain recipients and invitations. Ownership transfer, role changes, removal, leave, archive and restore use server-side rules and confirmation where appropriate.
- `/account/circle-invitations/[token]`: email-bound invitation acceptance after sign-in/account creation. Invitations expire after seven days, can be replaced/revoked, and cannot restore removed access by replay. Only the owner can grant admin access or readmit a removed member.
- Shared occasions appear in Home and Occasions. Creating a gift from a circle or its occasion carries validated context into the existing seven-step gift flow. This does not share the gift or change its payer/owner.

An added **recipient** is not automatically a member or an account. An invitation can connect a recipient to the person’s account when accepted. Recipient notes remain admin-only. Updating the recipient email revokes outstanding linked invitations.

Profile sharing is an explicit, initially off setting **for each circle**, independent of the existing private people/profile-sharing feature. Admins see account emails for access management; ordinary peers do not. Sharing can be withdrawn. Joining does not publish personal calendar dates, private people notes, gift briefs, options, quotes, messages, payments or delivery addresses. Circle gift listings include only the viewing customer’s own gifts.

Owners remain active admins and must transfer ownership before leaving. Removal/leave/archive use retained state; no customer data is deleted. Archived circles can be read and restored by the owner. Pending invitations are revoked on archive, inviter removal/leave or role change. All membership writes serialize on the circle record; creation also locks its idempotency key.

## Domain records and commands

`20261119000002_circles.sql` creates seven RLS-enabled tables, with browser roles denied direct access:

| Record | Purpose |
| --- | --- |
| `gyvft_circles` | Category, owner, description, retained archive state |
| `gyvft_circle_members` | Accepted account membership, role/state, display name, per-circle profile consent |
| `gyvft_circle_organisations` | Institutional circle’s organisation details and operator verification |
| `gyvft_circle_recipients` | Admin-only recipient notes; optional link to an accepted account |
| `gyvft_circle_invitations` | Normalized email, hashed token, role, expiry, revocation and acceptance |
| `gyvft_circle_occasions` | Explicitly published shared occasion date and annual recurrence |
| `gyvft_circle_events` | Append-only operation/actor/subject audit, without invitation tokens or note contents |

Two nullable columns attach a customer-owned gift to a circle/occasion; a composite foreign key prevents mismatched event/circle context. Existing gift ownership checks remain authoritative. The institutional circle itself represents the organisation; there is no second organisation login.

Server actions and HTTP APIs call the same commands in `src/lib/customer/circles.ts`. APIs authenticate the customer, apply rate limits, deny cross-origin writes, validate strict command shapes and return private/no-store responses. The collection creates circles; per-circle commands manage records, roles and sharing; invitation creation and acceptance have dedicated commands. Client-provided account IDs never replace the authenticated actor.

Operations → **Circles & organisations** lists institutional claims and records a confirmed human review. A matching domain is not verification. Only the existing secret-protected operator API can verify; a customer/admin session cannot. Organisation edits reset verification. Fictional demo organisations cannot be marked genuinely verified. Operator review notes are not returned in customer aggregates.

Invitation links are returned only to their authenticated creator. Email is optional and only sent when the operator of the circle chooses “Also email the invitation”; copy-link works without email configuration. Tokens are stored as hashes. No live invitation emails were sent during local verification.

## Completing earlier demo accounts

An empty Circles page alongside “Alumni network” occasions means those private sample labels have not created accepted memberships. The earlier data generator also assigned occasion relationships by cycling through people; this incorrectly labelled some book-club and neighbourhood occasions.

`/operations/demo-data/circles` now provides **Complete demo circles** for the four existing fictional accounts. It needs only the operator secret and explicit confirmation, with no customer password. The command verifies the exact four account IDs/emails and demo provenance, uses the existing seed transaction lock, creates missing fictional circles, and reports actual active-circle counts for each account. It does not run a migration or create/reset accounts, and cannot use a customer cookie as operator authority.

A canonical occasion context map now fixes future fixture generation. The completion command also corrects old relationships/recipient links only when ID, owner, title, original note and original relationship/person pair still match the known faulty fixture. Dates, notes and user edits remain intact; unrelated records are excluded. Existing circle ownership, membership, consent and archive changes are preserved. Private calendar labels do not automatically share an event or grant membership.

The PostgreSQL repair test reproduces the old state (20 personal occasions, zero circles), adds five circles and corrects 14 untouched contexts while retaining passwords/dates and unrelated customer records. Browser coverage exercises the password-free operator action, stable pending controls, Meera’s actual circle membership and corrected occasion labels. The dedicated local repair database is prepared empty before that retained-fixture test; it performs no cleanup/deletion. No production repair was executed during code verification.

## Explicit fictional workspaces

The existing `/operations/demo-data` action now adds five actual fictional circles, eleven accepted memberships, sixteen recipients and seven shared occasions alongside the four previously requested demo accounts:

| Circle | Owner | Additional accepted members |
| --- | --- | --- |
| Our family | Raghav | Kavya, Meera |
| Meridian Studio | Arun | Meera |
| Class of 2001 | Meera | Arun |
| The Sunday Book Club | Meera | Kavya |
| Our neighbourhood | Meera | Raghav |

The sample company remains unverified. Per-circle profile sharing starts off. No invitations, payments or Shopify orders are sent/created. Only exact known fictional gift IDs, owner IDs and submission keys receive optional circle context; personal notes are not copied. All inserts are inside the existing explicit seed transaction. Repeating the action preserves existing passwords, consent, memberships, ownership changes and archived records; identifier collisions fail the whole transaction. It does not migrate or delete data.

## Rollout — approval required

The user explicitly required approval before production migrations or data deletion. Approval to build does not waive this instruction. **Do not execute this production SQL until the owner approves the concrete migration. Shipping the compatible code or manifest does not authorize execution.** Builds, deployments, page loads and server startup never execute migrations.

1. Review this implementation and the complete additive SQL in `supabase/migrations/20261119000002_circles.sql`. It creates the seven tables/indexes and adds two nullable gift-context columns/constraints. It contains no existing-row update, deletion, truncation, demo backfill or account creation.
2. Obtain explicit approval for this production migration. The migration transaction and advisory lock remain those of the manual setup runner. Apply only the approved file via Supabase SQL or the approved `/setup` manifest release; previously applied customer migrations are skipped.
3. Deploy the reviewed code. Existing ordinary gift creation is compatible with the previous schema. Circles gives a setup-required message until its tables and context columns exist.
4. Only after schema approval/application, explicitly run `/operations/demo-data` if these fictional memberships are wanted. Existing four demo passwords are preserved. Adding demo data does not authorize a migration.
5. Verify live customer login, circle creation, invitation email delivery with a consenting test recipient, and operator access separately. Local success does not establish production SMTP or database state.

## Verification

Current evidence: 217 unit/database tests passed (21 environment-dependent tests skipped), TypeScript/lint and an optimized production build passed. Two real-browser tests passed: the complete customer/operator flow and an isolated throttled-loader check. The main flow took about 18 seconds; a recipient save took about one second. The broad default command also attempted legacy Studio integration suites, which failed to connect to their separate expected local database on port 5432. Those suites are not represented as verified.

The review gallery at `/circles-review.html` contains actual local application captures. A dedicated throttled-browser check covers pending/disabled creation controls and stable button width. Network throttling is isolated to that check: changing CDP network conditions midway through a longer React server-action session left streamed responses pending in the browser test harness; the ordinary uninstrumented workflow was verified separately.

The dedicated local PostgreSQL database is isolated from production. Domain tests cover concurrency/idempotency, membership permissions, invitations/expiry/replay/readmission, private emails/notes/gifts, per-circle profile withdrawal, explicit shared occasions, gift context, transfer, archive/restore, organisation claims and repeat demo seeding. HTTP tests cover session requirements, same-origin protection, exact acceptance input and separate operator authorization.

The Playwright flow signs into all four demos, checks real Circle navigation/counts, creates a circle, accepts an invitation in another browser account, adds an admin-only recipient and shared occasion, creates a private gift draft with persisted context, checks member restrictions, mobile overflow/controls and the Operations directory. Screenshots are actual locally rendered application screens, with fictional data, rather than an interactive mock.

Infrastructure monitoring stays on Vercel. Domain audit events are application-owned. Cross-company discovery/occasion intelligence, automatic domain joining, organisation billing/budgets, bulk employee import, shared gift purchasing authority, exports and reminder delivery remain future capabilities.
