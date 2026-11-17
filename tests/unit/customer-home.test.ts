import { describe, it, expect } from "vitest";
import { financialYear, giftAction, pageOf } from "@/lib/customer/home-model";
import { homeQuery } from "@/lib/customer/home";
const base = {
  id: "gift",
  kind: "project",
  stage: 4,
  demo: false,
  total: 10001,
  paid: 0,
  pendingKind: null,
  pendingPayment: false,
  options: 0,
  quoteRequested: false,
};
describe("Home data contract", () => {
  it("uses April to March financial years, not calendar years", () => {
    expect(financialYear("2027-03-31")).toEqual({
      start: "2026-04-01",
      endExclusive: "2027-04-01",
      label: "2026–27",
    });
    expect(financialYear("2027-04-01").start).toBe("2027-04-01");
  });
  it("returns totals independent of the visible carousel page", () => {
    expect(pageOf([1, 2, 3], 1, 1)).toEqual({
      items: [2],
      total: 3,
      offset: 1,
      limit: 1,
      nextOffset: 2,
    });
    expect(pageOf([1, 2], 2, 2)).toMatchObject({
      items: [],
      total: 2,
      nextOffset: null,
    });
  });
  it("asks for the advance only until the rounded-up half is paid", () => {
    expect(giftAction({ ...base, paid: 5000 }).kind).toBe("payment");
    expect(giftAction({ ...base, paid: 5001 }).kind).toBe("view");
    expect(giftAction({ ...base, paid: 5001, stage: 8 }).label).toBe(
      "Pay balance",
    );
  });
  it("does not ask customers to pay again while verification is pending", () => {
    expect(giftAction({ ...base, pendingPayment: true })).toMatchObject({
      kind: "payment_verification",
      requiresAction: false,
    });
  });
  it("does not reopen option selection after a quote has been requested", () => {
    expect(
      giftAction({ ...base, kind: "enquiry", options: 2, quoteRequested: true })
        .kind,
    ).toBe("view");
    expect(
      giftAction({
        ...base,
        kind: "enquiry",
        options: 2,
        quoteRequested: false,
      }).kind,
    ).toBe("options");
  });
  it("keeps sample requests read-only", () =>
    expect(
      giftAction({ ...base, demo: true, pendingKind: "proposal" }),
    ).toMatchObject({ label: "View sample", requiresAction: false }));
  it("rejects unbounded pagination and caller-supplied account IDs", () => {
    for (const input of [
      { limit: 21 },
      { offset: -1 },
      { section: "unknown" },
      { accountId: "somebody-else" },
      { limit: "" },
    ])
      expect(homeQuery.safeParse(input).success).toBe(false);
  });
});
