# GYVFT image and case-study implementation

The package is already aligned to this repository's existing image structure.

## Installed paths

- Homepage assets: `public/images/gyvft/homepage/`
- Case-study assets: `public/images/gyvft/case-studies/`
- Homepage mapping: `docs/gyvft/homepage.json`
- Case-study inventory: `docs/gyvft/case-studies.json`
- Editorial review matrix: `docs/gyvft/review.md`

Do not move these images into `aarla-source` or `brand`. Those existing folders serve different purposes.

## Implementation

1. Inspect the current site code and locate every homepage image reference, the `/for-organisations` hero, the `/stories` listing, individual story routes, homepage featured stories and related-story cards.
2. Wire homepage placements using `homepage.json`. Public URLs begin with `/images/gyvft/homepage/`.
3. Use `case-studies.json` as the canonical proposed story inventory. Public hero URLs begin with `/images/gyvft/case-studies/{slug}/hero.png`.
4. Preserve existing case-study copy wherever a current live page already exists. Create concise provisional copy only for new pages, using the factual notes in the inventory and review matrix.
5. Create all 17 story pages for staging review.

## Route changes

- `/stories/dancer-gift-sets` → `/stories/various-dance-schools`
- `/stories/sishyakulam` → `/stories/various-music-schools`
- `/stories/barclays-team-award-badges` → `/stories/natwest-team-event-badges`

Add permanent redirects from the old routes. Remove all Barclays wording: the actual project was NatWest team-event badges.

## Accuracy requirements

- Various Dance Schools is an umbrella story about logo-personalised Dance Class totes for schools, not generic dancer gift sets.
- Various Music Schools must preserve the product-to-school mappings in `review.md`; do not reassign products.
- Kumon Delegate Gifting must retain the actual note card, elephant tray, Mayil 15×17-inch tote and Chennai magnet. Do not change product proportions or place the Durai Adithya magnet inside Aarohana's bag.
- Kumon Winner Gifts currently shares the available Kumon image for staging only. Keep it flagged for editorial review until its separate scope is confirmed.
- Thambi 100 commemorates what would have been his 100th year after his death. Never describe it as a living centenarian's birthday celebration.
- Chinmay is a branding project.
- TM Karthik is recurring crew gifting across The Father, Flowers, Aha Kalyanam and Meeting Mr Green.
- The Cardiologist story includes separate outputs for Dr Harapriya and Dr Saileela; do not merge the two doctors or commissions.

## Review safety

The statuses in `case-studies.json` are `ready`, `review` and `reference-required`.

- Include all entries in local/staging review.
- Add development-only visual badges for `review` and `reference-required`.
- Do not show those badges in production.
- Do not permit a `reference-required` placeholder image to reach production.

## QA and handoff

Verify all homepage sections, the organisation page, all 17 story cards and routes, featured/related-story reuse, redirects, desktop crops and mobile crops. Run lint, type-check and production build. Do not deploy. Report the preview URL, affected routes, build errors and every remaining review item.
