# GYVFT — Cursor handoff for Codex

Last updated: 2026-10-01 (session continued into later follow-ups).  
Repo: `vanipriya-j/gyvft`  
Canonical branch for live site: `main`  
Open work (not yet merged): **PR #18** — `cursor/wire-case-study-images-kumon-3f8c`

---

## What this project is

Next.js public site + Studio for **GYVFT** (story-led gifts / books / merch).  
Public imagery and case-study inventory are driven by `docs/gyvft/` and assets under `public/images/gyvft/`.

**Important:** This is a custom Next.js version — APIs/conventions may differ from training data. Read `node_modules/next/dist/docs/` before changing framework code. See root `AGENTS.md`.

---

## Merged into `main` already

### Forms / email / CRM
- Public form leads email to **`aarla@aarla.in`** (defaults in code + env example).
- Resend: fallback to `onboarding@resend.dev` when custom domain is unverified.
- After Resend, leads forward to **Aarla OS** story-leads API (`STORY_LEADS_API_KEY`, hardcoded production URL). Fail-open if CRM fails.
- Related merged PRs: #8, #13, #14.

### Brand
- Logo/favicon use uploaded brand assets; `BrandLogo` uses `/images/brand/GYVFT_3x.png`.
- Nav/footer logo only — **no second GYVFT logo inside the homepage hero**.
- Related merged PRs: #10, #11, #12.

### GYVFT imagery system (IMPLEMENT.md)
- Scaffold + wiring from `docs/gyvft/IMPLEMENT.md` (PR #15).
- Asset roots (do **not** move into `aarla-source` or `brand`):
  - Homepage: `public/images/gyvft/homepage/`
  - Case studies: `public/images/gyvft/case-studies/{slug}/hero.png`
- Docs of record:
  - `docs/gyvft/IMPLEMENT.md`
  - `docs/gyvft/homepage.json`
  - `docs/gyvft/case-studies.json`
  - `docs/gyvft/review.md`
- Story content: `src/content/stories.ts`
- Homepage media registry: `src/config/public-media.ts`
- Render helpers:
  - `src/components/public/PublicImage.tsx` (server; gyvft path + optional legacy fallback)
  - `src/components/public/StoryMedia.tsx` (missing file → placeholder; `reference-required` blocked in production)
  - `src/components/public/StoryStatusBadge.tsx` (dev/staging only)
  - `src/lib/public-asset.ts` (`publicAssetExists`, `isProductionRuntime`)

### Story route renames (permanent redirects in `next.config.ts`)
| Old | New |
|---|---|
| `/stories/dancer-gift-sets` | `/stories/various-dance-schools` |
| `/stories/sishyakulam` | `/stories/various-music-schools` |
| `/stories/barclays-team-award-badges` | `/stories/natwest-team-event-badges` |

NatWest copy only — no Barclays wording.

### Homepage hero fix (merged)
- Hero was incorrectly preferring legacy `street-madras-coffee.jpg` via `fallbackSrc`.
- Now points **only** at:  
  **`/images/gyvft/homepage/01-home-hero_01.png`**  
  (`src/config/public-media.ts` + `docs/gyvft/homepage.json`)
- Embedded hero `BrandLogo` removed; nav logo unchanged.
- Merged PRs: #16, #17.

### Assets on disk
Many homepage + case-study PNGs were uploaded via GitHub (“Add files via upload”).  
Treat uploaded filenames/paths as source of truth — **do not move, rename, regenerate, or duplicate** unless the user asks.

---

## Open PR — merge this next

**PR #18** — https://github.com/vanipriya-j/gyvft/pull/18  
Branch: `cursor/wire-case-study-images-kumon-3f8c`

### What it does
1. **Wires newly uploaded heroes** (files already on `main` under `public/images/gyvft/case-studies/`):
   - Photo Gauge → `photo-gauge-summer-care-pack/hero.png`
   - Veeramakaliamman → `veeramakaliamman-temple-colouring-book/hero.png`
   - Diwali → **`diwali-gifting/hero.png`** while story slug stays `private-diwali-hampers` (path wired via `heroAsset()`; file not moved)
2. Marks those three stories `ready` (so production no longer treats them as `reference-required` placeholders).
3. **Consolidates Kumon** into one case study:
   - Title: **Kumon Gifting**
   - Retained route: `/stories/kumon-delegate-gifting`
   - Image: `kumon-delegate-gifting/hero.png` (approved)
   - Combined winner + delegate copy
   - Removes `kumon-winner-gifts` from listings / homepage preview / related stories
   - Adds redirect: `/stories/kumon-winner-gifts` → `/stories/kumon-delegate-gifting`
4. Updates `docs/gyvft/case-studies.json` + `review.md`.

### Verified on that branch
- `tsc --noEmit` pass
- `NODE_ENV=production next build` pass (16 story paths)
- Preview: correct hero `currentSrc`s; no PyCon/cardiologist/Thambi cross-wiring on those pages’ primary heroes; Kumon redirect 308; desktop/mobile heroes `aspect-[16/9]` + `object-fit: cover`

**Until #18 is merged, `main` still has two Kumon cards and Diwali still points at `private-diwali-hampers/hero.png` (empty folder — image lives in `diwali-gifting/`).**

---

## Key conventions for Codex

1. Prefer paths from `docs/gyvft/*.json`; keep story slugs stable when only assets move.
2. For a hero that lives under a different folder than the slug, use an explicit asset path (see `heroAsset()` on PR #18) — do not relocate the PNG.
3. Statuses: `ready` | `review` | `reference-required`.  
   In production, `reference-required` forces a placeholder even if a file exists (`StoryMedia`).
4. Homepage section images still may use `fallbackSrc` → `public/images/aarla-source/optimized/...` until each gyvft homepage file is present. **Hero must not use fallback.**
5. Forms: Resend + Aarla OS forward; do not break fail-open CRM behaviour.
6. Branch naming for agent work: `cursor/<descriptive-name>-3f8c`.

---

## Still open / editorial (after #18)

From `docs/gyvft/review.md` (post-#18 intent):

| Still needs attention | Why |
|---|---|
| Various Dance Schools | `review` — approve schools/products |
| Various Music Schools | `review` — verify product↔school mappings |
| BITS 2001 Reunion | `review` — interim image / approve scope |
| Several “ready” new pages | Copy still provisional (Chinmay, TM Karthik, Jannal Oram, Root360, Cardiologist umbrella) |

Music-school product mappings are listed in `docs/gyvft/review.md` — do not reassign products between schools.

Accuracy rules called out in IMPLEMENT.md (still in force):
- Dance schools = logo-personalised Dance Class totes (not generic dancer gift sets)
- Thambi 100 = commemorative after death, not a living centenarian party
- Cardiologist = keep Dr Harapriya and Dr Saileela distinct
- Kumon products: note card, elephant tray, Mayil 15×17 tote, Chennai magnet — do not invent Durai Adithya magnet placement errors

---

## Suggested first steps for Codex

1. Checkout / merge **PR #18** into `main` if still open.
2. Pull `main` and confirm Diwali hero resolves to `diwali-gifting/hero.png` and only one Kumon card exists.
3. Smoke: `/`, `/stories`, the four detail pages above, and `/stories/kumon-winner-gifts` → 308.
4. Continue editorial review items; attach any remaining PNGs without renaming folders.

---

## Quick file map

```
docs/gyvft/IMPLEMENT.md          # original implementation brief
docs/gyvft/homepage.json         # homepage asset names
docs/gyvft/case-studies.json     # case-study inventory + statuses
docs/gyvft/review.md             # editorial matrix
public/images/gyvft/homepage/    # homepage PNGs
public/images/gyvft/case-studies/# per-slug heroes (+ diwali-gifting/)
src/content/stories.ts           # portfolio content + redirects map
src/config/public-media.ts       # homepage image registry
src/components/public/Hero.tsx   # homepage hero (no fallback, no logo)
next.config.ts                   # permanent story redirects
```
