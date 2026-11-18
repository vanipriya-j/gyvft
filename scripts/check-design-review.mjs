import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium, expect } = require("@playwright/test");
const html = await readFile(
  new URL("../public/design-review.html", import.meta.url),
);
const srv = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
  res.end(html);
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox"],
});
const p = await b.newPage({
  viewport: { width: 390, height: 900 },
  isMobile: true,
  hasTouch: true,
});
p.setDefaultTimeout(7000);
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const f = p.frameLocator("iframe"),
  role = (x) => f.locator("[data-review-role]").selectOption(x),
  screen = async (x) => {
    await f.locator("[data-review-screen]").selectOption(x);
    if (await f.locator("[data-dialog][open]").count()) {
      if (await f.locator('[data-action="discard-workspace"]').count())
        await f.locator('[data-action="discard-workspace"]').click();
      else await f.locator('[data-action="close"]').click();
    }
    await expect(f.locator("[data-review-screen]")).toHaveValue(x);
  },
  a = (x) => f.locator(`[data-action="${x}"]`);
const file = {
  name: "gift-test.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII=",
    "base64",
  ),
};
async function controls(where) {
  const failures = await f.locator(where).evaluate((root) =>
    [
      ...root.querySelectorAll("button,a[href],input,select,textarea,summary"),
    ].flatMap((el) => {
      if (
        !el.getClientRects().length ||
        getComputedStyle(el).visibility === "hidden"
      )
        return [];
      let target = el;
      if (el.matches("input[type=checkbox],input[type=radio]"))
        target = el.closest("label") || el;
      const r = target.getBoundingClientRect();
      return r.width < 43.9 || r.height < 43.9
        ? [
            {
              control:
                el.getAttribute("aria-label") ||
                el.textContent.slice(0, 50) ||
                el.name,
              width: r.width,
              height: r.height,
            },
          ]
        : [];
    }),
  );
  expect(failures).toEqual([]);
}
try {
  await p.goto(`http://127.0.0.1:${srv.address().port}`);
  for (const width of [320, 390, 760]) {
    await p.setViewportSize({ width, height: 900 });
    for (const who of ["customer", "ops"]) {
      await role(who);
      const ids = await f
        .locator("[data-review-screen] option")
        .evaluateAll((xs) => xs.map((x) => x.value));
      for (const id of ids) {
        await screen(id);
        await controls("#gyvft-journeys");
        const frame = p.frames().find((x) => x.parentFrame());
        expect(
          await frame.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `Overflow ${width} ${id}`,
        ).toBeTruthy();
      }
    }
  }
  await p.setViewportSize({ width: 390, height: 900 });
  await role("customer");
  await a("review-curated").click();
  await a("review-changes").click();
  await expect(
    f.getByRole("dialog", { name: "Changes for this review", exact: true }),
  ).toBeVisible();
  await controls("[data-dialog]");
  await p.keyboard.press("Escape");
  await expect(a("review-changes")).toBeFocused();
  await a("review-build").click();
  await a("add-product").first().click();
  const title = await f.locator("[data-dialog] h2").textContent();
  await expect(
    f.getByRole("dialog", { name: title, exact: true }),
  ).toBeVisible();
  await controls("[data-dialog]");
  await a("close").click();
  await screen("moments");
  await f.locator('[data-content] [data-page="addPhotos"]').click();
  await f.locator('[name="photos"]').setInputFiles(file);
  await f.locator('[name="caption"]').fill("Photo One");
  await f.locator('[name="rights"]').check();
  await f.locator('[name="public"]').check();
  await f.getByRole("button", { name: "Save photos", exact: true }).click();
  await f.locator('[data-content] [data-page="addPhotos"]').click();
  await f.locator('[name="photos"]').setInputFiles(file);
  await f.locator('[name="caption"]').fill("Photo Two");
  await f.locator('[name="rights"]').check();
  await f.locator('[name="public"]').check();
  await f.getByRole("button", { name: "Save photos", exact: true }).click();
  await role("ops");
  await screen("stories");
  await a("open-submission").click();
  await a("feature-photos").click();
  await expect(f.locator("[data-public-photo-preview] figure")).toHaveCount(2);
  await role("customer");
  await screen("moments");
  await f
    .locator(
      '[data-action="manage-sharing"][data-kind="photo"][data-index="0"]',
    )
    .click();
  await expect(
    f.getByRole("dialog", { name: "Photo 1 · sharing", exact: true }),
  ).toBeVisible();
  await expect(f.locator("[data-dialog]")).toContainText("Photo One");
  await controls("[data-dialog]");
  await f.locator("[data-sharing-permission]").uncheck();
  await a("save-sharing").click();
  const moments = f.locator("[data-content] .gallery figure");
  await expect(moments).toHaveCount(2);
  await expect(moments.first()).toContainText("Private · you and Aarla");
  await expect(moments.nth(1)).toContainText("Public use permitted");
  for (const width of [320, 390]) {
    await p.setViewportSize({ width, height: 900 });
    await controls("[data-content]");
    const frame = p.frames().find((x) => x.parentFrame());
    expect(
      await frame.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await role("ops");
  await screen("stories");
  await a("open-submission").click();
  await expect(f.locator("[data-public-photo-preview] figure")).toHaveCount(1);
  await expect(f.locator("[data-public-photo-preview]")).toContainText(
    "Photo Two",
  );
  await expect(f.locator("[data-public-photo-preview]")).not.toContainText(
    "Photo One",
  );
  await expect(a("feature-photos")).toBeDisabled();
  await role("customer");
  await screen("moments");
  await f
    .locator(
      '[data-action="manage-sharing"][data-kind="photo"][data-index="0"]',
    )
    .click();
  await f.locator("[data-sharing-permission]").check();
  await a("save-sharing").click();
  await role("ops");
  await screen("stories");
  await a("open-submission").click();
  await expect(f.locator("[data-public-photo-preview] figure")).toHaveCount(1);
  await expect(a("feature-photos")).toBeEnabled();
  await a("feature-photos").click();
  await expect(f.locator("[data-public-photo-preview] figure")).toHaveCount(2);
  await role("customer");
  await screen("moments");
  await f.locator('[data-action="private-photo"][data-index="1"]').click();
  await role("ops");
  await screen("stories");
  await a("open-submission").click();
  await expect(f.locator("[data-public-photo-preview] figure")).toHaveCount(1);
  await expect(f.locator("[data-public-photo-preview]")).toContainText(
    "Photo One",
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS all 52 mobile screens at 320/390/760: 44px effective touch targets and no overflow; specific dialog names; independent photo withdrawal, retained private copies and other featured photo; re-consent requires re-featuring; quick withdrawal also works.",
  );
} finally {
  await b.close();
  await new Promise((r) => srv.close(r));
}
