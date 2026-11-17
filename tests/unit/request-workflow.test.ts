import { describe, expect, it } from "vitest";
import {
  requestWorkflow,
  latestApproval,
} from "@/lib/customer/request-workflow";
const enquiry = {
  kind: "enquiry",
  stage: 2,
  total: 0,
  paid: 0,
  approvals: [],
  selectionId: null,
  visibleOptions: 2,
  pendingPayment: false,
};
const quote = {
  id: "quote",
  kind: "proposal",
  version: 1,
  status: "approved",
  gift_selection_id: "selection-a",
};
describe("request workflow across customer and operations", () => {
  it("distinguishes available directions from a submitted selection", () => {
    expect(requestWorkflow(enquiry)).toBe("options_ready");
    expect(requestWorkflow({ ...enquiry, selectionId: "selection-a" })).toBe(
      "quote_requested",
    );
  });
  it("requires a quote for the exact latest selection", () => {
    expect(
      requestWorkflow({
        ...enquiry,
        selectionId: "selection-b",
        approvals: [quote],
      }),
    ).toBe("quote_requested");
    expect(
      requestWorkflow({
        ...enquiry,
        selectionId: "selection-a",
        approvals: [quote],
      }),
    ).toBe("quote_approved");
  });
  it("uses the latest version rather than a previously approved quote", () => {
    const revised = { ...quote, id: "revised", version: 2, status: "pending" };
    expect(latestApproval([quote, revised], "proposal")?.id).toBe("revised");
    expect(
      requestWorkflow({
        ...enquiry,
        selectionId: "selection-a",
        approvals: [quote, revised],
      }),
    ).toBe("quote_review");
  });
  it("keeps legacy quotes without a selection reviewable", () => {
    expect(
      requestWorkflow({
        ...enquiry,
        approvals: [{ ...quote, status: "pending", gift_selection_id: null }],
      }),
    ).toBe("quote_review");
  });
  it("rounds the 50 percent advance up and never credits a pending receipt", () => {
    const order = {
      ...enquiry,
      kind: "project",
      stage: 4,
      total: 10001,
      paid: 5000,
    };
    expect(requestWorkflow(order)).toBe("advance_due");
    expect(requestWorkflow({ ...order, pendingPayment: true })).toBe(
      "payment_review",
    );
    expect(requestWorkflow({ ...order, paid: 5001 })).toBe(
      "design_in_progress",
    );
  });
  it("shows changes requested for the latest artwork", () => {
    expect(
      requestWorkflow({
        ...enquiry,
        kind: "project",
        stage: 6,
        total: 10000,
        paid: 5000,
        approvals: [{ ...quote, kind: "design", status: "changes_requested" }],
      }),
    ).toBe("design_changes");
  });
  it("asks for balance at packing and retains delivery state thereafter", () => {
    const order = {
      ...enquiry,
      kind: "project",
      stage: 8,
      total: 10000,
      paid: 5000,
    };
    expect(requestWorkflow(order)).toBe("balance_due");
    expect(requestWorkflow({ ...order, pendingPayment: true })).toBe(
      "payment_review",
    );
    expect(requestWorkflow({ ...order, paid: 10000 })).toBe("packing");
    expect(requestWorkflow({ ...order, stage: 9 })).toBe("dispatched");
    expect(requestWorkflow({ ...order, stage: 10 })).toBe("delivered");
  });
});
