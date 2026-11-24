# Orient Star Group — Diwali Gifting

Added for owner review on 24 November 2026. The 16 existing stories, homepage story links and layouts are retained. Proposed route: `/stories/orient-star-diwali-hamper`.

## Story

The narrative follows **Across Skies & Seas**: Garuda, Makara and flowing waves as an Indian visual language for journeys, courage and resilience. The curation connects the tray, flat-lid kumkum box, brass diya, magnet option, packaging and greeting card. The greeting-card text has a readable disclosure beside its artwork.

No initial/final headcount, cost, selling price, customer testimonial, delivery result or invoice amount is asserted. The pictured magnet option is not presented as universal to every hamper. Earlier bottle/tote directions and the separate Kamadhenu exploration are not mixed into the shown collection.

## Sources and media

- Owner’s supplied context: [Orient Hamper Curation](https://chatgpt.com/g/g-p-6a487feb49d48191b159e89a5dac3efe-hamper-curation/c/6ab7c41e-87a4-83e8-93fc-f2b2143b2858). The URL returned no readable conversation text to this session; do not claim the original thread was read.
- [Hamper Curation conversation record](https://drive.google.com/file/d/12um2Y_pbkzc_YvEqwAEjFtO0tcvAk4Ub/view), compiled 17 November 2026, Orient Star sections.
- Owner posted three selected visuals in this conversation on 24 November. Exact corresponding originals were located using pages 15, 20 and 21 of the [visual catalogue](https://drive.google.com/file/d/1_lmOghwe8pEr0UidgyabYCpCfYFiOUGs/view), then recovered from the original archives below. PDF thumbnails were not used as website assets.

| Website asset        | Original                                                                             | Archive                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `hero.webp`          | `2026-10-09_149_Cobalt_blue_wave-lid_brass_kumkum_box.png`, 1536 × 1024              | [Client Projects 01](https://drive.google.com/file/d/1tc9hOWF3OEnKs_d1eSBRu5zDinTunXND/view) |
| `greeting-card.webp` | `2026-10-22_129_Blue-white_Diwali_card_featuring_Garuda_and_Makara.png`, 1254 × 1254 | [Client Projects 02](https://drive.google.com/file/d/1DVl38TLmAk9bpVBSi4vFcOh28h0HFFfK/view) |
| `packaging.webp`     | `2026-10-27_035_Kraft_mailer_with_Garuda_Diwali_artwork.png`, 1448 × 1086            | Client Projects 02                                                                           |

Media lives under `public/images/gyvft/case-studies/orient-star-diwali-hamper/`. Only these three selected images are added; full archives and unrelated artwork stay outside the repository. WebP conversion uses quality 90 at the original dimensions, without cropping, redrawing or changing the composition. Combined static payload is 707,672 bytes. Image files are served statically; the runtime continues using the build-generated asset index.

These are artwork/mockup visuals, identified accordingly in the gallery. They are not labelled as finished-order photographs. Source links and review notes belong in this document, not in customer-facing copy.

## Release

Review branch only. No production publication, migration, customer-data operation or Shopify write is part of this addition. The existing optional gallery field is now rendered when present; older stories have no gallery, so their presentation is unchanged.

## Verification

- Production build passes; the route is statically generated.
- Browser checks at 320, 390 and 1440 pixels: HTTP 200, no horizontal overflow or JavaScript errors, both gallery images load at their full aspect ratios, and the greeting-card disclosure opens by keyboard with a 44-pixel control.
- The browser pass exposed an existing reduced-motion hydration bug in `MotionReveal`: content could retain its initial zero opacity when the motion preference became available. An explicit immediate visible state fixes this without changing normal-motion animation or page layout. Visibility was checked on all 17 story headings with reduced motion and on Orient with normal motion.
- All 16 original story routes return HTTP 200 and have no new gallery. A direct record comparison against the base commit confirms the original content, order and redirects are unchanged; the listing now has 17 unique stories.
- Repository lint passes with two existing warnings in `tests/unit/public-home-interactions.test.tsx`. The original mobile homepage browser assertion used a dot-all regular-expression flag unsupported by the repo’s ES2017 TypeScript target; its equivalent `[\s\S]` form removes that typecheck blocker without changing the website.
- Full TypeScript checking passes after that equivalent assertion correction; changed source files also pass ESLint.
- Local screenshots and the browser verification script are kept under ignored `work/orient-review/`.
