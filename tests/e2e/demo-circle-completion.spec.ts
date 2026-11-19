import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const db = process.env.GYVFT_DEMO_CIRCLES_TEST_DB;
test.skip(!db, "Isolated repair fixture required.");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  trace: "off",
});
test("an operator completes existing demo circles without customer passwords and sees consistent occasions", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(60000);
  expect(new URL(db!).hostname).toBe("127.0.0.1");
  expect(new URL(db!).pathname).toBe("/gyvft_demo_circles_repair");
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `127.8.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`,
  });
  await page.goto(baseURL + "/operations/demo-data/circles");
  await expect(
    page.getByRole("heading", {
      name: "Complete the demo circles",
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.locator("input[type=password]").count()).toBe(1);
  await page
    .getByLabel("Operator secret", { exact: true })
    .fill("local-demo-circles-operator");
  await page.getByRole("checkbox").check();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/operations/demo-circles", async (route) => {
    await held;
    await route.continue();
  });
  const button = page.getByRole("button", {
      name: "Complete demo circles",
      exact: true,
    }),
    before = await button.boundingBox();
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-busy", "true");
  expect((await button.boundingBox())!.width).toBeCloseTo(before!.width, 0);
  release();
  await expect(page.getByRole("status")).toContainText(
    "aarla+demo-communities@aarla.in · 5 active circles",
  );
  await page.unroute("**/api/operations/demo-circles");
  await page.goto(baseURL + "/account/login");
  await page
    .getByLabel("Email used for your enquiry")
    .fill("aarla+demo-communities@aarla.in");
  await page
    .getByLabel("Password", { exact: true })
    .fill(readFileSync("work/customer-demo-test-password.txt", "utf8"));
  await page.getByRole("button", { name: "Sign in to My GYVFT" }).click();
  await page.waitForURL((url) => url.pathname === "/account");
  await page.goto(baseURL + "/account/circles");
  for (const name of [
    "Class of 2001",
    "The Sunday Book Club",
    "Our neighbourhood",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await page.goto(baseURL + "/account/occasions");
  const book = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Book club anniversary",
        exact: true,
      }),
    });
  await expect(book).toContainText("Book club");
  await expect(book).not.toContainText("Alumni network");
  const neighbours = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Neighbourhood gathering",
        exact: true,
      }),
    });
  await expect(neighbours).toContainText("Neighbourhood");
  await expect(neighbours).not.toContainText("Book club");
});
