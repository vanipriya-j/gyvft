import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// Opt in only with the dedicated local fixture server documented in CUSTOMER-PORTAL.md.
const database = process.env.PLAYWRIGHT_WORKFLOW_DB;
const secret = process.env.PLAYWRIGHT_OPERATOR_SECRET;
test.skip(
  !database || !secret,
  "Supply the disposable database and local operator secret.",
);
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("customer and team complete the same gift, including verified Shopify payments", async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(180000);
  const host = new URL(baseURL!);
  expect(["localhost", "127.0.0.1"]).toContain(host.hostname);
  expect(["localhost", "127.0.0.1"]).toContain(new URL(database!).hostname);
  // Refuse Shopify writes unless the live local process loaded our blocking mock.
  const fixture = JSON.parse(
    readFileSync("work/gift-flow-fixture.json", "utf8"),
  );
  expect(fixture.origin).toBe(host.origin);
  const databaseUrl = new URL(database!);
  expect(fixture.database).toBe(`${databaseUrl.host}${databaseUrl.pathname}`);
  process.kill(fixture.pid, 0);
  const sql = postgres(database!, { max: 1, prepare: false });
  const account = randomUUID(),
    other = randomUUID(),
    id = randomUUID(),
    foreign = randomUUID(),
    token = randomBytes(32).toString("base64url");
  const title = "A thank-you for the family";
  const photo = readFileSync(
    "public/images/gyvft/case-studies/various-dance-schools/hero.png",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const admin = await context.newPage();
  admin.on("pageerror", (e) => errors.push(e.message));
  const href = (view = "overview") =>
    `/account/projects/${id}${view === "overview" ? "" : `?view=${view}`}`;
  const op = async (data: Record<string, unknown>, status = 200) => {
    const response = await context.request.post("/api/operations/requests", {
      headers: { "x-setup-secret": secret! },
      data: { id, request_id: randomUUID(), ...data },
    });
    expect(response.status(), `Operation ${data.op}`).toBe(status);
    return response.json();
  };
  const desk = (name: string) =>
    admin
      .getByRole("navigation", { name: "Manage request" })
      .getByRole("button", { name, exact: true });
  async function approve(name: string, decision = "approved", response = "") {
    await page.goto(href("quote"));
    const article = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await article.locator('[name="decision"]').selectOption(decision);
    if (response) await article.locator('[name="response"]').fill(response);
    await article
      .getByRole("button", { name: "Send decision", exact: true })
      .click();
    await expect(
      article.getByText(
        decision === "approved"
          ? "Approved"
          : `Changes requested — ${response}`,
        { exact: true },
      ),
    ).toBeVisible();
  }
  try {
    await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${account},${account + "@example.test"},'LOCAL_TEST_ONLY'),(${other},${other + "@example.test"},'LOCAL_TEST_ONLY')`;
    await sql`INSERT INTO gyvft_customer_sessions(token_hash,account_id,expires_at) VALUES(${createHash("sha256").update(token).digest("hex")},${account},now()+interval '1 day')`;
    await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,brief) VALUES(${id},${account},${account + "@example.test"},${title},'Useful keepsakes for 10 family members, with a personal note and a shared design.'),(${foreign},${other},${other + "@example.test"},'Private gift','Private brief')`;
    await context.addCookies([
      {
        name: "gyvft_customer_session",
        value: token,
        domain: host.hostname,
        path: "/",
      },
    ]);
    await admin.goto(`/operations/requests?request=${id}`);
    await admin.getByLabel("Operator secret", { exact: true }).fill(secret!);
    await admin
      .getByRole("button", { name: "Open customer desk", exact: true })
      .click();
    await expect(
      admin.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      admin.getByRole("button", {
        name: "Convert approved quote to B2C order",
        exact: true,
      }),
    ).toBeDisabled();
    await desk("Gift options").click();
    const options = admin.locator("#desk-options");
    const form = options.locator("form").first();
    await form.locator('[name="title"]').fill("Option A — Family keepsakes");
    await form
      .locator('[name="description"]')
      .fill("A curated hamper; final artwork follows your choice.");
    await form.locator('[name="image"]').setInputFiles({
      name: "hamper.png",
      mimeType: "image/png",
      buffer: photo,
    });
    await form
      .getByLabel("Product / item", { exact: true })
      .fill("Personalised keepsake");
    await form
      .getByRole("combobox", { name: "Price display", exact: true })
      .selectOption("range");
    await form.locator('[name="low"]').fill("450");
    await form.locator('[name="high"]').fill("550");
    await form.locator('[name="quantity"]').fill("10");
    await form
      .getByRole("button", { name: "Publish gift option", exact: true })
      .click();
    await expect(
      options.getByRole("heading", {
        name: "Option A — Family keepsakes",
        exact: true,
      }),
    ).toBeVisible();
    await op({
      op: "reply",
      body: "We’ve put together a direction for your family. You can customise it before requesting a quote.",
    });
    await page.goto(href());
    await expect(
      page.getByText("Options ready", { exact: true }),
    ).toBeVisible();
    const visual = page.getByRole("img", {
      name: "Option A — Family keepsakes",
      exact: true,
    });
    await expect
      .poll(() => visual.evaluate((i: HTMLImageElement) => i.naturalWidth))
      .toBeGreaterThan(0);
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.screenshot({
      path: testInfo.outputPath("customer-gift-desktop.png"),
      fullPage: true,
    });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await expect(
        page.getByRole("link", { name: "Review your options →", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`customer-gift-mobile-${width}.png`),
        fullPage: true,
      });
    }
    await page
      .getByRole("link", { name: "Review your options →", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Make my own from A", exact: true })
      .click();
    await page.getByLabel("Number of recipients", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Save now", exact: true }).click();
    await expect(page.getByText("Saving…", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "4. Review", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Select this option & request quote",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Selected for quote · awaiting GYVFT", { exact: true }),
    ).toBeVisible();
    await admin
      .getByRole("button", { name: "Refresh desk", exact: true })
      .click();
    await admin.getByRole("button").filter({ hasText: title }).first().click();
    await desk("Gift options").click();
    await admin
      .getByRole("button", { name: "Use this selection in quote", exact: true })
      .first()
      .click();
    const quote = admin.locator("#desk-quote");
    await quote.locator('[name="title"]').fill("Family gift quote");
    await quote
      .locator('[name="description"]')
      .fill(
        "Ten keepsakes with standard printing, applicable taxes, packaging and delivery included in these agreed line items.",
      );
    await quote.getByLabel("Unit price (₹)", { exact: true }).fill("500");
    await quote
      .getByRole("button", { name: "Publish for approval", exact: true })
      .click();
    await expect(
      quote.getByText("Family gift quote", { exact: true }),
    ).toBeVisible();
    await op({ op: "convert" }, 409);
    await approve("Family gift quote");
    await admin
      .getByRole("button", { name: "Refresh desk", exact: true })
      .click();
    await admin.getByRole("button").filter({ hasText: title }).first().click();
    await admin
      .getByRole("button", {
        name: "Convert approved quote to B2C order",
        exact: true,
      })
      .click();
    await expect(admin.getByText("Advance due", { exact: true })).toBeVisible();
    await op({
      op: "instructions",
      upi_id: "localfixture@upi",
      razorpay_url: "",
      shopify_order_reference: "",
    });
    await page.goto(href("details"));
    for (const [label, value] of [
      ["Recipient name", "Fixture Friend"],
      ["Phone", "9876543210"],
      ["Full delivery address", "12 Fixture Road"],
      ["City", "Chennai"],
      ["State", "Tamil Nadu"],
      ["PIN code", "600001"],
    ])
      await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel("Occasion date", { exact: true }).fill("2026-12-14");
    await page
      .getByLabel("Requested delivery date", { exact: true })
      .fill("2026-12-12");
    await page.getByRole("button", { name: "Save dates", exact: true }).click();
    await expect(
      page.getByText("Your occasion and requested delivery dates are saved.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save delivery details", exact: true })
      .click();
    await expect(
      page.getByText(
        "Delivery details saved. The team will confirm fulfilment.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.goto(href("quote"));
    await page.getByLabel("Amount paid (₹)", { exact: true }).fill("2500");
    const reference = `LOCAL-ADVANCE-${randomUUID()}`;
    await page
      .getByLabel("UPI transaction reference", { exact: true })
      .fill(reference);
    await page
      .getByLabel("Transaction screenshot (PNG/JPEG/WebP, up to 2 MB)", {
        exact: true,
      })
      .setInputFiles({
        name: "receipt.png",
        mimeType: "image/png",
        buffer: photo,
      });
    await page
      .getByRole("button", { name: "Submit payment reference", exact: true })
      .click();
    await expect(
      page.getByText(
        "Payment screenshot and reference recorded. Allow up to 24 hours for verification.",
        { exact: true },
      ),
    ).toBeVisible();
    let detail = await op({ op: "detail" });
    expect(Number(detail.project.paid_paise)).toBe(0);
    await op({ op: "progress", stage: 7, next_action: "Production" }, 409);
    await op({ op: "payment", reference }, 409);
    await admin
      .getByRole("button", { name: "Refresh desk", exact: true })
      .click();
    await admin.getByRole("button").filter({ hasText: title }).first().click();
    await desk("Payments (1 pending)").click();
    const verification = admin.locator("#desk-payments");
    await verification
      .getByLabel("Reference to verify", { exact: true })
      .fill(reference);
    await verification
      .getByLabel(
        "I verified receipt and amount in the receiving bank/provider.",
        { exact: true },
      )
      .check();
    await verification
      .getByRole("button", { name: "Verify and credit receipt", exact: true })
      .click();
    await expect(
      verification.getByText("verified", { exact: true }),
    ).toBeVisible();
    await op({ op: "payment", reference, confirmed_receipt: true }, 409);
    await desk("Quote & design").click();
    await quote.locator('[name="kind"]').selectOption("design");
    await quote.locator('[name="title"]').fill("Family production design");
    await quote
      .locator('[name="description"]')
      .fill("Shared artwork and personal note for the set.");
    await quote.locator('[name="image"]').setInputFiles({
      name: "design.png",
      mimeType: "image/png",
      buffer: photo,
    });
    await quote
      .getByRole("button", { name: "Publish for approval", exact: true })
      .click();
    await expect(
      quote.getByText("Family production design", { exact: true }),
    ).toBeVisible();
    await approve(
      "Family production design",
      "changes_requested",
      "Please enlarge the names.",
    );
    await op({ op: "progress", stage: 7, next_action: "Production" }, 409);
    await op({
      op: "publish",
      kind: "design",
      title: "Revised family design",
      description: "Larger names as requested.",
      image: { data: photo.toString("base64"), mime: "image/png" },
    });
    await approve("Revised family design");
    // Shopify writes require the dedicated preload: the operator list must report its mock connection.
    expect((await op({ op: "list" })).shopifyConfigured).toBe(true);
    await admin
      .getByRole("button", { name: "Refresh desk", exact: true })
      .click();
    await admin.getByRole("button").filter({ hasText: title }).first().click();
    await desk("Fulfilment").click();
    admin.once("dialog", (dialog) => dialog.accept());
    await admin
      .getByRole("button", { name: "Create Shopify order", exact: true })
      .click();
    await expect(admin.getByText(/Shopify order: #LOCAL-/)).toBeVisible();
    detail = await op({ op: "detail" });
    const linkedOrder = detail.project.shopify_order_id;
    expect(detail.project.shopify_order_reference).toMatch(/^#LOCAL-/);
    await op({ op: "shopify_order", confirm_order: true });
    expect((await op({ op: "detail" })).project.shopify_order_id).toBe(
      linkedOrder,
    );
    const advance = Number(detail.project.paid_paise);
    expect(advance).toBe(250000);
    await op({
      op: "progress",
      stage: 7,
      next_action: "Your approved gifts are being made.",
    });
    await op({
      op: "progress",
      stage: 8,
      next_action: "Checked and packed; balance payment is due.",
    });
    await op(
      {
        op: "progress",
        stage: 9,
        next_action: "Dispatched",
        tracking_reference: "LOCAL-AWB",
      },
      409,
    );
    await op({
      op: "payment",
      reference: `LOCAL-BALANCE-${randomUUID()}`,
      amount_paise: 250000,
      confirmed_receipt: true,
    });
    await op({ op: "shopify_order", confirm_order: true });
    await op({ op: "shopify_order", confirm_order: true });
    detail = await op({ op: "detail" });
    expect(detail.project.shopify_order_id).toBe(linkedOrder);
    expect(Number(detail.project.paid_paise)).toBe(500000);
    await op({
      op: "progress",
      stage: 9,
      next_action: "Your gifts are on the way.",
      tracking_reference: "LOCAL-AWB",
      tracking_url: "https://example.com/track",
    });
    await page.goto(href("details"));
    await expect(page.getByText("LOCAL-AWB", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save delivery details", exact: true }),
    ).toHaveCount(0);
    await op({
      op: "progress",
      stage: 10,
      next_action: "Delivered. Enjoy your gifts.",
    });
    await page.goto(href());
    await expect(page.getByText("Delivered", { exact: true })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Gift workspace" })
      .getByRole("link", { name: "Messages", exact: true })
      .click();
    await page
      .getByLabel("Your message", { exact: true })
      .fill("Thank you, the gifts have arrived.");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      page.getByText("Your message has been saved.", { exact: true }),
    ).toBeVisible();
    await admin
      .getByRole("button", { name: "Refresh desk", exact: true })
      .click();
    await admin.getByRole("button").filter({ hasText: title }).first().click();
    await desk("Messages").click();
    await expect(
      admin.getByText("Thank you, the gifts have arrived.", { exact: true }),
    ).toBeVisible();
    await admin.screenshot({
      path: testInfo.outputPath("operations-gift-desktop.png"),
      fullPage: true,
    });
    await page.goto(`/account/projects/${foreign}`);
    await expect(
      page.getByRole("heading", { name: "Private gift", exact: true }),
    ).toHaveCount(0);
    const anonymous = await browser.newContext();
    const asset = await anonymous.request.get(
      `${baseURL}/api/customer-assets/approval/${detail.approvals[0].id}`,
    );
    expect(asset.status()).toBe(404);
    await anonymous.close();
    expect(errors).toEqual([]);
  } finally {
    await sql`DELETE FROM customer_projects WHERE id IN (${id},${foreign})`;
    await sql`DELETE FROM gyvft_customer_accounts WHERE id IN (${account},${other})`;
    await sql.end();
  }
});
