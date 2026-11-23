import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import postgres from "postgres";
import { demoAccounts } from "../../src/lib/customer/demo-accounts";
const db = process.env.GYVFT_CIRCLES_TEST_DB;
const localHeaders = () => ({
  "x-forwarded-for": `127.9.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`,
});
test.skip(!db, "Dedicated local Circles fixture required.");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  trace: "off",
});
test("circle creation shows a stable disabled loader while the request is in flight", async ({
  playwright,
  baseURL,
}) => {
  test.setTimeout(60000);
  const isolated = await playwright.chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
  const context = await isolated.newContext({
      extraHTTPHeaders: localHeaders(),
    }),
    page = await context.newPage();
  try {
    expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
    await page.goto(baseURL + "/account/login");
    await page
      .getByLabel("Email address")
      .fill(demoAccounts[0].email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(readFileSync("work/customer-demo-test-password.txt", "utf8"));
    await page.getByRole("button", { name: "Sign in to My GYVFT" }).click();
    await page.waitForURL((url) => url.pathname === "/account");
    await page.goto(baseURL + "/account/circles/new");
    await page
      .getByLabel("Circle name", { exact: true })
      .fill("A circle in motion");
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 800,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    const button = page.getByRole("button", {
        name: "Create circle",
        exact: true,
      }),
      before = await button.boundingBox();
    await button.click();
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toBeDisabled();
    expect((await button.boundingBox())!.width).toBeCloseTo(before!.width, 0);
    await page.waitForURL(/\/account\/circles\/[0-9a-f-]+$/);
    await expect(
      page.getByRole("heading", { name: "A circle in motion", exact: true }),
    ).toBeVisible();
  } finally {
    await isolated.close();
  }
});
test("real circle creation, invitation, membership, recipients, shared occasions, private gift draft, mobile and operator review", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240000);
  const u = new URL(db!);
  expect(u.hostname).toBe("127.0.0.1");
  expect(["/gyvft_circles_test", "/gyvft_circles_release"]).toContain(
    u.pathname,
  );
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  const sql = postgres(db!, { max: 2, prepare: false });
  mkdirSync("work/circles-screens", { recursive: true });
  const password = readFileSync("work/customer-demo-test-password.txt", "utf8");
  const errors: string[] = [];
  const owner = await browser.newContext({ extraHTTPHeaders: localHeaders() }),
    peer = await browser.newContext({ extraHTTPHeaders: localHeaders() });
  const page = await owner.newPage(),
    other = await peer.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  other.on("pageerror", (e) => errors.push(e.message));
  async function login(p: typeof page, email: string) {
    await p.goto(baseURL + "/account/login");
    await p.getByLabel("Email address").fill(email);
    await p.getByLabel("Password", { exact: true }).fill(password);
    await p.getByRole("button", { name: "Sign in to My GYVFT" }).click();
    await p.waitForURL((url) => url.pathname === "/account");
  }
  try {
    // All four scenarios contain actual membership records and navigable circles.
    for (const [i, expected] of [2, 2, 5, 2].entries()) {
      const ctx = await browser.newContext({
          extraHTTPHeaders: localHeaders(),
        }),
        p = await ctx.newPage();
      await login(p, demoAccounts[i].email);
      await p
        .getByRole("navigation", { name: "Main navigation", exact: true })
        .getByRole("link", { name: "Circles", exact: true })
        .click();
      await expect(
        p.getByRole("heading", { name: "Your circles", exact: true }),
      ).toBeVisible();
      expect(await p.locator(".circle-card").count()).toBeGreaterThanOrEqual(
        expected,
      );
      if (i === 2) {
        await p.setViewportSize({ width: 1440, height: 1000 });
        await p.screenshot({
          path: "work/circles-screens/desktop-circles.png",
          fullPage: true,
        });
      }
      await ctx.close();
    }
    await login(page, demoAccounts[0].email);
    await page.goto(baseURL + "/account/circles/new");
    const title = "People we celebrate";
    await page.getByLabel("Circle name", { exact: true }).fill(title);
    await page
      .getByLabel("A little about this circle")
      .fill("Birthdays, little milestones and thoughtful thank-yous.");
    await page
      .getByRole("button", { name: "Create circle", exact: true })
      .click();
    await page.waitForURL(/\/account\/circles\/[0-9a-f-]+$/);
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: /People \(1\)/ }).click();
    await page.getByLabel("Their name", { exact: true }).fill("Arun");
    await page
      .getByLabel("Invitation email", { exact: true })
      .fill(demoAccounts[1].email);
    await page
      .getByRole("button", { name: "Create invitation", exact: true })
      .click();
    const link = page.getByLabel("Invitation link", { exact: true });
    await expect(link).toBeVisible();
    const invitation = await link.inputValue();
    await login(other, demoAccounts[1].email);
    await other.goto(invitation);
    await expect(
      other.getByRole("heading", { name: "You’re invited to " + title }),
    ).toBeVisible();
    await other
      .getByRole("button", { name: "Accept invitation", exact: true })
      .click();
    await other.waitForURL(baseURL + "/account/circles/" + id);
    await other.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(
      other.getByRole("heading", { name: "You in this circle", exact: true }),
    ).toBeVisible();
    await expect(
      other.getByRole("button", { name: "Archive circle", exact: true }),
    ).toHaveCount(0);
    await expect(
      other.getByRole("button", { name: "Transfer ownership", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await page
      .locator("summary")
      .filter({ hasText: "+ Add a recipient" })
      .click();
    const recipient = page.locator("details").filter({
      has: page.locator("summary").filter({ hasText: "+ Add a recipient" }),
    });
    await recipient.getByLabel("Name", { exact: true }).fill("Ananya");
    await recipient
      .getByLabel("About them", { exact: true })
      .fill("A fictional friend who enjoys quiet mornings.");
    await recipient.getByLabel("Likes & interests").fill("Books and coffee");
    const recipientStarted = Date.now();
    await recipient
      .getByRole("button", { name: "Add recipient", exact: true })
      .click();
    await expect(
      page.locator("summary").filter({ hasText: "Ananya" }),
    ).toBeVisible({ timeout: 30000 });
    console.log("Recipient save duration ms:", Date.now() - recipientStarted);
    const occasionTitle = "Ananya’s birthday";
    await page.getByRole("link", { name: /Occasions \(0\)/ }).click();
    await page.getByLabel("What are we celebrating?").fill(occasionTitle);
    await page.getByLabel("Occasion date", { exact: true }).fill("2026-12-20");
    await page
      .getByLabel("Show this occasion to accepted members of this circle.")
      .check();
    await page
      .getByRole("button", { name: "Share occasion", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: occasionTitle, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "work/circles-screens/desktop-occasions.png",
      fullPage: true,
    });
    await other.goto(baseURL + "/account/circles/" + id + "?tab=people");
    await expect(
      other.getByRole("heading", { name: "Recipients", exact: true }),
    ).toHaveCount(0);
    await expect(
      other.getByRole("button", { name: "Create invitation" }),
    ).toHaveCount(0);
    await other.goto(baseURL + "/account/occasions");
    await expect(
      other
        .locator("article")
        .filter({
          has: other.locator(`a[href="/account/circles/${id}?tab=occasions"]`),
        })
        .getByRole("heading", { name: occasionTitle, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Create a gift →", exact: true })
      .click();
    await expect(
      page.getByText(
        "For " + title + " · This gift is private to your account.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Give this gift a name")).toHaveValue(
      occasionTitle,
    );
    await page
      .getByRole("button", { name: "Save private draft", exact: true })
      .click();
    await page.waitForURL(/\/account\/projects\//);
    const [g] =
      await sql`SELECT circle_id,circle_occasion_id FROM customer_projects WHERE id=${new URL(page.url()).pathname.split("/").pop()!}`;
    expect(g.circle_id).toBe(id);
    expect(g.circle_occasion_id).toBeTruthy();
    await page.goto(baseURL + "/account/circles/" + id + "?tab=people");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(
      page.getByRole("heading", { name: "Members", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "work/circles-screens/desktop-people.png",
      fullPage: true,
    });
    await page.goto(baseURL + "/account/circles/" + id + "?tab=settings");
    await expect(
      page.getByRole("heading", { name: "You in this circle", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "work/circles-screens/desktop-settings.png",
      fullPage: true,
    });
    await page.goto(baseURL + "/account/circles/" + id);
    await expect(
      page.getByRole("heading", {
        name: "Your gifts for this circle",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: "work/circles-screens/desktop-circle.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("navigation", { name: "Circle sections" }),
    ).toBeVisible();
    await page.screenshot({
      path: "work/circles-screens/mobile-circle.png",
      fullPage: true,
    });
    await expect(
      page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("link", { name: "Circles" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const buttons = await page
      .locator("button:visible,.app-button:visible")
      .evaluateAll((els) =>
        els.map((e) => ({
          name: e.textContent?.trim(),
          h: e.getBoundingClientRect().height,
        })),
      );
    expect(buttons.filter((b) => b.h < 43)).toEqual([]);
    await page.goto(baseURL + "/account/circles/" + id + "?tab=people");
    await page.getByRole("button", { name: "Make owner", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Make Arun the owner?" }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await page.goto(baseURL + "/account/circles/new");
    await page.getByLabel("Kind of circle").selectOption("corporate");
    await page
      .getByLabel("Circle name", { exact: true })
      .fill("A team with a story");
    await page
      .getByLabel("Organisation name", { exact: true })
      .fill("A team with a story");
    await page
      .getByLabel("Website", { exact: true })
      .fill("https://team.example");
    await page.getByLabel("Work email domain").fill("team.example");
    await page.screenshot({
      path: "work/circles-screens/mobile-create-company.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Create circle", exact: true })
      .click();
    await page.waitForURL(/\/account\/circles\/[0-9a-f-]+$/);
    await expect(
      page.getByText("Not yet verified", { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(baseURL + "/operations");
    await page
      .getByLabel("Operator secret", { exact: true })
      .fill("local-circles-operator-only");
    await page.getByRole("button", { name: "Open customer desk" }).click();
    await page
      .getByRole("button", { name: "Circles & organisations", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Meridian Studio", exact: true }),
    ).toBeVisible();
    const entry = page.locator("article").filter({
      has: page.getByRole("heading", {
        name: "Meridian Studio",
        exact: true,
      }),
    });
    await expect(
      entry.getByText("Fictional organisation", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "work/circles-screens/operations-organisations.png",
      fullPage: true,
    });
    await entry
      .getByRole("button", { name: "Review details", exact: true })
      .click();
    expect(
      await page.locator("select[name=state] option[value=verified]").count(),
    ).toBe(0);
    await entry
      .getByLabel("Check performed")
      .fill("Fictional company checked for local UI verification only.");
    await entry.getByRole("checkbox").check();
    await entry
      .getByRole("button", { name: "Save review", exact: true })
      .click();
    await expect(
      entry.getByText("needs review", { exact: true }),
    ).toBeVisible();
    await other.goto(baseURL + "/account/circles/" + id + "?tab=settings");
    await other
      .getByRole("button", { name: "Leave circle", exact: true })
      .click();
    const leave = other.getByRole("dialog", { name: "Leave this circle?" });
    await expect(leave).toBeVisible();
    await leave
      .getByRole("button", { name: "Leave circle", exact: true })
      .click();
    await other.waitForURL(baseURL + "/account/circles");
    await expect(
      other.getByRole("heading", { name: "Your circles", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await owner.close();
    await peer.close();
    await sql.end();
  }
});
