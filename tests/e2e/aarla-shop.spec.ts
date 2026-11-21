import { test, expect } from "@playwright/test";
import postgres, { type Sql } from "postgres";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runPendingMigrations } from "../../src/lib/database/migrations";
const url = process.env.AARLA_COUPON_BROWSER_DATABASE_URL,
  secret = process.env.PLAYWRIGHT_OPERATOR_SECRET;
test.skip(!url || !secret, "Dedicated local simulated-Shopify fixture only");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
let sql: Sql, owner: string, other: string;
const customerId = "gid://shopify/Customer/123";
const calls = () => {
  try {
    return readFileSync("work/aarla-coupon-calls.jsonl", "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((s) => JSON.parse(s));
  } catch {
    return [];
  }
};
test.beforeAll(async () => {
  const u = new URL(url!);
  if (
    u.hostname !== "127.0.0.1" ||
    !u.pathname.startsWith("/gyvft_aarla_coupon_")
  )
    throw Error("Local fixture only");
  sql = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
  await runPendingMigrations(sql, undefined, "customer");
  owner = randomUUID();
  other = randomUUID();
  for (const [id, shopify] of [
    [owner, customerId],
    [other, "gid://shopify/Customer/456"],
  ]) {
    const [existing] =
      await sql`SELECT id FROM gyvft_customer_accounts WHERE shopify_customer_id=${shopify}`;
    if (existing) {
      if (shopify === customerId) owner = existing.id;
      else other = existing.id;
    } else
      await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash,shopify_customer_id,shopify_sync_state) VALUES(${id},${id + "@example.test"},'local-only',${shopify},'synced')`;
  }
});
test.afterAll(async () => {
  if (sql) await sql.end();
});
async function signIn(
  context: import("@playwright/test").BrowserContext,
  id: string,
  baseURL: string,
) {
  const token = randomBytes(32).toString("base64url");
  await sql`INSERT INTO gyvft_customer_sessions(token_hash,account_id,expires_at) VALUES(${createHash("sha256").update(token).digest("hex")},${id},now()+interval '1 hour')`;
  await context.addCookies([
    {
      name: "gyvft_customer_session",
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
test("Shop at Aarla reuses a customer-only 24-hour code and redirects to the selected product", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90000);
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  await signIn(context, owner, baseURL!);
  await context.route("https://aarla.in/discount/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<h1>Aarla checkout handoff received</h1>",
    }),
  );
  await page.goto("/account");
  const shop = page
    .getByRole("link", { name: /Shop at Aarla · 5% for you/ })
    .first();
  await expect(shop).toBeVisible();
  expect(await shop.getAttribute("href")).toMatch(/^\/account\/shop\?to=/);
  const popupEvent = context.waitForEvent("page");
  await shop.click();
  const popup = await popupEvent;
  await expect(
    popup.getByText("Getting your 5% saving ready…", { exact: true }),
  ).toBeVisible();
  await expect(popup).toHaveURL(/^https:\/\/aarla.in\/discount\/GYVFT5-/);
  const first = new URL(popup.url()),
    code = first.pathname.split("/").at(-1);
  expect(
    new URL(first.searchParams.get("redirect")!, "https://aarla.in").pathname,
  ).toBe("/products/fixture-gift");
  const created = calls().filter((c) => c.operation === "created");
  expect(created).toHaveLength(1);
  expect(created[0].customerId).toBe(customerId);
  expect(Date.parse(created[0].endsAt) - Date.parse(created[0].startsAt)).toBe(
    86400000,
  );
  await popup.close();
  const nextEvent = context.waitForEvent("page");
  await shop.click();
  const next = await nextEvent;
  await expect(next).toHaveURL(/^https:\/\/aarla.in\/discount\/GYVFT5-/);
  expect(new URL(next.url()).pathname.split("/").at(-1)).toBe(code);
  expect(calls().filter((c) => c.operation === "created")).toHaveLength(1);
  await next.close();
  const second = await context.browser()!.newContext();
  await signIn(second, other, baseURL!);
  const response = await second.request.post(
    baseURL + "/api/customer/aarla-shop",
    {
      headers: { Origin: baseURL! },
      data: { destination: "/products/fixture-gift" },
    },
  );
  expect(response.ok()).toBe(true);
  expect(new URL((await response.json()).redirectUrl).pathname).not.toBe(
    first.pathname,
  );
  expect(calls().filter((c) => c.operation === "created")).toHaveLength(2);
  await second.close();
});
test("unauthenticated visits do not create coupons and errors keep the user in GYVFT", async ({
  page,
  context,
  baseURL,
}) => {
  const before = calls().filter((c) => c.operation === "created").length;
  await page.goto("/account/shop?to=%2F");
  await expect(page).toHaveURL(/\/account\/login\?next=/);
  expect(calls().filter((c) => c.operation === "created")).toHaveLength(before);
  await signIn(context, owner, baseURL!);
  await page.route("**/api/customer/aarla-shop", (r) =>
    r.fulfill({
      status: 503,
      json: {
        ok: false,
        error: {
          message: "We couldn’t confirm your 5% saving. Please try again.",
        },
      },
    }),
  );
  await page.goto("/account/shop?to=%2Fproducts%2Ffixture-gift");
  await expect(
    page.getByText("We couldn’t confirm your 5% saving. Please try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  expect(["127.0.0.1", "localhost"]).toContain(new URL(page.url()).hostname);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(
    (await page
      .getByRole("button", { name: "Try again", exact: true })
      .boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: "work/aarla-coupon-error-mobile.png",
    fullPage: true,
  });
});
test("Operations checks the deployed credential’s discount scope without issuing a code", async ({
  page,
}) => {
  const before = calls().filter((c) => c.operation === "created").length;
  await page.goto("/operations");
  await page.getByLabel("Operator secret", { exact: true }).fill(secret!);
  await page
    .getByRole("button", { name: "Open customer desk", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Settings & connections", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Check Aarla savings connection",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Connected to Aarla. Discount creation is permitted. This check created no coupon.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls().filter((c) => c.operation === "created")).toHaveLength(before);
});
