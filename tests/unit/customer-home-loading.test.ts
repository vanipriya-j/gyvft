import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ catalogue: vi.fn(), sql: vi.fn() }));
vi.mock("@/lib/customer/catalogue", () => ({
  aarlaCatalogue: mocks.catalogue,
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => mocks.sql }));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: vi.fn(),
}));
vi.mock("@/lib/customer/home-data", () => ({
  homeGifts: async () => ({ items: [], total: 0 }),
  homeOccasions: async () => ({ items: [], total: 0 }),
  homePayments: async () => ({ items: [], total: 0 }),
}));
vi.mock("@/lib/customer/saved-ideas", () => ({
  savedIdeasFor: async () => ({ items: [], total: 0 }),
}));
import { customerHome, homeQuery } from "@/lib/customer/home";
const account = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "fixture@example.test",
};
describe("independent external recommendations", () => {
  beforeEach(() => {
    mocks.catalogue.mockReset();
    mocks.sql.mockResolvedValue([]);
  });
  it("renders owned Home data even when the external catalogue would never resolve", async () => {
    mocks.catalogue.mockImplementation(() => new Promise(() => {}));
    const home = await customerHome(account, homeQuery.parse({}), new Date(), {
      deferExternalCatalogue: true,
    });
    expect(home.sections.gifts?.status).toBe("ready");
    expect(home.sections.occasions?.status).toBe("ready");
    expect(home.sections.aarla).toBeUndefined();
    expect(mocks.catalogue).not.toHaveBeenCalled();
  });
  it("retains the authenticated section API for fetching the catalogue independently", async () => {
    mocks.catalogue.mockResolvedValue({
      available: true,
      allProducts: [],
      products: [],
      offers: [],
    });
    const home = await customerHome(
      account,
      homeQuery.parse({ section: "aarla" }),
    );
    expect(home.sections.aarla?.status).toBe("ready");
    expect(home.sections.gifts).toBeUndefined();
    expect(mocks.catalogue).toHaveBeenCalledOnce();
  });
});
