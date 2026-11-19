// Disposable local integration fixture. Never preload this into a deployed app.
import postgres from "postgres";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
const database = new URL(process.env.DATABASE_URL || "");
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1"].includes(database.hostname)
)
  throw Error("Local test database required");
process.env.SHOPIFY_SHOP_DOMAIN = "gyvft-fixture.myshopify.com";
process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = "local-fixture-token";
const captureAuthMail = process.env.GYVFT_AUTH_MAIL_FIXTURE === "1";
process.env.RESEND_API_KEY = captureAuthMail ? "re_local_auth_fixture" : "";
mkdirSync("work", { recursive: true });
if (process.argv.some((arg) => /next[\\/]dist[\\/]bin[\\/]next$/.test(arg)))
  writeFileSync(
    "work/gift-flow-fixture.json",
    JSON.stringify({
      pid: process.pid,
      origin: new URL(process.env.NEXT_PUBLIC_APP_URL).origin,
      database: `${database.host}${database.pathname}`,
    }),
  );
globalThis.__gyvftSql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
});
const original = globalThis.fetch;
const orders = new Map(),
  customers = new Map();
let created = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith("https://api.resend.com/")) {
    if (!captureAuthMail)
      throw Error("Live mail access blocked in local fixture");
    const message = JSON.parse(init.body);
    if (message.subject === "Reset your GYVFT password") {
      const to = Array.isArray(message.to) ? message.to[0] : message.to;
      if (!to.endsWith("@example.test"))
        throw Error("Local auth mail must use an example.test address");
      mkdirSync("work/auth-mail-fixture", { recursive: true });
      writeFileSync(
        `work/auth-mail-fixture/${createHash("sha256").update(to).digest("hex")}.json`,
        JSON.stringify(message),
        { mode: 0o600 },
      );
    }
    return Response.json({ id: "local-mail-accepted" });
  }
  if (url.startsWith("https://gyvft-fixture.myshopify.com/admin/api/")) {
    const { query, variables: v } = JSON.parse(init.body);
    let data;
    if (query.includes("GYVFTCustomerCreate")) {
      const c = {
        id: `gid://shopify/Customer/${customers.size + 1}`,
        email: v.input.email,
      };
      customers.set(c.email, c);
      data = { customerCreate: { customer: c, userErrors: [] } };
    } else if (query.includes("GYVFTCustomer(")) {
      const email = JSON.parse(v.query.slice(6));
      data = {
        customers: {
          nodes: customers.has(email) ? [customers.get(email)] : [],
        },
      };
    } else if (query.includes("GYVFTOrderCreate")) {
      const o = v.order;
      const total = o.lineItems.reduce(
        (s, i) =>
          s +
          Math.round(Number(i.priceSet.shopMoney.amount) * 100) * i.quantity,
        0,
      );
      if (
        !o.customer.toAssociate.id ||
        !o.shippingAddress.zip ||
        !o.shippingAddress.provinceCode ||
        o.lineItems.length !== 1 ||
        o.lineItems[0].quantity !== 1 ||
        !o.note.includes("Single custom batch")
      )
        throw Error("Incomplete Shopify payload");
      const order = {
        id: `gid://shopify/Order/${++created}`,
        name: `#LOCAL-${created}`,
        customer: { id: o.customer.toAssociate.id },
        totalPriceSet: {
          shopMoney: { amount: (total / 100).toFixed(2), currencyCode: "INR" },
        },
        totalReceivedSet: {
          shopMoney: {
            amount: o.transactions[0].amountSet.shopMoney.amount,
            currencyCode: "INR",
          },
        },
        tag: o.tags.find((x) => x.startsWith("gyvft_")),
      };
      orders.set(order.id, order);
      data = { orderCreate: { order, userErrors: [] } };
    } else if (query.includes("GYVFTRecordPayment")) {
      const order = orders.get(v.id);
      order.totalReceivedSet.shopMoney.amount =
        order.totalPriceSet.shopMoney.amount;
      data = { orderCreateManualPayment: { order, userErrors: [] } };
    } else if (query.includes("GYVFTOrder("))
      data = {
        orders: {
          nodes: [...orders.values()].filter(
            (o) =>
              v.query === `tag:${o.tag}` ||
              v.query === `id:${o.id.split("/").at(-1)}`,
          ),
        },
      };
    else throw Error("Unexpected Shopify operation");
    return Response.json({ data });
  }
  if (url.startsWith("https://aarla.in/products.json?"))
    return Response.json({ products: [] });
  if (url.includes(".myshopify.com/admin/"))
    throw Error("Live Shopify access blocked in this local fixture");
  return original(input, init);
};
