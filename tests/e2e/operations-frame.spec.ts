import { test, expect } from "@playwright/test";
const secret = process.env.PLAYWRIGHT_OPERATOR_SECRET;
test.skip(!secret, "Local operator fixture required.");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("Operations toolbar, navigation and headings stay fixed during delayed area transitions", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(150000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  await context.setExtraHTTPHeaders({ "x-forwarded-for": "127.0.0.47" });
  let hold = false,
    release = () => {},
    gate = Promise.resolve();
  await page.route("**/api/operations**", async (route) => {
    if (hold) await gate;
    await route.continue().catch(() => {});
  });
  const evidence: {
    width: number;
    area: string;
    phase: string;
    maxMovement: number;
  }[] = [];
  async function geometry() {
    return page.evaluate(() => {
      const rect = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const title = document
        .querySelector(".ops-page-header h1")!
        .getBoundingClientRect();
      return {
        toolbar: rect(".ops-header"),
        actions: rect(".ops-header .app-actions"),
        navigation: rect(innerWidth > 760 ? ".ops-side" : ".app-mobile-ops"),
        content: rect(".app-nav-grid > section").x,
        heading: { x: title.x, y: title.y, height: title.height },
        pageHeader: rect(".ops-page-header"),
      };
    });
  }
  function stable(
    actual: Awaited<ReturnType<typeof geometry>>,
    baseline: Awaited<ReturnType<typeof geometry>>,
    label: string,
  ) {
    let delta = 0;
    for (const key of [
      "toolbar",
      "actions",
      "navigation",
      "heading",
      "pageHeader",
    ] as const) {
      for (const field of Object.keys(baseline[key]) as Array<
        keyof (typeof baseline)[typeof key]
      >) {
        const d = Math.abs(actual[key][field] - baseline[key][field]);
        delta = Math.max(delta, d);
        expect(d, `${label}: ${key}.${field}`).toBeLessThan(0.6);
      }
    }
    expect(
      Math.abs(actual.content - baseline.content),
      label + " content left edge",
    ).toBeLessThan(0.6);
    return delta;
  }
  try {
    for (const width of [1440, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(baseURL + "/operations");
      await page.getByLabel("Operator secret", { exact: true }).fill(secret!);
      await page
        .getByRole("button", { name: "Open customer desk", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Dashboard", exact: true }),
      ).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.evaluate(() => scrollTo(0, 0));
      const baseline = await geometry();
      for (const area of [
        "Requests & orders",
        "Customers",
        "Occasions",
        "Feedback & photos",
        "Reports & health",
        "Settings & connections",
        "Dashboard",
      ]) {
        gate = new Promise<void>((r) => {
          release = r;
        });
        hold = area !== "Settings & connections";
        if (width > 760)
          await page
            .getByRole("complementary", { name: "Operations areas" })
            .getByRole("button", { name: area, exact: true })
            .click();
        else
          await page
            .getByRole("combobox", { name: "Operations area", exact: true })
            .selectOption({ label: area });
        if (hold) {
          await expect(page.locator(".ops-progress")).toHaveAttribute(
            "data-active",
            "true",
          );
          evidence.push({
            width,
            area,
            phase: "pending",
            maxMovement: stable(
              await geometry(),
              baseline,
              `${width} ${area} loading`,
            ),
          });
          if (area === "Customers" && [1440, 390].includes(width))
            await page.screenshot({
              path: `/tmp/gyvft-operations-progress-${width}.png`,
              fullPage: true,
            });
        }
        hold = false;
        release();
        await expect(page.locator(".ops-progress")).toHaveAttribute(
          "data-active",
          "false",
        );
        await expect(page.locator(".ops-page-header h1")).toHaveText(area);
        evidence.push({
          width,
          area,
          phase: "loaded",
          maxMovement: stable(
            await geometry(),
            baseline,
            `${width} ${area} loaded`,
          ),
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
      }
    }
    gate = new Promise<void>((r) => {
      release = r;
    });
    hold = true;
    await page
      .getByRole("combobox", { name: "Operations area", exact: true })
      .selectOption({ label: "Customers" });
    await expect(page.locator(".ops-progress")).toHaveAttribute(
      "data-active",
      "true",
    );
    await page.getByRole("button", { name: "Lock desk", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Open customer desk", exact: true }),
    ).toBeEnabled();
    hold = false;
    release();
    const fs = await import("node:fs");
    fs.writeFileSync(
      "/tmp/gyvft-operations-frame-evidence.json",
      JSON.stringify(evidence, null, 2),
    );
  } finally {
    hold = false;
    release();
  }
});
