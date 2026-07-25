import { expect, test } from "@playwright/test";

test.skip(
  process.env.PLAYWRIGHT_RUN_E2E !== "1",
  "Set PLAYWRIGHT_RUN_E2E=1 with a running app to execute browser e2e tests.",
);

test("homepage loads with GYVFT brand and CTAs", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("GYVFT").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Your story\. Our telling\./i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tell us your story/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Make us your merch partner/i })).toBeVisible();
});

test("unauthenticated Studio redirects to login", async ({ page }) => {
  await page.goto("/studio");

  await expect(page).toHaveURL(/\/studio\/login\?next=%2Fstudio/);
});

test("story form multi-step UI renders", async ({ page }) => {
  await page.goto("/tell-your-story");

  await expect(page.getByText("Step 1 of 7")).toBeVisible();
  await expect(page.getByLabel("What story should we help tell?")).toBeVisible();
});

test("rejecting consent prevents Meta and Clarity script injection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Reject optional/i }).click();

  await expect(page.locator("#gyvft-meta-pixel")).toHaveCount(0);
  await expect(page.locator("#gyvft-clarity")).toHaveCount(0);
});

test.skip("logout flow with mocked authenticated Studio session", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: /Log out/i }).click();
  await expect(page).toHaveURL(/\/studio\/login/);
});
