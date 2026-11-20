# Function storage and public asset tracing

20 November 2026. The initial Vercel screenshot showed 8.9 GB of Function Storage, which the user attributed to GYVFT. A later Functions Storage project view shows GYVFT at 7.86 GB; a separate Deployment Storage view shows 7.44 GB total. These are distinct metrics and views, not proof of that much customer data or traffic. Functions Storage covers stored regional function bundles; Deployment Storage covers build outputs/static assets. Retained releases can affect both. Exact per-deployment attribution and the current retention policy still need authenticated Vercel inspection. Open GYVFT → Deployments → a successful deployment → Resources (Functions and Static Assets); compare a release before the fix with the new one.

Vercel records each project's daily maximum for both metrics. Deleting a deployment stops its future contribution, but does not erase earlier usage; a billing-period total need not fall immediately. See [Vercel's definitions and measurement rules](https://vercel.com/docs/deployment-storage).

## Confirmed local packaging issue and correction

`publicAssetExists()` used a dynamic filesystem path under `public`. Next.js consequently traced the public image tree into many route dependency lists. The Operations review page also read variable PNG paths at runtime, and the demo seeder's dynamic path expression included additional case-study images.

The fix generates a small, deterministic asset-path/PNG-dimension manifest before `next build` and `next dev`. Rendering uses this metadata for existing missing-image fallbacks and review dimensions; the images remain untouched static assets. The demo seeder now reads its two exact required images. There are no broad trace exclusions that could hide missing runtime dependencies.

Local production-build comparison, using the same checkout and dependencies:

| Measurement                             |                           Before |                       After |
| --------------------------------------- | -------------------------------: | --------------------------: |
| Unique files in route dependency traces |                         81.2 MiB |                    9.49 MiB |
| Public assets in those traces           |                         72.4 MiB |                    0.69 MiB |
| Tell Your Story route trace             |                         74.9 MiB |                    2.48 MiB |
| Demo-data route public images           | Included other case-study images | Exactly two required images |

These are local Next.js dependency-trace measurements, **not Vercel invoice measurements**. Vercel's bundling, compression, deduplication, deployment history and other projects affect its reported storage. Do not multiply route trace size by route count or claim that this reduces the whole 8.9 GB by the same percentage.

Metadata generation reads only the public directory and writes `src/config/public-assets.generated.json`. It never connects to a database, runs migrations, deletes images, changes customer data or executes a deployed request. New public files are included automatically on the next build. The committed metadata permits typechecking/tests before a build; a freshness test compares it to the actual public inventory.

## Existing deployment history

The code change reduces future function packaging. It does not delete or resize retained deployments, and no deployment/retention setting was changed here.

Use Vercel Usage → Function Storage → Projects to identify each project's contribution. Review deployment count and retention separately for previews, production, failed and cancelled deployments. A proposed cleanup should list the deployments to remove and preserve the current production deployment and an agreed rollback version. Obtain explicit approval before deletion or a retention change that removes history. Do not blanket-delete deployments to make the usage graph fall.

Batch related code changes and review them locally before pushing, to avoid unnecessary preview/production deployment churn. Do not skip release checks or silently turn off deployments.

Official references: [Vercel's deployment/storage explanation](https://vercel.com/changelog/deployment-storage-pricing-expands-to-existing-teams), [deployment retention](https://vercel.com/docs/deployment-retention), and [Next.js output tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
