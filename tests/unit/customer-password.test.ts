import { describe, expect, it } from "vitest";
import {
  hashCustomerPassword,
  verifyCustomerPassword,
  hashOpaqueToken,
} from "@/lib/customer/password";

describe("customer password and session token primitives", () => {
  it("salts each password hash and verifies the correct password", async () => {
    const password = "A long example password 🌿";
    const first = await hashCustomerPassword(password);
    const second = await hashCustomerPassword(password);
    expect(first).not.toEqual(second);
    expect(first).not.toContain(password);
    expect(await verifyCustomerPassword(password, first)).toBe(true);
    expect(await verifyCustomerPassword(password, second)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const stored = await hashCustomerPassword("A real example password");
    expect(await verifyCustomerPassword("An incorrect password", stored)).toBe(
      false,
    );
  });

  it("rejects malformed hashes without throwing", async () => {
    for (const hash of [
      "",
      "plain-password",
      "scrypt$bad",
      "scrypt$32768$8$1$bad$bad",
    ])
      expect(await verifyCustomerPassword("example", hash)).toBe(false);
  });

  it("stores only a stable opaque token digest", () => {
    const token = "this-is-a-fixture-session-token";
    const digest = hashOpaqueToken(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(token);
    expect(hashOpaqueToken(token)).toBe(digest);
    expect(hashOpaqueToken(token + "-different")).not.toBe(digest);
  });
});
