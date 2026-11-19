# Operations dashboard

`/operations` opens the live dashboard after operator authentication. `/operations/requests` remains the work queue, and a request deep link opens that request directly.

The dashboard starts with work rather than decoration:

- An attention prompt links pending payment checks or overdue requested deliveries to their records.
- Active gifts, payment submissions awaiting verification, production/packing and packed gifts have compact summaries that open the matching work-queue filter. Packed gifts still require the balance and tracking checks before dispatch.
- Up next orders payment checks and due work first, with the actual waiting party, owner and task date.
- Payment checks open the matching gift’s bank-verification section; proof older than 24 hours is marked for attention.
- Money shows receipts by their verification date over the last 30 days, separately from outstanding amounts on confirmed orders. A pending screenshot contributes no verified money.
- The Reports link opens a matching verified-receipts/outstanding summary alongside the existing app reports.
- Pipeline counts and requested deliveries in the next seven days reflect the shared request objects. Requested dates are not presented as delivery commitments.

Private drafts and labelled samples are excluded from all dashboard facts. Empty states say what will appear instead of inventing activity. The work queue still permits reviewing labelled samples. All reads use the existing operator secret; no new credential or customer privilege was introduced.

`operations-snapshot.ts` supplies operational facts through the existing authenticated Operations API. The snapshot is reusable by reporting. It adds no database tables or UI-specific source of truth.

## Shared visual theme and responsiveness

The approved cream, near-black, red and olive palette is owned by `src/app/globals.css`. Customer Home, public buttons, authentication, gifting workspaces, dialogs and Operations consume these tokens. Do not add another brown palette or redeclare the business theme in a page stylesheet. Red identifies primary actions, olive provides secondary emphasis, and colour always accompanies text.

Account navigation acknowledges pending clicks and has a route loading state. Home loads external Aarla recommendations independently of owned gift data; a slow catalogue cannot block the customer’s gifts. Request aggregates read independent child records together after ownership checks. Identity reads are deduplicated only inside a React server render, never in a shared customer cache. Operations refreshes its list and selected request concurrently after a save. Switching Operations areas cancels obsolete reads instead of disabling navigation; writes retain their existing duplicate-action lock. A sticky header shows pending work.

Next may commit a streamed account-page response before an ownership check calls `notFound`, so page status alone can be 200. The isolation checks verify the not-found boundary and the absence of protected content; protected media endpoints continue to return 404.

The browser checks cover computed colours across public/customer/Operations screens, deliberately delayed navigation, independent catalogue loading, accurate dashboard facts and sample/draft exclusions, drill-down to bank verification, and 44px mobile controls/reflow.

## Next design work

The next Operations screens to review are richer analytics and downloadable reports, customer account management and named team access/roles. These are not implemented by this dashboard change. Individual circle and organisation flows must be planned and reviewed before their permissions or data model are built. The existing individual gifting and Shopify rules remain in force.
