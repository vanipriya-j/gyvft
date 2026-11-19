import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const db = process.env.PLAYWRIGHT_WORKFLOW_DB,
  secret = process.env.PLAYWRIGHT_OPERATOR_SECRET;
test.skip(!db || !secret, "Dedicated local fixture required.");
test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});
test("real customer and operator mobile controls, names, focus and layouts", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  expect(new URL(db!).hostname).toBe("127.0.0.1");
  expect(new URL(db!).port).toBe("55434");
  const sql = postgres(db!, { max: 2 }),
    account = randomUUID(),
    token = randomBytes(32).toString("base64url"),
    gift = randomUUID(),
    delivered = randomUUID(),
    person = randomUUID(),
    occasion = randomUUID(),
    option = randomUUID(),
    draft = randomUUID(),
    selection = randomUUID();
  const image = readFileSync(
      "public/images/gyvft/case-studies/various-dance-schools/hero.png",
    ),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/api/operations") && r.status() >= 400)
      errors.push("Operations HTTP " + r.status());
  });
  async function audit(label: string, root = ".gyvft-app") {
    const small = await page.locator(root).evaluate((el) =>
      [
        ...el.querySelectorAll("a[href],button,input,select,textarea,summary"),
      ].flatMap((control) => {
        if (
          !control.getClientRects().length ||
          getComputedStyle(control).visibility === "hidden"
        )
          return [];
        const target = control.matches("input[type=checkbox],input[type=radio]")
          ? control.closest("label") || control
          : control;
        const r = target.getBoundingClientRect();
        return r.width < 43.9 || r.height < 43.9
          ? [
              {
                name:
                  control.getAttribute("aria-label") ||
                  control.getAttribute("name") ||
                  control.textContent?.slice(0, 65),
                width: r.width,
                height: r.height,
              },
            ]
          : [];
      }),
    );
    expect(small, label).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow ${label}`,
    ).toBeTruthy();
  }
  try {
    await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${account},${account + "@example.test"},'LOCAL_TEST')`;
    await sql`INSERT INTO gyvft_customer_sessions(token_hash,account_id,expires_at) VALUES(${createHash("sha256").update(token).digest("hex")},${account},now()+interval '1 day')`;
    await sql`INSERT INTO gyvft_customer_profiles(account_id,name,about,interests) VALUES(${account},'Ananya Raman','A little about me','Thoughtful everyday gifts')`;
    await sql`INSERT INTO gyvft_customer_people(id,account_id,name,relationship,about,likes) VALUES(${person},${account},'Amma','Mother','A little about Amma','Morning coffee')`;
    await sql`INSERT INTO gyvft_customer_occasions(id,account_id,title,occasion_date,repeats_annually,person_id) VALUES(${occasion},${account},'Amma’s birthday','2026-11-29',true,${person})`;
    const brief = {
      title: "A thank-you for the family",
      story:
        "Useful keepsakes for ten family members, a shared design and a warm personal printed card for our celebration.",
      occasion: "Family celebration",
      audience: "One group",
      recipients: 10,
      individuals: [],
      recipient_notes: "Family and friends",
      likes: "Coffee and music",
      avoid: "Strong perfume",
      message: "A warm thank-you",
      formats: "Bottle and card",
      budget: "1300",
      budget_basis: "per_recipient",
      delivery_date: "2026-12-12",
      city: "Chennai",
      phone: "9000000000",
      occasion_id: occasion,
      person_id: person,
    };
    const doc = {
      label: "A warmth shared",
      recipients: 10,
      lines: [
        {
          key: randomUUID(),
          source: { kind: "catalogue", id: "bottle" },
          name: "Bottle",
          quantity: 1,
          variants: { Capacity: "500 ml" },
          unit_paise: null,
        },
      ],
      design: "existing",
      design_notes: "A shared design",
      personalisation: "One personal card",
      packaging: "Card box",
      notes: "",
      extra_budget_paise: null,
      extra_idea: "",
      based_on: null,
    };
    await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,brief,kind,customer_type,stage,total_paise,paid_paise,draft_document,occasion_id,person_id) VALUES(${gift},${account},${account + "@example.test"},${brief.title},${brief.story},'project','b2c',6,1330000,665000,${sql.json(brief)},${occasion},${person}),(${delivered},${account},${account + "@example.test"},'Amma’s birthday · delivered','A small morning ritual, remembered.','project','b2c',10,160000,160000,${sql.json({ ...brief, title: "Amma’s birthday · delivered" })},${occasion},${person})`;
    await sql`INSERT INTO gyvft_gift_options(id,project_id,title,description,contents,image_data,image_type,request_id) VALUES(${option},${gift},'A warmth shared','One curated hamper',${sql.json([{ key: "bottle", name: "Bottle", quantity: 1, unit_paise: 125000 }])},${image},'image/png',${randomUUID()})`;
    await sql`INSERT INTO gyvft_gift_drafts(id,project_id,document) VALUES(${draft},${gift},${sql.json(doc)})`;
    await sql`INSERT INTO gyvft_gift_selections(id,project_id,draft_id,draft_version,snapshot) VALUES(${selection},${gift},${draft},1,${sql.json(doc)})`;
    await sql`INSERT INTO customer_project_approvals(project_id,kind,version,title,description,status,amount_paise,items,gift_selection_id) VALUES(${gift},'proposal',1,'Your gift quote','The exact gift and listed charges.','approved',1330000,${sql.json([{ name: "Gift sets, taxes and listed charges", quantity: 10, unit_paise: 133000, item_type: "gift", personalisation: "One shared design" }])},${selection})`;
    await sql`INSERT INTO customer_project_approvals(project_id,kind,version,title,description,status,image_data,image_type) VALUES(${gift},'design',1,'Production artwork','Check the spelling and placement.','pending',${image},'image/png')`;
    await sql`INSERT INTO gyvft_gift_photos(id,project_id,caption,kind,image_data,image_type) VALUES(${randomUUID()},${delivered},'A lovely morning moment','Someone using their gift',${image},'image/png')`;
    await context.addCookies([
      {
        name: "gyvft_customer_session",
        value: token,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    const routes = [
      "/account",
      "/account/gifts",
      "/account/people",
      `/account/people/${person}`,
      `/account/people/${person}?edit=1`,
      "/account/profile",
      "/account/profile/tastes",
      "/account/occasions",
      `/account/occasions/${occasion}`,
      `/account/occasions/${occasion}?edit=1`,
      "/account?view=saved",
      "/account?view=payments",
      ...[
        "overview",
        "brief",
        "quote",
        "design",
        "delivery",
        "messages",
        "activity",
      ].map((v) => `/account/projects/${gift}?view=${v}`),
      `/account/projects/${gift}/options`,
      `/account/projects/${delivered}?view=moments`,
    ];
    for (const width of [320, 390, 760]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of routes) {
        await page.goto(baseURL + path);
        await audit(`${width} ${path}`);
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(baseURL + `/account/projects/${gift}?view=design`);
    await page
      .getByRole("button", { name: "Approve artwork v1", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Approve artwork v1?", exact: true }),
    ).toBeVisible();
    await audit("Approval dialog", "[role=dialog]");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Approve artwork v1", exact: true }),
    ).toBeFocused();
    await page.goto(baseURL + `/account/projects/${gift}/options`);
    await page
      .getByRole("button", { name: "Customise a copy", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your workspace", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Choose & add Bottle", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Bottle", exact: true }),
    ).toBeVisible();
    await audit("Variant dialog", "[role=dialog]");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Choose & add Bottle", exact: true }),
    ).toBeFocused();
    await page.goto(baseURL + `/account/projects/${delivered}?view=moments`);
    await page
      .getByRole("button", { name: "Manage sharing", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Photo sharing", exact: true }),
    ).toBeVisible();
    await audit("Photo dialog", "[role=dialog]");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Manage sharing", exact: true }),
    ).toBeFocused();
    const areas = [
      "Dashboard",
      "Requests & orders",
      "Customers",
      "Occasions",
      "Feedback & photos",
      "Reports & health",
      "Settings & connections",
    ];
    for (const width of [320, 390, 760]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(baseURL + "/operations");
      await page.getByLabel("Operator secret", { exact: true }).fill(secret!);
      await page
        .getByRole("button", { name: "Open customer desk", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Dashboard", exact: true }),
      ).toBeVisible();
      for (const area of areas) {
        await page
          .getByRole("combobox", { name: "Operations area", exact: true })
          .selectOption({ label: area });
        await expect(
          page.getByText("Working… please wait.", { exact: true }),
        ).toHaveCount(0);
        await audit(`${width} Ops ${area}`);
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await sql`DELETE FROM customer_projects WHERE customer_account_id=${account}`;
    await sql`DELETE FROM gyvft_customer_accounts WHERE id=${account}`;
    await sql.end();
  }
});
