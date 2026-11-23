import { expect, test } from "@playwright/test";

test.skip(
  process.env.PLAYWRIGHT_RUN_E2E !== "1",
  "Set PLAYWRIGHT_RUN_E2E=1 with a running app to execute browser e2e tests.",
);

test("homepage loads with GYVFT brand and CTAs", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "GYVFT home", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /You know them.*Give something that feels like them/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create my GYVFT", exact: true }).first(),
  ).toHaveAttribute("href", "/account/login?mode=signup");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }).first(),
  ).toBeVisible();
});

test("homepage opens registration directly without an existing enquiry", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Create my GYVFT", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/account\/login\?mode=signup$/);
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create your account", exact: true }),
  ).toBeVisible();
});

test("homepage product preview, named films and mobile navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByRole("tab", { name: "Occasions", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "A few things to look forward to.",
  );
  await page.getByRole("tab", { name: "Circles", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Our family");
  await page.getByRole("tab", { name: "Your gifts", exact: true }).click();
  await page.getByLabel(/A little keepsake/).check();
  await expect(
    page.getByText(/A little keepsake selected in this example/),
  ).toBeVisible();
  const film = page.getByRole("button", { name: /Why GYVFT/ });
  await film.click();
  await expect(
    page.getByRole("dialog", {
      name: "You know the person. Why is finding their gift so hard?",
    }),
  ).toBeVisible();
  await expect(page.locator("video source")).toHaveAttribute(
    "src",
    "/website-review/gyvft-your-story.mp4",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(film).toBeFocused();
  await page
    .getByRole("button", { name: "See how GYVFT helps", exact: true })
    .click();
  await expect(page.locator("video source")).toHaveAttribute(
    "src",
    "/website-review/gyvft-how-it-works.mp4",
  );
  await page.getByRole("button", { name: "Close film", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.locator("#public-mobile-menu")).toBeVisible();
  await page
    .locator("#public-mobile-menu")
    .getByRole("link", { name: "How it works", exact: true })
    .click();
  await expect(page.locator("#public-mobile-menu")).toBeHidden();
});

test("unauthenticated Studio redirects to login", async ({ page }) => {
  await page.goto("/studio");

  await expect(page).toHaveURL(/\/studio\/login\?next=%2Fstudio/);
});

test("story form multi-step UI renders", async ({ page }) => {
  await page.goto("/tell-your-story");

  await expect(page.getByText("Step 1 of 7")).toBeVisible();
  await expect(page.getByText("What story should we help tell?")).toBeVisible();
  await expect(
    page.getByRole("textbox", {
      name: /Share the people, place, milestone, or memory/i,
    }),
  ).toBeVisible();
});

test("rejecting consent prevents Meta and Clarity script injection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Reject optional/i }).click();

  await expect(page.locator("#gyvft-meta-pixel")).toHaveCount(0);
  await expect(page.locator("#gyvft-clarity")).toHaveCount(0);
});

test("consent banner dismisses and stays dismissed after reload", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("Privacy choices")).toBeVisible();
  await page.getByRole("button", { name: /Accept all/i }).click();
  await expect(page.getByText("Privacy choices")).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Privacy choices")).toHaveCount(0);
});

test.skip("logout flow with mocked authenticated Studio session", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: /Log out/i }).click();
  await expect(page).toHaveURL(/\/studio\/login/);
});
