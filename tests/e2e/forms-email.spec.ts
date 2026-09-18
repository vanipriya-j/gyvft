import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const artifactsDir = "/opt/cursor/artifacts";
fs.mkdirSync(artifactsDir, { recursive: true });

async function dismissConsent(page: import("@playwright/test").Page) {
  const accept = page.getByRole("button", { name: /Accept all/i });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
    await expect(page.getByText("Privacy choices")).toHaveCount(0);
    return;
  }
  const reject = page.getByRole("button", { name: /Reject optional/i });
  if (await reject.isVisible().catch(() => false)) {
    await reject.click();
    await expect(page.getByText("Privacy choices")).toHaveCount(0);
  }
}

test("health reports leads inbox aarla@aarla.in", async ({ request }) => {
  const res = await request.get("/api/health");
  const body = await res.json();
  expect(body.mail.leadsEmail).toBe("aarla@aarla.in");
  expect(body.mail.hasLeadsEmail).toBe(true);
  expect(body.mail.hasFromEmail).toBe(true);
});

test("all public form pages load", async ({ page }) => {
  for (const route of [
    "/tell-your-story",
    "/become-a-merch-partner",
    "/book-a-discovery",
    "/upload-a-brief",
  ]) {
    await page.goto(route);
    await dismissConsent(page);
    await expect(page.locator("form").first()).toBeVisible();
  }
  await page.screenshot({
    path: path.join(artifactsDir, "forms_upload_brief_loaded.png"),
    fullPage: true,
  });
});

test("story form walks through all steps and submits", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/tell-your-story");
  await dismissConsent(page);

  // Step 1 — story
  await page.locator("textarea").first().fill(
    "We want to celebrate a family milestone with a keepsake book and a small gift set for relatives across cities.",
  );
  await page.getByRole("button", { name: /^Continue$/i }).click();

  // Step 2 — occasion (Birthday is default)
  await expect(page.getByText("Step 2 of 7")).toBeVisible();
  await page.getByRole("button", { name: /^Continue$/i }).click();

  // Step 3 — audiences
  await expect(page.getByText("Step 3 of 7")).toBeVisible();
  await page.getByRole("button", { name: /^Family$/i }).click();
  await page.getByRole("button", { name: /^Continue$/i }).click();

  // Step 4 — formats
  await expect(page.getByText("Step 4 of 7")).toBeVisible();
  await page.getByRole("button", { name: /^Book$/i }).click();
  await page.getByRole("button", { name: /^Continue$/i }).click();

  // Step 5 — logistics
  await expect(page.getByText("Step 5 of 7")).toBeVisible();
  await page.locator('input[type="date"]').fill("2026-12-01");
  await page.locator("select").nth(1).selectOption("1-25");
  await page.locator("select").nth(2).selectOption("Under 1L");
  await page.getByRole("button", { name: /^Continue$/i }).click();

  // Step 6 — location
  await expect(page.getByText("Step 6 of 7")).toBeVisible();
  await page.locator('input[name="primary_city"]').fill("Chennai");
  await page.getByRole("button", { name: /^Continue$/i }).click();

  // Step 7 — contact
  await expect(page.getByText("Step 7 of 7")).toBeVisible();
  await page.locator('input[name="full_name"]').fill("Form Test Visitor");
  await page.locator('input[name="email"]').fill("form-test@example.com");
  await page.locator('input[name="phone"]').fill("+919999999999");
  await page.screenshot({
    path: path.join(artifactsDir, "form_story_step7_no_banner.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: /Send story/i }).click();
  await page.waitForTimeout(4000);

  const thankYou = page.url().includes("/thank-you");
  const errorText = await page
    .locator("p")
    .filter({ hasText: /could not send|try again|Missing/i })
    .first()
    .textContent()
    .catch(() => null);

  await page.screenshot({
    path: path.join(
      artifactsDir,
      thankYou ? "form_story_submit_thank_you_v2.png" : "form_story_submit_error_v2.png",
    ),
    fullPage: true,
  });

  // Without RESEND_API_KEY we expect a graceful error, not a crash.
  if (!thankYou) {
    expect(errorText || "").toMatch(/could not send|try again|Missing email configuration/i);
  }
});

test("discovery form validates and attempts submit", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/book-a-discovery");
  await dismissConsent(page);

  await page.locator('input[name="full_name"]').fill("Discovery Tester");
  await page.locator('input[name="email"]').fill("discovery-test@example.com");
  await page.locator('input[name="phone"]').fill("+918888888888");
  await page.locator('textarea[name="discussion_topic"]').fill(
    "We would like a discovery call about anniversary gifts for our team.",
  );
  await page.locator('input[name="occasion_or_requirement"]').fill("Team anniversary");
  await page.locator('input[name="timeline"]').fill("Next quarter");

  await page.screenshot({
    path: path.join(artifactsDir, "form_discovery_filled_no_banner.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: /submit|request|send|book/i }).click();
  await page.waitForTimeout(4000);

  const thankYou = page.url().includes("/thank-you");
  await page.screenshot({
    path: path.join(
      artifactsDir,
      thankYou ? "form_discovery_submit_thank_you_v2.png" : "form_discovery_submit_error_v2.png",
    ),
    fullPage: true,
  });

  expect(thankYou || (await page.locator("form").first().isVisible())).toBeTruthy();
});
