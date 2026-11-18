import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password-hash";

describe("password hash", () => {
  it("verifies the right password and rejects others", async () => {
    const stored = await hashPassword("correct horse battery");

    expect(stored).toMatch(/^scrypt:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{43}$/);
    await expect(verifyPassword("correct horse battery", stored)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("correct horse batterY", stored)).resolves.toBe(
      false,
    );
    await expect(verifyPassword("", stored)).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored values", async () => {
    await expect(verifyPassword("x", "bcrypt:abc:def")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt:abc")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt:abc:short")).resolves.toBe(false);
  });
});
