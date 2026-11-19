import { beforeEach, it, expect, vi } from "vitest";
const { own, account, sql } = vi.hoisted(() => ({
  own: vi.fn(),
  account: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("@/lib/customer/data", () => ({ ownedProject: own }));
vi.mock("@/lib/customer/session", () => ({
  requireCustomerAccount: account,
  destroyCustomerSession: vi.fn(),
}));
vi.mock("@/lib/database/client", () => ({ getSql: sql }));
import { submitPayment } from "@/app/account/actions";
import { demoAccounts } from "@/lib/customer/demo-accounts";
beforeEach(() => {
  vi.clearAllMocks();
});
it("rejects proof for fictional sample projects before database mutation", async () => {
  account.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
  own.mockResolvedValue({ submission_key: "gyvft-demo-v1-sample" });
  const result = await submitPayment(
    "22222222-2222-4222-8222-222222222222",
    new FormData(),
  );
  expect(result).toMatchObject({
    ok: false,
    message: expect.stringContaining("do not accept payments"),
  });
  expect(sql).not.toHaveBeenCalled();
});
it("rejects proof from a demo identity even if a new request lacks the fixture prefix", async () => {
  account.mockResolvedValue(demoAccounts[0]);
  own.mockResolvedValue({ submission_key: null });
  expect(
    (
      await submitPayment(
        "22222222-2222-4222-8222-222222222222",
        new FormData(),
      )
    ).ok,
  ).toBe(false);
  expect(sql).not.toHaveBeenCalled();
});
