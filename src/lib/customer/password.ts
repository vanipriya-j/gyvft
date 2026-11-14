import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, value) => (error ? reject(error) : resolve(value)),
    );
  });
export async function hashCustomerPassword(password: string) {
  if (password.length < 8 || password.length > 128)
    throw new Error("Password must contain 8–128 characters");
  const salt = randomBytes(16).toString("hex");
  return `scrypt$32768$8$1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyCustomerPassword(password: string, stored: string) {
  if (
    password.length > 128 ||
    !/^scrypt\$32768\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored)
  )
    return false;
  const parts = stored.split("$");
  return timingSafeEqual(
    await derive(password, parts[4]),
    Buffer.from(parts[5], "hex"),
  );
}
export const hashOpaqueToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newOpaqueToken = () => randomBytes(32).toString("base64url");
export const isOpaqueToken = (value: string) =>
  /^[A-Za-z0-9_-]{43}$/.test(value);
