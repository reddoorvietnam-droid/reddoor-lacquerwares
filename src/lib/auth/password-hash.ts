import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * scrypt with N=2^15, r=8, p=1 (OWASP's floor), stored as
 * `scrypt:<salt>:<key>` in base64url. No `$` in the format: Next's dotenv
 * loader would try to expand it as a variable.
 */
const cost = 2 ** 15;
const blockSize = 8;
const keyLength = 32;
const maxmem = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFC"),
      salt,
      keyLength,
      { N: cost, r: blockSize, p: 1, maxmem },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt:${salt.toString("base64url")}:${key.toString("base64url")}`;
}

/** Constant-time check of a password against a `hashPassword` result. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltText, keyText] = stored.split(":");
  if (scheme !== "scrypt" || !saltText || !keyText) return false;

  const expected = Buffer.from(keyText, "base64url");
  if (expected.length !== keyLength) return false;

  const actual = await derive(password, Buffer.from(saltText, "base64url"));
  return timingSafeEqual(actual, expected);
}
