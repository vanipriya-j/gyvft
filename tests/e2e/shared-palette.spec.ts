import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { createHash, randomBytes, randomUUID } from "node:crypto";
const db = process.env.PLAYWRIGHT_WORKFLOW_DB;
test.skip(!db, "Dedicated local database required.");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("shared approved palette and immediate navigation feedback", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120000);
  expect(new URL(db!).hostname).toBe("127.0.0.1");
  expect(new URL(db!).port).toBe("55434");
  const sql = postgres(db!, { max: 2 }),
    account = randomUUID(),
    token = randomBytes(32).toString("base64url");
  let releaseNavigation = () => {},
    releaseCatalogue = () => {};
  const navigationGate = new Promise<void>((r) => {
      releaseNavigation = r;
    }),
    catalogueGate = new Promise<void>((r) => {
      releaseCatalogue = r;
    });
  try {
    await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${account},${account + "@example.test"},'LOCAL_TEST')`;
    await sql`INSERT INTO gyvft_customer_sessions(token_hash,account_id,expires_at) VALUES(${createHash("sha256").update(token).digest("hex")},${account},now()+interval '1 day')`;
    await context.addCookies([
      {
        name: "gyvft_customer_session",
        value: token,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await page.goto(baseURL + "/");
    await expect(
      page
        .getByRole("link", { name: "Tell us your story", exact: true })
        .first(),
    ).toHaveCSS("background-color", "rgb(184, 35, 43)");
    await expect(page.locator("body")).toHaveCSS("color", "rgb(25, 27, 23)");
    await page.route("**/api/customer/home?section=aarla**", async (route) => {
      await catalogueGate;
      await route.continue();
    });
    await page.goto(baseURL + "/account");
    await expect(
      page.getByRole("heading", { name: /Gifts taking shape/ }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: /Start a new gift/, exact: false })
        .first(),
    ).toHaveCSS("background-color", "rgb(184, 35, 43)");
    await expect(
      page.getByText("Finding a little inspiration at Aarla…", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".gyvft-app")).toHaveCSS(
      "color",
      "rgb(25, 27, 23)",
    );
    releaseCatalogue();
    await page.goto(baseURL + "/account/profile");
    await page.route("**/account/gifts**", async (route) => {
      if (route.request().headers().rsc === "1") await navigationGate;
      await route.continue();
    });
    await page.waitForTimeout(250);
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "My gifts", exact: true })
      .click();
    await expect(
      page.getByRole("status", { name: "Opening page", exact: true }),
    ).toBeVisible({ timeout: 600 });
    releaseNavigation();
    await expect(
      page.getByRole("heading", { name: "My gifts", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('.navigation-feedback[data-pending="true"]'),
    ).toHaveCount(0);
    await page.goto(baseURL + "/operations");
    await expect(
      page.getByRole("button", { name: "Open customer desk", exact: true }),
    ).toHaveCSS("background-color", "rgb(184, 35, 43)");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseURL + "/account");
    await expect(
      page.getByRole("link", { name: "New gift", exact: false }).first(),
    ).toHaveCSS("background-color", "rgb(184, 35, 43)");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  } finally {
    releaseNavigation();
    releaseCatalogue();
    await sql`DELETE FROM gyvft_customer_accounts WHERE id=${account}`;
    await sql.end();
  }
});
