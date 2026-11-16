# Gift options and customer workspace

This feature adds `/account/projects/[id]/options`. It uses the existing GYVFT customer account and database session. It does not create Supabase Auth users or require a Shopify catalogue.

## Customer journey

1. Open a request and choose **Explore gift options**. Published options appear in a two-column grid with one hamper photo/mock-up, manually entered contents and an optional indicative price or range.
2. Choose **Build my option**, copy a curated option, or duplicate an existing customer alternative. Copies have independent contents; published options remain unchanged.
3. Add products using the line-icon carousel **inside** the dotted workspace. Drag/drop and click/tap are equivalent. Framed art, bottles, dabara sets and T-shirts collect their variants in a dialog; kids sizes differ from adult sizes.
4. Set recipient count, quantities per recipient, design approach, individual personalisation and packaging. “Add a little more” records the extra per-recipient budget and request for the team; it does not invent or automatically add recommendations.
5. Drafts save to the database, with an explicit saving indicator, manual Save, navigation protection for unsaved changes and optimistic version checking. A stale tab cannot overwrite a newer version. After an uncertain save, reload to recover the stored version.
6. Once a customer alternative has a published quote, further customisation creates another alternative; server checks also prevent overwriting the quoted option.
7. Review and select the option for a quote. A fixed snapshot is stored and the team is notified through the existing notification outbox. Further experiments do not change it.
8. Return to the request to review the linked itemised quote, approve it and continue through the existing advance/payment-proof verification, artwork approval and delivery workflow.

Each option has a Show/Hide switch. **Show hidden options** reveals saved hidden options for restoration. Visibility does not mutate contents, estimates, snapshots or quote history. Samples and converted orders are read-only in the workspace; changes to an order go through the team.

## Prices

Publishing supports **no price shown**, **indicative price**, or **range**, with a per-set/whole-order basis, assumed quantity and packaging-included checkbox. Displayed prices include applicable taxes; delivery is separate at actuals. A copied option retains the original estimate only as a reference and says **Awaiting revised estimate**. Unpriced catalogue/custom items stay **to quote**, never free. Product printing is included in product prices; individual names/messages are additional per print. Charges are explicitly agreed in the final quote, including any design work below the complimentary threshold.

## Operations

Open `/operations/requests`, authenticate with the existing operator secret and select the customer's request.

- **Gift options & customer selections** publishes one image and a contents list; no Shopify product ID is needed. Publishing creates a new immutable option. Revisions are new options; Show/Hide is separate metadata.
- Choose optional estimate display/basis/assumed quantity; enter tax-inclusive amounts.
- Review customer drafts separately from their submitted selections. **Use this selection in quote** copies the exact items, quantities and variant details into the existing quote editor. Enter final item prices and all agreed charges before publishing. Zero/default prices are not a priced quote.
- The latest saved selection must be linked when publishing a quote. A superseded selection cannot be approved or converted. Customers can expand **Your selected gift for this quote** to see the snapshot.
- Existing conversion/payment/production/dispatch checks continue to apply. No Shopify order or payment is created by publishing options, building drafts or requesting a quote.

## Setup and validation

Deploy the matching application code and apply `20261116000001_gift_workspace.sql` through the existing `/setup` flow (included in its customer-only manifest). This migration adds namespaced option, draft, selection and visibility tables, a quote-to-selection link, and the safe quote-request event type. New tables have RLS enabled with browser-role privileges revoked; application server queries enforce request ownership. Private images enforce the same ownership.

Unit validation: `npx vitest run tests/unit`.

Additional database tests are opt-in against the disposable local PGlite fixture described in `work/auth-test-db/README.md`, after applying the customer migrations:

```
GYVFT_WORKSPACE_TEST_DB=postgresql://postgres:postgres@127.0.0.1:55432/postgres npx vitest run tests/unit/gift-workspace-db.test.ts
```

The test refuses non-local fixture URLs. It checks cross-account writes, cross-request content sources, stale saves, fixed snapshots, visibility, selection-linked quotes and browser-role table access. Local Playwright checks exercise customer reloads, variants, hide/restore, image isolation, admin publication and the quote-to-delivery roundtrip. Notifications use local fixtures and never send real customer mail during these checks.
