// Explicit local integration fixture. No live merchant writes or external network.
import postgres from "postgres";
import { appendFileSync, mkdirSync } from "node:fs";
const database = new URL(process.env.DATABASE_URL || "");
if (
  database.hostname !== "127.0.0.1" ||
  !database.pathname.startsWith("/gyvft_aarla_coupon_")
)
  throw Error("Dedicated local coupon fixture required");
process.env.SHOPIFY_SHOP_DOMAIN = "aarla-coupon-fixture.myshopify.com";
process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = "";
process.env.SHOPIFY_CLIENT_ID = "local-coupon-client";
process.env.SHOPIFY_CLIENT_SECRET = "local-coupon-secret";
process.env.RESEND_API_KEY = "";
globalThis.__gyvftSql = postgres(process.env.DATABASE_URL, {
  max: 5,
  prepare: false,
});
const original = globalThis.fetch,
  coupons = new Map();
mkdirSync("work", { recursive: true });
function record(operation, data = {}) {
  appendFileSync(
    process.env.AARLA_COUPON_FIXTURE_LOG || "work/aarla-coupon-calls.jsonl",
    JSON.stringify({ operation, ...data }) + "\n",
  );
}
const connection = {
  shop: { primaryDomain: { host: "aarla.in" } },
  currentAppInstallation: { accessScopes: [{ handle: "write_discounts" }] },
};
globalThis.fetch = async (input, init) => {
  const u = new URL(
    typeof input === "string" ? input : input.url || String(input),
  );
  if (u.hostname === "aarla-coupon-fixture.myshopify.com") {
    if (u.pathname === "/admin/oauth/access_token") {
      const form = new URLSearchParams(init.body);
      if (
        form.get("grant_type") !== "client_credentials" ||
        form.get("client_id") !== "local-coupon-client" ||
        form.get("client_secret") !== "local-coupon-secret"
      )
        throw Error("Wrong fixture client credentials");
      record("authenticate");
      return Response.json({
        access_token: "local-coupon-fixture-token",
        expires_in: 86399,
        scope: "write_discounts",
      });
    }
    if (init.headers["X-Shopify-Access-Token"] !== "local-coupon-fixture-token")
      throw Error("Admin call must use the exchanged token");
    const { query, variables: v } = JSON.parse(init.body);
    let data;
    if (query.includes("GYVFTCouponConnection")) {
      record("connection");
      data = connection;
    } else if (query.includes("GYVFTLatestCoupon")) {
      record("latest");
      const tag = JSON.parse(v.query.match(/tag:("[^"]+")/)[1]);
      const nodes = [...coupons.values()]
        .filter((n) => n.codeDiscount.tags.includes(tag))
        .slice(-1)
        .map((n) => ({ id: n.id, discount: n.codeDiscount }));
      data = { ...connection, discountNodes: { nodes } };
    } else if (query.includes("GYVFTCouponByCode")) {
      record("lookup");
      data = { codeDiscountNodeByCode: coupons.get(v.code) || null };
    } else if (query.includes("GYVFTCreateCoupon")) {
      const p = v.input;
      if (coupons.has(p.code))
        data = {
          discountCodeBasicCreate: {
            codeDiscountNode: null,
            userErrors: [{ code: "TAKEN" }],
          },
        };
      else {
        if (
          p.usageLimit !== 1 ||
          p.context.customers.add.length !== 1 ||
          p.customerGets.value.percentage !== 0.05 ||
          Date.parse(p.endsAt) - Date.parse(p.startsAt) !== 86400000
        )
          throw Error("Wrong coupon policy");
        const node = {
          id: "gid://shopify/DiscountCodeNode/" + (coupons.size + 1),
          codeDiscount: {
            __typename: "DiscountCodeBasic",
            title: p.title,
            tags: p.tags,
            startsAt: p.startsAt,
            endsAt: p.endsAt,
            status: "ACTIVE",
            asyncUsageCount: 0,
            usageLimit: 1,
            appliesOncePerCustomer: true,
            minimumRequirement: null,
            codes: { nodes: [{ code: p.code }] },
            context: {
              __typename: "DiscountCustomers",
              customers: p.context.customers.add.map((id) => ({ id })),
            },
            customerGets: {
              appliesOnOneTimePurchase: true,
              appliesOnSubscription: false,
              value: { __typename: "DiscountPercentage", percentage: 0.05 },
              items: { __typename: "AllDiscountItems", allItems: true },
            },
          },
        };
        coupons.set(p.code, node);
        record("created", {
          code: p.code,
          customerId: p.context.customers.add[0],
          startsAt: p.startsAt,
          endsAt: p.endsAt,
        });
        await new Promise((r) => setTimeout(r, 500));
        data = {
          discountCodeBasicCreate: { codeDiscountNode: node, userErrors: [] },
        };
      }
    } else throw Error("Unexpected fixture operation");
    return Response.json({ data });
  }
  if (u.hostname === "aarla.in" && u.pathname === "/products.json")
    return Response.json({
      products: [
        {
          id: 123,
          title: "Fixture Aarla gift",
          handle: "fixture-gift",
          created_at: "2026-11-21T00:00:00Z",
          images: [
            { src: "https://cdn.shopify.com/s/files/1/coupon-fixture.png" },
          ],
          variants: [{ price: "500.00", available: true }],
        },
      ],
    });
  if (u.hostname === "cdn.shopify.com")
    return new Response(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
      { headers: { "content-type": "image/png" } },
    );
  if (!["localhost", "127.0.0.1"].includes(u.hostname))
    throw Error("External network blocked by coupon fixture");
  return original(input, init);
};
