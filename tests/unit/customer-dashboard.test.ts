import { describe, expect, it } from "vitest";
import {
  dashboardStats,
  dateKey,
  filterRequests,
  formatCounts,
  indiaToday,
  nextOccasionDate,
  requestActivity,
  summarizeRequests,
  upcomingDates,
  type Occasion,
  type RequestRow,
} from "@/lib/customer/dashboard-model";
import type { CustomerProject } from "@/lib/customer/data";
import { storyInput } from "../fixtures/story-request";
const row = (changes: Partial<RequestRow> = {}): RequestRow => ({
  id: "request-one",
  title: "A birthday gift",
  kind: "enquiry",
  stage: 0,
  nextAction: "We are reviewing your brief",
  organisation: "",
  occasion: "Birthday",
  formats: ["Book"],
  quantity: "1-25",
  budget: "1L-5L",
  briefDate: "2026-12-01",
  datePrecision: "exact",
  occasionDate: null,
  deliveryDate: null,
  paidPaise: 0,
  totalPaise: null,
  createdAt: "2026-11-01T10:00:00Z",
  demo: false,
  ...changes,
});
const occasion = (changes: Partial<Occasion> = {}): Occasion => ({
  id: "occasion-one",
  title: "Birthday",
  occasion_date: "2000-12-05",
  repeats_annually: true,
  ...changes,
});
describe("customer gifting dashboard", () => {
  it("keeps brief targets, occasion dates and requested delivery dates separate", () => {
    expect(upcomingDates([row()], [], "2026-11-01")).toEqual([]);
    const dates = upcomingDates(
      [row({ occasionDate: "2026-12-05", deliveryDate: "2026-12-03" })],
      [],
      "2026-11-01",
    );
    expect(dates.map((d) => [d.kind, d.date])).toEqual([
      ["delivery", "2026-12-03"],
      ["occasion", "2026-12-05"],
    ]);
  });
  it("rolls annual dates forward without changing the saved birthday", () => {
    const o = occasion();
    expect(nextOccasionDate(o, "2026-12-06")).toBe("2027-12-05");
    expect(o.occasion_date).toBe("2000-12-05");
    expect(nextOccasionDate(o, "2026-12-05")).toBe("2026-12-05");
    expect(
      nextOccasionDate(occasion({ occasion_date: "2030-12-05" }), "2026-11-01"),
    ).toBe("2030-12-05");
  });
  it("handles leap-day occasions and one-off past dates explicitly", () => {
    expect(
      nextOccasionDate(occasion({ occasion_date: "2000-02-29" }), "2027-01-01"),
    ).toBe("2027-02-28");
    expect(
      nextOccasionDate(occasion({ occasion_date: "2000-02-29" }), "2028-01-01"),
    ).toBe("2028-02-29");
    expect(
      nextOccasionDate(
        occasion({ occasion_date: "2020-02-01", repeats_annually: false }),
        "2026-01-01",
      ),
    ).toBeNull();
  });
  it("never counts sample budgets, quotations or enquiry references as money spent", () => {
    const stats = dashboardStats([
      row({
        demo: true,
        kind: "project",
        paidPaise: 900000,
        totalPaise: 999999,
      }),
      row({ kind: "enquiry", paidPaise: 500000 }),
      row({ kind: "project", paidPaise: 2500, totalPaise: 10000 }),
    ]);
    expect(stats.paidPaise).toBe(2500);
    expect(stats.balancePaise).toBe(7500);
    expect(stats.total).toBe(2);
    expect(stats.sampleMode).toBe(false);
  });
  it("labels sample activity and only includes sample calendar dates when explicitly requested", () => {
    const demo = row({ demo: true, occasionDate: "2026-12-01" });
    expect(dashboardStats([demo]).sampleMode).toBe(true);
    expect(dashboardStats([demo]).paidPaise).toBe(0);
    expect(upcomingDates([demo], [], "2026-11-01")).toEqual([]);
    expect(upcomingDates([demo], [], "2026-11-01", true)).toHaveLength(1);
  });
  it("counts requests by Indian calendar month, including the year boundary", () => {
    const activity = requestActivity(
      [row({ createdAt: "2026-12-31T23:30:00Z" })],
      "2027-01-01",
    );
    expect(activity.at(-1)).toMatchObject({ key: "2027-01", count: 1 });
    expect(activity).toHaveLength(6);
    expect(indiaToday(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
  it("searches and filters without mutating the original requests", () => {
    const rows = [
      row({ id: "a", organisation: "North Star", stage: 11 }),
      row({ id: "b", deliveryDate: "2026-12-01" }),
      row({ id: "c", kind: "project", deliveryDate: "2026-11-20" }),
    ];
    expect(
      filterRequests(rows, "north", "all", "newest").map((r) => r.id),
    ).toEqual(["a"]);
    expect(
      filterRequests(rows, "", "open", "delivery").map((r) => r.id),
    ).toEqual(["c", "b"]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("does not present format selections as purchases or double-count duplicate choices", () => {
    expect(
      formatCounts([
        row({ formats: ["Book", "Book", "Film"] }),
        row({ formats: ["Book"] }),
      ]),
    ).toEqual([
      { label: "Book", count: 2 },
      { label: "Film", count: 1 },
    ]);
  });
  it("creates owner-visible summaries from the original seven-step snapshot", () => {
    const project = {
      id: "p",
      title: "Reunion",
      brief: storyInput.story_description,
      kind: "enquiry",
      stage: 0,
      next_action: "Review",
      gift_brief: { ...storyInput, source: "tell_your_story", version: 1 },
      target_date: "2099-12-01",
      total_paise: null,
      paid_paise: 0,
      created_at: "2026-11-01",
      submission_key: "gyvft-demo-test",
    } as unknown as CustomerProject;
    expect(summarizeRequests([project])[0]).toMatchObject({
      organisation: "Example",
      occasion: "Family reunion",
      quantity: "26-100",
      budget: "1L-5L",
      occasionDate: null,
      deliveryDate: null,
      demo: true,
    });
  });
  it("rejects impossible and unsupported dates", () => {
    expect(dateKey("2026-02-31")).toBeNull();
    expect(dateKey("0000-01-01")).toBeNull();
    expect(dateKey(new Date("invalid"))).toBeNull();
  });
});
