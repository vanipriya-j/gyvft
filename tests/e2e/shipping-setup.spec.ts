import { test, expect } from "@playwright/test";
import postgres, { type Sql } from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
const databaseURL = process.env.SHIPPING_SETUP_BROWSER_DATABASE_URL,
  secret = process.env.PLAYWRIGHT_OPERATOR_SECRET,
  filename = "20261120000001_shipping.sql";
test.skip(
  !databaseURL || !secret,
  "Dedicated local shipping setup fixture only",
);
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
let sql: Sql, before: string;
const fingerprint = async () =>
  JSON.stringify({
    accounts: await sql`SELECT * FROM gyvft_customer_accounts ORDER BY id`,
    projects: await sql`SELECT * FROM customer_projects ORDER BY id`,
    history:
      await sql`SELECT * FROM schema_migrations WHERE id<>${filename} ORDER BY id`,
  });
test.beforeAll(async () => {
  const u = new URL(databaseURL!);
  if (
    u.hostname !== "127.0.0.1" ||
    !u.pathname.startsWith("/gyvft_shipping_browser_setup_")
  )
    throw Error("Dedicated local database required");
  sql = postgres(databaseURL!, { max: 1, prepare: false, onnotice: () => {} });
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations(id text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())`;
  const applied = new Set(
    (await sql`SELECT id FROM schema_migrations`).map((r) => r.id),
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => /^202611/.test(f) && f < filename)
    .sort()) {
    if (applied.has(f)) continue;
    await sql.unsafe(readFileSync("supabase/migrations/" + f, "utf8"));
    await sql`INSERT INTO schema_migrations(id) VALUES(${f})`;
  }
  const id = randomUUID();
  await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${id},${id + "@example.test"},'preserve-this-test-hash')`;
  before = await fingerprint();
});
test.afterAll(async () => {
  if (sql) await sql.end();
});
test("owner checks status, applies only approved shipping SQL, and sees completion without changed customer data", async ({
  page,
  baseURL,
}) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  let writes = 0;
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/setup", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().action === "shipping-migrate"
    ) {
      writes++;
      await gate;
    }
    await route.continue();
  });
  await page.goto("/setup/shipping");
  const apply = page.getByRole("button", {
    name: "Apply approved shipping update",
    exact: true,
  });
  await expect(apply).toBeDisabled();
  expect(await fingerprint()).toBe(before);
  await page
    .getByLabel("Setup / Operations secret", { exact: true })
    .fill("wrong-secret-value");
  await page
    .getByRole("button", { name: "Check pending updates", exact: true })
    .click();
  await expect(
    page.getByText("Invalid setup secret.", { exact: true }),
  ).toBeVisible();
  await expect(apply).toBeDisabled();
  await page
    .getByLabel("Setup / Operations secret", { exact: true })
    .fill(secret!);
  await page
    .getByRole("button", { name: "Check pending updates", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Ready to apply shipping only",
      exact: true,
    }),
  ).toBeVisible();
  expect(await fingerprint()).toBe(before);
  await expect(apply).toBeEnabled();
  const box = await apply.boundingBox();
  await apply.click();
  await expect(apply).toBeDisabled();
  await expect(apply).toHaveAttribute("aria-busy", "true");
  const during = await apply.boundingBox();
  expect(during!.width).toBeCloseTo(box!.width, 0);
  expect(writes).toBe(1);
  release();
  await expect(
    page.getByRole("heading", { name: "Shipping is active", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Shipping update applied. Existing customer records were not changed.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(await fingerprint()).toBe(before);
  await expect(
    page.getByLabel("Setup / Operations secret", { exact: true }),
  ).toHaveValue("");
  await expect(apply).toBeDisabled();
  expect(
    await sql`SELECT id FROM schema_migrations WHERE id=${filename}`,
  ).toHaveLength(1);
  expect(
    await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gyvft_ship%'`,
  ).toHaveLength(4);
  await page.screenshot({
    path: "work/shipping-setup-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect((await apply.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: "work/shipping-setup-mobile.png",
    fullPage: true,
  });
});
test("missing earlier updates keep Apply disabled and name the required review", async ({
  page,
}) => {
  await page.route("**/api/setup", async (route) => {
    expect(route.request().postDataJSON().action).toBe("status");
    await route.fulfill({
      json: {
        ok: true,
        message: "Status loaded",
        migrations: [
          { id: "20261119000002_circles.sql", appliedAt: null },
          { id: filename, appliedAt: null },
        ],
      },
    });
  });
  await page.goto("/setup/shipping");
  await page
    .getByLabel("Setup / Operations secret", { exact: true })
    .fill(secret!);
  await page
    .getByRole("button", { name: "Check pending updates", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Earlier updates need review",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("20261119000002_circles.sql", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Apply approved shipping update",
      exact: true,
    }),
  ).toBeDisabled();
});
