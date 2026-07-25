import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/encryption/secrets";

describe("secret encryption", () => {
  it("encrypts and decrypts a secret roundtrip without exposing plaintext", () => {
    const plaintext = "sk_test_roundtrip_secret_1234567890";

    const encrypted = encryptSecret(plaintext);

    expect(encrypted.keyVersion).toBe(1);
    expect(encrypted.lastFour).toBe("7890");
    expect(encrypted.ciphertext.toString("utf8")).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });
});
