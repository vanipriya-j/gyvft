import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  home: vi.fn(),
  save: vi.fn(),
  event: vi.fn(),
}));
vi.mock("@/lib/customer/session", () => ({
  getCustomerAccount: mocks.account,
}));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: mocks.event,
}));
vi.mock("@/lib/customer/home", async (original) => ({
  ...(await original<typeof import("@/lib/customer/home")>()),
  customerHome: mocks.home,
}));
vi.mock("@/lib/customer/saved-ideas", async (original) => ({
  ...(await original<typeof import("@/lib/customer/saved-ideas")>()),
  setSavedIdea: mocks.save,
}));
import { GET } from "@/app/api/customer/home/route";
import { PUT, DELETE } from "@/app/api/customer/saved-ideas/route";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
const request = (body: unknown, origin = "https://www.gyvft.com") =>
  new Request("https://www.gyvft.com/api/customer/saved-ideas", {
    method: "PUT",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
describe("customer Home API security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMemoryGuardsForTests();
    mocks.account.mockResolvedValue({
      id: "owner",
      email: "owner@example.test",
    });
    mocks.home.mockResolvedValue({ sections: {} });
    mocks.save.mockResolvedValue({ saved: true });
  });
  it("returns a JSON 401 rather than a login redirect and never loads personal data", async () => {
    mocks.account.mockResolvedValue(null);
    const r = await GET(new Request("https://www.gyvft.com/api/customer/home"));
    expect(r.status).toBe(401);
    expect(mocks.home).not.toHaveBeenCalled();
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("binds reads to the cookie account and rejects ownership query parameters", async () => {
    expect(
      (
        await GET(
          new Request(
            "https://www.gyvft.com/api/customer/home?accountId=victim",
          ),
        )
      ).status,
    ).toBe(400);
    const r = await GET(
      new Request(
        "https://www.gyvft.com/api/customer/home?section=gifts&offset=6&limit=3",
      ),
    );
    expect(r.status).toBe(200);
    expect(mocks.home).toHaveBeenCalledWith(
      { id: "owner", email: "owner@example.test" },
      { section: "gifts", offset: 6, limit: 3 },
    );
    expect(r.headers.get("vary")).toBe("Cookie");
  });
  it("rejects missing or cross-site origins on cookie-authenticated writes", async () => {
    expect(
      (await PUT(request({ kind: "product", id: "123" }, "https://evil.test")))
        .status,
    ).toBe(403);
    const r = request({ kind: "product", id: "123" });
    r.headers.delete("origin");
    expect((await PUT(r)).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("accepts only a reference, with explicit idempotent save/remove intent", async () => {
    expect(
      (
        await PUT(
          request({ kind: "product", id: "123", title: "Fake", price: 1 }),
        )
      ).status,
    ).toBe(400);
    await PUT(request({ kind: "product", id: "123" }));
    await DELETE(request({ kind: "product", id: "123" }));
    expect(mocks.save).toHaveBeenNthCalledWith(
      1,
      "owner",
      { kind: "product", id: "123" },
      true,
    );
    expect(mocks.save).toHaveBeenNthCalledWith(
      2,
      "owner",
      { kind: "product", id: "123" },
      false,
    );
  });
  it("bounds payload size and never leaks a database error", async () => {
    expect((await PUT(request({ id: "a".repeat(3000) }))).status).toBe(413);
    mocks.save.mockRejectedValue(new Error("password=secret-host"));
    const r = await PUT(request({ kind: "product", id: "123" }));
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("secret-host");
  });
});
