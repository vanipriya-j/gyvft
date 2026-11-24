const safeViews = new Set([
  "overview",
  "brief",
  "options",
  "quote",
  "design",
  "payments",
  "fulfilment",
  "delivery",
  "messages",
  "moments",
  "activity",
  "edit",
]);
const safeModes = new Set(["signup", "login", "forgot", "recover", "reset"]);

/** No customer names, account/gift IDs, recovery tokens or arbitrary URL queries. */
export function analyticsPage(pathname: string, query = "") {
  if (
    /^\/(operations(?:-review)?|studio|setup|api|mcp|connect\/gyvft-agent|\.well-known)(\/|$)/.test(
      pathname,
    )
  )
    return null;
  if (/^\/account\/(?:circle-)?invitations?(\/|$)/.test(pathname)) return null;
  let path = pathname.replace(/\/$/, "") || "/";
  path = path.replace(
    /(\/account\/(?:projects|circles|occasions|people))\/[^/]+/g,
    "$1/[id]",
  );
  if (
    path.startsWith("/account") &&
    !/^\/account(?:$|\/(?:login|shop|gifts(?:\/new)?|profile(?:\/tastes)?|circles(?:\/(?:new|\[id\]))?|occasions(?:\/\[id\])?|people(?:\/\[id\])?|projects\/\[id\](?:\/options)?)$)/.test(
      path,
    )
  )
    return null;
  if (
    !path.startsWith("/account") &&
    !new Set([
      "/",
      "/why-gyvft",
      "/stories",
      "/tell-your-story",
      "/for-organisations",
      "/become-a-merch-partner",
      "/upload-a-brief",
      "/book-a-discovery",
      "/thank-you",
      "/privacy",
      "/cookies",
      "/terms",
    ]).has(path)
  ) {
    path = /^\/stories\/[a-z0-9-]{1,100}$/.test(path)
      ? path
      : /^\/l\//.test(path)
        ? "/l/[slug]"
        : "/other";
  }
  const params = new URLSearchParams(query),
    safe = new URLSearchParams();
  const view = params.get("view"),
    mode = params.get("mode");
  if (view && safeViews.has(view)) safe.set("view", view);
  if (path === "/account/login" && mode && safeModes.has(mode))
    safe.set("mode", mode);
  if (!path.startsWith("/account")) {
    for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
      const value = params.get(key);
      if (value && /^[a-zA-Z0-9_.-]{1,80}$/.test(value)) safe.set(key, value);
    }
  }
  return {
    path: path + (safe.size ? `?${safe}` : ""),
    title: path.startsWith("/account")
      ? "My GYVFT"
      : path === "/"
        ? "GYVFT"
        : `${path} · GYVFT`,
  };
}

const safeStrings: Record<string, Set<string>> = {
  method: new Set(["email"]),
  form_name: new Set([
    "gift_brief",
    "story",
    "partner",
    "discovery",
    "brief_upload",
  ]),
  cta_name: new Set([
    "create_account",
    "sign_in",
    "start_gift",
    "shop_aarla",
    "watch_problem",
    "watch_solution",
    "view_story",
  ]),
};

/** Explicit parameter allowlist: never forward form values or provider payloads. */
export function googleParameters(input: Record<string, unknown>) {
  const safe: Record<string, string | number> = {};
  for (const [key, values] of Object.entries(safeStrings)) {
    if (typeof input[key] === "string" && values.has(input[key]))
      safe[key] = input[key];
  }
  if (
    Number.isInteger(input.step) &&
    Number(input.step) >= 0 &&
    Number(input.step) <= 20
  )
    safe.step = Number(input.step);
  return safe;
}
