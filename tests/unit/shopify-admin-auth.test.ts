import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: vi.fn() }));
const domain = "aarla-merch.myshopify.com";
const issued = (token = "fixture-issued-token", expires = 86399) =>
  Response.json({
    access_token: token,
    expires_in: expires,
    scope: "write_discounts",
  });
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("SHOPIFY_SHOP_DOMAIN", domain);
  vi.stubEnv("SHOPIFY_CLIENT_ID", "fixture-client");
  vi.stubEnv("SHOPIFY_CLIENT_SECRET", "fixture-secret");
  vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("exchanges client credentials only on the pinned Aarla endpoint and reuses the issued token", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(issued());
  vi.stubGlobal("fetch", fetch);
  const { shopifyAdminToken, shopifyServerConfigured } =
    await import("@/services/shopify/admin-auth");
  expect(shopifyServerConfigured()).toBe(true);
  expect(await shopifyAdminToken()).toBe("fixture-issued-token");
  expect(await shopifyAdminToken()).toBe("fixture-issued-token");
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe(`https://${domain}/admin/oauth/access_token`);
  expect(options).toMatchObject({
    method: "POST",
    cache: "no-store",
    redirect: "error",
  });
  expect(Object.fromEntries(new URLSearchParams(options.body))).toEqual({
    grant_type: "client_credentials",
    client_id: "fixture-client",
    client_secret: "fixture-secret",
  });
});
it("coalesces simultaneous token requests within an instance", async () => {
  let release!: (r: Response) => void;
  const fetch = vi.fn().mockImplementation(
    () =>
      new Promise<Response>((r) => {
        release = r;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const { shopifyAdminToken } = await import("@/services/shopify/admin-auth");
  const requests = [
    shopifyAdminToken(),
    shopifyAdminToken(),
    shopifyAdminToken(),
  ];
  expect(fetch).toHaveBeenCalledTimes(1);
  release(issued());
  expect(await Promise.all(requests)).toEqual(
    Array(3).fill("fixture-issued-token"),
  );
});
it("renews before Shopify's returned expiry without a refresh-token cron", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(issued("first", 120))
    .mockResolvedValueOnce(issued("second", 120));
  vi.stubGlobal("fetch", fetch);
  const { shopifyAdminToken } = await import("@/services/shopify/admin-auth");
  expect(await shopifyAdminToken()).toBe("first");
  vi.setSystemTime(Date.now() + 109000);
  expect(await shopifyAdminToken()).toBe("second");
  expect(fetch).toHaveBeenCalledTimes(2);
});
it.each(["SHOPIFY_CLIENT_SECRET", "SHOPIFY_CLIENT_ID"])(
  "does not reuse a cached token after %s changes",
  async (field) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(issued("first"))
      .mockResolvedValueOnce(issued("second"));
    vi.stubGlobal("fetch", fetch);
    const { shopifyAdminToken } = await import("@/services/shopify/admin-auth");
    expect(await shopifyAdminToken()).toBe("first");
    vi.stubEnv(field, "rotated-fixture");
    expect(await shopifyAdminToken()).toBe("second");
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);
it("retains legacy token support when neither client credential is supplied", async () => {
  vi.stubEnv("SHOPIFY_CLIENT_ID", "");
  vi.stubEnv("SHOPIFY_CLIENT_SECRET", "");
  vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "legacy-fixture");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { shopifyAdminToken, shopifyServerConfigured } =
    await import("@/services/shopify/admin-auth");
  expect(shopifyServerConfigured()).toBe(true);
  expect(await shopifyAdminToken()).toBe("legacy-fixture");
  expect(fetch).not.toHaveBeenCalled();
});
it("uses the complete client pair in preference to a leftover legacy token", async () => {
  vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "legacy-fixture");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(issued()));
  const { shopifyAdminToken } = await import("@/services/shopify/admin-auth");
  expect(await shopifyAdminToken()).toBe("fixture-issued-token");
});
it("rejects an incomplete pair rather than hiding it behind a legacy token", async () => {
  vi.stubEnv("SHOPIFY_CLIENT_SECRET", "");
  vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "legacy-fixture");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { shopifyAdminToken, shopifyServerConfigured } =
    await import("@/services/shopify/admin-auth");
  expect(shopifyServerConfigured()).toBe(false);
  await expect(shopifyAdminToken()).rejects.toThrow("Set both");
  expect(fetch).not.toHaveBeenCalled();
});
it.each([
  "aarla-merch",
  "aarla.in",
  "https://aarla.in",
  "bad.example",
  "aarla.myshopify.com@evil.test",
  "aarla.myshopify.com/other",
  "another-fixture.myshopify.com",
])(
  "keeps credentials pinned to Aarla despite a stale domain override: %s",
  async (bad) => {
    vi.stubEnv("SHOPIFY_SHOP_DOMAIN", bad);
    const fetch = vi.fn().mockResolvedValueOnce(issued());
    vi.stubGlobal("fetch", fetch);
    const { shopifyAdminToken } = await import("@/services/shopify/admin-auth");
    expect(await shopifyAdminToken()).toBe("fixture-issued-token");
    expect(fetch.mock.calls[0][0]).toBe(
      `https://${domain}/admin/oauth/access_token`,
    );
  },
);
it("does not retain failed exchanges or expose provider bodies/secrets", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        {
          error: "invalid_client",
          error_description: "fixture-secret raw-provider-body",
        },
        { status: 401 },
      ),
    )
    .mockResolvedValueOnce(issued());
  vi.stubGlobal("fetch", fetch);
  const { shopifyAdminToken } = await import("@/services/shopify/admin-auth");
  await expect(shopifyAdminToken()).rejects.toThrow("Check the client ID");
  expect(await shopifyAdminToken()).toBe("fixture-issued-token");
});
it("explains same-organization restrictions safely", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "shop_not_permitted" }, { status: 403 }),
      ),
  );
  const { shopifyAdminToken } = await import("@/services/shopify/admin-auth");
  await expect(shopifyAdminToken()).rejects.toThrow(
    "same Shopify organization",
  );
});
it.each([
  { access_token: "", expires_in: 86399 },
  { access_token: "fixture", expires_in: 0 },
  { access_token: "fixture", expires_in: "86399" },
])("rejects malformed token lifetimes/responses", async (body) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(body)));
  const { shopifyAdminToken } = await import("@/services/shopify/admin-auth");
  await expect(shopifyAdminToken()).rejects.toThrow(
    "invalid authentication response",
  );
});
it("invalidates a rejected cached token without replaying a mutation, then authenticates the next explicit attempt", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(issued("first"))
    .mockResolvedValueOnce(Response.json({}, { status: 401 }))
    .mockResolvedValueOnce(issued("second"))
    .mockResolvedValueOnce(Response.json({ data: { confirmed: true } }));
  vi.stubGlobal("fetch", fetch);
  const { shopifyRequest } = await import("@/lib/customer/shopify");
  await expect(shopifyRequest("mutation { fixture }", {})).rejects.toThrow(
    "Shopify did not confirm",
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(await shopifyRequest("query { fixture }", {})).toEqual({
    confirmed: true,
  });
  expect(fetch.mock.calls[1][1].headers["X-Shopify-Access-Token"]).toBe(
    "first",
  );
  expect(fetch.mock.calls[3][1].headers["X-Shopify-Access-Token"]).toBe(
    "second",
  );
});
