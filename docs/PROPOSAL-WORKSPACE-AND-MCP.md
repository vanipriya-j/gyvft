# Gift option images, quick fill and GPT connection

The owner requested multiple option images, drag-and-drop/clipboard entry, fast JSON or text filling, and an MCP connection so GPT can prepare options directly in GYVFT. These features operate on the gift-option object model and custom prices supplied by the owner.

The subsequent [Agent Operations expansion](AGENT-OPERATIONS.md) adds twelve explicitly scoped tools for publication, customer approvals with proof, messages, payment requests/verified receipts, intake and Shopify handoff. The three original tools described here retain their original boundaries; existing grants require reconnection for additional permissions.

## Operations entry

Open a real request → **Options**. A new option supports up to **six images**. Choose files, drop them into the image area, or focus that area and paste an image with Ctrl+V/⌘V. Before saving, remove unwanted selections and choose the cover. PNG, JPEG and WebP inputs may be up to 10 MB each; the app creates bounded previews for viewing. Original source artwork should be retained separately.

**Quick fill** accepts one JSON option or a labelled block. **Review import** displays the parsed items and estimate; **Apply to form** replaces only the text, item and pricing fields. Selected images remain. Neither action saves or publishes. Invalid input preserves the existing form. The text parser uses explicit labels, not an external AI service; GPT performs natural-language interpretation when using the MCP connection.

```json
{
  "title": "Team appreciation kit",
  "description": "A coordinated set for your team.",
  "contents": [
    { "name": "Branded T-shirt", "quantity": 1 },
    { "name": "Journal", "quantity": 1 },
    { "name": "Water bottle", "quantity": 1 }
  ],
  "pricing": {
    "mode": "none",
    "basis": "per_set",
    "quantity": 1,
    "packaging_included": false
  }
}
```

All import/MCP prices use **rupees**, explicitly named `low_inr` and `high_inr`. For a supplied estimate use `mode: "indicative"` and `low_inr`; for a range use `mode: "range"` and both amounts. `basis` is `per_set` or `order`. The shared model converts to integer paise once. No amount is invented when it is unknown. Estimates retain the existing tax-inclusive/delivery-at-actuals presentation and remain separate from a quote for approval.

Labelled text supports `Title:`, `Description:`, `Items:` (one item per line, optionally `2 x Journals`), `Price:` (a rupee amount, range or `unpriced`), `Price basis:`, `Sets:` and `Packaging:` (`included` or `not included`). Ambiguous prices and duplicate labels produce a review error.

**Save private draft** preserves an unpublished option, including a text-only draft. It creates no customer event or notification. **Edit draft** updates text/pricing and appends images; saved images and the existing cover are retained. A new reference key and expected version protect edits from overwriting another operator or agent's changes. Revision records retain prior draft metadata. **Publish reviewed draft** requires an image and the reviewed version, makes the option customer-visible and queues the existing option-ready notification once. Published options remain immutable; official-order/production locks apply to every write.

Customers can browse thumbnails, use previous/next buttons, swipe horizontally or open a named, keyboard-accessible larger preview. Images remain behind the existing ownership/visibility checks. Private draft images cannot be read by the customer, another customer or an anonymous visitor.

## Explicit database activation

No build, startup, deployment, image upload, settings read or MCP request applies SQL. Production execution requires the owner's explicit approval, as instructed earlier in this project.

| Update | Effect |
| --- | --- |
| `20261124000001_gift_option_images.sql` | Adds a private table for five extra images per option; the existing image remains its cover. |
| `20261124000002_agent_proposals.sql` | Adds draft version/reference columns, permits missing cover bytes only on private drafts, and adds private revision, OAuth grant and connection-settings tables. Connections start disabled. |

These files contain no customer-record deletion or backfill. Existing option titles, prices, cover bytes and timestamps are preserved. The published-cover constraint continues requiring an image for every published option. Row-level security and direct-access revocations match the existing customer storage model.

For galleries alone, `/setup/option-images` checks status and runs only the first checksum-pinned file after the operator explicitly approves it. For all requested features, `/setup/agent-proposals` runs only the two pinned files still pending. It requires the existing gift workspace/journey migrations to be recorded, blocks modified SQL and uses the existing transaction/advisory lock. It never applies unrelated pending migrations. Merely checking status performs no schema write. Retrying an already-recorded activation does not run its SQL again.

Before activation, existing single-image options and publishing continue working. The form explains that additional images/private drafts require activation; customer pages retain the original cover fallback. The migration files are included in the existing server-owned customer manifest, but execution is always an explicit command.

## Connect ChatGPT

1. Review and approve the two files above through `/setup/agent-proposals` using the existing Operations/setup secret.
2. Open **Operations → Settings & connections → GPT & agent connections** and enable GPT connections.
3. Add `https://www.gyvft.com/mcp` as a custom server in ChatGPT developer mode, choosing **OAuth**. The server advertises dynamic registration. If using a preconfigured public client, its ID is `gyvft-chatgpt` and it has no client secret.
4. Authorise on the GYVFT consent page using the Operations secret. Enter that secret only on GYVFT. ChatGPT receives separate access/refresh tokens.
5. Try a real brief plus a small attached image, then review the resulting private draft in the request's Options tab before publishing.

Example instruction after connecting:

> Open my GYVFT request using the link I provide. Use these option descriptions, my custom prices and the attached images to prepare private option drafts. Keep unknown prices unpriced. Show me the saved draft links; I will review and publish them in Operations.

The connection needs no separate OpenAI API key or hosted AI service. It uses the existing Operations credential only to approve OAuth; token-signing keys are purpose-separated and server-only. Do not paste credentials into a conversation or put them in a public environment variable. `GYVFT_MCP_ORIGIN` is an optional **server-only** canonical-origin override; the default is `https://www.gyvft.com`. Explicit HTTP loopback origins are supported for isolated local QA. A production token cannot be used against a different-origin MCP endpoint.

## MCP tool surface

| Tool | Access and result |
| --- | --- |
| `list_gift_requests` | Read-only search of submitted, non-demo requests; at most 20 results. |
| `get_gift_request` | Reads a submitted brief and its option/draft metadata. Does not return payment proofs, delivery addresses or private unsubmitted customer briefs. |
| `save_gift_option_draft` | Creates/updates private options and appends attached images. Requires a UUID `client_reference`; edits also require `option_id` and `expected_version`. Never publishes or sends customer notifications. |

Tool inputs use the same rupee-based option shape as quick fill. Attached images use OpenAI file parameters (`_meta["openai/fileParams"]: ["files"]`), with top-level file objects containing `download_url`, `file_id`, and optional `mime_type`/`file_name`. No base64 image payload needs to be generated by the model. File URLs are temporary and are not persisted or logged. Completed retries use the saved revision/reference and do not download expired file links again. A reused key with different data is rejected.

Image ingestion accepts only HTTPS OpenAI file/storage hosts, rejects private/reserved addresses, pins the verified IPv4 address while preserving TLS/SNI and Host, revalidates redirects and bounds bytes/time. PNG/JPEG/WebP signatures are checked before decoding; pixel limits and preview conversion remove metadata. Downloads/processing finish before the atomic draft write. Existing saved images are appended to, not deleted or silently replaced.

OAuth uses exact allowlisted ChatGPT callbacks, issuer identification, resource-bound tokens, S256 PKCE, five-minute single-use codes, fifteen-minute access tokens and rotating refresh tokens with a fixed thirty-day grant expiry. Grant/token secrets are stored only as hashes. The owner can revoke one connection or disable/revoke all from Operations. The JSON-RPC endpoint supports stateless Streamable HTTP requests and the advertised legacy/current protocol versions; it does not require an in-memory server session. The original three tools expose no publication, payment or order action. Additional actions require the separately activated and explicitly granted scopes described in [AGENT-OPERATIONS.md](AGENT-OPERATIONS.md). No tool permits arbitrary HTTP or SQL.

References: [OpenAI authentication](https://developers.openai.com/plugins/build/auth), [OpenAI file parameters](https://developers.openai.com/plugins/reference), [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [MCP 2026 per-request transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports). The legacy initialisation handshake and current per-request version, capability and HTTP-header checks are both covered.

## Verification and remaining live check

Tests use only the dedicated localhost:55438 PostgreSQL fixture. They cover legacy images before activation, both additive SQL files, image ownership/visibility, six-image ordering, draft revisions and stale writes, no notification before publication, one-time publication, PKCE, code expiry/replay, refresh rotation, grant expiry, revocation, tool scopes, protocol versions, private-brief exclusion, SSRF/redirect guards and bounded real image conversion. Fixtures contain fictional records and no live provider credentials.

The automated suite passed 355 tests with 62 unrelated database-dependent tests skipped. After the final protocol checks, all 30 focused proposal/import/image/MCP tests passed again. Production build and lint passed (lint retains two pre-existing image-fixture warnings).

Browser QA passed against the production build and a disposable local database: native clipboard paste, drop, reviewed import, invalid-import preservation, cover choice, private save/edit with no customer event or notification, six-image limit, explicit one-time publication, customer image ownership, gallery navigation, named dialog and focus return, touch swipe, and 320/390/1440px layouts without horizontal overflow. The actual local OAuth consent, callback/issuer, token exchange, MCP brief read, private draft write and token revocation also passed. No browser exceptions were recorded. Function tracing contains no public media; Sharp is confined to the MCP image endpoint and does not enter the Operations API bundle.

This does not establish an actual connected ChatGPT account or a live host-provided file upload. Those require owner activation/connection and a first real attachment after release. No production migration or customer-data operation has been run by the agent.
