import { describe, expect, it, vi, beforeEach } from "vitest";
import { paymentSummary, safePaymentUrl } from "@/lib/customer/model";
const { getUser, query, redirect } = vi.hoisted(() => ({
  getUser: vi.fn(),
  query: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/lib/auth/session", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/supabase/keys", () => ({
  hasSupabasePublishableConfig: () => true,
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => query }));
vi.mock("next/navigation", () => ({ redirect }));
import { customerEmail, ownedProject } from "@/lib/customer/data";
import {
  sendMessage,
  submitPayment,
  decideApproval,
} from "@/app/account/actions";
describe("customer portal trust boundaries", () => {
  beforeEach(() => vi.clearAllMocks());
  it("requires verified email before exposing customer data", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "person@example.com", email_confirmed_at: null } },
      error: null,
    });
    await expect(customerEmail()).rejects.toThrow("redirect:/account/login");
    expect(query).not.toHaveBeenCalled();
  });
  it("normalizes a verified address", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { email: "Person@Example.com", email_confirmed_at: "2026-01-01" },
      },
      error: null,
    });
    expect(await customerEmail()).toBe("person@example.com");
  });
  it("scopes project reads to the authenticated address", async () => {
    query.mockResolvedValue([]);
    expect(
      await ownedProject(
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "owner@example.com",
      ),
    ).toBeNull();
    expect(query.mock.calls[0].slice(1)).toEqual([
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "owner@example.com",
    ]);
    expect(query.mock.calls[0][0].join("?")).toContain("AND customer_email =");
  });
  it("rejects malformed project IDs without a database lookup", async () => {
    expect(await ownedProject("../../other", "owner@example.com")).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
  it("requires 50% and credits verified receipts without negative balances", () => {
    expect(paymentSummary(10001, 2000)).toEqual({
      advance: 5001,
      advanceDue: 3001,
      balance: 8001,
    });
    expect(paymentSummary(10000, 12000)).toEqual({
      advance: 5000,
      advanceDue: 0,
      balance: 0,
    });
  });
  it("allows only secure Razorpay checkout destinations", () => {
    expect(safePaymentUrl("https://rzp.io/i/example")).toBeTruthy();
    for (const url of [
      "javascript:alert(1)",
      "https://rzp.io.evil.test/pay",
      "http://rzp.io/pay",
      "https://user:pass@rzp.io/pay",
    ])
      expect(safePaymentUrl(url)).toBeNull();
  });
  it("rejects messages and payment submissions for somebody else’s project", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { email: "owner@example.com", email_confirmed_at: "2026-01-01" },
      },
      error: null,
    });
    query.mockResolvedValue([]);
    const data = new FormData();
    data.set("body", "Hello");
    await expect(
      sendMessage("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", data),
    ).rejects.toThrow("Project unavailable");
    await expect(
      submitPayment("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", data),
    ).rejects.toThrow("Project unavailable");
    expect(
      query.mock.calls.every((call) => call[0].join("").startsWith("SELECT")),
    ).toBe(true);
  });
  it("records UPI references as pending without increasing verified receipts", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { email: "owner@example.com", email_confirmed_at: "2026-01-01" },
      },
      error: null,
    });
    query
      .mockResolvedValueOnce([{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }])
      .mockResolvedValueOnce([]);
    const data = new FormData();
    data.set("amount", "2500.50");
    data.set("reference", "123456789012");
    expect(
      (await submitPayment("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", data)).ok,
    ).toBe(true);
    const mutation = query.mock.calls[1];
    expect(mutation[0].join("?")).toContain(
      "INSERT INTO customer_payment_submissions",
    );
    expect(mutation[0].join("?")).not.toContain("paid_paise");
    expect(mutation.slice(1)).toContain(250050);
  });
  it("rejects an approval change request with no explanation", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { email: "owner@example.com", email_confirmed_at: "2026-01-01" },
      },
      error: null,
    });
    query.mockResolvedValueOnce([
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
    ]);
    const data = new FormData();
    data.set("decision", "changes_requested");
    expect(
      (
        await decideApproval(
          "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          data,
        )
      ).ok,
    ).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("does not accept a decision on an already decided or superseded approval", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { email: "owner@example.com", email_confirmed_at: "2026-01-01" },
      },
      error: null,
    });
    query
      .mockResolvedValueOnce([{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }])
      .mockResolvedValueOnce([]);
    const data = new FormData();
    data.set("decision", "approved");
    expect(
      (
        await decideApproval(
          "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          data,
        )
      ).ok,
    ).toBe(false);
    const mutation = query.mock.calls[1][0].join("?");
    expect(mutation).toContain("a.status = 'pending'");
    expect(mutation).toContain("newer.version > a.version");
    expect(mutation).toContain("INSERT INTO customer_project_events");
  });
});
