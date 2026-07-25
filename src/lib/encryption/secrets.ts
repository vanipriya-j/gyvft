import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getEnv } from "@/config/env";
import { AppError } from "@/lib/errors/app-error";
import { lastFour } from "@/lib/utils/normalise";

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = 1;

function getKey(): Buffer {
  const env = getEnv();
  if (!env.INTEGRATION_ENCRYPTION_KEY) {
    throw new AppError("INTERNAL_ERROR", "INTEGRATION_ENCRYPTION_KEY is not configured", {
      expose: false,
    });
  }
  const key = Buffer.from(env.INTEGRATION_ENCRYPTION_KEY, "utf8");
  if (key.length < 32) {
    throw new AppError("INTERNAL_ERROR", "INTEGRATION_ENCRYPTION_KEY must be at least 32 characters", {
      expose: false,
    });
  }
  return key.subarray(0, 32);
}

export type EncryptedSecret = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
  lastFour: string;
};

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted,
    iv,
    authTag,
    keyVersion: KEY_VERSION,
    lastFour: lastFour(plaintext),
  };
}

export function decryptSecret(input: {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}): string {
  const decipher = createDecipheriv(ALGORITHM, getKey(), input.iv);
  decipher.setAuthTag(input.authTag);
  const decrypted = Buffer.concat([decipher.update(input.ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
