import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/auth/[...nextauth]/route";

const environmentKeys = [
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "MONGODB_URI",
] as const;
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function context() {
  return { params: Promise.resolve({ nextauth: ["providers"] }) };
}

describe("optional NextAuth route", () => {
  it.each([GET, POST])(
    "returns a non-cacheable setup state when auth is absent",
    async (handler) => {
      for (const key of environmentKeys) {
        delete process.env[key];
      }

      const response = await handler(
        new NextRequest("http://localhost:3000/api/auth/providers"),
        context(),
      );

      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({
        error: "AUTH_NOT_CONFIGURED",
        message: "Authentication is not configured for this deployment.",
      });
    },
  );

  it("remains disabled when OAuth is present but MongoDB is absent", async () => {
    process.env.AUTH_SECRET = "x".repeat(32);
    process.env.AUTH_GOOGLE_ID = "google-client";
    process.env.AUTH_GOOGLE_SECRET = "google-secret";
    delete process.env.MONGODB_URI;

    const response = await GET(
      new NextRequest("http://localhost:3000/api/auth/providers"),
      context(),
    );

    expect(response.status).toBe(503);
  });
});
