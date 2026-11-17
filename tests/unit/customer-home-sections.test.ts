import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  gifts: vi.fn(),
  occasions: vi.fn(),
  saved: vi.fn(),
  payments: vi.fn(),
  catalogue: vi.fn(),
  event: vi.fn(),
}));
vi.mock("@/lib/customer/home-data", () => ({
  homeGifts: mocks.gifts,
  homeOccasions: mocks.occasions,
  homePayments: mocks.payments,
}));
vi.mock("@/lib/customer/saved-ideas", () => ({ savedIdeasFor: mocks.saved }));
vi.mock("@/lib/customer/catalogue", () => ({
  aarlaCatalogue: mocks.catalogue,
}));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: mocks.event,
}));
import { customerHome, homeQuery } from "@/lib/customer/home";
const account = { id: "owner", email: "owner@example.test" };
describe("independent Home sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [
      mocks.gifts,
      mocks.occasions,
      mocks.saved,
      mocks.payments,
    ])
      fn.mockResolvedValue({ items: [], total: 0 });
    mocks.catalogue.mockResolvedValue({ available: false });
  });
  it("keeps personal gifts available when the external catalogue fails", async () => {
    mocks.saved.mockRejectedValue({ code: "42P01" });
    const result = await customerHome(
      account,
      homeQuery.parse({}),
      new Date("2026-11-16T20:00:00Z"),
    );
    expect(result.today).toBe("2026-11-17");
    expect(result.sections.gifts?.status).toBe("ready");
    expect(result.sections.saved).toEqual({
      status: "setup_required",
      data: null,
    });
    expect(result.sections.aarla).toEqual({
      status: "unavailable",
      data: null,
    });
  });
  it("fetches only the carousel being advanced", async () => {
    await customerHome(
      account,
      homeQuery.parse({ section: "gifts", offset: 6, limit: 3 }),
    );
    expect(mocks.gifts).toHaveBeenCalledWith("owner", 6, 3);
    expect(mocks.catalogue).not.toHaveBeenCalled();
    expect(mocks.payments).not.toHaveBeenCalled();
  });
  it("distinguishes a real zero from an unavailable payment summary", async () => {
    mocks.payments.mockRejectedValue(new Error("password=private"));
    const result = await customerHome(
      account,
      homeQuery.parse({ section: "payments" }),
    );
    expect(result.sections.payments).toEqual({
      status: "unavailable",
      data: null,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
