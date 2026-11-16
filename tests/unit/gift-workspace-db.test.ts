import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  emptyGiftDraft,
  type GiftOption,
} from "@/lib/customer/gift-workspace-model";
let sql: Sql;
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("@/lib/customer/notifications", () => ({
  queueNotification: vi.fn(),
  scheduleNotifications: vi.fn(),
}));
import {
  giftWorkspace,
  publishGiftOption,
  saveGiftDraft,
  requestGiftQuote,
  setGiftVisibility,
} from "@/lib/customer/gift-workspace";
import { mutatePilot } from "@/lib/customer/pilot-admin";
const uri = process.env.GYVFT_WORKSPACE_TEST_DB;
describe.skipIf(!uri)("gift workspace disposable database boundaries", () => {
  const account = randomUUID(),
    other = randomUUID(),
    project = randomUUID(),
    foreign = randomUUID(),
    draftId = randomUUID();
  let option: GiftOption;
  beforeAll(async () => {
    if (!uri?.startsWith("postgresql://postgres:postgres@127.0.0.1:55432/"))
      throw Error("Only the disposable local fixture is allowed.");
    sql = postgres(uri, { max: 1, prepare: false });
    await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${account},${account + "@example.test"},'TEST'),(${other},${other + "@example.test"},'TEST')`;
    await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title) VALUES(${project},${account},${account + "@example.test"},'Test gift'),(${foreign},${other},${other + "@example.test"},'Other gift')`;
  });
  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM customer_projects WHERE id IN (${project},${foreign})`;
      await sql`DELETE FROM gyvft_customer_accounts WHERE id IN (${account},${other})`;
      await sql.end();
    }
  });
  it("publishes manual content with a price range exactly once", async () => {
    const key = randomUUID(),
      raw = {
        title: "Option A",
        description: "One manually curated hamper",
        contents: [
          {
            key: "custom",
            name: "Custom keepsake",
            quantity: 1,
            unit_paise: null,
          },
        ],
        pricing: {
          mode: "range",
          basis: "per_set",
          quantity: 10,
          low_paise: 45000,
          high_paise: 55000,
          packaging_included: false,
        },
        image: {
          mime: "image/png",
          data: readFileSync(
            "public/images/gyvft/case-studies/various-dance-schools/hero.png",
          ).toString("base64"),
        },
      };
    await publishGiftOption(project, key, raw);
    await publishGiftOption(project, key, raw);
    const data = await giftWorkspace(project);
    expect(data.options).toHaveLength(1);
    option = data.options[0];
    expect(option.pricing.low_paise).toBe(45000);
  });
  it("rejects writes from another account and source content from another request", async () => {
    await expect(
      saveGiftDraft(project, other, randomUUID(), 0, emptyGiftDraft()),
    ).rejects.toThrow("unavailable");
    const d = emptyGiftDraft();
    d.lines = [
      {
        key: randomUUID(),
        source: { kind: "curated", optionId: option.id, key: "custom" },
        quantity: 1,
        variants: {},
      },
    ];
    await expect(
      saveGiftDraft(foreign, other, randomUUID(), 0, d),
    ).rejects.toThrow("unavailable");
  });
  it("rejects stale versions and preserves immutable quote snapshots", async () => {
    const d = emptyGiftDraft();
    d.lines = [
      {
        key: randomUUID(),
        source: { kind: "curated", optionId: option.id, key: "custom" },
        quantity: 1,
        variants: {},
      },
    ];
    const row = await saveGiftDraft(project, account, draftId, 0, d);
    const first = await requestGiftQuote(
      project,
      account,
      draftId,
      row.version,
      randomUUID(),
    );
    const duplicate = await requestGiftQuote(
      project,
      account,
      draftId,
      row.version,
      randomUUID(),
    );
    expect(duplicate.id).toBe(first.id);
    d.lines[0].quantity = 3;
    await saveGiftDraft(project, account, draftId, row.version, d);
    await expect(
      saveGiftDraft(project, account, draftId, row.version, d),
    ).rejects.toThrow("another tab");
    const state = await giftWorkspace(project);
    expect(state.selections[0].snapshot.lines[0].quantity).toBe(1);
    expect(state.drafts[0].document.lines[0].quantity).toBe(3);
  });
  it("persists visibility independently of published contents and prices", async () => {
    await setGiftVisibility(project, option.id, "curated", true, account);
    let state = await giftWorkspace(project);
    expect(state.options[0].hidden).toBe(true);
    expect(state.options[0].contents).toEqual(option.contents);
    expect(state.options[0].pricing).toEqual(option.pricing);
    await setGiftVisibility(project, option.id, "curated", false, account);
    state = await giftWorkspace(project);
    expect(state.options[0].hidden).toBe(false);
    await expect(
      setGiftVisibility(project, option.id, "curated", true, other),
    ).rejects.toThrow("unavailable");
  });
  it("links quotes to the latest customer selection and rejects a foreign or stale selection", async () => {
    const state = await giftWorkspace(project),
      raw = {
        id: project,
        op: "publish",
        kind: "proposal",
        title: "Agreed quote",
        description:
          "Tax-inclusive products; packaging and delivery confirmed separately.",
        items: [
          {
            name: "Custom keepsakes",
            quantity: 10,
            unit_paise: 50000,
            item_type: "gift",
            personalisation: "",
          },
        ],
      };
    await expect(
      mutatePilot({
        ...raw,
        request_id: randomUUID(),
        gift_selection_id: randomUUID(),
      }),
    ).rejects.toThrow("latest");
    const selection = state.selections[0];
    await mutatePilot({
      ...raw,
      request_id: randomUUID(),
      gift_selection_id: selection.id,
    });
    const [approval] =
      await sql`SELECT gift_selection_id FROM customer_project_approvals WHERE project_id=${project}`;
    expect(approval.gift_selection_id).toBe(selection.id);
    const latest = (await giftWorkspace(project)).drafts[0];
    await expect(
      saveGiftDraft(
        project,
        account,
        latest.id,
        latest.version,
        latest.document,
      ),
    ).rejects.toThrow("quoted");
  });
  it("prevents new edits after order conversion and denies browser-role table access", async () => {
    await sql`UPDATE customer_projects SET kind='project' WHERE id=${project}`;
    await expect(
      saveGiftDraft(project, account, randomUUID(), 0, emptyGiftDraft()),
    ).rejects.toThrow("already an order");
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`;
        await tx`SELECT * FROM gyvft_gift_drafts`;
      }),
    ).rejects.toThrow();
  });
});
