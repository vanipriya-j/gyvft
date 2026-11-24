/** Public stream identifier supplied by GYVFT's owner, not a credential. */
export function analyticsConfiguration() {
  // Explicit empty values disable the default stream; deployment overrides remain supported.
  const ga4 = (
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "G-XFWQJZM0RN"
  ).trim();
  const gtm = process.env.NEXT_PUBLIC_GTM_ID?.trim() || "";
  // One installation path prevents installing the same Google tag twice.
  if (/^G-[A-Z0-9]{5,20}$/.test(ga4)) return { mode: "ga4" as const, id: ga4 };
  if (/^GTM-[A-Z0-9]{4,20}$/.test(gtm))
    return { mode: "gtm" as const, id: gtm };
  return null;
}
