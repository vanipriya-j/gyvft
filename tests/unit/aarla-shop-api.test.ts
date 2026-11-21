import { beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ account: vi.fn(), shop: vi.fn() }));
vi.mock("@/lib/customer/session", () => ({ getCustomerAccount: mock.account }));
vi.mock("@/lib/customer/aarla-shop", () => ({
  shopAarlaForAccount: mock.shop,
}));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: vi.fn(),
}));
import { POST } from "@/app/api/customer/aarla-shop/route";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";
const request = (data: unknown, origin = "https://www.gyvft.com") =>
  new Request("https://www.gyvft.com/api/customer/aarla-shop", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  vi.clearAllMocks();
  resetMemoryGuardsForTests();
  mock.account.mockResolvedValue({ id: "owner", email: "owner@example.test" });
  mock.shop.mockResolvedValue({
    redirectUrl: "https://aarla.in/discount/confirmed",
    percentage: 5,
  });
});
it("requires same-origin authenticated writes before touching Shopify", async () => {
  expect(
    (await POST(request({ destination: "/" }, "https://evil.test"))).status,
  ).toBe(403);
  mock.account.mockResolvedValue(null);
  expect((await POST(request({ destination: "/" }))).status).toBe(401);
  expect(mock.shop).not.toHaveBeenCalled();
});
it("takes identity from the customer session and returns private uncached data", async () => {
  const r = await POST(request({ destination: "/products/example" }));
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(mock.shop.mock.calls[0][0]).toEqual({
    id: "owner",
    email: "owner@example.test",
  });
});
it("rejects another customer ID or an external redirect supplied by the browser", async () => {
  for (const data of [
    { destination: "/", customerId: "other" },
    { destination: "https://evil.test/" },
  ])
    expect((await POST(request(data))).status).toBe(400);
  expect(mock.shop).not.toHaveBeenCalled();
});
