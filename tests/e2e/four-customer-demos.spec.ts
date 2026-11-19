import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { demoAccounts } from "../../src/lib/customer/demo-accounts";
const db = process.env.PLAYWRIGHT_WORKFLOW_DB,
  secret = process.env.PLAYWRIGHT_OPERATOR_SECRET;
test.skip(!db || !secret, "Disposable local fixture required.");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("operator adds four rich demo accounts, preserves existing data/passwords and browser-isolates each customer", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(240000);
  expect(new URL(db!).hostname).toBe("127.0.0.1");
  expect(new URL(db!).port).toBe("55434");
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `127.2.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`,
  });
  const fixture = JSON.parse(
    readFileSync("work/gift-flow-fixture.json", "utf8"),
  );
  expect(fixture.origin).toBe(baseURL);
  const sql = postgres(db!, { max: 2, prepare: false });
  mkdirSync("work", { recursive: true });
  const pwPath = "work/customer-demo-test-password.txt";
  if (!existsSync(pwPath))
    writeFileSync(pwPath, "Local demo password " + randomUUID(), {
      mode: 0o600,
    });
  const pw = readFileSync(pwPath, "utf8");
  const root = () =>
    sql`SELECT count(*)::int AS n,md5(string_agg(row_to_json(a)::text,'|' ORDER BY a.id)) AS digest FROM gyvft_customer_accounts a WHERE id NOT IN ${sql(demoAccounts.map((a) => a.id))}`;
  const snapshot = async () => {
    const r = await context.request.post(baseURL + "/api/operations/requests", {
      headers: { "x-setup-secret": secret! },
      data: { op: "snapshot" },
    });
    expect(r.status()).toBe(200);
    return (await r.json()).snapshot;
  };
  const before = await root(),
    opsBefore = await snapshot();
  try {
    const unauthorized = await context.request.post(
      baseURL + "/api/operations/demo-data",
      { data: { password: pw, confirm: true } },
    );
    expect(unauthorized.status()).toBe(401);
    await page.goto(baseURL + "/operations/demo-data");
    await expect(
      page.getByRole("heading", {
        name: "Four stories, ready to explore.",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Operator secret", { exact: true }).fill(secret!);
    await page
      .getByLabel("Password for the new demo accounts", { exact: true })
      .fill(pw);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Add four demo accounts", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      /Four demo workspaces are ready|demo records already exist/,
      { timeout: 60000 },
    );
    const accounts =
      await sql`SELECT id,email,password_hash FROM gyvft_customer_accounts WHERE id IN ${sql(demoAccounts.map((a) => a.id))} ORDER BY id`;
    expect(accounts).toHaveLength(4);
    expect(new Set(accounts.map((a) => a.password_hash)).size).toBe(4);
    const counts = () =>
      sql`SELECT (SELECT count(*)::int FROM customer_projects WHERE customer_account_id IN ${sql(demoAccounts.map((a) => a.id))}) AS gifts,(SELECT count(*)::int FROM gyvft_customer_people WHERE account_id IN ${sql(demoAccounts.map((a) => a.id))}) AS people,(SELECT count(*)::int FROM gyvft_customer_occasions WHERE account_id IN ${sql(demoAccounts.map((a) => a.id))}) AS occasions`;
    const countBefore = await counts();
    expect(countBefore[0]).toMatchObject({
      gifts: 28,
      people: 22,
      occasions: 20,
    });
    await page.getByLabel("Operator secret", { exact: true }).fill(secret!);
    await page
      .getByLabel("Password for the new demo accounts", { exact: true })
      .fill("A different password must not replace existing ones");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Add four demo accounts", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("already exist", {
      timeout: 60000,
    });
    expect(await counts()).toEqual(countBefore);
    expect(await root()).toEqual(before);
    expect(
      await sql`SELECT id,email,password_hash FROM gyvft_customer_accounts WHERE id IN ${sql(demoAccounts.map((a) => a.id))} ORDER BY id`,
    ).toEqual(accounts);
    const opsAfter = await snapshot();
    expect(opsAfter.counts).toEqual(opsBefore.counts);
    expect(opsAfter.money).toEqual(opsBefore.money);
    for (const a of demoAccounts) {
      const own = await browser.newContext({
        viewport: { width: 1366, height: 900 },
      });
      const p = await own.newPage();
      const errors: string[] = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(baseURL + "/account/login");
      await p
        .getByLabel("Email used for your enquiry", { exact: true })
        .fill(a.email);
      await p.getByLabel("Password", { exact: true }).fill(pw);
      await p
        .getByRole("button", { name: "Sign in to My GYVFT", exact: true })
        .click();
      await expect(p).toHaveURL(baseURL + "/account");
      await expect(p.getByText(/Demo workspace · People/)).toBeVisible();
      const home = await p.evaluate(async () => {
        const response = await fetch("/api/customer/home?section=all", {
          credentials: "same-origin",
        });
        return { status: response.status, payload: await response.json() };
      });
      expect(home.status).toBe(200);
      const payload = home.payload.data;
      expect(payload.sections.gifts.data.total).toBeGreaterThan(0);
      expect(payload.sections.occasions.data.total).toBeGreaterThan(0);
      expect(payload.sections.payments.data.completedGifts).toBeGreaterThan(0);
      expect(
        payload.sections.payments.data.paidThisFinancialYearPaise,
      ).toBeGreaterThan(0);
      expect(payload.sections.saved.data.total).toBeGreaterThan(0);
      const [gift] =
        await sql`SELECT id,title FROM customer_projects WHERE customer_account_id=${a.id} AND stage<10 ORDER BY created_at LIMIT 1`;
      await p.goto(baseURL + `/account/projects/${gift.id}`);
      await expect(
        p.getByRole("heading", { name: gift.title, exact: true }),
      ).toBeVisible();
      await p.goto(baseURL + "/account/profile");
      await expect(p.getByLabel("Your name", { exact: true })).toHaveValue(
        a.shortName,
      );
      for (const path of [
        "/account/gifts",
        "/account/people",
        "/account/occasions",
        "/account?view=payments",
        "/account?view=saved",
      ]) {
        await p.goto(baseURL + path);
        await expect(p.getByText(/Demo workspace · People/)).toBeVisible();
      }
      const other = demoAccounts.find((x) => x.id !== a.id)!;
      const [foreign] =
        await sql`SELECT id,title FROM customer_projects WHERE customer_account_id=${other.id} LIMIT 1`;
      await p.goto(baseURL + `/account/projects/${foreign.id}`);
      await expect(
        p.getByRole("heading", { name: foreign.title, exact: true }),
      ).toHaveCount(0);
      await p.goto(baseURL + "/account");
      await p.screenshot({
        path: `/tmp/gyvft-demo-${a.kind}-desktop.png`,
        fullPage: true,
      });
      await p.setViewportSize({ width: 390, height: 844 });
      await p.reload();
      expect(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await p.screenshot({
        path: `/tmp/gyvft-demo-${a.kind}-mobile.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
      await own.close();
    }
    const linked =
      await sql`SELECT count(*)::int AS n FROM gyvft_customer_accounts WHERE id IN ${sql(demoAccounts.map((a) => a.id))} AND shopify_customer_id IS NOT NULL`;
    expect(linked[0].n).toBe(0);
  } finally {
    await sql.end();
  } // Intentionally retain only these fictional local fixtures; no deletion.
});
