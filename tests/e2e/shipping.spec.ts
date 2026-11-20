import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import postgres from "postgres";
const enabled = process.env.GYVFT_SHIPPING_BROWSER === "1",
  secret = process.env.PLAYWRIGHT_OPERATOR_SECRET;
test.skip(
  !enabled || !secret,
  "Disposable local simulated-courier fixture only",
);
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("Operations configures encrypted keys, books and tracks a split, and the customer sees the same deliveries", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  const fixture = JSON.parse(
    readFileSync("work/shipping-browser-fixture.json", "utf8"),
  );
  expect(new URL(fixture.databaseURL).pathname).toMatch(
    /^\/gyvft_shipping_browser_/,
  );
  const sql = postgres(fixture.databaseURL, { max: 1, prepare: false });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
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
    const settings = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: "Delhivery connection",
          exact: true,
        }),
      })
      .last();
    await expect(
      settings.getByRole("combobox", { name: "Environment", exact: true }),
    ).toBeVisible();
    await settings
      .getByRole("combobox", { name: "Environment", exact: true })
      .selectOption("production");
    await settings
      .getByLabel("Delhivery API key", { exact: true })
      .fill("local-browser-delhivery-token");
    await settings
      .getByLabel("Exact Delhivery client name", { exact: true })
      .fill("Shipping browser");
    await settings
      .getByLabel("Registered pickup warehouse name", { exact: true })
      .fill("Fixture warehouse");
    await settings
      .getByLabel("Pickup PIN code", { exact: true })
      .fill("600034");
    await settings
      .getByLabel("Seller name", { exact: true })
      .fill("Fixture seller");
    await settings
      .getByLabel("Seller GSTIN registered with Delhivery", { exact: true })
      .fill("33ABCDE1234F1Z5");
    await settings.getByLabel(/I confirmed the registered warehouse/).check();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/operations/requests") &&
        r.request().postDataJSON()?.op === "shipping_settings_save",
    );
    await settings
      .getByRole("button", { name: "Save Delhivery settings", exact: true })
      .click();
    const payload = await (await saved).json();
    expect(JSON.stringify(payload)).not.toMatch(
      /local-browser-delhivery-token|ciphertext|auth_tag/,
    );
    await expect(settings.getByText(/Delhivery settings saved/)).toBeVisible();
    await expect(
      settings.getByLabel("Delhivery API key", { exact: true }),
    ).toHaveValue("");
    await settings
      .getByRole("button", { name: "Test saved API connection", exact: true })
      .click();
    await expect(settings.getByText(/API token accepted/)).toBeVisible();
    await page.screenshot({
      path: "work/shipping-settings-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "work/shipping-settings-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/operations/requests?request=${fixture.projectId}`);
    await page.getByLabel("Operator secret", { exact: true }).fill(secret!);
    await page
      .getByRole("button", { name: "Open customer desk", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Shipping browser gift", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Order & delivery", exact: true })
      .click();
    const shipping = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: "Shipments & collection",
          exact: true,
        }),
      })
      .last();
    await expect(
      shipping.getByRole("button", {
        name: "Confirm delivery plan",
        exact: true,
      }),
    ).toBeVisible();
    await shipping
      .getByLabel("Confirmed gift sets in this order", { exact: true })
      .fill("100");
    await shipping.getByLabel(/I checked this count/).check();
    await shipping
      .getByRole("button", { name: "Confirm delivery plan", exact: true })
      .click();
    await expect(
      shipping.getByText("Allocate 100 more gift sets.", { exact: false }),
    ).toBeVisible();
    const editor = shipping.locator("details").filter({
      has: page.getByText("Add a parcel or store collection", {
        exact: true,
      }),
    });
    for (const [label, count] of [
      ["Chennai office", 60],
      ["Family parcels", 40],
    ] as const) {
      if (!(await editor.evaluate((el) => (el as HTMLDetailsElement).open)))
        await editor.locator("summary").click();
      await editor.getByLabel("Destination label", { exact: true }).fill(label);
      await editor
        .getByLabel("Gift sets in this parcel / collection", { exact: true })
        .fill(String(count));
      await editor
        .getByLabel("Recipient or collection contact", { exact: true })
        .fill("Test recipient");
      await editor
        .getByLabel("Delivery contact phone", { exact: true })
        .fill("9876543210");
      await editor
        .getByLabel("Address (may be confirmed later)", { exact: true })
        .fill("10 Example Road");
      await editor.getByLabel("City", { exact: true }).fill("Chennai");
      await editor.getByLabel("State", { exact: true }).fill("Tamil Nadu");
      await editor.getByLabel("PIN code", { exact: true }).fill("600034");
      await editor
        .getByRole("button", { name: "Add to delivery plan", exact: true })
        .click();
      await expect(
        shipping.getByRole("heading", {
          name: `${label} · ${count} sets`,
          exact: true,
        }),
      ).toBeVisible();
    }
    let manifests = 0;
    page.on("request", (r) => {
      if (
        r.url().endsWith("/api/operations/requests") &&
        r.postDataJSON()?.op === "shipping_book"
      )
        manifests++;
    });
    for (const [label, count] of [
      ["Chennai office", 60],
      ["Family parcels", 40],
    ] as const) {
      const card = shipping.locator("article").filter({
        has: page.getByRole("heading", {
          name: `${label} · ${count} sets`,
          exact: true,
        }),
      });
      await card.locator("summary").click();
      for (const [name, value] of [
        ["Packed weight (grams)", "1000"],
        ["Length (cm)", "20"],
        ["Width (cm)", "15"],
        ["Height (cm)", "10"],
        ["This parcel's invoice value (₹)", "400"],
        ["Contents description", "Custom gifts"],
        ["Invoice HSN code(s), comma separated", "4911"],
        ["Invoice reference", "LOCAL-INV"],
      ])
        await card.getByLabel(name, { exact: true }).fill(value);
      await card
        .getByLabel(/I checked the address, invoice and parcel details/)
        .check();
      const button = card.getByRole("button", {
        name: "Book live Delhivery parcel",
        exact: true,
      });
      await button.click();
      await expect(button).toBeDisabled();
      await expect(card.getByText(/Booked · awaiting pickup/)).toBeVisible();
    }
    expect(manifests).toBe(2);
    const pickup = shipping.locator("details").filter({
      has: page.getByText("Request one warehouse pickup for 2 booked parcels", {
        exact: true,
      }),
    });
    await pickup.locator("summary").click();
    await pickup
      .getByLabel("Pickup date (India time)", { exact: true })
      .fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    await pickup
      .getByLabel("Pickup time (India time)", { exact: true })
      .fill("12:00");
    await pickup.getByLabel(/These parcels are packed/).check();
    await pickup
      .getByRole("button", { name: "Request warehouse pickup", exact: true })
      .click();
    await expect(
      shipping.getByText(/Warehouse pickup requested/),
    ).toBeVisible();
    const first = shipping.locator("article").first();
    await first
      .getByRole("button", { name: "Refresh carrier tracking", exact: true })
      .click();
    await expect(
      shipping.getByText(/60\/100 delivered or collected/),
    ).toBeVisible();
    expect(
      (
        await sql`SELECT stage FROM customer_projects WHERE id=${fixture.projectId}`
      )[0].stage,
    ).toBe(8);
    await shipping
      .locator("article")
      .nth(1)
      .getByRole("button", { name: "Refresh carrier tracking", exact: true })
      .click();
    await expect(
      shipping.getByText(/100\/100 delivered or collected/),
    ).toBeVisible();
    expect(
      (
        await sql`SELECT stage FROM customer_projects WHERE id=${fixture.projectId}`
      )[0].stage,
    ).toBe(10);
    await page.screenshot({
      path: "work/shipping-operations-desktop.png",
      fullPage: true,
    });
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
    await page.goto(`/account/projects/${fixture.projectId}?view=delivery`);
    await expect(
      page.getByRole("heading", { name: "Your deliveries", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/100 of 100 gift sets delivered or collected/),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Delivery address", exact: true }),
    ).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toContain(
      "local-browser-delhivery-token",
    );
    await page.screenshot({
      path: "work/shipping-customer-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "work/shipping-customer-mobile.png",
      fullPage: true,
    });
    const outsider = await page.request.get(
      `/api/customer/shipments?project_id=11111111-1111-4111-8111-111111111111`,
    );
    expect(outsider.status()).toBe(409);
    expect(errors).toEqual([]);
  } finally {
    await sql.end();
  }
});

test("Porter and store collection have manual controls with no courier API call", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  const fixture = JSON.parse(
    readFileSync("work/shipping-browser-fixture.json", "utf8"),
  );
  const sql = postgres(fixture.databaseURL, { max: 1, prepare: false });
  const id = crypto.randomUUID(),
    porter = crypto.randomUUID(),
    pickup = crypto.randomUUID();
  try {
    await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,kind,stage,total_paise,paid_paise,shopify_order_reference) VALUES(${id},${fixture.accountId},'shipping-browser@example.test','Manual shipping gift','project',8,100000,100000,'#MANUAL-LOCAL')`;
    await sql`INSERT INTO customer_project_approvals(project_id,kind,version,title,description,status) VALUES(${id},'design',1,'Proof','Approved artwork','approved')`;
    const command = async (body: Record<string, unknown>) => {
      const r = await page.request.post("/api/operations/requests", {
        headers: { "x-setup-secret": secret! },
        data: body,
      });
      expect(r.ok()).toBe(true);
      return r.json();
    };
    await command({
      op: "shipping_plan",
      project_id: id,
      expected_sets: 100,
      expected_version: 0,
      confirmed_manifest: true,
      request_id: crypto.randomUUID(),
    });
    for (const [shipmentId, method, sets, label] of [
      [porter, "porter", 60, "Porter office"],
      [pickup, "pickup", 40, "Store collection"],
    ] as const)
      await command({
        op: "shipping_save",
        project_id: id,
        id: shipmentId,
        method,
        gift_sets: sets,
        label,
        recipient_name: "Test contact",
        phone: "9876543210",
        address: "10 Example Road",
        city: "Chennai",
        state: "Tamil Nadu",
        postal_code: "600034",
        expected_version: 0,
        request_id: crypto.randomUUID(),
      });
    const callsBefore = readFileSync(
      "work/shipping-browser-calls.jsonl",
      "utf8",
    )
      .trim()
      .split("\n").length;
    await page.goto(`/operations/requests?request=${id}`);
    await page.getByLabel("Operator secret", { exact: true }).fill(secret!);
    await page
      .getByRole("button", { name: "Open customer desk", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Manual shipping gift", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Order & delivery", exact: true })
      .click();
    const shipping = page
      .getByRole("heading", { name: "Shipments & collection", exact: true })
      .locator("..");
    const card = (label: string) =>
      shipping
        .locator("article")
        .filter({
          has: page.getByRole("heading", { name: label, exact: true }),
        });
    const porterCard = card("Porter office · 60 sets"),
      pickupCard = card("Store collection · 40 sets");
    await porterCard
      .getByLabel("Courier booking/tracking reference", { exact: true })
      .fill("PORTER-LOCAL-60");
    await porterCard.getByLabel(/I verified this actual shipment/).check();
    await porterCard
      .getByRole("button", { name: "Record verified status", exact: true })
      .click();
    await expect(
      porterCard.getByText("Porter · In transit", { exact: true }),
    ).toBeVisible();
    await porterCard
      .getByRole("combobox", { name: "Actual status", exact: true })
      .selectOption("delivered");
    await porterCard
      .getByRole("button", { name: "Record verified status", exact: true })
      .click();
    await expect(
      shipping.getByText(/60\/100 delivered or collected/),
    ).toBeVisible();
    await pickupCard.getByLabel(/I verified this actual shipment/).check();
    await pickupCard
      .getByRole("button", { name: "Record verified status", exact: true })
      .click();
    await expect(
      pickupCard.getByText("Store pickup · Ready for collection", {
        exact: true,
      }),
    ).toBeVisible();
    await pickupCard
      .getByRole("combobox", { name: "Actual status", exact: true })
      .selectOption("collected");
    await pickupCard
      .getByRole("button", { name: "Record verified status", exact: true })
      .click();
    await expect(
      shipping.getByText(/100\/100 delivered or collected/),
    ).toBeVisible();
    const callsAfter = readFileSync("work/shipping-browser-calls.jsonl", "utf8")
      .trim()
      .split("\n").length;
    expect(callsAfter).toBe(callsBefore);
    expect(
      (await sql`SELECT stage FROM customer_projects WHERE id=${id}`)[0].stage,
    ).toBe(10);
  } finally {
    await sql.end();
  }
});
