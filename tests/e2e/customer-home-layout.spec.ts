import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
/** Supply fictional, locally seeded sessions; never use production customer cookies. */
const path = process.env.PLAYWRIGHT_HOME_FIXTURES;
test.skip(
  !path,
  "Set PLAYWRIGHT_HOME_FIXTURES to local sample/empty/populated/long-title session fixtures.",
);
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
type Fixture = { token: string };
for (const state of ["sample-empty", "empty", "populated", "long"]) {
  for (const width of [1024, 1366]) {
    test(`${state}: shared card edges at ${width}px`, async ({
      page,
      context,
      baseURL,
    }) => {
      const url = new URL(baseURL!);
      expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
      const fixtures = JSON.parse(readFileSync(path!, "utf8")) as Record<
        string,
        Fixture
      >;
      await context.addCookies([
        {
          name: "gyvft_customer_session",
          value: fixtures[state].token,
          domain: url.hostname,
          path: "/",
        },
      ]);
      if (process.env.PLAYWRIGHT_HOME_IMAGE)
        await page.route(
          (url) =>
            url.pathname === "/_next/image" &&
            String(url.searchParams.get("url")).startsWith(
              "https://cdn.shopify.com/",
            ),
          (route) =>
            route.fulfill({
              path: process.env.PLAYWRIGHT_HOME_IMAGE!,
              contentType: "image/jpeg",
            }),
        );
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/account");
      const rails = page.locator(
        'section[aria-label="Gifts taking shape"],section[aria-label="Upcoming occasions"],section[aria-label="Coming up at Aarla"]',
      );
      await expect(rails).toHaveCount(3);
      const cards = rails.locator("article");
      await expect(cards).toHaveCount(3);
      const boxes = await cards.evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height };
        }),
      );
      expect(
        Math.max(...boxes.map((b) => b.top)) -
          Math.min(...boxes.map((b) => b.top)),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.max(...boxes.map((b) => b.bottom)) -
          Math.min(...boxes.map((b) => b.bottom)),
      ).toBeLessThanOrEqual(1);
      if (state === "sample-empty") {
        expect(Math.max(...boxes.map((b) => b.height))).toBeLessThan(360);
        const note = page.getByText(
          "Sample request · no payment or order will be created.",
          { exact: true },
        );
        await expect(note).toBeVisible();
        const n = await note.boundingBox();
        expect(n!.y).toBeGreaterThanOrEqual(boxes[0].bottom);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      if (state === "long")
        for (const card of await cards.all()) {
          expect(
            await card.evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
          ).toBe(true);
        }
      await page.screenshot({
        path: `work/home-aligned-${state}-${width}.png`,
        fullPage: true,
      });
    });
  }
}
test("personal occasion invitation opens its form directly on mobile", async ({
  page,
  context,
  baseURL,
}) => {
  const url = new URL(baseURL!);
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  const fixtures = JSON.parse(readFileSync(path!, "utf8")) as Record<
    string,
    Fixture
  >;
  await context.addCookies([
    {
      name: "gyvft_customer_session",
      value: fixtures["sample-empty"].token,
      domain: url.hostname,
      path: "/",
    },
  ]);
  if (process.env.PLAYWRIGHT_HOME_IMAGE)
    await page.route(
      (url) =>
        url.pathname === "/_next/image" &&
        String(url.searchParams.get("url")).startsWith(
          "https://cdn.shopify.com/",
        ),
      (route) =>
        route.fulfill({
          path: process.env.PLAYWRIGHT_HOME_IMAGE!,
          contentType: "image/jpeg",
        }),
    );
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Whose special day is coming up?" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: `work/home-aligned-sample-empty-mobile-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("link", { name: "Add a special day →", exact: true })
    .click();
  await expect(page).toHaveURL(/view=occasions&add=1/);
  await expect(page.getByLabel("Occasion name", { exact: true })).toBeVisible();
});

test("larger text can expand the shared card row without clipping", async ({
  page,
  context,
  baseURL,
}) => {
  const url = new URL(baseURL!);
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  const fixtures = JSON.parse(readFileSync(path!, "utf8")) as Record<
    string,
    Fixture
  >;
  await context.addCookies([
    {
      name: "gyvft_customer_session",
      value: fixtures.long.token,
      domain: url.hostname,
      path: "/",
    },
  ]);
  if (process.env.PLAYWRIGHT_HOME_IMAGE)
    await page.route(
      (url) =>
        url.pathname === "/_next/image" &&
        String(url.searchParams.get("url")).startsWith(
          "https://cdn.shopify.com/",
        ),
      (route) =>
        route.fulfill({
          path: process.env.PLAYWRIGHT_HOME_IMAGE!,
          contentType: "image/jpeg",
        }),
    );
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/account");
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  const cards = page.locator(
    'section[aria-label="Gifts taking shape"] article,section[aria-label="Upcoming occasions"] article,section[aria-label="Coming up at Aarla"] article',
  );
  const boxes = await cards.evaluateAll((nodes) =>
    nodes.map((n) => ({
      bottom: n.getBoundingClientRect().bottom,
      clipped: n.scrollHeight > n.clientHeight + 1,
    })),
  );
  expect(
    Math.max(...boxes.map((b) => b.bottom)) -
      Math.min(...boxes.map((b) => b.bottom)),
  ).toBeLessThanOrEqual(1);
  expect(boxes.every((b) => !b.clipped)).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("placeholder and catalogue images fill their frames without stretching", async ({
  page,
  context,
  baseURL,
}) => {
  const url = new URL(baseURL!);
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  const fixtures = JSON.parse(readFileSync(path!, "utf8")) as Record<
    string,
    Fixture
  >;
  await context.addCookies([
    {
      name: "gyvft_customer_session",
      value: fixtures["sample-empty"].token,
      domain: url.hostname,
      path: "/",
    },
  ]);
  if (process.env.PLAYWRIGHT_HOME_IMAGE)
    await page.route(
      (url) =>
        url.pathname === "/_next/image" &&
        String(url.searchParams.get("url")).startsWith(
          "https://cdn.shopify.com/",
        ),
      (route) =>
        route.fulfill({
          path: process.env.PLAYWRIGHT_HOME_IMAGE!,
          contentType: "image/jpeg",
        }),
    );
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/account");
    const frames = page.locator(
      'section[aria-label="Gifts taking shape"] article [data-placeholder-kind],section[aria-label="Upcoming occasions"] article [data-placeholder-kind]',
    );
    await expect(frames).toHaveCount(2);
    const images = frames.locator("img");
    await expect
      .poll(() =>
        images.evaluateAll((nodes) =>
          nodes.every(
            (n) =>
              n instanceof HTMLImageElement && n.complete && n.naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);
    for (const image of await images.all()) {
      expect(await image.evaluate((e) => getComputedStyle(e).objectFit)).toBe(
        "cover",
      );
      expect(
        await image.evaluate((e) => {
          const a = e.getBoundingClientRect(),
            b = e.parentElement!.getBoundingClientRect();
          return (
            Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1
          );
        }),
      ).toBe(true);
    }
    const product = page
      .locator('section[aria-label="Coming up at Aarla"] article img')
      .first();
    await expect
      .poll(() =>
        product.evaluate(
          (e) =>
            e instanceof HTMLImageElement && e.complete && e.naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(await product.evaluate((e) => getComputedStyle(e).objectFit)).toBe(
      "cover",
    );
    expect(
      await product.evaluate((e) => {
        const a = e.getBoundingClientRect(),
          b = e.parentElement!.getBoundingClientRect();
        return (
          Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1
        );
      }),
    ).toBe(true);
  }
});

test("customer preview wins over inspiration and a failed preview receives an image fallback", async ({
  page,
  context,
  baseURL,
}) => {
  const url = new URL(baseURL!);
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  const fixtures = JSON.parse(readFileSync(path!, "utf8")) as Record<
    string,
    Fixture
  >;
  await context.addCookies([
    {
      name: "gyvft_customer_session",
      value: fixtures.populated.token,
      domain: url.hostname,
      path: "/",
    },
  ]);
  if (process.env.PLAYWRIGHT_HOME_IMAGE)
    await page.route(
      (url) =>
        url.pathname === "/_next/image" &&
        String(url.searchParams.get("url")).startsWith(
          "https://cdn.shopify.com/",
        ),
      (route) =>
        route.fulfill({
          path: process.env.PLAYWRIGHT_HOME_IMAGE!,
          contentType: "image/jpeg",
        }),
    );
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/account");
  const gift = page.getByRole("region", {
    name: "Gifts taking shape",
    exact: true,
  });
  await expect(gift.locator("article img")).toHaveAttribute(
    "src",
    /^\/api\/customer-assets\//,
  );
  await page.route("**/api/customer-assets/gift-option/**", (route) =>
    route.abort(),
  );
  await page.reload();
  await expect(gift.locator('[data-placeholder-kind="gift"]')).toBeVisible();
  await expect(
    gift.getByText("Image unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    gift.getByRole("link", { name: "Review options →", exact: true }),
  ).toBeVisible();
});
