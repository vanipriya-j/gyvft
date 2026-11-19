import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
const db = process.env.PLAYWRIGHT_WORKFLOW_DB,
  secret = process.env.PLAYWRIGHT_OPERATOR_SECRET;
test.skip(!db || !secret, "Dedicated local fixture required.");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("Operations dashboard uses real facts, excludes drafts/samples and opens the correct work", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120000);
  expect(new URL(db!).hostname).toBe("127.0.0.1");
  expect(new URL(db!).port).toBe("55434");
  const sql = postgres(db!, { max: 2 }),
    account = randomUUID(),
    ids = Array.from({ length: 6 }, () => randomUUID()) as string[];
  const snapshot = async () => {
    const r = await context.request.post("/api/operations/requests", {
      headers: { "x-setup-secret": secret! },
      data: { op: "snapshot" },
    });
    expect(r.status()).toBe(200);
    return (await r.json()).snapshot;
  };
  const denied = await context.request.post("/api/operations/requests", {
    data: { op: "snapshot" },
  });
  expect(denied.status()).toBe(401);
  let releaseReports = () => {};
  const reportGate = new Promise<void>((resolve) => {
    releaseReports = resolve;
  });
  const before = await snapshot();
  try {
    await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${account},${account + "@example.test"},'LOCAL_TEST')`;
    for (const [i, stage, total, paid, title] of [
      [0, 4, 1330000, 0, "Family thank-you · dashboard QA"],
      [1, 7, 640000, 320000, "A welcome for the new team · dashboard QA"],
      [2, 8, 550000, 550000, "Amma’s birthday · dashboard QA"],
      [3, 10, 200000, 200000, "A little thank-you · dashboard QA"],
      [4, 0, 9000000, 0, "Private draft · dashboard QA"],
      [5, 4, 9000000, 0, "Labelled sample · dashboard QA"],
    ] as const) {
      await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,brief,kind,customer_type,stage,total_paise,paid_paise,is_draft,submission_key,delivery_date,task_due_at) VALUES(${ids[i]},${account},${account + "@example.test"},${title},'Fictional local acceptance-test data.','project','b2c',${stage},${total},${paid},${i === 4},${i === 5 ? "gyvft-demo-dashboard-qa" : null},(now() AT TIME ZONE 'Asia/Kolkata')::date+2,now()+interval '1 day')`;
    }
    await sql`INSERT INTO customer_payment_submissions(project_id,reference,amount_paise,status,created_at) VALUES(${ids[0]},'LOCAL-DASHBOARD-PENDING',665000,'pending',now()-interval '26 hours')`;
    for (const [i, n] of [
      [1, 320000],
      [2, 550000],
      [3, 200000],
    ])
      await sql`INSERT INTO customer_payment_submissions(project_id,reference,amount_paise,status,verified_at) VALUES(${ids[i]},${"LOCAL-DASHBOARD-VERIFIED-" + i},${n},'verified',now()-interval '1 day')`;
    const after = await snapshot();
    expect(after.counts.active - before.counts.active).toBe(3);
    expect(after.counts.production - before.counts.production).toBe(2);
    expect(after.counts.pendingPayments - before.counts.pendingPayments).toBe(
      1,
    );
    expect(
      after.money.verifiedLast30Days - before.money.verifiedLast30Days,
    ).toBe(1070000);
    expect(after.money.outstanding - before.money.outstanding).toBe(1650000);
    expect(
      after.queue.some((q: { id: string }) => [ids[4], ids[5]].includes(q.id)),
    ).toBe(false);
    expect(
      after.payments.find((p: { projectId: string }) => p.projectId === ids[0])
        .overdue,
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(baseURL + "/operations");
    await page.getByLabel("Operator secret", { exact: true }).fill(secret!);
    await page
      .getByRole("button", { name: "Open customer desk", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: /Verified receipts over the last 30 days/,
      }),
    ).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.screenshot({
      path: "/tmp/gyvft-operations-dashboard-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Verify payment", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Family thank-you · dashboard QA",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bank verification", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("complementary", { name: "Operations areas" })
      .getByRole("button", { name: "Dashboard", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^In production/ }).click();
    await expect(page.getByRole("combobox", { name: /Show/ })).toHaveValue(
      "production",
    );
    await expect(
      page.getByText("A welcome for the new team · dashboard QA", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Family thank-you · dashboard QA", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("complementary", { name: "Operations areas" })
      .getByRole("button", { name: "Dashboard", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await page.route("**/api/operations", async (route) => {
      await reportGate;
      await route.continue().catch(() => {});
    });
    const nav = page.getByRole("complementary", { name: "Operations areas" });
    await nav
      .getByRole("button", { name: "Reports & health", exact: true })
      .click();
    await expect(
      nav.getByRole("button", { name: "Customers", exact: true }),
    ).toBeEnabled();
    await nav.getByRole("button", { name: "Customers", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Customers", exact: true }),
    ).toBeVisible();
    releaseReports();
    await page
      .locator("article")
      .filter({ hasText: account + "@example.test" })
      .getByRole("button", { name: "View their gifts", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Requests & orders", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: /Show/ })).toHaveValue(
      "all",
    );
    await expect(
      page.getByText("Family thank-you · dashboard QA", { exact: true }),
    ).toBeVisible();

    await nav.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reports", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Money received & outstanding",
        exact: true,
      }),
    ).toBeVisible();
    await nav.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    for (const width of [320, 390, 760]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      const small = await page.locator(".ops-dashboard").evaluate((el) =>
        [...el.querySelectorAll("button,a[href]")]
          .filter((e) => e.getClientRects().length)
          .map((e) => ({
            t: e.textContent?.slice(0, 60),
            w: e.getBoundingClientRect().width,
            h: e.getBoundingClientRect().height,
          }))
          .filter((r) => r.w < 43.9 || r.h < 43.9),
      );
      expect(small).toEqual([]);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "/tmp/gyvft-operations-dashboard-mobile.png",
      fullPage: true,
    });
  } finally {
    releaseReports();
    await sql`DELETE FROM customer_projects WHERE customer_account_id=${account}`;
    await sql`DELETE FROM gyvft_customer_accounts WHERE id=${account}`;
    await sql.end();
  }
});
