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
import type { Sql } from "postgres";
import sharp from "sharp";
import jsQR from "jsqr";
import { agentOperationsFixture } from "../fixtures/agent-operations-database";
let sql: Sql;
const state = vi.hoisted(() => ({
  account: null as { id: string } | null,
  send: vi.fn(),
  images: vi.fn(),
  files: vi.fn(),
  shopify: vi.fn(),
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("@/lib/customer/session", () => ({
  getCustomerAccount: async () => state.account,
}));
vi.mock("@/services/notifications/transports", async (original) => ({
  ...(await original<typeof import("@/services/notifications/transports")>()),
  sendNotificationEmail: state.send,
}));
vi.mock("@/lib/mcp/images", async (original) => ({
  ...(await original<typeof import("@/lib/mcp/images")>()),
  prepareMcpImages: state.images,
  prepareMcpRequirementFiles: state.files,
}));
vi.mock("@/lib/customer/shopify", () => ({
  createOrSyncShopifyOrder: state.shopify,
  shopifyConfigured: () => true,
}));
import {
  recordOfflineApproval,
  offlineApprovalsFor,
} from "@/lib/customer/agent-operations";
import { applyApprovalDecision } from "@/lib/customer/approval-decisions";
import { requestCustomerPayment } from "@/lib/customer/payment-requests";
import { paymentRequestEmail } from "@/lib/customer/payment-request-email";
import { deliverNotifications } from "@/lib/customer/notifications";
import { paymentQrFor } from "@/lib/customer/payment-qr";
import { callMcpTool } from "@/lib/mcp/tools";
import { mcpScopes } from "@/lib/mcp/config";
import {
  operationFingerprint,
  reserveOperation,
  completeOperation,
} from "@/lib/mcp/operation-commands";
import { GET as asset } from "@/app/api/customer-assets/[kind]/[id]/route";
import { GET as qrRoute } from "@/app/api/payment-qr/[id]/route";
const uri = process.env.TEST_AGENT_OPERATIONS_DB_URL;
const proof = {
  mime: "image/png",
  data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XxioAAAAASUVORK5CYII=",
};
const actor = { id: randomUUID(), scopes: [...mcpScopes] };
const secret = "local-agent-operations-fixture";
const file = {
  download_url: "https://files.oaiusercontent.com/proof?expires=old",
  file_id: "file_proof",
};
const item = {
  name: "Custom gift",
  quantity: 1,
  unit_paise: 1330000,
  item_type: "gift",
  personalisation: "",
};
async function project(total = 1330000, type = "b2c") {
  const [account] =
    await sql`INSERT INTO gyvft_customer_accounts(email,password_hash) VALUES(${randomUUID() + "@example.test"},'unknown-fixture-hash') RETURNING id`;
  const [p] =
    await sql`INSERT INTO customer_projects(customer_account_id,customer_email,title,kind,stage,customer_type) VALUES(${account.id}::uuid,${randomUUID() + "@example.test"},'Fictional gift','enquiry',1,${type}) RETURNING id`;
  const [quote] =
    await sql`INSERT INTO customer_project_approvals(project_id,kind,version,title,description,amount_paise,items) VALUES(${p.id}::uuid,'proposal',1,'Custom quote','Fictional approval',${total},${sql.json([{ ...item, unit_paise: total }])}) RETURNING id,version`;
  return {
    id: p.id as string,
    account: account.id as string,
    quote: quote.id as string,
    total,
  };
}
async function approved(total = 1330000, type = "b2c") {
  const p = await project(total, type);
  await recordOfflineApproval(approvalInput(p), { source: "operations" });
  return p;
}
function approvalInput(p: { id: string; quote: string }) {
  return {
    request_id: randomUUID(),
    project_id: p.id,
    approval_id: p.quote,
    expected_version: 1,
    channel: "whatsapp",
    note: "Customer explicitly approved quote v1 in the attached message.",
    recorded_by: "Fixture Operator",
    proof: [proof],
  };
}
function paymentInput(
  p: { id: string; quote: string; total: number },
  paid = 0,
  phase: "advance" | "balance" = "advance",
) {
  return {
    request_id: randomUUID(),
    project_id: p.id,
    approval_id: p.quote,
    expected_version: 1,
    phase,
    expected_due_paise: Math.max(
      0,
      (phase === "advance" ? Math.ceil(p.total / 2) : p.total) - paid,
    ),
    expected_paid_paise: paid,
  };
}
const request = (path: string, operator = false) =>
  new Request("https://www.gyvft.com" + path, {
    headers: operator ? { "x-setup-secret": secret } : {},
  });
describe.skipIf(!uri)("Agent Operations against isolated PostgreSQL", () => {
  beforeAll(async () => {
    ({ sql } = await agentOperationsFixture(uri!));
    vi.stubEnv("SETUP_SECRET", secret);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.gyvft.com");
    vi.stubEnv("RESEND_API_KEY", "fixture-never-sent");
    await sql`INSERT INTO gyvft_customer_upi_settings(singleton,upi_id,payee_name) VALUES(true,'fictional@bank','Fictional Receiving Account')`;
  });
  beforeEach(() => {
    state.account = null;
    state.send.mockReset().mockResolvedValue("fixture-provider-accepted");
    state.images.mockReset().mockResolvedValue([proof]);
    state.files.mockReset().mockResolvedValue([]);
    state.shopify.mockReset().mockResolvedValue("#fixture-order");
  });
  afterAll(async () => {
    await sql?.end();
    vi.unstubAllEnvs();
  });
  it("records approval and private proof atomically; replay cannot duplicate approval, money or events", async () => {
    const p = await project(1330000, "b2b"),
      input = approvalInput(p);
    const results = await Promise.all([
      recordOfflineApproval(input, { source: "mcp", id: actor.id }),
      recordOfflineApproval(input, { source: "mcp", id: actor.id }),
    ]);
    expect(results.map((r) => r.duplicate).sort()).toEqual([false, true]);
    const [row] =
      await sql`SELECT kind,stage,total_paise,customer_type FROM customer_projects WHERE id=${p.id}::uuid`;
    expect(row).toMatchObject({
      kind: "project",
      stage: 4,
      total_paise: "1330000",
      customer_type: "b2b",
    });
    expect(
      await sql`SELECT * FROM gyvft_offline_approval_files WHERE offline_approval_id=${input.request_id}::uuid`,
    ).toHaveLength(1);
    expect(
      await sql`SELECT * FROM customer_order_items WHERE project_id=${p.id}::uuid`,
    ).toHaveLength(1);
    const [file] = (await offlineApprovalsFor(p.id))[0].files;
    state.account = { id: p.account };
    expect(
      (
        await asset(request("/proof"), {
          params: Promise.resolve({
            kind: "offline-approval-proof",
            id: file.id,
          }),
        })
      ).status,
    ).toBe(404);
    const response = await asset(request("/proof", true), {
      params: Promise.resolve({ kind: "offline-approval-proof", id: file.id }),
    });
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from(proof.data, "base64"),
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(
      recordOfflineApproval(
        { ...input, note: "different payload" },
        { source: "operations" },
      ),
    ).rejects.toThrow("different data");
    expect(state.send).not.toHaveBeenCalled();
  });
  it("requires screenshots and current version/selection, rejects production locks, and rolls back official-order conflicts", async () => {
    const p = await project();
    await expect(
      recordOfflineApproval(
        { ...approvalInput(p), proof: [] },
        { source: "operations" },
      ),
    ).rejects.toThrow();
    await expect(
      recordOfflineApproval(
        { ...approvalInput(p), expected_version: 2 },
        { source: "operations" },
      ),
    ).rejects.toThrow("version changed");
    await sql`UPDATE customer_projects SET shopify_order_reference='#existing' WHERE id=${p.id}::uuid`;
    await expect(
      recordOfflineApproval(approvalInput(p), { source: "operations" }),
    ).rejects.toThrow("reconciliation");
    expect(
      (
        await sql`SELECT status FROM customer_project_approvals WHERE id=${p.quote}::uuid`
      )[0].status,
    ).toBe("pending");
    expect(await offlineApprovalsFor(p.id)).toEqual([]);
    await sql`UPDATE customer_projects SET shopify_order_reference=NULL,stage=7,production_started_at=now() WHERE id=${p.id}::uuid`;
    await expect(
      recordOfflineApproval(approvalInput(p), { source: "operations" }),
    ).rejects.toThrow("Only the latest");
    const newer = await project();
    await sql`INSERT INTO customer_project_approvals(project_id,kind,version,title,description) VALUES(${newer.id}::uuid,'proposal',2,'Revision','New revision')`;
    await expect(
      recordOfflineApproval(approvalInput(newer), { source: "operations" }),
    ).rejects.toThrow("Only the latest");
  });
  it("preserves customer-owned decisions and denies cross-account approval", async () => {
    const p = await project();
    await expect(
      sql.begin((tx) =>
        applyApprovalDecision(tx as unknown as Sql, {
          projectId: p.id,
          approvalId: p.quote,
          accountId: randomUUID(),
          decision: "approved",
          response: "Yes",
          notifyTeam: true,
        }),
      ),
    ).rejects.toThrow("unavailable");
    const r = await sql.begin((tx) =>
      applyApprovalDecision(tx as unknown as Sql, {
        projectId: p.id,
        approvalId: p.quote,
        accountId: p.account,
        decision: "approved",
        response: "Approved by customer",
        notifyTeam: true,
      }),
    );
    expect(r).toHaveLength(1);
    expect(await offlineApprovalsFor(p.id)).toEqual([]);
    expect(
      (
        await sql`SELECT destination FROM gyvft_customer_notifications WHERE project_id=${p.id}::uuid`
      )[0].destination,
    ).toBe("team");
  });
  it("sends exact advance and balance commitments once; blocks stale snapshots and pending proof", async () => {
    const p = await approved(1330001),
      input = paymentInput(p);
    expect(await requestCustomerPayment(input)).toMatchObject({
      amount_inr: 6650.01,
      duplicate: false,
    });
    expect(await requestCustomerPayment(input)).toMatchObject({
      duplicate: true,
    });
    const mail = await paymentRequestEmail(
      sql,
      "payment-request:" + input.request_id,
    );
    expect(mail?.text).toContain(
      "Pay ₹6650.01 as the advance. The remaining ₹6650.00 is due before dispatch.",
    );
    expect(mail?.text).toContain("?view=quote");
    expect(await deliverNotifications(p.id)).toEqual({
      candidates: 1,
      accepted: 1,
    });
    expect(await deliverNotifications(p.id)).toEqual({
      candidates: 0,
      accepted: 0,
    });
    expect(state.send).toHaveBeenCalledTimes(1);
    await expect(
      requestCustomerPayment({ ...paymentInput(p), expected_due_paise: 100 }),
    ).rejects.toThrow("amount due changed");
    await sql`INSERT INTO customer_payment_submissions(project_id,amount_paise,reference) VALUES(${p.id}::uuid,665001,'pending-fixture')`;
    await expect(requestCustomerPayment(paymentInput(p))).rejects.toThrow(
      "awaiting verification",
    );
    await sql`UPDATE customer_payment_submissions SET status='verified' WHERE project_id=${p.id}::uuid`;
    await sql`UPDATE customer_projects SET paid_paise=665001,stage=5 WHERE id=${p.id}::uuid`;
    await expect(
      requestCustomerPayment(paymentInput(p, 665001, "balance")),
    ).rejects.toThrow("packed");
    await sql`UPDATE customer_projects SET stage=8 WHERE id=${p.id}::uuid`;
    const balance = paymentInput(p, 665001, "balance");
    await requestCustomerPayment(balance);
    expect(
      (await paymentRequestEmail(sql, "payment-request:" + balance.request_id))
        ?.text,
    ).toContain("Pay the remaining ₹6650.00 before dispatch.");
  });
  it("suppresses a queued payment email after funds, quote or pending receipt changed", async () => {
    const p = await approved(),
      input = paymentInput(p);
    await requestCustomerPayment(input);
    await sql`UPDATE customer_projects SET paid_paise=665000 WHERE id=${p.id}::uuid`;
    expect(await deliverNotifications(p.id)).toEqual({
      candidates: 1,
      accepted: 0,
    });
    expect(state.send).not.toHaveBeenCalled();
    expect(
      (
        await sql`SELECT attempts,state FROM gyvft_customer_notifications WHERE project_id=${p.id}::uuid`
      )[0],
    ).toMatchObject({ attempts: 8, state: "failed" });
  });
  it("generates a decodable amount-prefilled QR for the trusted payee; denies other customers and stale/pending amounts", async () => {
    const p = await approved(),
      qr = await paymentQrFor(p.id, p.account);
    const image = await sharp(qr.png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(
      new Uint8ClampedArray(image.data),
      image.info.width,
      image.info.height,
    );
    expect(decoded?.data).toBe(qr.uri);
    const params = new URL(decoded!.data).searchParams;
    expect(Object.fromEntries(params)).toMatchObject({
      pa: "fictional@bank",
      pn: "Fictional Receiving Account",
      am: "6650.00",
      cu: "INR",
    });
    expect(params.get("tr")).toMatch(/^GY.+A1$/);
    await expect(paymentQrFor(p.id, randomUUID())).rejects.toThrow(
      "unavailable",
    );
    state.account = { id: p.account };
    expect(
      (
        await qrRoute(
          request("/api/payment-qr/" + p.id + "?expected_amount_paise=1"),
          { params: Promise.resolve({ id: p.id }) },
        )
      ).status,
    ).toBe(404);
    await sql`INSERT INTO customer_payment_submissions(project_id,amount_paise,reference) VALUES(${p.id}::uuid,665000,'qr-pending-fixture')`;
    await expect(paymentQrFor(p.id, p.account)).rejects.toThrow(
      "pending payment",
    );
  });
  it("requires explicit actual receipt and expected quote/paid state; a repeated reference is never credited twice", async () => {
    const p = await approved(),
      input = {
        request_id: p.id,
        client_reference: randomUUID(),
        approval_id: p.quote,
        expected_version: 1,
        expected_paid_inr: 0,
        amount_inr: 6650,
        reference: "bank-fixture-123",
        confirmed_receipt: true,
      };
    await expect(
      callMcpTool(
        "verify_customer_payment",
        { ...input, confirmed_receipt: false },
        actor,
      ),
    ).rejects.toThrow();
    const result = await callMcpTool("verify_customer_payment", input, actor);
    expect(result).toMatchObject({ verified: true, amount_inr: 6650 });
    expect(
      await callMcpTool("verify_customer_payment", input, actor),
    ).toMatchObject({ replayed: true });
    await expect(
      callMcpTool(
        "verify_customer_payment",
        { ...input, client_reference: randomUUID() },
        actor,
      ),
    ).rejects.toThrow("position changed");
    expect(
      (
        await sql`SELECT paid_paise FROM customer_projects WHERE id=${p.id}::uuid`
      )[0].paid_paise,
    ).toBe("665000");
  });
  it("enforces granular scopes before reads/writes and stable action fingerprints across expired signed URLs", async () => {
    const p = await project();
    await expect(
      callMcpTool(
        "publish_gift_option",
        {},
        {
          id: actor.id,
          scopes: ["gyvft:requests:read", "gyvft:options:write"],
        },
      ),
    ).rejects.toThrow("additional permission");
    const input = {
      client_reference: randomUUID(),
      request_id: p.id,
      files: [file],
    };
    const digest = operationFingerprint("proof", input);
    expect(
      operationFingerprint("proof", {
        ...input,
        files: [
          { ...file, download_url: "https://files.oaiusercontent.com/new-url" },
        ],
      }),
    ).toBe(digest);
    expect(
      operationFingerprint("proof", {
        ...input,
        files: [{ ...file, file_id: "file_other" }],
      }),
    ).not.toBe(digest);
    await reserveOperation(
      input.client_reference,
      p.id,
      "proof",
      digest,
      actor.id,
    );
    await completeOperation(input.client_reference, { done: true });
    expect(
      await reserveOperation(
        input.client_reference,
        p.id,
        "proof",
        digest,
        actor.id,
      ),
    ).toEqual({ done: true });
    await expect(
      reserveOperation(
        input.client_reference,
        p.id,
        "proof",
        "f".repeat(64),
        actor.id,
      ),
    ).rejects.toThrow("different data");
  });
  it("replays evidenced MCP approval without redownloading expired proof", async () => {
    const p = await project(),
      input = {
        request_id: p.id,
        client_reference: randomUUID(),
        approval_id: p.quote,
        expected_version: 1,
        channel: "whatsapp",
        note: "Customer approved this exact quote",
        recorded_by: "Owner",
        files: [file],
      };
    await callMcpTool("record_offline_approval", input, actor);
    state.images.mockRejectedValue(Error("expired"));
    expect(
      await callMcpTool(
        "record_offline_approval",
        {
          ...input,
          files: [
            {
              ...file,
              download_url: "https://files.oaiusercontent.com/new-url",
            },
          ],
        },
        actor,
      ),
    ).toMatchObject({ replayed: true, approved: true });
    expect(state.images).toHaveBeenCalledTimes(1);
  });
  it("private quote saves require the current draft version and do not publish or email", async () => {
    const p = await project(),
      input = {
        request_id: p.id,
        client_reference: randomUUID(),
        kind: "quote",
        expected_draft_version: 0,
        title: "New private quote",
        description: "Owner supplied prices",
        items: [
          { name: "Set", quantity: 4, unit_inr: 1200, item_type: "gift" },
        ],
      };
    expect(
      await callMcpTool("save_approval_draft", input, actor),
    ).toMatchObject({ private: true, version: 1 });
    expect(state.send).not.toHaveBeenCalled();
    await expect(
      callMcpTool(
        "save_approval_draft",
        { ...input, client_reference: randomUUID() },
        actor,
      ),
    ).rejects.toThrow("draft changed");
    expect(
      (
        await sql`SELECT document FROM gyvft_gift_approval_drafts WHERE project_id=${p.id}::uuid`
      )[0].document.items[0].unit_paise,
    ).toBe(120000);
  });
  it("requires approved exact artwork before invoking the Shopify adapter", async () => {
    const p = await approved(),
      input = {
        request_id: p.id,
        client_reference: randomUUID(),
        approval_id: p.quote,
        expected_version: 1,
        design_id: randomUUID(),
        expected_design_version: 1,
        expected_paid_inr: 6650,
        confirmed_create: true,
      };
    await expect(
      callMcpTool("create_shopify_order", input, actor),
    ).rejects.toThrow("artwork");
    expect(state.shopify).not.toHaveBeenCalled();
  });
  it("publishes only a reviewed current quote draft and exposes its exact Operations version", async () => {
    const p = await project(),
      input = {
        request_id: p.id,
        client_reference: randomUUID(),
        kind: "quote",
        expected_draft_version: 0,
        title: "Owner reviewed quote",
        description: "Four branded sets",
        items: [
          {
            name: "Branded set",
            quantity: 4,
            unit_inr: 1200,
            item_type: "gift",
          },
        ],
      };
    await callMcpTool("save_approval_draft", input, actor);
    const publish = {
      request_id: p.id,
      client_reference: randomUUID(),
      kind: "quote",
      expected_version: 1,
      notify_customer: true,
    };
    const result = await callMcpTool("publish_approval_draft", publish, actor);
    expect(result).toMatchObject({ published: true, version: 2 });
    expect(
      await callMcpTool("publish_approval_draft", publish, actor),
    ).toMatchObject({ replayed: true, version: 2 });
    const position = await callMcpTool(
      "get_gift_operations",
      { request_id: p.id },
      actor,
    );
    expect(position.current_quote).toMatchObject({
      version: 2,
      status: "pending",
      total_inr: 4800,
    });
    expect(
      (
        await sql`SELECT count(*)::int AS n FROM customer_project_approvals WHERE project_id=${p.id}::uuid`
      )[0].n,
    ).toBe(2);
  });
  it("customer intake over MCP preserves existing credentials and retries without expired attachments", async () => {
    const email = randomUUID() + "@example.test",
      input = {
        client_reference: randomUUID(),
        name: "New fictional customer",
        email,
        requirement: {
          title: "Team gifts",
          story: "Journals for a small team",
        },
        files: [],
      };
    const saved = await callMcpTool("create_customer_intake", input, actor);
    expect(saved).toMatchObject({ created_account: true, email_sent: false });
    expect(state.send).not.toHaveBeenCalled();
    state.files.mockRejectedValue(Error("expired"));
    expect(
      await callMcpTool("create_customer_intake", input, actor),
    ).toMatchObject({ replayed: true });
    state.files.mockResolvedValue([]);
    const [original] =
      await sql`SELECT password_hash FROM gyvft_customer_accounts WHERE id=${saved.account_id as string}::uuid`;
    await callMcpTool(
      "create_customer_intake",
      {
        client_reference: randomUUID(),
        customer_id: saved.account_id,
        email,
        requirement: { title: "Another requirement", story: "One more gift" },
      },
      actor,
    );
    expect(
      (
        await sql`SELECT password_hash FROM gyvft_customer_accounts WHERE id=${saved.account_id as string}::uuid`
      )[0].password_hash,
    ).toBe(original.password_hash);
  });
  it("new SQL can be replayed locally without changing customer records", async () => {
    const [before] =
      await sql`SELECT count(*)::int AS n FROM gyvft_customer_accounts`;
    await sql.unsafe(
      readFileSync(
        "supabase/migrations/20261124000004_agent_operations.sql",
        "utf8",
      ),
    );
    expect(
      (await sql`SELECT count(*)::int AS n FROM gyvft_customer_accounts`)[0].n,
    ).toBe(before.n);
  });
});
