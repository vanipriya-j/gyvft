import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
const db = process.env.PLAYWRIGHT_WORKFLOW_DB;
test.skip(
  !db || process.env.GYVFT_AUTH_MAIL_FIXTURE !== "1",
  "Local database and captured email transport required.",
);
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("browser signup, duplicate protection, sign-in/out, reset email, new password and session revocation", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  expect(new URL(db!).hostname).toBe("127.0.0.1");
  expect(new URL(db!).port).toBe("55434");
  const ip = `127.0.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  const sql = postgres(db!, { max: 2 }),
    email = `auth-browser-${randomUUID()}@example.test`,
    password = "Local test password " + randomUUID(),
    nextPassword = "Changed local password " + randomUUID();
  const mailPath = `work/auth-mail-fixture/${createHash("sha256").update(email).digest("hex")}.json`;
  const other = await browser.newContext();
  await other.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  const stale = await other.newPage();
  async function fill(p: typeof page, pw: string) {
    await p
      .getByLabel("Email used for your enquiry", { exact: true })
      .fill(email);
    await p.getByLabel("Password", { exact: true }).fill(pw);
  }
  try {
    await page.goto(baseURL + "/account/login");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await fill(page, password);
    await page
      .getByRole("button", { name: "Create your account", exact: true })
      .click();
    await expect(page).toHaveURL(baseURL + "/account");
    const [account] =
      await sql`SELECT id,password_hash FROM gyvft_customer_accounts WHERE email=${email}`;
    expect(account.password_hash.startsWith("scrypt$")).toBe(true);
    expect(account.password_hash).not.toContain(password);
    await stale.goto(baseURL + "/account/login");
    await fill(stale, password);
    await stale
      .getByRole("button", { name: "Sign in to My GYVFT", exact: true })
      .click();
    await expect(stale).toHaveURL(baseURL + "/account");
    await page.locator('summary[aria-label="Your account"]').click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(baseURL + "/account/login");
    await fill(page, "Incorrect local password");
    await page
      .getByRole("button", { name: "Sign in to My GYVFT", exact: true })
      .click();
    await expect(page.locator("p[role=alert]")).toContainText(
      "Check your email and password",
    );
    await page
      .getByRole("button", { name: "Forgot password?", exact: true })
      .click();
    await page
      .getByLabel("Email used for your enquiry", { exact: true })
      .fill(email);
    await page
      .getByRole("button", { name: "Send password reset link", exact: true })
      .click();
    await expect(page.locator("p[role=status]")).toContainText(
      "password reset instructions",
    );
    expect(existsSync(mailPath)).toBe(true);
    const mail = JSON.parse(readFileSync(mailPath, "utf8"));
    expect(mail.to).toEqual([email]);
    const resetUrl = new URL(mail.text.match(/https?:\/\/\S+/)[0]);
    expect(resetUrl.origin).toBe(baseURL);
    const token = resetUrl.searchParams.get("reset")!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [reset] =
      await sql`SELECT token_hash,used_at FROM gyvft_customer_password_resets WHERE account_id=${account.id}`;
    expect(reset.token_hash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(reset.used_at).toBeNull();
    await page.goto(resetUrl.href);
    await page.getByLabel("New password", { exact: true }).fill(nextPassword);
    await page
      .getByRole("button", { name: "Save new password", exact: true })
      .click();
    await expect(page).toHaveURL(baseURL + "/account/login");
    await expect(
      page.getByRole("button", { name: "Sign in to My GYVFT", exact: true }),
    ).toBeVisible();
    const [sessions] =
      await sql`SELECT count(*)::int AS n FROM gyvft_customer_sessions WHERE account_id=${account.id}`;
    expect(sessions.n).toBe(0);
    await stale.goto(baseURL + "/account/gifts");
    await expect(stale).toHaveURL(/\/account\/login/);
    await page.goto(resetUrl.href);
    await page
      .getByLabel("New password", { exact: true })
      .fill("A different attempted password");
    await page
      .getByRole("button", { name: "Save new password", exact: true })
      .click();
    await expect(page.locator("p[role=alert]")).toContainText(
      "invalid or has expired",
    );
    await page.goto(baseURL + "/account/login");
    await fill(page, password);
    await page
      .getByRole("button", { name: "Sign in to My GYVFT", exact: true })
      .click();
    await expect(page.locator("p[role=alert]")).toContainText(
      "Check your email and password",
    );
    await fill(page, nextPassword);
    await page
      .getByRole("button", { name: "Sign in to My GYVFT", exact: true })
      .click();
    await expect(page).toHaveURL(baseURL + "/account");
    await page.locator('summary[aria-label="Your account"]').click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(baseURL + "/account/login");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await fill(page, "Duplicate registration must not replace password");
    await page
      .getByRole("button", { name: "Create your account", exact: true })
      .click();
    await expect(page.locator("p[role=alert]")).toContainText("Try signing in");
  } finally {
    await other.close();
    await sql`DELETE FROM gyvft_customer_accounts WHERE email=${email}`;
    if (existsSync(mailPath)) unlinkSync(mailPath);
    await sql.end();
  }
});

test("recovery rate limit gives a visible retry wait before account lookup", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(60000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `127.1.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`,
  });
  await page.goto(baseURL + "/account/login");
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await page
    .getByLabel("Email used for your enquiry", { exact: true })
    .fill(`unknown-${randomUUID()}@example.test`);
  const send = page.getByRole("button", {
    name: "Send password reset link",
    exact: true,
  });
  for (let i = 0; i < 5; i++) {
    await send.click();
    await expect(page.locator("p[role=status]")).toContainText(
      "If an account exists",
    );
    await expect(send).toBeEnabled();
  }
  await send.click();
  await expect(page.locator("p[role=alert]")).toContainText("wait 15 minutes");
  await expect(send).toBeEnabled();
});
