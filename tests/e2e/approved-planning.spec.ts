import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const db = process.env.PLAYWRIGHT_WORKFLOW_DB,
  secret = process.env.PLAYWRIGHT_OPERATOR_SECRET;
test.skip(!db || !secret, "Dedicated local fixture required.");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("private people, invitation-controlled profiles, occasions and a persisted seven-step gift", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  expect(new URL(db!).hostname).toBe("127.0.0.1");
  expect(new URL(db!).port).toBe("55434");
  const fixture = JSON.parse(
    readFileSync("work/gift-flow-fixture.json", "utf8"),
  );
  expect(fixture.origin).toBe(baseURL);
  process.kill(fixture.pid, 0);
  const sql = postgres(db!, { max: 2, prepare: false }),
    account = randomUUID(),
    other = randomUUID(),
    token = randomBytes(32).toString("base64url"),
    otherToken = randomBytes(32).toString("base64url"),
    email = other + "@example.test";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${account},${account + "@example.test"},'LOCAL_TEST'),(${other},${email},'LOCAL_TEST')`;
    await sql`INSERT INTO gyvft_customer_sessions(token_hash,account_id,expires_at) VALUES(${createHash("sha256").update(token).digest("hex")},${account},now()+interval '1 day'),(${createHash("sha256").update(otherToken).digest("hex")},${other},now()+interval '1 day')`;
    await context.addCookies([
      {
        name: "gyvft_customer_session",
        value: token,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await page.goto(baseURL + "/account/people?add=1");
    await page.getByLabel("Their name", { exact: true }).fill("Amma");
    await page.getByLabel("Relationship", { exact: true }).fill("Mother");
    await page
      .getByLabel("Email for an optional invitation", { exact: true })
      .fill(email);
    await page
      .getByLabel("Write a little about them", { exact: true })
      .fill("My private note: she loves early mornings.");
    await page
      .getByLabel("Likes and interests", { exact: true })
      .fill("Coffee, music and gardening");
    await page
      .getByRole("button", { name: "Save person", exact: true })
      .click();
    await page.waitForURL(/\/account\/people\/[0-9a-f-]+$/);
    const personId = page.url().split("/").at(-1)!;
    await page
      .getByRole("button", { name: "Get invitation link", exact: true })
      .click();
    await expect(
      page.getByLabel("Invitation link", { exact: true }),
    ).toBeVisible();
    const invitation = await page
      .getByLabel("Invitation link", { exact: true })
      .inputValue();
    await page.goto(baseURL + "/account/occasions?add=1");
    await page
      .getByLabel("Occasion name", { exact: true })
      .fill("Amma’s birthday");
    await page.getByLabel("Occasion date", { exact: true }).fill("2026-11-29");
    await page
      .getByRole("combobox", { name: /Who is it for/ })
      .selectOption(personId);
    await page
      .getByLabel("Relationship / circle (optional)", { exact: true })
      .fill("Family");
    await page
      .getByLabel("This occasion returns every year", { exact: true })
      .check();
    await page
      .getByLabel("A note for next time", { exact: true })
      .fill("Something useful for her morning coffee.");
    await page
      .getByRole("button", { name: "Save occasion", exact: true })
      .click();
    await page.waitForURL(/\/account\/occasions\/[0-9a-f-]+$/);
    const occasionId = page.url().split("/").at(-1)!;
    await page
      .getByRole("link", { name: "Plan a gift for this occasion", exact: true })
      .click();
    await expect(
      page.getByLabel("Give this gift a name", { exact: true }),
    ).toHaveValue("Amma’s birthday");
    await page
      .getByRole("textbox", { name: "Tell us the story", exact: true })
      .fill(
        "A personal birthday gift for Amma and her much-loved morning coffee ritual, with a warm handwritten message.",
      );
    await page
      .getByRole("button", { name: "Save private draft", exact: true })
      .click();
    await page.waitForURL(/\/account\/projects\/[0-9a-f-]+\?view=edit$/);
    const giftId = new URL(page.url()).pathname.split("/").at(-1)!;
    const [saved] =
      await sql`SELECT is_draft,occasion_id,person_id FROM customer_projects WHERE id=${giftId}`;
    expect(saved.is_draft).toBe(true);
    expect(saved.occasion_id).toBe(occasionId);
    expect(saved.person_id).toBe(personId);
    const listed = await context.request.post(
      baseURL + "/api/operations/requests",
      {
        headers: { "x-setup-secret": secret! },
        data: { op: "list", query: "Amma’s birthday" },
      },
    );
    expect(
      (await listed.json()).requests.some(
        (r: { id: string }) => r.id === giftId,
      ),
    ).toBe(false);
    await page
      .getByRole("button", { name: "Continue to the occasion", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Continue to the recipients", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", {
        name: "Describe them — names, relationships or the group",
        exact: true,
      }),
    ).toHaveValue("Amma");
    await page
      .getByRole("button", {
        name: "Continue to what it should say",
        exact: true,
      })
      .click();
    await page
      .getByLabel("What should the gift communicate?", { exact: true })
      .fill("You make every morning warmer.");
    await page
      .getByRole("button", { name: "Continue to your budget", exact: true })
      .click();
    await page.getByLabel("Budget or range (₹)", { exact: true }).fill("1500");
    await page
      .getByRole("button", { name: "Continue to where & when", exact: true })
      .click();
    await page
      .getByLabel("Requested delivery date", { exact: true })
      .fill("2026-11-27");
    await page.getByLabel("Delivery city", { exact: true }).fill("Chennai");
    await page
      .getByRole("button", { name: "Continue to review & send", exact: true })
      .click();
    await page
      .getByLabel("Phone / WhatsApp", { exact: true })
      .fill("9000000000");
    await page
      .getByRole("button", { name: "Send my story", exact: true })
      .click();
    await page.waitForURL(baseURL + `/account/projects/${giftId}`);
    await expect(
      page.getByRole("heading", { name: "Amma’s birthday", exact: true }),
    ).toBeVisible();
    expect(
      (await sql`SELECT is_draft FROM customer_projects WHERE id=${giftId}`)[0]
        .is_draft,
    ).toBe(false);
    await page.goto(baseURL + `/account/occasions/${occasionId}`);
    await expect(
      page.getByRole("link", { name: "Build on this gift →", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Build on this gift →", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Tell us the story", exact: true }),
    ).toHaveValue(/Build on last time:/);
    const second = await browser.newContext();
    await second.addCookies([
      {
        name: "gyvft_customer_session",
        value: otherToken,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    const friend = await second.newPage();
    await friend.goto(invitation);
    await friend
      .getByRole("button", { name: "Accept invitation", exact: true })
      .click();
    await expect(
      friend.getByRole("heading", { name: "You’re connected.", exact: true }),
    ).toBeVisible();
    await friend.goto(baseURL + "/account/profile");
    await friend.getByLabel("Your name", { exact: true }).fill("Amma");
    await friend
      .getByLabel("A little about you", { exact: true })
      .fill("I love slow mornings, Carnatic music and my garden.");
    await friend
      .getByLabel("Things you enjoy", { exact: true })
      .fill("Coffee and music");
    await friend
      .getByRole("button", { name: "Save my profile", exact: true })
      .click();
    await expect(friend.getByText("Saved.", { exact: true })).toBeVisible();
    await page.goto(baseURL + `/account/people/${personId}`);
    await expect(
      page.getByText("I love slow mornings, Carnatic music and my garden.", {
        exact: true,
      }),
    ).toHaveCount(0);
    await friend
      .getByRole("checkbox", {
        name: "Share my profile with people whose invitations I’ve accepted",
        exact: true,
      })
      .check();
    await friend
      .getByRole("button", { name: "Save my profile", exact: true })
      .click();
    await expect(friend.getByText("Saved.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("I love slow mornings, Carnatic music and my garden.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("My private note: she loves early mornings.", {
        exact: true,
      }),
    ).toBeVisible();
    await friend
      .getByRole("checkbox", {
        name: "Share my profile with people whose invitations I’ve accepted",
        exact: true,
      })
      .uncheck();
    await friend
      .getByRole("button", { name: "Save my profile", exact: true })
      .click();
    await expect(friend.getByText("Saved.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("I love slow mornings, Carnatic music and my garden.", {
        exact: true,
      }),
    ).toHaveCount(0);
    const denied = await second.request.get(
      baseURL + `/account/projects/${giftId}`,
    );
    expect([200, 404]).toContain(denied.status());
    const deniedBody = await denied.text();
    expect(deniedBody).toMatch(
      /NEXT_HTTP_ERROR_FALLBACK;404|This page could not be found/,
    );
    expect(deniedBody).not.toContain("You make every morning warmer.");
    expect(deniedBody).not.toContain(
      "Something useful for her morning coffee.",
    );
    await second.close();
    expect(errors).toEqual([]);
  } finally {
    await sql`DELETE FROM customer_projects WHERE customer_account_id IN (${account},${other})`;
    await sql`DELETE FROM gyvft_customer_accounts WHERE id IN (${account},${other})`;
    await sql.end();
  }
});
