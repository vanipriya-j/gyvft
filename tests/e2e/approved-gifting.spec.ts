import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { createHash, randomBytes, randomUUID } from "node:crypto";
const db = process.env.PLAYWRIGHT_WORKFLOW_DB,
  secret = process.env.PLAYWRIGHT_OPERATOR_SECRET;
test.skip(!db || !secret, "Dedicated local workflow fixture required.");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("approved customer and Operations flow, real persistence and individual photo withdrawal", async ({
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
    id = randomUUID(),
    account = randomUUID(),
    other = randomUUID(),
    token = randomBytes(32).toString("base64url"),
    foreignToken = randomBytes(32).toString("base64url");
  const title = "A thank-you for the family · approved workflow";
  const image = readFileSync(
    "public/images/gyvft/case-studies/various-dance-schools/hero.png",
  );
  const file = { name: "moment.png", mimeType: "image/png", buffer: image };
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const admin = await context.newPage();
  admin.setDefaultTimeout(15000);
  admin.on("pageerror", (e) => errors.push(e.message));
  const href = (view = "overview") =>
    `/account/projects/${id}${view === "overview" ? "" : `?view=${view}`}`;
  const command = async (raw: Record<string, unknown>, status = 200) => {
    const response = await context.request.post("/api/operations/requests", {
      headers: { "x-setup-secret": secret! },
      data: { id, request_id: randomUUID(), ...raw },
    });
    expect(response.status(), JSON.stringify(raw.op)).toBe(status);
    return response.json();
  };
  const tab = (name: string) =>
    admin
      .getByRole("navigation", { name: "Manage request" })
      .getByRole("button", { name, exact: true });
  try {
    await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${account},${account + "@example.test"},'LOCAL_TEST'),(${other},${other + "@example.test"},'LOCAL_TEST')`;
    await sql`INSERT INTO gyvft_customer_sessions(token_hash,account_id,expires_at) VALUES(${createHash("sha256").update(token).digest("hex")},${account},now()+interval '1 day'),(${createHash("sha256").update(foreignToken).digest("hex")},${other},now()+interval '1 day')`;
    await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,brief) VALUES(${id},${account},${account + "@example.test"},${title},'Useful keepsakes for ten family members, with a warm shared design and a personal card for the celebration.')`;
    await context.addCookies([
      {
        name: "gyvft_customer_session",
        value: token,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await command({
      op: "publish_gift_option",
      title: "A warmth shared",
      description: "Bottle and keepsake",
      contents: [
        { key: "bottle", name: "Bottle", quantity: 1, unit_paise: 125000 },
      ],
      pricing: {
        mode: "range",
        basis: "per_set",
        quantity: 10,
        low_paise: 120000,
        high_paise: 135000,
        packaging_included: false,
      },
      image: { mime: "image/png", data: image.toString("base64") },
    });
    await page.goto(href() + "/options");
    await page
      .getByRole("button", { name: "Choose this option", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Composition", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Request quote", exact: true })
      .click();
    await expect(
      page.getByText("Your chosen gift is with Aarla.", { exact: true }),
    ).toBeVisible();
    await admin.goto(`/operations/requests?request=${id}`);
    await admin.getByLabel("Operator secret", { exact: true }).fill(secret!);
    await admin
      .getByRole("button", { name: "Open customer desk", exact: true })
      .click();
    await expect(
      admin.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await tab("Quote").click();
    const quote = admin
      .locator("form")
      .filter({ has: admin.getByLabel("Title", { exact: true }) });
    await quote.getByLabel("Title", { exact: true }).fill("Family gift quote");
    await quote
      .getByLabel("Description", { exact: true })
      .fill(
        "Ten gift sets with taxes, shared printing, packaging and delivery included as listed.",
      );
    const lines = quote.locator("fieldset");
    if ((await lines.count()) === 0)
      await admin
        .getByRole("button", { name: "Add item / charge", exact: true })
        .click();
    await lines
      .nth(0)
      .getByLabel("Product or charge", { exact: true })
      .fill("Gift set");
    await lines.nth(0).getByLabel("Quantity", { exact: true }).fill("10");
    await lines
      .nth(0)
      .getByLabel("Unit price (₹)", { exact: true })
      .fill("1250");
    await admin
      .getByRole("button", { name: "Add item / charge", exact: true })
      .click();
    await lines
      .nth(1)
      .getByLabel("Product or charge", { exact: true })
      .fill("Packaging");
    await lines.nth(1).getByLabel("Quantity", { exact: true }).fill("10");
    await lines.nth(1).getByLabel("Unit price (₹)", { exact: true }).fill("50");
    await lines.nth(1).getByRole("combobox").selectOption("fee");
    await admin
      .getByRole("button", { name: "Add item / charge", exact: true })
      .click();
    await lines
      .nth(2)
      .getByLabel("Product or charge", { exact: true })
      .fill("Delivery");
    await lines
      .nth(2)
      .getByLabel("Unit price (₹)", { exact: true })
      .fill("300");
    await lines.nth(2).getByRole("combobox").selectOption("fee");
    await quote
      .getByRole("button", { name: "Save private draft", exact: true })
      .click();
    await expect(
      admin.getByRole("heading", { name: "Saved draft · v1", exact: true }),
    ).toBeVisible();
    await page.goto(href("quote"));
    await expect(
      page.getByRole("heading", {
        name: "Your quote is taking shape",
        exact: true,
      }),
    ).toBeVisible();
    await admin
      .getByRole("button", {
        name: "Publish for customer approval",
        exact: true,
      })
      .click();
    await admin
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toBeHidden();
    await page.goto(href("quote"));
    await page
      .getByRole("button", { name: "Approve quote v1", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Approve quote v1?", exact: true }),
    ).toBeVisible();
    await page.getByRole("dialog").getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Confirm approval", exact: true })
      .click();
    await expect(
      page.getByText("Pay ₹6,650.00 now.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("The remaining ₹6,650.00 is due before dispatch.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByLabel("UPI / payment transaction reference", { exact: true })
      .fill("LOCAL-BROWSER-ADVANCE");
    await page.locator('[name="evidence"]').setInputFiles(file);
    await page
      .getByRole("button", { name: "Submit payment proof", exact: true })
      .click();
    await expect(
      page.getByText("₹6,650.00 submitted for verification.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Correct my submission", exact: true })
      .click();
    const correction = page.getByRole("dialog", {
      name: "Correct payment proof",
      exact: true,
    });
    await correction
      .getByLabel("Transaction reference", { exact: true })
      .fill("LOCAL-BROWSER-ADVANCE-CORRECTED");
    await correction.locator('[name="evidence"]').setInputFiles(file);
    await correction
      .getByRole("button", { name: "Save corrected proof", exact: true })
      .click();
    await expect(correction).toBeHidden();
    await expect(
      page.getByText(/LOCAL-BROWSER-ADVANCE-CORRECTED/),
    ).toBeVisible();
    await tab("Payments").click();
    await admin.getByRole("button", { name: "Refresh", exact: true }).click();
    await admin
      .getByRole("button", { name: "Verify payment →", exact: true })
      .first()
      .click();
    await admin
      .getByRole("checkbox", {
        name: "I checked the receiving bank/provider and this amount has arrived.",
        exact: true,
      })
      .check();
    await admin
      .getByRole("button", { name: "Verify receipt", exact: true })
      .click();
    await tab("Artwork").click();
    await admin.getByLabel("Title", { exact: true }).fill("Family artwork");
    await admin
      .getByLabel("Description", { exact: true })
      .fill("One shared design. Please check placement and spelling.");
    await admin.locator('[name="image"]').setInputFiles(file);
    await admin
      .getByRole("button", { name: "Save private draft", exact: true })
      .click();
    await expect(
      admin.getByRole("heading", { name: "Saved draft · v1", exact: true }),
    ).toBeVisible();
    await admin
      .getByRole("button", {
        name: "Publish for customer approval",
        exact: true,
      })
      .click();
    await admin
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toBeHidden();
    await page.goto(href("design"));
    await page
      .getByRole("button", { name: "Approve artwork v1", exact: true })
      .click();
    await page.getByRole("dialog").getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Confirm approval", exact: true })
      .click();
    await page.goto(href("delivery"));
    for (const [name, value] of [
      ["recipient_name", "Ananya Raman"],
      ["phone", "9000000000"],
      ["address", "12 Sample Street"],
      ["city", "Chennai"],
      ["state", "Tamil Nadu"],
      ["postal_code", "600001"],
    ])
      await page.locator(`[name="${name}"]`).fill(value);
    await page
      .getByRole("button", { name: "Save delivery address", exact: true })
      .click();
    await expect(
      page.getByText(
        "Delivery details saved. The team will confirm fulfilment.",
        { exact: true },
      ),
    ).toBeVisible();
    await tab("Order & delivery").click();
    await admin
      .getByRole("button", { name: "Create Shopify order", exact: true })
      .click();
    await admin
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toBeHidden();
    await expect(
      admin.getByText("Linked · read-only", { exact: true }),
    ).toBeVisible();
    await admin
      .getByRole("button", {
        name: "Update production / delivery",
        exact: true,
      })
      .click();
    await admin
      .getByRole("dialog", {
        name: "Start production and lock this gift?",
        exact: true,
      })
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(
      admin.getByText("Production has started.", { exact: true }),
    ).toBeVisible();
    await page.goto(href("design"));
    await expect(
      page.getByRole("button", { name: "Request changes", exact: true }),
    ).toHaveCount(0);
    await command({
      op: "progress",
      stage: 8,
      next_action: "Your gifts are being packed.",
    });
    await page.goto(href("quote"));
    await page
      .getByLabel("UPI / payment transaction reference", { exact: true })
      .fill("LOCAL-BROWSER-BALANCE");
    await page.locator('[name="evidence"]').setInputFiles(file);
    await page
      .getByRole("button", { name: "Submit payment proof", exact: true })
      .click();
    await expect(
      page.getByText("₹6,650.00 submitted for verification.", { exact: true }),
    ).toBeVisible();
    await command({
      op: "payment",
      reference: "LOCAL-BROWSER-BALANCE",
      confirmed_receipt: true,
    });
    await command({ op: "shopify_order", confirm_order: true });
    await command({
      op: "progress",
      stage: 9,
      next_action: "Your gifts are on the way.",
      tracking_reference: "LOCAL-TRACKING-1",
      tracking_url: "https://example.test/tracking",
    });
    await command({
      op: "progress",
      stage: 10,
      next_action: "Your gifts have been delivered.",
    });
    await page.goto(href("moments"));
    await page.getByRole("combobox", { name: /Your rating/ }).selectOption("5");
    await page
      .getByLabel("Your experience", { exact: true })
      .fill("They loved the thoughtful details.");
    await page
      .getByRole("button", { name: "Save my feedback", exact: true })
      .click();
    await expect(
      page.getByText(
        "Feedback saved. Your public permission is recorded separately.",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .locator('[name="photos"]')
      .setInputFiles([file, { ...file, name: "second.png" }]);
    await page.locator('[name="caption"]').fill("A shared family moment");
    await page.locator('[name="rights"]').check();
    await page.locator('[name="public_permission"]').last().check();
    await page
      .getByRole("button", { name: "Save photos", exact: true })
      .click();
    await expect(
      page.getByText("2 photos saved.", { exact: true }),
    ).toBeVisible();
    const photos =
      await sql`SELECT id FROM gyvft_gift_photos WHERE project_id=${id} ORDER BY created_at,id`;
    expect(photos).toHaveLength(2);
    for (const photo of photos)
      await command({
        op: "feature_photo",
        photo_id: photo.id,
        featured: true,
      });
    const anon = await browser.newContext();
    expect(
      (
        await anon.request.get(
          baseURL + `/api/customer-assets/moment/${photos[0].id}`,
        )
      ).status(),
    ).toBe(200);
    await page
      .getByRole("button", { name: "Manage sharing", exact: true })
      .first()
      .click();
    await page
      .getByRole("dialog", { name: "Photo sharing", exact: true })
      .getByRole("checkbox")
      .uncheck();
    await page
      .getByRole("button", { name: "Save sharing choice", exact: true })
      .click();
    await expect(
      page.getByText("Private · you and Aarla", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await anon.request.get(
          baseURL + `/api/customer-assets/moment/${photos[0].id}`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await anon.request.get(
          baseURL + `/api/customer-assets/moment/${photos[1].id}`,
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await context.request.get(
          baseURL + `/api/customer-assets/moment/${photos[0].id}`,
        )
      ).status(),
    ).toBe(200);
    await anon.close();
    const foreign = await browser.newContext();
    await foreign.addCookies([
      {
        name: "gyvft_customer_session",
        value: foreignToken,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    const denied = await foreign.request.get(baseURL + href());
    // Next streams loading UI before notFound; status may already be committed.
    expect([200, 404]).toContain(denied.status());
    const deniedBody = await denied.text();
    expect(deniedBody).toMatch(
      /NEXT_HTTP_ERROR_FALLBACK;404|This page could not be found/,
    );
    expect(deniedBody).not.toContain(title);
    expect(
      (
        await foreign.request.get(
          baseURL + `/api/customer-assets/moment/${photos[0].id}`,
        )
      ).status(),
    ).toBe(404);
    await foreign.close();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(href("delivery"));
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
    await expect(
      page.getByText("LOCAL-TRACKING-1", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: "test-results/approved-delivery-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await sql`DELETE FROM customer_projects WHERE customer_account_id IN (${account},${other})`;
    await sql`DELETE FROM gyvft_customer_accounts WHERE id IN (${account},${other})`;
    await sql.end();
  }
});
