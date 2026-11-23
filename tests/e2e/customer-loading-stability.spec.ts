import { test, expect, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import postgres from "postgres";
const db = process.env.PLAYWRIGHT_WORKFLOW_DB;
test.skip(!db, "Dedicated existing local fixtures required.");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
const rect = async (l: Locator) => {
  const b = await l.boundingBox();
  expect(b).not.toBeNull();
  return b!;
};
function same(
  a: Awaited<ReturnType<typeof rect>>,
  b: Awaited<ReturnType<typeof rect>>,
) {
  for (const k of ["x", "y", "width", "height"] as const)
    expect(Math.abs(a[k] - b[k])).toBeLessThanOrEqual(1);
}
test("delayed customer navigation, menu transitions, form actions and carousels keep controls stable", async ({
  page,
  baseURL,
  context,
}) => {
  test.setTimeout(120000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  expect(new URL(db!).port).toBe("55434");
  const sql = postgres(db!, { max: 1 }),
    account = "d4e00000-0000-4000-8000-000000000002";
  await context.setExtraHTTPHeaders({ "x-forwarded-for": "127.3.45.67" });
  await page.setViewportSize({ width: 1366, height: 900 });
  try {
    await page.goto(baseURL + "/account/login");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("aarla+demo-business@aarla.in");
    await page
      .getByLabel("Password", { exact: true })
      .fill(readFileSync("work/customer-demo-test-password.txt", "utf8"));
    await page
      .getByRole("button", { name: "Sign in to My GYVFT", exact: true })
      .click();
    await expect(page).toHaveURL(baseURL + "/account");
    await expect(page.getByText(/Demo workspace · People/)).toHaveCount(0);
    const header = page.locator("header").first(),
      before = await rect(header);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/account/profile**", async (r) => {
      if (r.request().headers().rsc === "1") {
        await gate;
      }
      await r.continue();
    });
    await page.locator('summary[aria-label="Your account"]').click();
    await page.getByRole("link", { name: "About me", exact: true }).click();
    await expect(
      page.locator('body > .navigation-feedback[data-pending="true"]'),
    ).toBeVisible();
    await expect(page.locator("details[open]")).toHaveCount(0);
    same(before, await rect(header));
    release();
    await expect(
      page.getByRole("heading", { name: "A little about you", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('.navigation-feedback[data-pending="true"]'),
    ).toHaveCount(0);
    same(before, await rect(header));
    await page.unroute("**/account/profile**");
    const network = await context.newCDPSession(page);
    await network.send("Network.enable");
    await network.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 1200,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    const save = page
        .locator("form")
        .filter({ has: page.getByLabel("Your name", { exact: true }) })
        .locator("button")
        .first(),
      buttonBefore = await rect(save);
    await save.click();
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute("aria-busy", "true");
    same(buttonBefore, await rect(save));
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    same(buttonBefore, await rect(save));
    await network.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await network.detach();
    // Add retained local-only samples so the carousel has an uncached page.
    for (let i = 0; i < 7; i++)
      await sql`INSERT INTO customer_projects(id,submission_key,customer_account_id,customer_email,title,brief,created_at) VALUES(${"f5e00000-0000-4000-8000-" + String(i + 1).padStart(12, "0")},${"gyvft-demo-loading-test-" + i},${account},'aarla+demo-business@aarla.in',${"Loading test gift " + (i + 1)},'Retained fictional local sample for delayed carousel checks.',now()-interval '200 days') ON CONFLICT DO NOTHING`;
    await page.goto(baseURL + "/account");
    for (let i = 0; i < 5; i++)
      await page
        .getByRole("button", { name: "Next gift", exact: true })
        .click();
    let nextCard!: () => void;
    const cardGate = new Promise<void>((r) => (nextCard = r));
    await page.route("**/api/customer/home?section=gifts**", async (r) => {
      await cardGate;
      await r.continue();
    });
    const next = page.getByRole("button", { name: "Next gift", exact: true }),
      previous = page.getByRole("button", {
        name: "Previous gift",
        exact: true,
      }),
      n = await rect(next),
      p = await rect(previous);
    await next.click();
    await expect(next).toBeDisabled();
    same(n, await rect(next));
    same(p, await rect(previous));
    nextCard();
    await expect(next).toBeEnabled();
    same(n, await rect(next));
    same(p, await rect(previous));
    await page.unroute("**/api/customer/home?section=gifts**");
    const [gift] =
      await sql`SELECT id FROM customer_projects WHERE customer_account_id=${account} ORDER BY stage,id LIMIT 1`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseURL + `/account/projects/${gift.id}`);
    await expect(page.getByText(/Demo workspace · People/)).toHaveCount(0);
    let nextSection!: () => void;
    const sectionGate = new Promise<void>((r) => (nextSection = r));
    await page.route("**/account/projects/**", async (r) => {
      if (
        r.request().headers().rsc === "1" &&
        new URL(r.request().url()).searchParams.get("view") === "activity"
      )
        await sectionGate;
      await r.continue();
    });
    const select = page.getByRole("combobox", {
        name: "Gift section",
        exact: true,
      }),
      selectBefore = await rect(select);
    await select.selectOption("activity");
    await expect(select).toBeDisabled();
    await expect(
      page.getByRole("status", { name: "Opening gift section", exact: true }),
    ).toBeVisible();
    same(selectBefore, await rect(select));
    nextSection();
    await expect(select).toBeEnabled();
    await expect(select).toHaveValue("activity");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  } finally {
    await sql.end();
  }
});
