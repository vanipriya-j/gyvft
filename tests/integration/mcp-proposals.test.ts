import { randomUUID, createHash } from "node:crypto";
import { decodeJwt } from "jose";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import type { Sql } from "postgres";
import { proposalFixture } from "../fixtures/proposal-database";
let sql: Sql;
const mocks = vi.hoisted(() => ({ notify: vi.fn(), prepareImages: vi.fn() }));
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("@/lib/customer/notifications", () => ({
  queueNotification: mocks.notify,
}));
vi.mock("@/lib/mcp/images", async (original) => ({
  ...(await original<typeof import("@/lib/mcp/images")>()),
  prepareMcpImages: mocks.prepareImages,
}));
import {
  approveMcpConnection,
  signAuthorisationRequest,
  exchangeMcpToken,
  authenticateMcp,
  hashToken,
  revokeMcpToken,
} from "@/lib/mcp/auth";
import { mcpClientId, mcpResource, mcpScopes } from "@/lib/mcp/config";
import { setMcpEnabled, revokeMcpGrant } from "@/lib/mcp/settings";
import { giftWorkspace } from "@/lib/customer/gift-workspace";
import {
  saveOptionDraft,
  publishOptionDraft,
} from "@/lib/customer/option-drafts";
import { callMcpTool } from "@/lib/mcp/tools";
import { POST as rpc } from "@/app/mcp/route";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
const uri = process.env.TEST_OPTION_IMAGES_DB_URL;
const secret = "local-operator-proposal-fixture",
  redirect = "https://chatgpt.com/connector_platform_oauth_redirect",
  verifier = "fixture-pkce-verifier-" + "v".repeat(43);
const image = {
  mime: "image/png",
  data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XxioAAAAASUVORK5CYII=",
};
const option = {
  title: "Fictional team appreciation",
  description: "A coordinated set.",
  contents: [
    { key: "journal", name: "Custom journal", quantity: 1, unit_paise: null },
  ],
  pricing: {
    mode: "none",
    basis: "per_set",
    quantity: 1,
    low_paise: null,
    high_paise: null,
    packaging_included: false,
  },
};
describe.skipIf(!uri)(
  "GPT authorisation and proposal boundaries against isolated PostgreSQL",
  () => {
    const project = randomUUID(),
      owner = randomUUID(),
      privateProject = randomUUID();
    let accessToken: string,
      refreshToken: string,
      grantId: string,
      draftId: string,
      draftVersion: number;
    const authInput = (scope = mcpScopes.join(" ")) => ({
      client_id: mcpClientId,
      redirect_uri: redirect,
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      state: "fixture-state",
      resource: mcpResource(),
      scope,
    });
    async function issue(scope?: string) {
      const request = await signAuthorisationRequest(authInput(scope));
      const callback = new URL(await approveMcpConnection(request, secret));
      return callback;
    }
    const params = (code: string) =>
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: mcpClientId,
        code,
        code_verifier: verifier,
        redirect_uri: redirect,
        resource: mcpResource(),
      });
    const protocol = (
      body: unknown,
      token = accessToken,
      headers: Record<string, string> = {},
    ) =>
      rpc(
        new Request("https://www.gyvft.com/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: "Bearer " + token } : {}),
            ...headers,
          },
          body: JSON.stringify(body),
        }),
      );
    beforeAll(async () => {
      vi.stubEnv("SETUP_SECRET", secret);
      vi.stubEnv("GYVFT_MCP_ORIGIN", undefined);
      ({ sql } = await proposalFixture(uri!));
      await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,brief,gift_brief) VALUES(${project}::uuid,${owner}::uuid,'fictional@example.test','Fictional team gifts','Branded T-shirts, journals and bottles.',${sql.json({ budget_amount: 1200, budget_basis: "per_recipient" })})`;
      await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,is_draft) VALUES(${privateProject}::uuid,${owner}::uuid,'fictional@example.test','PRIVATE UNSUBMITTED BRIEF',true)`;
    });
    beforeEach(() => {
      resetMemoryGuardsForTests();
      mocks.prepareImages.mockReset().mockResolvedValue([]);
      mocks.notify.mockClear();
    });
    afterAll(async () => {
      if (sql) await sql.end();
      vi.unstubAllEnvs();
    });
    it("starts disabled, validates callback and PKCE, and does not persist plaintext secrets", async () => {
      await expect(signAuthorisationRequest(authInput())).rejects.toThrow(
        "disabled",
      );
      await setMcpEnabled(true);
      await expect(
        signAuthorisationRequest({
          ...authInput(),
          redirect_uri: "https://attacker.example/callback",
        }),
      ).rejects.toThrow();
      await expect(
        signAuthorisationRequest({
          ...authInput(),
          code_challenge_method: "plain",
        }),
      ).rejects.toThrow();
      const request = await signAuthorisationRequest(authInput());
      await expect(
        approveMcpConnection(request, "incorrect secret"),
      ).rejects.toThrow("could not be verified");
      expect(
        (await sql`SELECT count(*)::int AS n FROM gyvft_mcp_grants`)[0].n,
      ).toBe(0);
      const callback = new URL(await approveMcpConnection(request, secret));
      expect(callback.searchParams.get("state")).toBe("fixture-state");
      expect(callback.searchParams.get("iss")).toBe("https://www.gyvft.com");
      const code = callback.searchParams.get("code")!;
      const row = (await sql`SELECT * FROM gyvft_mcp_grants`)[0];
      expect(row.code_hash).toBe(hashToken(code));
      expect(JSON.stringify(row)).not.toContain(secret);
      const wrong = params(code);
      wrong.set("code_verifier", "wrong-" + "x".repeat(43));
      await expect(exchangeMcpToken(wrong)).rejects.toMatchObject({
        code: "invalid_grant",
      });
      const wrongResource = params(code);
      wrongResource.set("resource", "https://other.example/mcp");
      await expect(exchangeMcpToken(wrongResource)).rejects.toMatchObject({
        code: "invalid_grant",
      });
      const result = await exchangeMcpToken(params(code));
      accessToken = result.access_token;
      refreshToken = result.refresh_token;
      const actor = await authenticateMcp("Bearer " + accessToken);
      grantId = actor.id;
      expect(actor.scopes).toEqual([...mcpScopes].sort());
      await expect(exchangeMcpToken(params(code))).rejects.toMatchObject({
        code: "invalid_grant",
      });
    });
    it("rotates refresh tokens and enforces audience and revocation", async () => {
      const claims = decodeJwt(accessToken);
      expect(Number(claims.exp) - Number(claims.iat)).toBe(900);
      const refresh = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: mcpClientId,
        refresh_token: refreshToken,
        resource: mcpResource(),
      });
      const result = await exchangeMcpToken(refresh);
      await expect(exchangeMcpToken(refresh)).rejects.toMatchObject({
        code: "invalid_grant",
      });
      accessToken = result.access_token;
      refreshToken = result.refresh_token;
      const callback = await issue("gyvft:requests:read"),
        readOnly = await exchangeMcpToken(
          params(callback.searchParams.get("code")!),
        );
      const widen = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: mcpClientId,
        refresh_token: readOnly.refresh_token,
        scope: mcpScopes.join(" "),
      });
      await expect(exchangeMcpToken(widen)).rejects.toMatchObject({
        code: "invalid_scope",
      });
      await revokeMcpToken(readOnly.access_token);
      await expect(
        authenticateMcp("Bearer " + readOnly.access_token),
      ).rejects.toMatchObject({ code: "invalid_token" });
      const refreshRevoked = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: mcpClientId,
        refresh_token: readOnly.refresh_token,
      });
      await expect(exchangeMcpToken(refreshRevoked)).rejects.toMatchObject({
        code: "invalid_grant",
      });
    });
    it("old read/draft connections cannot publish and receive a reauthorisation challenge", async () => {
      const callback = await issue("gyvft:requests:read gyvft:options:write");
      const token = await exchangeMcpToken(
        params(callback.searchParams.get("code")!),
      );
      const response = await protocol(
        {
          jsonrpc: "2.0",
          id: 77,
          method: "tools/call",
          params: { name: "publish_gift_option", arguments: {} },
        },
        token.access_token,
      );
      const body = await response.json();
      expect(body.result.isError).toBe(true);
      expect(body.result._meta["mcp/www_authenticate"][0]).toContain(
        "gyvft:options:publish",
      );
    });
    it("rejects expired codes, expired refresh grants and altered access tokens", async () => {
      const callback = await issue(),
        code = callback.searchParams.get("code")!;
      await sql`UPDATE gyvft_mcp_grants SET expires_at=now()-interval '1 second' WHERE code_hash=${hashToken(code)}`;
      await expect(exchangeMcpToken(params(code))).rejects.toMatchObject({
        code: "invalid_grant",
      });
      const fresh = await issue(),
        tokens = await exchangeMcpToken(
          params(fresh.searchParams.get("code")!),
        );
      const actor = await authenticateMcp("Bearer " + tokens.access_token);
      await sql`UPDATE gyvft_mcp_grants SET refresh_expires_at=now()-interval '1 second' WHERE id=${actor.id}::uuid`;
      await expect(
        authenticateMcp("Bearer " + tokens.access_token),
      ).rejects.toMatchObject({ code: "invalid_token" });
      await expect(
        exchangeMcpToken(
          new URLSearchParams({
            grant_type: "refresh_token",
            client_id: mcpClientId,
            refresh_token: tokens.refresh_token,
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_grant" });
      await expect(
        authenticateMcp("Bearer " + accessToken.slice(0, -8) + "tampered"),
      ).rejects.toMatchObject({ code: "invalid_token" });
    });
    it("supports MCP discovery and versions without exposing data to anonymous or cross-origin calls", async () => {
      const unauthorised = await protocol(
        { jsonrpc: "2.0", id: 1, method: "tools/list" },
        "",
      );
      expect(unauthorised.status).toBe(401);
      expect(unauthorised.headers.get("www-authenticate")).toContain(
        "oauth-protected-resource/mcp",
      );
      expect(
        (
          await protocol(
            { jsonrpc: "2.0", id: 1, method: "tools/list" },
            accessToken,
            { origin: "https://attacker.example" },
          )
        ).status,
      ).toBe(403);
      const initialise = await (
        await protocol({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-11-25", capabilities: {} },
        })
      ).json();
      expect(initialise.result.protocolVersion).toBe("2025-11-25");
      expect(
        (
          await protocol({
            jsonrpc: "2.0",
            method: "notifications/initialized",
          })
        ).status,
      ).toBe(202);
      const tools = await (
        await protocol(
          {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
            params: {
              _meta: {
                "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                "io.modelcontextprotocol/clientCapabilities": {},
              },
            },
          },
          accessToken,
          { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/list" },
        )
      ).json();
      expect(
        tools.result.tools
          .slice(0, 3)
          .map((tool: { name: string }) => tool.name),
      ).toEqual([
        "list_gift_requests",
        "get_gift_request",
        "save_gift_option_draft",
      ]);
      expect(tools.result.tools[2]._meta["openai/fileParams"]).toEqual([
        "files",
      ]);
      expect(
        tools.result._meta["io.modelcontextprotocol/serverInfo"].name,
      ).toBe("GYVFT proposal workspace");
      const modernMeta = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      };
      const mismatchedHeaders: Record<string, string>[] = [
        { "MCP-Protocol-Version": "2026-07-28" },
        { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "ping" },
      ];
      for (const headers of mismatchedHeaders) {
        const rejected = await protocol(
          {
            jsonrpc: "2.0",
            id: 5,
            method: "tools/list",
            params: { _meta: modernMeta },
          },
          accessToken,
          headers,
        );
        expect(rejected.status).toBe(400);
        expect((await rejected.json()).error.code).toBe(-32020);
      }
      const missingCapabilities = await protocol(
        {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/list",
          params: {
            _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
          },
        },
        accessToken,
        { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/list" },
      );
      expect((await missingCapabilities.json()).error.code).toBe(-32602);
      const wrongToolName = await protocol(
        {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "get_gift_request",
            arguments: { request_id: project },
            _meta: modernMeta,
          },
        },
        accessToken,
        {
          "MCP-Protocol-Version": "2026-07-28",
          "Mcp-Method": "tools/call",
          "Mcp-Name": "another_tool",
        },
      );
      expect((await wrongToolName.json()).error.code).toBe(-32020);
      const encodedToolName = await protocol(
        {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "get_gift_request",
            arguments: { request_id: project },
            _meta: modernMeta,
          },
        },
        accessToken,
        {
          "MCP-Protocol-Version": "2026-07-28",
          "Mcp-Method": "tools/call",
          "Mcp-Name":
            "=?base64?" +
            Buffer.from("get_gift_request").toString("base64") +
            "?=",
        },
      );
      expect(
        (await encodedToolName.json()).result.structuredContent.request.id,
      ).toBe(project);
      const unsupported = await protocol(
        { jsonrpc: "2.0", id: 5, method: "tools/list" },
        accessToken,
        { "MCP-Protocol-Version": "2099-01-01" },
      );
      expect((await unsupported.json()).error).toMatchObject({
        code: -32022,
        data: { requested: "2099-01-01" },
      });
      const modernUnknown = await protocol(
        {
          jsonrpc: "2.0",
          id: 5,
          method: "unknown",
          params: { _meta: modernMeta },
        },
        accessToken,
        { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "unknown" },
      );
      expect(modernUnknown.status).toBe(404);
      expect(
        (
          await protocol(
            {
              jsonrpc: "2.0",
              id: 3,
              method: "tools/list",
              params: {
                _meta: {
                  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                },
              },
            },
            accessToken,
            { "MCP-Protocol-Version": "2025-11-25" },
          )
        ).status,
      ).toBe(400);
      const unknown = await (
        await protocol({ jsonrpc: "2.0", id: 4, method: "delete_everything" })
      ).json();
      expect(unknown.error.code).toBe(-32601);
    });
    it("reads submitted briefs only and checks tool scopes before saving", async () => {
      const actor = await authenticateMcp("Bearer " + accessToken);
      expect(await callMcpTool("list_gift_requests", {}, actor)).toMatchObject({
        requests: [{ id: project }],
      });
      await expect(
        callMcpTool("get_gift_request", { request_id: privateProject }, actor),
      ).rejects.toThrow("unavailable");
      const data = await callMcpTool(
        "get_gift_request",
        { request_id: project },
        actor,
      );
      expect(JSON.stringify(data)).not.toMatch(
        /PRIVATE UNSUBMITTED|refresh_hash|payment/,
      );
      await expect(
        callMcpTool(
          "save_gift_option_draft",
          {},
          { id: actor.id, scopes: ["gyvft:requests:read"] },
        ),
      ).rejects.toThrow("required scope");
    });
    it("creates image-free private drafts idempotently without notifying or exposing them to customers", async () => {
      const input = {
        project_id: project,
        client_reference: randomUUID(),
        option,
      };
      const first = await saveOptionDraft(input, "mcp", grantId);
      draftId = first.id;
      draftVersion = first.version;
      expect(first.published).toBe(false);
      expect(first.imageCount).toBe(0);
      expect((await saveOptionDraft(input, "mcp", grantId)).duplicate).toBe(
        true,
      );
      expect((await giftWorkspace(project, owner)).options).toHaveLength(0);
      expect((await giftWorkspace(project)).options).toHaveLength(1);
      expect(
        (await sql`SELECT count(*)::int AS n FROM customer_project_events`)[0]
          .n,
      ).toBe(0);
      expect(mocks.notify).not.toHaveBeenCalled();
      await expect(
        publishOptionDraft(project, draftId, draftVersion),
      ).rejects.toThrow("at least one image");
      await expect(
        saveOptionDraft(
          { ...input, option: { ...option, title: "Different title" } },
          "mcp",
          grantId,
        ),
      ).rejects.toThrow("different draft data");
    });
    it("appends images, preserves revision history and rejects stale or cross-request updates", async () => {
      const write = {
        project_id: project,
        client_reference: randomUUID(),
        option_id: draftId,
        expected_version: draftVersion,
        option,
        images: [image, image],
      };
      const saved = await saveOptionDraft(write, "mcp", grantId);
      draftVersion = saved.version;
      expect(saved.imageCount).toBe(2);
      expect((await saveOptionDraft(write, "mcp", grantId)).duplicate).toBe(
        true,
      );
      await expect(
        saveOptionDraft(
          { ...write, client_reference: randomUUID() },
          "mcp",
          grantId,
        ),
      ).rejects.toThrow("changed");
      await expect(
        saveOptionDraft(
          {
            ...write,
            project_id: privateProject,
            client_reference: randomUUID(),
          },
          "mcp",
          grantId,
        ),
      ).rejects.toThrow("unavailable");
      expect(
        (
          await sql`SELECT count(*)::int AS n FROM gyvft_gift_option_draft_versions WHERE option_id=${draftId}::uuid`
        )[0].n,
      ).toBe(2);
      expect((await giftWorkspace(project, owner)).options).toHaveLength(0);
      expect(mocks.notify).not.toHaveBeenCalled();
    });
    it("publishes the reviewed version once and then locks agent edits", async () => {
      await expect(publishOptionDraft(project, draftId, 1)).rejects.toThrow(
        "latest version",
      );
      await publishOptionDraft(project, draftId, draftVersion);
      await publishOptionDraft(project, draftId, draftVersion);
      expect(mocks.notify).toHaveBeenCalledTimes(1);
      expect((await giftWorkspace(project, owner)).options).toHaveLength(1);
      expect(
        (await sql`SELECT count(*)::int AS n FROM customer_project_events`)[0]
          .n,
      ).toBe(1);
      await expect(
        saveOptionDraft(
          {
            project_id: project,
            client_reference: randomUUID(),
            option_id: draftId,
            expected_version: draftVersion,
            option,
          },
          "mcp",
          grantId,
        ),
      ).rejects.toThrow("Published options");
      await sql`UPDATE customer_projects SET stage=7 WHERE id=${project}::uuid`;
      await expect(
        saveOptionDraft(
          { project_id: project, client_reference: randomUUID(), option },
          "mcp",
          grantId,
        ),
      ).rejects.toThrow("locked");
    });
    it("confirms an uploaded draft on retry without downloading an expired file link again", async () => {
      const requestId = randomUUID();
      await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title) VALUES(${requestId}::uuid,${owner}::uuid,'fictional@example.test','Fictional file upload')`;
      const actor = await authenticateMcp("Bearer " + accessToken),
        input = {
          request_id: requestId,
          client_reference: randomUUID(),
          option: {
            title: "Uploaded test option",
            contents: [{ name: "Custom journal", quantity: 1 }],
          },
          files: [
            {
              file_id: "file_fixture_image",
              download_url:
                "https://files.oaiusercontent.com/fixture?token=not-persisted",
            },
          ],
        };
      mocks.prepareImages.mockResolvedValueOnce([image]);
      const saved = (await callMcpTool(
        "save_gift_option_draft",
        input,
        actor,
      )) as { id: string; duplicate: boolean };
      expect(saved.duplicate).toBe(false);
      const calls = mocks.prepareImages.mock.calls.length;
      mocks.prepareImages.mockRejectedValueOnce(Error("Link expired"));
      const replay = (await callMcpTool(
        "save_gift_option_draft",
        input,
        actor,
      )) as { id: string; duplicate: boolean };
      expect(replay).toMatchObject({ id: saved.id, duplicate: true });
      expect(mocks.prepareImages).toHaveBeenCalledTimes(calls);
      await expect(
        callMcpTool(
          "save_gift_option_draft",
          { ...input, option: { ...input.option, title: "Different data" } },
          actor,
        ),
      ).rejects.toThrow("different draft data");
      expect((await giftWorkspace(requestId, owner)).options).toHaveLength(0);
      expect((await giftWorkspace(requestId)).options).toHaveLength(1);
      expect(mocks.notify).not.toHaveBeenCalled();
      const history =
        await sql`SELECT document FROM gyvft_gift_option_draft_versions WHERE option_id=${saved.id}::uuid`;
      expect(JSON.stringify(history)).not.toContain("not-persisted");
    });
    it("revokes active access immediately when the owner disables the connection", async () => {
      await setMcpEnabled(false);
      await expect(authenticateMcp("Bearer " + accessToken)).rejects.toThrow(
        "disabled",
      );
      await setMcpEnabled(true);
      await expect(
        authenticateMcp("Bearer " + accessToken),
      ).rejects.toMatchObject({ code: "invalid_token" });
      await revokeMcpGrant(grantId);
      expect(
        (
          await sql`SELECT revoked_at IS NOT NULL AS revoked FROM gyvft_mcp_grants WHERE id=${grantId}::uuid`
        )[0].revoked,
      ).toBe(true);
    });
  },
);
