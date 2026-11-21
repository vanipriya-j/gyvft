const origin = "https://aarla.in";

/** Only store home/product/collection paths, never a caller-controlled redirect. */
export function aarlaDestination(value: string): string {
  const u = new URL(value, origin);
  if (
    u.protocol !== "https:" ||
    !["aarla.in", "www.aarla.in"].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.port
  )
    throw Error("Choose an Aarla product or collection.");
  const parts = u.pathname.split("/").filter(Boolean);
  if (
    parts.length &&
    (parts.length !== 2 ||
      !["products", "collections"].includes(parts[0]) ||
      !/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,200}$/u.test(
        decodeURIComponent(parts[1]),
      ))
  )
    throw Error("Choose an Aarla product or collection.");
  const path = parts.length
    ? `/${parts[0]}/${encodeURIComponent(decodeURIComponent(parts[1]))}`
    : "/";
  const query = new URLSearchParams();
  query.set("utm_source", "gyvft");
  query.set("utm_medium", "customer_dashboard");
  const campaign = u.searchParams.get("utm_campaign");
  if (campaign && /^[a-zA-Z0-9_-]{1,80}$/.test(campaign))
    query.set("utm_campaign", campaign);
  const variant = u.searchParams.get("variant");
  if (variant && /^\d{1,30}$/.test(variant) && parts[0] === "products")
    query.set("variant", variant);
  return path + "?" + query;
}

export function aarlaShopHref(destination: string, enabled: boolean): string {
  return enabled
    ? `/account/shop?to=${encodeURIComponent(aarlaDestination(destination))}`
    : destination;
}

export function aarlaDiscountUrl(code: string, destination: string): string {
  if (!/^GYVFT5-[A-F0-9]{24}-[A-Z0-9]{1,8}$/.test(code))
    throw Error("Invalid saving reference.");
  const url = new URL(`/discount/${code}`, origin);
  url.searchParams.set("redirect", aarlaDestination(destination));
  return url.href;
}
