import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
const { account, list, create, change, accept, verify } = vi.hoisted(() => ({
  account: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  change: vi.fn(),
  accept: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("@/lib/customer/session", () => ({ getCustomerAccount: account }));
vi.mock("@/lib/customer/circles", () => ({
  circlesForAccount: list,
  createCircle: create,
  changeCircle: change,
  circleForAccount: vi.fn(),
  acceptCircleInvitation: accept,
  circleOrganisationDirectory: vi.fn(),
  verifyCircleOrganisation: verify,
}));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: vi.fn(),
}));
import { GET, POST } from "@/app/api/customer/circles/route";
import { PATCH } from "@/app/api/customer/circles/[id]/route";
import { POST as acceptInvite } from "@/app/api/customer/circle-invitations/accept/route";
import { POST as operator } from "@/app/api/operations/requests/route";
const actor = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "local@example.test",
};
const req = (body: unknown, origin = "https://www.gyvft.com") =>
  new Request("https://www.gyvft.com/api/customer/circles", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  resetMemoryGuardsForTests();
  account.mockResolvedValue(actor);
  list.mockResolvedValue([]);
  create.mockResolvedValue("new-id");
  change.mockResolvedValue(undefined);
  accept.mockResolvedValue("accepted-id");
  vi.stubEnv("SETUP_SECRET", "a-local-test-secret");
});
afterEach(() => vi.unstubAllEnvs());
describe("Circle HTTP authentication boundaries", () => {
  it("requires a customer session and returns private, uncached data", async () => {
    account.mockResolvedValueOnce(null);
    expect(
      (await GET(new Request("https://www.gyvft.com/api/customer/circles")))
        .status,
    ).toBe(401);
    const r = await GET(
      new Request("https://www.gyvft.com/api/customer/circles"),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(list).toHaveBeenCalledWith(actor.id, false);
  });
  it("rejects cross-origin mutation before any domain command", async () => {
    expect((await POST(req({}, "https://elsewhere.example"))).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
    expect(
      (
        await PATCH(req({}, "https://elsewhere.example"), {
          params: Promise.resolve({ id: actor.id }),
        })
      ).status,
    ).toBe(403);
    expect(change).not.toHaveBeenCalled();
  });
  it("uses the authenticated identity and accepts normal domain payloads up to 8KB", async () => {
    const payload = { description: "x".repeat(3000) };
    expect((await POST(req(payload))).status).toBe(201);
    expect(create).toHaveBeenCalledWith(actor, payload);
    expect((await POST(req({ description: "x".repeat(9000) }))).status).toBe(
      413,
    );
  });
  it("requires exact invitation acceptance input; never treats an account field as authority", async () => {
    expect(
      (
        await acceptInvite(
          req({
            token: "x".repeat(43),
            display_name: "Member",
            share_profile: false,
            account_id: actor.id,
          }),
        )
      ).status,
    ).toBe(400);
    expect(accept).not.toHaveBeenCalled();
    expect(
      (
        await acceptInvite(
          req({
            token: "x".repeat(43),
            display_name: "Member",
            share_profile: false,
          }),
        )
      ).status,
    ).toBe(200);
    expect(accept).toHaveBeenCalledWith(actor, "x".repeat(43), {
      display_name: "Member",
      share_profile: false,
    });
  });
  it("does not let a customer cookie grant operator organisation verification", async () => {
    const r = await operator(
      req({
        op: "verify_circle_organisation",
        id: actor.id,
        state: "verified",
        note: "Checking details",
        confirmed: true,
      }),
    );
    expect(r.status).toBe(401);
    expect(verify).not.toHaveBeenCalled();
  });
});
