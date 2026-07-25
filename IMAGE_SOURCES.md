# Image sources (Aarla public assets → GYVFT)

Downloaded from publicly available pages on [aarla.in](https://aarla.in) for local use only.  
**Do not hotlink Aarla CDN URLs in production.** Assets live under `public/images/aarla-source/`.

## Inventory decision summary

| Asset | Decision | Reason |
| --- | --- | --- |
| Homepage street scene | Reuse (cropped/optimised) | Atmosphere / gathering, no brand marks |
| Honour / performance still | Reuse | Memory & honour story world |
| Green tumbler + bowl gift set | Reuse | Object-first gifting |
| Grandmother & child drawing | Reuse | Remember / personal story |
| Nourish bag + bottle + tiffin | Reuse | Merch / organisation kit |
| Gather doorway scene | Reuse | Celebrate / belonging |
| Sacred.png | Rejected | Sacred / cultural motif |
| Navaratri / Devi / branded product stills | Rejected | Aarla-specific taxonomy or branding |
| Logo / wordmark assets | Rejected | Aarla branding |

## Downloaded assets

### `street-madras-coffee`

| Field | Value |
| --- | --- |
| Source page | https://aarla.in/ |
| Original URL | `https://cdn.shopify.com/s/files/1/0948/0626/0373/files/Street_Madras_Coffee.png?...` |
| Depicts | Warm street gathering / café atmosphere |
| GYVFT usage | Homepage hero background |
| Aarla branding | No |
| Treatment | Optimised JPEG in `optimized/`; original PNG in `originals/` |
| Production path | `/images/aarla-source/optimized/street-madras-coffee.jpg` |

### `honour-performance`

| Field | Value |
| --- | --- |
| Source page | https://aarla.in/ |
| Original URL | `https://cdn.shopify.com/s/files/1/0948/0626/0373/files/Honour.png?...` |
| Depicts | Classical dance performance; ghungroos in foreground |
| GYVFT usage | Story world: Honour; also transformation example support |
| Aarla branding | No |
| Treatment | Optimised JPEG |
| Production path | `/images/aarla-source/optimized/honour-performance.jpg` |

### `gift-tumbler-bowl`

| Field | Value |
| --- | --- |
| Source page | https://aarla.in/ |
| Original URL | `https://cdn.shopify.com/s/files/1/0948/0626/0373/files/Untitled_design_22.png?...` |
| Depicts | Green metal tumbler and bowl gift set on warm table |
| GYVFT usage | “What your story can become” — gifts / objects |
| Aarla branding | No |
| Treatment | Optimised JPEG |
| Production path | `/images/aarla-source/optimized/gift-tumbler-bowl.jpg` |

### `remember-drawing`

| Field | Value |
| --- | --- |
| Source page | https://aarla.in/collections/arts |
| Original URL | `https://cdn.shopify.com/s/files/1/0948/0626/0373/files/Arts_Story_3.png?...` |
| Depicts | Illustrated grandmother and child drawing together |
| GYVFT usage | Story world: Remember; books / personal narrative cue |
| Aarla branding | No |
| Treatment | Optimised JPEG |
| Production path | `/images/aarla-source/optimized/remember-drawing.jpg` |

### `merch-nourish-kit`

| Field | Value |
| --- | --- |
| Source page | https://aarla.in/collections/nourish |
| Original URL | `https://cdn.shopify.com/s/files/1/0948/0626/0373/files/Nourish_Hero.png?...` |
| Depicts | Soft bag, bottle, and tiffin arranged as a kit |
| GYVFT usage | Organisations / merchandise capability |
| Aarla branding | No |
| Treatment | Optimised JPEG |
| Production path | `/images/aarla-source/optimized/merch-nourish-kit.jpg` |

### `celebrate-gathering`

| Field | Value |
| --- | --- |
| Source page | https://aarla.in/collections/gather |
| Original URL | `https://cdn.shopify.com/s/files/1/0948/0626/0373/files/Gather_Hero.png?...` |
| Depicts | People gathered in a warmly lit doorway |
| GYVFT usage | Story world: Celebrate / Belong |
| Aarla branding | No |
| Treatment | Optimised JPEG |
| Production path | `/images/aarla-source/optimized/celebrate-gathering.jpg` |

## Typography notes (from live Aarla CSS)

Aarla’s theme loads:

- Body: **Inter**
- Headings: **PT Serif**

Both are available via Google Fonts and are reused in GYVFT through `next/font/google` (licence-safe for web use).

## Colour notes (from live Aarla `:root` theme)

| Token / role | Aarla source | GYVFT token |
| --- | --- | --- |
| Page cream | `rgb(246, 241, 232)` / `#f6f1e8` | `--background` |
| Soft surface | `rgb(239, 231, 218)` / `#efe7da` | `--surface`, `--warm-neutral` |
| Body text | `rgb(43, 43, 43)` / `#2b2b2b` | `--text` |
| Muted text | softened warm grey from `#2b2b2b` | `--muted-text` |
| Olive accent | `#70715b` | `--olive` |
| Dark warm accent | `#4a3429` / near `#202202` | `--olive-dark`, CTA fill |
| Border | light warm line on cream | `--border` |

Shopify theme CSS was **not** copied wholesale; values were extracted into GYVFT semantic tokens.
