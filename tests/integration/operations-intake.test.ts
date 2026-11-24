import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
let sql: Sql;
const state = vi.hoisted(() => ({
  account: null as { id: string; email?: string } | null,
  send: vi.fn(),
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("@/lib/customer/session", () => ({
  getCustomerAccount: async () => state.account,
  claimCustomerEnquiries: vi.fn(),
  createCustomerSession: vi.fn(),
}));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: vi.fn(),
}));
vi.mock("@/lib/customer/accounts", () => ({
  limitCustomerAuth: vi.fn(),
  customerAccountError: () => "Account action failed",
  CustomerRateLimitError: class extends Error {},
}));
vi.mock("@/lib/customer/shopify", () => ({ scheduleCustomerSync: vi.fn() }));
vi.mock("@/services/notifications/transports", () => ({
  sendNotificationEmail: state.send,
}));
import {
  operationsIntakeReady,
  createOperationsIntake,
  requirementAttachmentsFor,
  intakeCustomers,
  intakeAccessFor,
  sendOperationsSetupEmail,
} from "@/lib/customer/operations-intake";
import { POST } from "@/app/api/operations/intake/route";
import { GET as asset } from "@/app/api/customer-assets/[kind]/[id]/route";
import { resetCustomerPasswordAction } from "@/app/account/auth-actions";
import {
  hashCustomerPassword,
  verifyCustomerPassword,
  hashOpaqueToken,
} from "@/lib/customer/password";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
const uri = process.env.TEST_OPERATIONS_INTAKE_DB_URL;
const schema = "ops_intake_" + randomUUID().replaceAll("-", "");
const secret = "local-intake-operator-only";
const pdf = Buffer.from("%PDF-1.4\nFictional fixture document\n%%EOF");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XxioAAAAASUVORK5CYII=",
  "base64",
);
const requirement = {
  title: "Fictional team requirement",
  story:
    "T-shirts, journals and bottles for the team, with the supplied brand artwork.",
  customer_type: "b2b",
  organisation_name: "Fictional Studio",
  recipients: 4,
  budget: "1000–1200",
  city: "Chennai & Bengaluru",
  occasion_date: "2026-12-01",
  delivery_date: "2026-11-29",
};
const files = [
  {
    filename: "requirements.pdf",
    mime: "application/pdf",
    data: pdf.toString("base64"),
  },
  { filename: "brand.png", mime: "image/png", data: png.toString("base64") },
];
const newInput = () => ({
  request_id: randomUUID(),
  customer: {
    kind: "new",
    name: "Fictional Customer",
    email: "fictional-" + randomUUID() + "@example.test",
  },
  requirement,
  files,
});
const call = (body: Record<string, unknown>, authenticated = true) =>
  POST(
    new Request("https://www.gyvft.com/api/operations/intake", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authenticated ? { "x-setup-secret": secret } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
const download = (id: string, operator = false) =>
  asset(
    new Request("https://www.gyvft.com/api/customer-assets/requirement/" + id, {
      headers: operator ? { "x-setup-secret": secret } : {},
    }),
    { params: Promise.resolve({ kind: "requirement", id }) },
  );
describe.skipIf(!uri)("Operations customer and requirement intake", () => {
  let existingId: string,
    existingHash: string,
    newAccount: string,
    newProject: string;
  beforeAll(async () => {
    const target = new URL(uri!);
    if (
      target.hostname !== "127.0.0.1" ||
      target.port !== "55438" ||
      target.pathname !== "/gyvft_gallery_test"
    )
      throw Error(
        "Operations intake tests require the dedicated localhost:55438 fixture.",
      );
    sql = postgres(uri!, {
      max: 4,
      connection: { search_path: schema },
      onnotice: () => {},
    });
    await sql.unsafe(
      `CREATE SCHEMA ${schema}; DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$;`,
    );
    for (const file of [
      "20261112000000_customer_portal.sql",
      "20261114000001_customer_accounts.sql",
    ])
      await sql.unsafe(readFileSync("supabase/migrations/" + file, "utf8"));
    await sql.unsafe(`ALTER TABLE customer_projects ADD COLUMN is_draft boolean DEFAULT false,ADD COLUMN draft_document jsonb,ADD COLUMN occasion_date date,ADD COLUMN delivery_date date;
      CREATE TABLE gyvft_customer_profiles(account_id uuid PRIMARY KEY REFERENCES gyvft_customer_accounts(id),name text DEFAULT '',about text,interests text,avoid text,share_profile boolean);
      CREATE TABLE gyvft_gift_brief_revisions(project_id uuid,version int,document jsonb,PRIMARY KEY(project_id,version));`);
    vi.stubEnv("SETUP_SECRET", secret);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.gyvft.com");
    existingHash = await hashCustomerPassword("FixtureExisting!2026");
    [{ id: existingId }] =
      await sql`INSERT INTO gyvft_customer_accounts(email,password_hash) VALUES('existing@example.test',${existingHash}) RETURNING id`;
    await sql`INSERT INTO gyvft_customer_profiles(account_id,name,about,interests,avoid,share_profile) VALUES(${existingId}::uuid,'Existing customer','Keep this profile','Music','',false)`;
  });
  beforeEach(() => {
    state.account = null;
    state.send.mockReset();
    state.send.mockResolvedValue("fixture-provider-id");
    resetMemoryGuardsForTests();
  });
  afterAll(async () => {
    await sql?.end();
    vi.unstubAllEnvs();
  });
  it("requires operator authentication and reports activation without writing", async () => {
    expect((await call({ op: "create", ...newInput() }, false)).status).toBe(
      401,
    );
    expect(await operationsIntakeReady()).toBe(false);
    expect(await (await call({ op: "status" })).json()).toMatchObject({
      installed: false,
    });
    await expect(createOperationsIntake(newInput())).rejects.toThrow(
      "database update",
    );
    expect(
      (await sql`SELECT count(*)::int AS n FROM gyvft_customer_accounts`)[0].n,
    ).toBe(1);
    expect(await requirementAttachmentsFor(randomUUID())).toEqual([]);
  });
  it("applies the additive schema twice without changing an existing account or profile", async () => {
    const migration = readFileSync(
      "supabase/migrations/20261124000003_operations_intake.sql",
      "utf8",
    );
    await sql.unsafe(migration);
    await sql.unsafe(migration);
    expect(await operationsIntakeReady()).toBe(true);
    expect(
      (
        await sql`SELECT password_hash FROM gyvft_customer_accounts WHERE id=${existingId}::uuid`
      )[0].password_hash,
    ).toBe(existingHash);
    expect(
      (
        await sql`SELECT about FROM gyvft_customer_profiles WHERE account_id=${existingId}::uuid`
      )[0].about,
    ).toBe("Keep this profile");
    const protectedTables =
      await sql`SELECT relrowsecurity FROM pg_class WHERE relname IN ('gyvft_operations_intakes','gyvft_requirement_attachments','gyvft_customer_setup_emails') AND relnamespace=${schema}::regnamespace`;
    expect(protectedTables).toHaveLength(3);
    expect(protectedTables.every((row) => row.relrowsecurity)).toBe(true);
  });
  it("atomically saves a new customer, requirement and private files without sending email", async () => {
    const input = newInput();
    const response = await call({ op: "create", ...input });
    expect(response.status).toBe(200);
    const { result } = await response.json();
    newAccount = result.account_id;
    newProject = result.project_id;
    expect(result).toMatchObject({
      created_account: true,
      setup_pending: true,
      duplicate: false,
    });
    const [account] =
      await sql`SELECT * FROM gyvft_customer_accounts WHERE id=${newAccount}::uuid`;
    expect(account.password_hash).toMatch(/^scrypt\$/);
    expect(
      await verifyCustomerPassword(
        "FixtureExisting!2026",
        account.password_hash,
      ),
    ).toBe(false);
    const [project] =
      await sql`SELECT * FROM customer_projects WHERE id=${newProject}::uuid`;
    expect(project).toMatchObject({
      customer_account_id: newAccount,
      customer_email: input.customer.email,
      kind: "enquiry",
      is_draft: false,
      stage: 0,
      customer_type: "b2b",
      organisation_name: "Fictional Studio",
    });
    expect(project.draft_document).toMatchObject({
      recipients: 4,
      budget: "1000–1200",
      source: "operations",
    });
    expect(
      (await requirementAttachmentsFor(newProject)).map(
        (file) => file.filename,
      ),
    ).toEqual(["requirements.pdf", "brand.png"]);
    expect(
      (
        await sql`SELECT count(*)::int AS n FROM customer_project_events WHERE project_id=${newProject}::uuid`
      )[0].n,
    ).toBe(1);
    expect(
      (await sql`SELECT count(*)::int AS n FROM gyvft_customer_sessions`)[0].n,
    ).toBe(0);
    expect(state.send).not.toHaveBeenCalled();
    const replay = await createOperationsIntake(input);
    expect(replay).toMatchObject({
      account_id: newAccount,
      project_id: newProject,
      duplicate: true,
    });
    await expect(
      createOperationsIntake({
        ...input,
        requirement: { ...requirement, title: "Different intent" },
      }),
    ).rejects.toThrow("different data");
    expect(
      (
        await sql`SELECT count(*)::int AS n FROM gyvft_requirement_attachments WHERE project_id=${newProject}::uuid`
      )[0].n,
    ).toBe(2);
  });
  it("serialises simultaneous retries into one customer and request", async () => {
    const input = newInput();
    const results = await Promise.all([
      createOperationsIntake(input),
      createOperationsIntake(input),
    ]);
    expect(new Set(results.map((row) => row.account_id)).size).toBe(1);
    expect(results.filter((row) => row.duplicate)).toHaveLength(1);
  });
  it("uses an explicitly selected existing account without replacing its credentials or profile", async () => {
    await expect(
      createOperationsIntake({
        ...newInput(),
        customer: {
          kind: "new",
          name: "Replacement name",
          email: "existing@example.test",
        },
      }),
    ).rejects.toThrow("already exists");
    const result = await createOperationsIntake({
      request_id: randomUUID(),
      customer: {
        kind: "existing",
        id: existingId,
        email: "existing@example.test",
      },
      requirement,
    });
    expect(result).toMatchObject({
      created_account: false,
      setup_pending: false,
      account_id: existingId,
      name: "Existing customer",
    });
    expect(
      (
        await sql`SELECT password_hash FROM gyvft_customer_accounts WHERE id=${existingId}::uuid`
      )[0].password_hash,
    ).toBe(existingHash);
    await expect(
      sendOperationsSetupEmail(existingId, randomUUID()),
    ).rejects.toThrow("already has account access");
    expect(state.send).not.toHaveBeenCalled();
    await expect(
      createOperationsIntake({
        request_id: randomUUID(),
        customer: {
          kind: "existing",
          id: existingId,
          email: "someone-else@example.test",
        },
        requirement,
      }),
    ).rejects.toThrow("active customer");
  });
  it("rejects invalid and excessive attachments before creating customer records", async () => {
    const [{ n }] =
      await sql`SELECT count(*)::int AS n FROM gyvft_customer_accounts`;
    await expect(
      createOperationsIntake({
        ...newInput(),
        files: [
          {
            filename: "wrong.pdf",
            mime: "application/pdf",
            data: png.toString("base64"),
          },
        ],
      }),
    ).rejects.toThrow("valid PDF");
    await expect(
      createOperationsIntake({
        ...newInput(),
        files: [{ ...files[0], filename: "../secret.pdf" }],
      }),
    ).rejects.toThrow();
    const big = Buffer.alloc(1500000, 32);
    big.write("%PDF-1.4");
    await expect(
      createOperationsIntake({
        ...newInput(),
        files: [
          {
            filename: "one.pdf",
            mime: "application/pdf",
            data: big.toString("base64"),
          },
          {
            filename: "two.pdf",
            mime: "application/pdf",
            data: big.toString("base64"),
          },
        ],
      }),
    ).rejects.toThrow("2.5 MB");
    expect(
      (await sql`SELECT count(*)::int AS n FROM gyvft_customer_accounts`)[0].n,
    ).toBe(n);
  });
  it("supports a file-only requirement and standalone customer creation", async () => {
    const input = newInput();
    const fileOnly = await createOperationsIntake({
      ...input,
      requirement: { ...requirement, story: "" },
    });
    expect(
      (
        await sql`SELECT brief FROM customer_projects WHERE id=${fileOnly.project_id}::uuid`
      )[0].brief,
    ).toBe("The requirement was supplied in the attached files.");
    const standalone = await createOperationsIntake({
      request_id: randomUUID(),
      customer: newInput().customer,
    });
    expect(standalone.project_id).toBe(null);
    expect(standalone.setup_pending).toBe(true);
    await expect(
      createOperationsIntake({
        ...newInput(),
        files: [],
        requirement: { ...requirement, story: "" },
      }),
    ).rejects.toThrow("Paste the requirement");
  });
  it("protects attachment downloads by customer ownership and forces private downloads", async () => {
    const [file] = await requirementAttachmentsFor(newProject);
    expect((await download(file.id)).status).toBe(404);
    state.account = { id: existingId };
    expect((await download(file.id)).status).toBe(404);
    state.account = { id: newAccount };
    const owned = await download(file.id);
    expect(owned.status).toBe(200);
    expect(Buffer.from(await owned.arrayBuffer())).toEqual(pdf);
    expect(owned.headers.get("content-disposition")).toContain("attachment");
    expect(owned.headers.get("cache-control")).toBe("private, no-store");
    expect(owned.headers.get("content-security-policy")).toContain("sandbox");
    state.account = null;
    expect((await download(file.id, true)).status).toBe(200);
  });
  it("returns safe search and setup status without secrets or file content", async () => {
    const rows = await intakeCustomers("existing@example.test");
    expect(rows).toMatchObject([{ id: existingId, setup_pending: false }]);
    expect(JSON.stringify(rows)).not.toMatch(
      /password_hash|token_ciphertext|file_data/,
    );
    expect(await intakeAccessFor([newAccount])).toMatchObject([
      { account_id: newAccount, setup_pending: true },
    ]);
  });
  it("retries failed setup delivery using the same encrypted token and provider action key", async () => {
    const id = randomUUID();
    state.send.mockRejectedValueOnce(Error("provider fixture failure"));
    expect(await sendOperationsSetupEmail(newAccount, id)).toMatchObject({
      state: "failed",
    });
    const first = state.send.mock.calls[0][0];
    expect(first.to).toMatch(/@example.test$/);
    const url = new URL(first.text.match(/https:\/\/\S+/)[0]);
    const token = url.searchParams.get("reset")!;
    const [stored] =
      await sql`SELECT * FROM gyvft_customer_setup_emails WHERE id=${id}::uuid`;
    expect(stored.token_hash).toBe(hashOpaqueToken(token));
    expect(stored.token_ciphertext).not.toContain(token);
    expect(url.searchParams.get("setup")).toBe("1");
    expect(
      new Date(stored.expires_at).getTime() - Date.now(),
    ).toBeLessThanOrEqual(3600000);
    expect(await sendOperationsSetupEmail(newAccount, id)).toMatchObject({
      state: "sent",
    });
    expect(state.send.mock.calls[1][0]).toEqual(first);
    await sendOperationsSetupEmail(newAccount, id);
    expect(state.send).toHaveBeenCalledTimes(2);
    const form = new FormData();
    form.set("token", token);
    form.set("password", "NewFixturePassword!2026");
    expect(await resetCustomerPasswordAction(form)).toMatchObject({ ok: true });
    expect(
      await verifyCustomerPassword(
        "NewFixturePassword!2026",
        (
          await sql`SELECT password_hash FROM gyvft_customer_accounts WHERE id=${newAccount}::uuid`
        )[0].password_hash,
      ),
    ).toBe(true);
    expect(await resetCustomerPasswordAction(form)).toMatchObject({
      ok: false,
    });
    expect(await intakeAccessFor([newAccount])).toMatchObject([
      { setup_pending: false },
    ]);
    await expect(
      sendOperationsSetupEmail(newAccount, randomUUID()),
    ).rejects.toThrow("already has account access");
    expect(
      (
        await sql`SELECT password_hash FROM gyvft_customer_accounts WHERE id=${existingId}::uuid`
      )[0].password_hash,
    ).toBe(existingHash);
  });
  it("does not send expired setup links or resend a used link after failed delivery", async () => {
    const account = await createOperationsIntake({
      request_id: randomUUID(),
      customer: newInput().customer,
    });
    const id = randomUUID();
    state.send.mockRejectedValue(Error("provider fixture failure"));
    await sendOperationsSetupEmail(account.account_id, id);
    await sql`UPDATE gyvft_customer_setup_emails SET expires_at=now()-interval '1 second' WHERE id=${id}::uuid`;
    const calls = state.send.mock.calls.length;
    await expect(
      sendOperationsSetupEmail(account.account_id, id),
    ).rejects.toThrow("expired");
    expect(state.send).toHaveBeenCalledTimes(calls);
    const other = await createOperationsIntake({
      request_id: randomUUID(),
      customer: newInput().customer,
    });
    const otherId = randomUUID();
    await sendOperationsSetupEmail(other.account_id, otherId);
    await sql`UPDATE gyvft_customer_password_resets SET used_at=now() WHERE account_id=${other.account_id}::uuid`;
    await expect(
      sendOperationsSetupEmail(other.account_id, otherId),
    ).rejects.toThrow("already has account access");
  });
  it("rejects malformed API payloads and excessive bodies with no writes", async () => {
    expect(
      (
        await call({
          op: "send_setup_email",
          account_id: "invalid",
          request_id: randomUUID(),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call({
          op: "create",
          ...newInput(),
          files: [],
          requirement: { title: "x" },
        })
      ).status,
    ).toBe(400);
    const response = await POST(
      new Request("https://www.gyvft.com/api/operations/intake", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-setup-secret": secret,
        },
        body: " ".repeat(4 * 1024 * 1024 + 1),
      }),
    );
    expect(response.status).toBe(413);
  });
});
