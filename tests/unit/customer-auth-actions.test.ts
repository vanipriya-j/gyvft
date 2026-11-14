import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashCustomerPassword,
  hashOpaqueToken,
  verifyCustomerPassword,
} from "@/lib/customer/password";

const {
  query,
  transaction,
  begin,
  limit,
  claim,
  createSession,
  sendEmail,
  jar,
} = vi.hoisted(() => {
  const transaction = vi.fn();
  const begin = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(transaction),
  );
  const query = Object.assign(vi.fn(), { begin });
  return {
    query,
    transaction,
    begin,
    limit: vi.fn(),
    claim: vi.fn(),
    createSession: vi.fn(),
    sendEmail: vi.fn(),
    jar: { get: vi.fn(), set: vi.fn() },
  };
});
vi.mock("@/lib/database/client", () => ({ getSql: () => query }));
vi.mock("next/headers", () => ({
  cookies: async () => jar,
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.70" }),
}));
vi.mock("@/lib/customer/session", () => ({
  claimCustomerEnquiries: claim,
  createCustomerSession: createSession,
}));
vi.mock("@/lib/customer/accounts", async (original) => ({
  ...(await original<typeof import("@/lib/customer/accounts")>()),
  limitCustomerAuth: limit,
}));
vi.mock("@/services/email/public-resend", () => ({
  sendPublicResendEmail: sendEmail,
}));
vi.mock("@/lib/logging/logger", () => ({ logger: { warn: vi.fn() } }));
import {
  registerCustomerAction,
  loginCustomerAction,
  requestCustomerPasswordResetAction,
  resetCustomerPasswordAction,
} from "@/app/account/auth-actions";

const account = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  email: "owner@example.com",
};
const password = "A sufficiently long fixture password";
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const statements = (mock: { mock: { calls: unknown[][] } } = query) =>
  mock.mock.calls.map((call) => (call[0] as TemplateStringsArray).join("?"));
let storedHash: string;
beforeAll(async () => {
  storedHash = await hashCustomerPassword(password);
});
beforeEach(() => {
  query.mockReset().mockResolvedValue([]);
  transaction.mockReset().mockResolvedValue([]);
  begin.mockClear();
  limit.mockReset().mockResolvedValue(undefined);
  claim.mockReset().mockResolvedValue(undefined);
  createSession.mockReset().mockResolvedValue(undefined);
  sendEmail.mockReset().mockResolvedValue({ id: "fixture-email" });
  jar.get.mockReset().mockReturnValue(undefined);
  jar.set.mockReset();
});

describe("database-owned customer authentication actions", () => {
  it("rejects malformed registration input before hashing or database access", async () => {
    expect(
      (
        await registerCustomerAction(
          form({ email: "invalid", password: "short" }),
        )
      ).ok,
    ).toBe(false);
    expect(limit).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("registers a normalized identity with a salted hash, then creates an application session", async () => {
    query.mockResolvedValueOnce([account]);
    const result = await registerCustomerAction(
      form({ email: " OWNER@Example.com ", password }),
    );
    expect(result).toMatchObject({ ok: true, redirectTo: "/account" });
    const values = query.mock.calls[0].slice(1);
    expect(values[0]).toBe(account.email);
    expect(values).not.toContain(password);
    expect(await verifyCustomerPassword(password, values[1])).toBe(true);
    expect(claim).toHaveBeenCalledWith(account);
    expect(createSession).toHaveBeenCalledExactlyOnceWith(account.id);
  });

  it("does not overwrite an existing account or issue a session on duplicate registration", async () => {
    const result = await registerCustomerAction(
      form({ email: account.email, password }),
    );
    expect(result.ok).toBe(false);
    expect(statements()[0]).toContain("ON CONFLICT (email) DO NOTHING");
    expect(createSession).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
  });

  it("uses the same invalid-credentials response for absent, inactive and wrong-password accounts", async () => {
    const outcomes = [];
    for (const rows of [
      [],
      [{ ...account, password_hash: storedHash, is_active: false }],
      [{ ...account, password_hash: storedHash, is_active: true }],
    ]) {
      query.mockResolvedValueOnce(rows);
      outcomes.push(
        await loginCustomerAction(
          form({
            email: account.email,
            password: "Incorrect fixture password",
          }),
        ),
      );
    }
    expect(outcomes.every((result) => result.ok === false)).toBe(true);
    expect(new Set(outcomes.map((result) => result.message)).size).toBe(1);
    expect(createSession).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
  });

  it("creates a session only after an active account's password verifies", async () => {
    query.mockResolvedValueOnce([
      { ...account, password_hash: storedHash, is_active: true },
    ]);
    const result = await loginCustomerAction(
      form({ email: " OWNER@Example.com ", password }),
    );
    expect(result).toMatchObject({ ok: true, redirectTo: "/account" });
    expect(query.mock.calls[0].slice(1)).toEqual([account.email]);
    expect(createSession).toHaveBeenCalledExactlyOnceWith(account.id);
  });

  it("stores only the reset-token digest while emailing the usable link", async () => {
    query.mockResolvedValueOnce([{ id: account.id }]).mockResolvedValueOnce([]);
    const result = await requestCustomerPasswordResetAction(
      form({ email: account.email }),
    );
    expect(result.ok).toBe(true);
    const email = sendEmail.mock.calls[0][0];
    const link = new URL(email.text.match(/https?:\/\/\S+/)[0]);
    const token = link.searchParams.get("reset")!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(query.mock.calls[1].slice(1)).toEqual([
      hashOpaqueToken(token),
      account.id,
    ]);
    expect(query.mock.calls.flat()).not.toContain(token);
    expect(email.to).toBe(account.email);
  });

  it("does not reveal account existence or email-provider failures during recovery", async () => {
    const absent = await requestCustomerPasswordResetAction(
      form({ email: account.email }),
    );
    query.mockResolvedValueOnce([{ id: account.id }]).mockResolvedValueOnce([]);
    sendEmail.mockRejectedValueOnce(
      new Error("private mail-provider credentials"),
    );
    const failedMail = await requestCustomerPasswordResetAction(
      form({ email: account.email }),
    );
    expect(failedMail).toEqual(absent);
    expect(failedMail.message).not.toContain("private");
  });

  it("consumes a reset token once and revokes all account sessions within the same transaction", async () => {
    const token = "t".repeat(43);
    transaction.mockResolvedValueOnce([{ account_id: account.id }]);
    const first = await resetCustomerPasswordAction(form({ token, password }));
    expect(first).toMatchObject({ ok: true, redirectTo: "/account/login" });
    expect(begin).toHaveBeenCalledOnce();
    const calls = transaction.mock.calls;
    expect(calls[0][0].join("?")).toContain(
      "used_at IS NULL AND expires_at > now()",
    );
    expect(calls[0].slice(1)).toEqual([hashOpaqueToken(token)]);
    expect(await verifyCustomerPassword(password, calls[1][1])).toBe(true);
    expect(calls[1].slice(1)).not.toContain(password);
    expect(calls[2][0].join("?")).toContain(
      "DELETE FROM gyvft_customer_sessions WHERE account_id =",
    );
    expect(calls[2].slice(1)).toEqual([account.id]);
    expect(calls[3][0].join("?")).toContain("account_id =");
    const second = await resetCustomerPasswordAction(form({ token, password }));
    expect(second.ok).toBe(false);
    expect(second.message).toContain("invalid or has expired");
    expect(
      statements(transaction).filter((text) =>
        text.startsWith("UPDATE gyvft_customer_accounts"),
      ),
    ).toHaveLength(1);
    expect(
      statements(transaction).filter((text) =>
        text.startsWith("DELETE FROM gyvft_customer_sessions"),
      ),
    ).toHaveLength(1);
  });

  it("rejects malformed reset tokens before touching credentials or sessions", async () => {
    expect(
      (
        await resetCustomerPasswordAction(
          form({ token: "not-a-token", password }),
        )
      ).ok,
    ).toBe(false);
    expect(limit).not.toHaveBeenCalled();
    expect(begin).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("request claiming and auth rate-limit safeguards", () => {
  it("does not claim real enquiries by email alone when there is no browser claim token", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/customer/session")
    >("@/lib/customer/session");
    await actual.claimCustomerEnquiries(account);
    expect(query).toHaveBeenCalledOnce();
    const statement = statements()[0];
    expect(statement).toContain("submission_key IN");
    expect(statement).toContain("AND id IN");
    expect(statement).toContain("customer_account_id IS NULL");
    expect(statement).toContain("gyvft-demo-v1-received");
  });

  it("requires the browser claim digest and matching email to link an anonymous enquiry", async () => {
    const token = "c".repeat(43);
    jar.get.mockReturnValue({ value: token });
    const actual = await vi.importActual<
      typeof import("@/lib/customer/session")
    >("@/lib/customer/session");
    await actual.claimCustomerEnquiries(account);
    const statement = statements()[0];
    expect(statement).toContain(
      "customer_account_id IS NULL AND browser_claim_hash =",
    );
    expect(statement).toContain("AND customer_email =");
    expect(query.mock.calls[0].slice(1)).toEqual([
      account.id,
      hashOpaqueToken(token),
      account.email,
    ]);
    expect(jar.set).toHaveBeenCalledWith(
      "gyvft_enquiry_claim",
      "",
      expect.objectContaining({ httpOnly: true, maxAge: 0 }),
    );
  });

  it("keeps an IP-wide rate bucket when callers vary account email", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/customer/accounts")
    >("@/lib/customer/accounts");
    query.mockResolvedValue([{ attempts: 1 }]);
    await actual.limitCustomerAuth("register", "one@example.com");
    await actual.limitCustomerAuth("register", "two@example.com");
    expect(query.mock.calls[0].slice(1)).toEqual(query.mock.calls[2].slice(1));
    expect(query.mock.calls[1].slice(1)).not.toEqual(
      query.mock.calls[3].slice(1),
    );
    expect(query.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/);
  });
});
