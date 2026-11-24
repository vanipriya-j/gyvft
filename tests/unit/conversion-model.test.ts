import { describe, expect, it } from "vitest";
import {
  conversionFacts,
  reportCsv,
  type ConversionProject,
} from "@/lib/customer/conversion-model";
const now = new Date("2026-11-24T06:00:00Z"),
  settings = { windowDays: 90, stalledDays: 3 };
const project = (
  overrides: Partial<ConversionProject> = {},
): ConversionProject => ({
  id: "request",
  title: "A gift",
  customer_email: "test@example.test",
  created_at: "2026-11-01T06:00:00Z",
  stage: 3,
  kind: "enquiry",
  task_owner: "Aarla",
  shopify_order_reference: null,
  has_options: true,
  visible_options: true,
  has_selection: true,
  has_quote: true,
  approved_quote: false,
  verified_payment: false,
  pending_payment: false,
  paid_paise: "0",
  quote_status: "pending",
  design_status: null,
  quote_paise: "1330000",
  shared_at: "2026-11-20T06:00:00Z",
  decided_at: null,
  last_customer: null,
  last_team: null,
  last_activity: null,
  ...overrides,
});
describe("conversion facts", () => {
  it("flags a quote after the agreed three-day boundary without calling it cancelled", () => {
    const facts = conversionFacts(
      [project({ shared_at: "2026-11-21T06:00:00Z" })],
      settings,
      now,
    );
    expect(facts.stalledProposals).toBe(1);
    expect(facts.followUps[0]).toMatchObject({
      waiting: "Customer",
      days: 3,
      tab: "quote",
    });
    expect(
      conversionFacts(
        [project({ shared_at: "2026-11-21T06:00:01Z" })],
        settings,
        now,
      ).stalledProposals,
    ).toBe(0);
  });
  it("treats an unanswered customer question and change request as Aarla work", () => {
    const facts = conversionFacts(
      [
        project({
          shared_at: "2026-11-15T06:00:00Z",
          last_customer: "2026-11-19T06:00:00Z",
          last_team: "2026-11-18T06:00:00Z",
        }),
        project({
          id: "changes",
          quote_status: "changes_requested",
          decided_at: "2026-11-19T06:00:00Z",
        }),
      ],
      settings,
      now,
    );
    expect(facts.stalledProposals).toBe(0);
    expect(facts.waitingAarla).toBe(2);
    expect(facts.followUps[0].action).toBe("Reply to customer");
  });
  it("keeps payment proof out of paid conversions and routes it to bank verification", () => {
    const f = conversionFacts(
      [
        project({
          approved_quote: true,
          quote_status: "approved",
          stage: 4,
          pending_payment: true,
        }),
      ],
      settings,
      now,
    );
    expect(f.quoteToPayment).toEqual({ numerator: 0, denominator: 1 });
    expect(f.verifiedPaise).toBe("0");
    expect(f.followUps[0]).toMatchObject({
      waiting: "Aarla",
      action: "Verify payment",
      tab: "payments",
    });
  });
  it("does not count operator work or completed production as customer abandonment", () => {
    const f = conversionFacts(
      [
        project({
          id: "hidden",
          has_quote: false,
          has_selection: false,
          visible_options: false,
          quote_status: null,
        }),
        project({ id: "production", stage: 7 }),
        project({ id: "delivered", stage: 10 }),
      ],
      settings,
      now,
    );
    expect(f.stalledProposals).toBe(0);
    expect(f.followUps).toHaveLength(1);
    expect(f.followUps[0].waiting).toBe("Aarla");
    expect(f.milestones.find((m) => m.key === "options")?.count).toBe(3);
  });
  it("uses one request cohort for rates while retaining older open follow-ups", () => {
    const f = conversionFacts(
      [
        project({ id: "old", created_at: "2025-01-01T00:00:00Z" }),
        project({
          id: "new",
          approved_quote: true,
          verified_payment: true,
          paid_paise: "665000",
        }),
      ],
      settings,
      now,
    );
    expect(f.cohortCount).toBe(1);
    expect(f.quoteToPayment).toEqual({ numerator: 1, denominator: 1 });
    expect(f.verifiedPaise).toBe("665000");
    expect(f.followUps).toHaveLength(2);
  });
  it("reports empty denominators and sums money without floating-point rounding", () => {
    const f = conversionFacts(
      [
        project({ paid_paise: "90071992547409910" }),
        project({ id: "two", paid_paise: "1" }),
      ],
      settings,
      now,
    );
    expect(f.verifiedPaise).toBe("90071992547409911");
    expect(conversionFacts([], settings, now).quoteApproval).toEqual({
      numerator: 0,
      denominator: 0,
    });
  });
  it("quotes export cells and prevents spreadsheet formulas", () => {
    expect(
      reportCsv([['=HYPERLINK("bad")', "safe, title", "line\nline", "@evil"]]),
    ).toBe('"\'=HYPERLINK(""bad"")","safe, title","line\nline","\'@evil"');
  });
});
