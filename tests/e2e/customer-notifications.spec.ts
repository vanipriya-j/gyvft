import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
const secret = process.env.PLAYWRIGHT_OPERATOR_SECRET;
test.skip(
  !secret || !process.env.GYVFT_NOTIFICATION_BROWSER,
  "Disposable local captured-email fixture only.",
);
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("Operations email controls show progress, prevent duplicate clicks and distinguish provider acceptance", async ({
  page,
  baseURL,
}) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/operations");
  await page.getByLabel("Operator secret", { exact: true }).fill(secret!);
  await page
    .getByRole("button", { name: "Open customer desk", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Settings & connections", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Email updates", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Configured · test inbox delivery", { exact: true }),
  ).toBeVisible();
  let release = () => {},
    sends = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/operations/requests", async (route) => {
    if (route.request().postDataJSON()?.op === "test_notification_email") {
      sends++;
      await gate;
    }
    await route.continue();
  });
  const button = page.getByRole("button", {
    name: "Send test email to team inbox",
    exact: true,
  });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-busy", "true");
  expect(sends).toBe(1);
  release();
  await expect(
    page.getByText(
      "Test accepted by email provider. Check the team inbox to confirm receipt.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(button).toBeEnabled();
  await page
    .getByRole("button", { name: "Process due notifications", exact: true })
    .click();
  await expect(page.getByText(/Processed \d+ due notifications/)).toBeVisible();
  await page.screenshot({
    path: "work/notification-operations-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(button).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const box = await button.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: "work/notification-operations-mobile.png",
    fullPage: true,
  });
  expect(sends).toBe(1);
  expect(errors).toEqual([]);
});
test("customer messages notify the team and an Operations reply notifies the same customer", async ({
  page,
  context,
  baseURL,
}) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  const fixture = JSON.parse(
    readFileSync("work/notification-browser-fixture.json", "utf8"),
  );
  const db = new URL(fixture.databaseURL);
  expect(db.hostname).toBe("127.0.0.1");
  expect(db.port).toBe("55434");
  expect(db.pathname).toMatch(/^\/gyvft_notifications_browser_/);
  const sql = postgres(fixture.databaseURL, { max: 1, prepare: false });
  try {
    const token = randomBytes(32).toString("base64url");
    await sql`INSERT INTO gyvft_customer_sessions(token_hash,account_id,expires_at) VALUES(${createHash("sha256").update(token).digest("hex")},${fixture.accountId},now()+interval '1 hour')`;
    await context.addCookies([
      {
        name: "gyvft_customer_session",
        value: token,
        url: baseURL!,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto(`/account/projects/${fixture.projectId}?view=messages`);
    await page
      .getByLabel("Your message", { exact: true })
      .fill("Could you suggest a thoughtful birthday gift?");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      page.getByText("Your message has been saved.", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await sql`SELECT state FROM gyvft_customer_notifications WHERE project_id=${fixture.projectId} AND destination='team' ORDER BY created_at DESC LIMIT 1`
          )[0]?.state,
      )
      .toBe("sent");
    const r = await page.request.post("/api/operations/requests", {
      headers: { "x-setup-secret": secret! },
      data: {
        op: "reply",
        id: fixture.projectId,
        request_id: randomUUID(),
        body: "We have your brief and will curate options for you.",
      },
    });
    expect(r.status()).toBe(200);
    await expect
      .poll(
        async () =>
          (
            await sql`SELECT state FROM gyvft_customer_notifications WHERE project_id=${fixture.projectId} AND destination='customer' ORDER BY created_at DESC LIMIT 1`
          )[0]?.state,
      )
      .toBe("sent");
    const mail = readFileSync("work/notification-browser-mail.jsonl", "utf8")
      .trim()
      .split("\n")
      .map((v) => JSON.parse(v));
    expect(
      mail.some(
        (m) =>
          m.to.includes("team@example.test") &&
          m.subject === "GYVFT: customer message" &&
          m.text.includes(`/operations/requests?request=${fixture.projectId}`),
      ),
    ).toBe(true);
    expect(
      mail.some(
        (m) =>
          m.to.includes("customer@example.test") &&
          m.subject.includes("New message") &&
          m.text.includes(`/account/projects/${fixture.projectId}`),
      ),
    ).toBe(true);
  } finally {
    await sql.end();
  }
});
