import { test, expect } from "@playwright/test";
const customers = [
  {
    shopifyCustomerId: "gid://shopify/Customer/42",
    email: "first@example.test",
    name: "First customer",
  },
  {
    shopifyCustomerId: "gid://shopify/Customer/43",
    email: "second@example.test",
    name: "Second customer",
  },
];
for (const width of [390, 1440])
  test(`customer test review and retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let secondAttempt = 0;
    const applied: string[] = [];
    await page.route("**/api/operations/customer-pilot", async (route) => {
      const body = route.request().postDataJSON();
      expect(route.request().headers()["x-setup-secret"]).toBe(
        "local-fictional-secret",
      );
      if (body.op === "status")
        return route.fulfill({
          json: {
            ok: true,
            result: {
              enabled: false,
              collection: "gid://shopify/Collection/1",
            },
          },
        });
      if (body.op === "preview")
        return route.fulfill({
          json: {
            ok: true,
            result: {
              id: body.customer.shopifyCustomerId.endsWith("42")
                ? "11111111-1111-4111-8111-111111111111"
                : "22222222-2222-4222-8222-222222222222",
              fingerprint: "a".repeat(64),
              customer: body.customer,
              account: "create",
              orders: 2,
              points: 20,
              pendingPoints: 5,
              review: [
                {
                  id: "gid://shopify/Order/1",
                  reason: "Retail classification needs review",
                },
              ],
              excluded: 0,
              enabled: false,
            },
          },
        });
      applied.push(body.customer.email);
      if (
        body.customer.email === "second@example.test" &&
        secondAttempt++ === 0
      )
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            message: "Fictional lost response: retry the same apply.",
          },
        });
      return route.fulfill({
        json: {
          ok: true,
          result: { createdAccount: true, points: 20, alreadyApplied: false },
        },
      });
    });
    await page.goto("/setup/customer-pilot");
    await page
      .getByLabel("Operations setup secret")
      .fill("local-fictional-secret");
    await page.getByLabel("Selected customers JSON").setInputFiles({
      name: "fictional.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(customers)),
    });
    await page
      .getByRole("button", {
        name: "Check selected customers · no changes saved",
      })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Check passed. Each test transaction was rolled back",
    );
    await expect(
      page.getByRole("button", { name: "Apply reviewed customers & rewards" }),
    ).toBeDisabled();
    await expect(page.locator("caption")).toContainText(
      "40 proposed available points",
    );
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Apply reviewed customers & rewards" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Fictional lost response",
    );
    await page
      .getByRole("button", { name: "Apply reviewed customers & rewards" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Selected customers saved",
    );
    expect(applied).toEqual([
      "first@example.test",
      "second@example.test",
      "second@example.test",
    ]);
    await expect(
      page.getByRole("button", { name: "Apply reviewed customers & rewards" }),
    ).toBeDisabled();
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test("real unauthenticated production-build endpoint rejects writes", async ({
  request,
}) => {
  const response = await request.post("/api/operations/customer-pilot", {
    data: { op: "status" },
  });
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});
