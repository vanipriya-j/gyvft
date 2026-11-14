import { describe, expect, it, vi, beforeEach } from "vitest";
import { paymentSummary, safePaymentUrl } from "@/lib/customer/model";
import { resetMemoryGuardsForTests } from "@/lib/security/memory-guards";

const account = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  email: "owner@example.com",
};
const projectId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const { getAccount, requireAccount, destroySession, query, redirect } =
  vi.hoisted(() => ({
    getAccount: vi.fn(),
    requireAccount: vi.fn(),
    destroySession: vi.fn(),
    query: vi.fn(),
    redirect: vi.fn((path: string) => {
      throw new Error(`redirect:${path}`);
    }),
  }));
vi.mock("@/lib/customer/session", () => ({
  getCustomerAccount: getAccount,
  requireCustomerAccount: requireAccount,
  destroyCustomerSession: destroySession,
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => query }));
vi.mock("next/navigation", () => ({ redirect }));
import { customerEmail, ownedProject, projectsFor } from "@/lib/customer/data";
import {
  sendMessage,
  submitPayment,
  decideApproval,
  signOut,
} from "@/app/account/actions";

describe("customer portal trust boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockReset().mockResolvedValue([]);
    requireAccount.mockReset().mockResolvedValue(account);
    getAccount.mockReset().mockResolvedValue(account);
    destroySession.mockReset().mockResolvedValue(undefined);
    resetMemoryGuardsForTests();
  });

  it("requires an application session before exposing customer identity", async () => {
    requireAccount.mockRejectedValueOnce(new Error("redirect:/account/login"));
    await expect(customerEmail()).rejects.toThrow("redirect:/account/login");
    expect(query).not.toHaveBeenCalled();
  });

  it("uses the email belonging to the authenticated application account", async () => {
    expect(await customerEmail()).toBe(account.email);
    expect(requireAccount).toHaveBeenCalledOnce();
  });

  it("scopes list and detail reads to account ID rather than an unverified email", async () => {
    await projectsFor(account.id);
    expect(query.mock.calls[0].slice(1)).toEqual([account.id]);
    expect(query.mock.calls[0][0].join("?")).toContain("customer_account_id =");
    query.mockClear();
    expect(await ownedProject(projectId, account.id)).toBeNull();
    expect(query.mock.calls[0].slice(1)).toEqual([projectId, account.id]);
    expect(query.mock.calls[0][0].join("?")).toContain(
      "AND customer_account_id =",
    );
    expect(query.mock.calls[0].slice(1)).not.toContain(account.email);
  });

  it("rejects malformed project IDs without a database lookup", async () => {
    expect(await ownedProject("../../other", account.id)).toBeNull();
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

  it("denies unauthenticated writes before looking up or mutating projects", async () => {
    requireAccount.mockRejectedValueOnce(new Error("redirect:/account/login"));
    const data = new FormData();
    data.set("body", "Hello");
    await expect(sendMessage(projectId, data)).rejects.toThrow(
      "redirect:/account/login",
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects messages and payment submissions for somebody else’s project", async () => {
    const data = new FormData();
    data.set("body", "Hello");
    await expect(sendMessage(projectId, data)).rejects.toThrow(
      "Project unavailable",
    );
    await expect(submitPayment(projectId, data)).rejects.toThrow(
      "Project unavailable",
    );
    expect(
      query.mock.calls.every((call) => call[0].join("").startsWith("SELECT")),
    ).toBe(true);
    for (const call of query.mock.calls)
      expect(call.slice(1)).toContain(account.id);
  });

  it("rechecks account ownership in the message insertion statement", async () => {
    query.mockResolvedValueOnce([{ id: projectId }]).mockResolvedValueOnce([]);
    const data = new FormData();
    data.set("body", "A question about my request");
    expect((await sendMessage(projectId, data)).ok).toBe(true);
    const mutation = query.mock.calls[1];
    expect(mutation[0].join("?")).toContain("customer_account_id =");
    expect(mutation.slice(1)).toContain(account.id);
    expect(mutation.slice(1)).not.toContain(account.email);
  });

  it("records UPI references as pending without increasing verified receipts", async () => {
    query.mockResolvedValueOnce([{ id: projectId }]).mockResolvedValueOnce([]);
    const data = new FormData();
    data.set("amount", "2500.50");
    data.set("reference", "123456789012");
    expect((await submitPayment(projectId, data)).ok).toBe(true);
    const mutation = query.mock.calls[1];
    expect(mutation[0].join("?")).toContain(
      "INSERT INTO customer_payment_submissions",
    );
    expect(mutation[0].join("?")).toContain("customer_account_id =");
    expect(mutation[0].join("?")).not.toContain("paid_paise");
    expect(mutation.slice(1)).toContain(250050);
    expect(mutation.slice(1)).toContain(account.id);
  });

  it("rejects an approval change request with no explanation", async () => {
    query.mockResolvedValueOnce([{ id: projectId }]);
    const data = new FormData();
    data.set("decision", "changes_requested");
    expect(
      (
        await decideApproval(
          projectId,
          "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          data,
        )
      ).ok,
    ).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("does not accept a decision on an already decided or superseded approval", async () => {
    query.mockResolvedValueOnce([{ id: projectId }]).mockResolvedValueOnce([]);
    const data = new FormData();
    data.set("decision", "approved");
    expect(
      (
        await decideApproval(
          projectId,
          "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          data,
        )
      ).ok,
    ).toBe(false);
    const mutation = query.mock.calls[1][0].join("?");
    expect(mutation).toContain("a.status = 'pending'");
    expect(mutation).toContain("newer.version > a.version");
    expect(mutation).toContain("INSERT INTO customer_project_events");
    expect(mutation).toContain("customer_account_id =");
    expect(query.mock.calls[1].slice(1)).toContain(account.id);
  });

  it("revokes the database session on sign out", async () => {
    await expect(signOut()).rejects.toThrow("redirect:/account/login");
    expect(destroySession).toHaveBeenCalledOnce();
  });
});
