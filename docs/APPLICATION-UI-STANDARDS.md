# GYVFT application typography and spacing

Reviewed 17 November 2026. These are GYVFT application design decisions informed by current product design systems, not universal pixel requirements. Public marketing pages are outside this change.

## Reference findings

- [Atlassian app typography](https://atlassian.design/foundations/typography) uses a 14px/20px default for compact application text. Its [application guidance](https://atlassian.design/foundations/typography/applying-typography) reserves smaller text for secondary uses, recommends 16px for extended reading, and calls for relative units, semantic headings and adequate contrast.
- [IBM Carbon type sets](https://www.carbondesignsystem.com/building-blocks/foundations/typography/type-sets), updated September 2026, distinguish task-focused productive typography from expressive typography. Compact body styles are 14px/18px; larger reading styles use 16px. Fixed, role-based headings support denser product containers.
- [Atlassian spacing](https://atlassian.design/foundations/spacing/) uses a limited token scale based on 8px, with useful subdivisions including 4px and 12px. Related content should be grouped by proximity; larger separations communicate distinct groups. A scale creates consistency, not a mandate to use large gaps.
- [Material application type guidance](https://m3.material.io/styles/typography/applying-type) organizes styles by display, headline, title, label and body roles. These roles should not all look like promotional headlines.
- [WCAG 2.2 target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) has a 24×24 CSS-pixel AA minimum with defined exceptions, while the enhanced criterion uses 44×44. GYVFT aims for at least 44×44 touch targets; that does not mean 44px gaps between controls.
- [WCAG text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) requires layouts to survive user spacing overrides. It does not require every default UI label to use 1.5 line-height or every paragraph to have enormous margins. Avoid fixed-height clipping and preserve zoom/reflow.

## GYVFT type roles

Values below are nominal at a 16px browser root. Implement with rem units and support browser zoom.

| Role | Desktop | Mobile | Treatment |
| --- | --- | --- | --- |
| Page title | 28 / 36px | 24 / 32px | Brand serif, regular |
| Desktop Home slogan | 32 / 40px | Omitted | Brand serif, regular |
| Section / carousel title | 20 / 24px | 20 / 24px | Brand serif, regular |
| Gift / option title | 20 / 24px | 20 / 24px | Brand serif, regular |
| Normal UI text / button labels | 14 / 20px | 14 / 20px | Existing sans, regular/medium |
| Messages, longer reading and mobile editable text | 16 / 24px | 16 / 24px | Existing sans |
| Secondary dates, captions, status | 12 / 16px | 12 / 16px | Secondary information only |

Keep the existing brand fonts; introducing another font is unnecessary. Preserve sentence case. Avoid 10px essential labels, widely tracked uppercase instructions and large explanatory paragraphs on task screens. Use tabular numerals for changing or aligned prices, quantities and totals. Font weight, wording and position should reinforce hierarchy without creating many similar heading styles.

## GYVFT spacing roles

Core scale: 4, 8, 12, 16, 24, 32px. Use the larger steps only when the relationship warrants it.

| Relationship | Starting value |
| --- | --- |
| Closely related text / icon-to-label | 4–8px |
| Heading to its content | 8px |
| Description to its action | 8–12px |
| Desktop card body padding | 16px |
| Mobile compact card padding | 12–16px |
| Related field or row groups | 12–16px |
| Separate sections | 24px |
| Desktop page inset | 24px |
| Mobile page inset | 16px |

Apply a gap once: stacked parent padding, child margins and fixed spacer elements must not silently add together. Reduce excessive page inset and card padding in addition to correcting oversized card heights. Keep actions close to the content they affect. Align peer card edges, but do not distribute their internal whitespace simply to fill a large box. Use content-driven minimum heights and permit expansion when text grows.

## Responsive behavior

Desktop Home retains the slogan, three aligned carousel columns and the lower inspiration/saved/payment area. Mobile uses compact horizontal image/text cards, a contextual New gift CTA aligned with Gifts taking shape, then occasions and Aarla. It does not inherit a desktop vertical stack or its large image dimensions. Both use the same data and clear navigation to the complete history, saved ideas and payment details.

Within each carousel, show only centred previous/next controls; heading totals communicate collection size. No simultaneous visible scrollbars, autoplay or duplicate active-request list on Home. Controls need accessible labels, keyboard focus, loading/disabled states and truthful empty/error states.

The individual gift page should be a task workspace: compact identifying header, visible visual direction and current action, concise stage progression, then clearly labelled Options, Quote/payment, Brief, Activity and Messages as appropriate to the current stage. Do not make every field a full-width card or present an enquiry as if it were already an approved order. Mock this screen before implementation.

## Review checks

Review populated, empty, sample and failure states at 320px, 390px, 1024px and 1366px. Check long gift titles, large currency values, keyboard operation, 200% text/zoom, increased text spacing and mobile touch targets. Essential actions should be visible before secondary detail. The goal is useful information density with readable type and understandable groups, not the fewest pixels possible.

## Carousel alignment and personal invitations

Desktop carousel sections share header, card and annotation tracks using CSS subgrid. Sample notices and request failures belong beneath the shared card track so they cannot shorten only one card. Cards grow with their content; no large fixed minimum height is used. Controls are omitted for collections with fewer than two items.

An empty occasion calendar invites a personal choice: “Whose special day is coming up?” and “Save a birthday or anniversary for someone you care about.” Its single Add a special day action opens the occasion form directly. Avoid urgency, repeated prompts or promises of reminders that the application does not provide.

`tests/e2e/customer-home-layout.spec.ts` checks fictional sample/empty/populated/long-title states at 1024/1366px, mobile reflow, the direct add flow and 200% text sizing. Opt in with `PLAYWRIGHT_HOME_FIXTURES` (JSON keys `sample-empty`, `empty`, `populated`, `long`, each holding a local test-session token), `PLAYWRIGHT_BASE_URL` pointing to a local running app, and optionally `PLAYWRIGHT_CHROMIUM_EXECUTABLE` / `PLAYWRIGHT_HOME_IMAGE`. These tests refuse hosted app URLs.

## Home imagery

Use existing GYVFT library photographs for missing gift previews, occasion photos and empty carousel visuals. Real customer/curation images take priority. Generic gift imagery is labelled as inspiration; a failed actual image is labelled unavailable so it is not represented as a prepared option. The original source PNGs remain unchanged.

Carousel image containers use full-frame, aspect-preserving cover crops with focal positions chosen for each library photo and a separate portrait crop on mobile. Catalogue imagery fills the same frame rather than appearing as a small contained square. Public assets use the existing image optimizer/CSP; private preview URLs remain native cookie-authenticated images. Image rendering and fallback priority are covered by the Home browser regression suite.
