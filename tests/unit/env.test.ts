import { afterEach, describe, expect, it } from "vitest";

import { getBaseEnv, inspectAuthEnv, inspectMongoEnv } from "@/lib/env/server";

const originalDataSource = process.env.DATA_SOURCE;
const originalAuthVariables = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
};
const originalMongoUri = process.env.MONGODB_URI;

afterEach(() => {
  if (originalDataSource === undefined) {
    delete process.env.DATA_SOURCE;
  } else {
    process.env.DATA_SOURCE = originalDataSource;
  }

  for (const [key, value] of Object.entries(originalAuthVariables)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  if (originalMongoUri === undefined) {
    delete process.env.MONGODB_URI;
  } else {
    process.env.MONGODB_URI = originalMongoUri;
  }
});

describe("lazy environment validation", () => {
  it("uses safe local defaults without integration secrets", () => {
    delete process.env.DATA_SOURCE;

    expect(getBaseEnv()).toMatchObject({
      DATA_SOURCE: "auto",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      MONGODB_DB_NAME: "reddoor",
    });
  });

  it("rejects an unknown data source", () => {
    process.env.DATA_SOURCE = "silent-fallback";

    expect(() => getBaseEnv()).toThrow(/Application configuration is invalid/);
  });

  it("reports optional authentication as unconfigured without exposing values", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;

    // Field-level failures surface alone; the provider cross-check runs only
    // once the fields themselves parse.
    expect(inspectAuthEnv()).toEqual({
      configured: false,
      invalidKeys: ["AUTH_SECRET"],
    });
  });

  it("requires at least one sign-in provider once the secret is set", () => {
    process.env.AUTH_SECRET = "0".repeat(48);
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    delete process.env.DEV_LOGIN_PASSWORD;

    expect(inspectAuthEnv()).toEqual({
      configured: false,
      invalidKeys: ["AUTH_GOOGLE_ID"],
    });
  });

  it("accepts the Google pair only as a pair", () => {
    process.env.AUTH_SECRET = "0".repeat(48);
    process.env.AUTH_GOOGLE_ID = "client-id";
    delete process.env.AUTH_GOOGLE_SECRET;
    delete process.env.DEV_LOGIN_PASSWORD;

    expect(inspectAuthEnv()).toEqual({
      configured: false,
      invalidKeys: ["AUTH_GOOGLE_SECRET"],
    });
  });

  it("reports MongoDB as unconfigured without attempting a connection", () => {
    delete process.env.MONGODB_URI;

    expect(inspectMongoEnv()).toEqual({
      configured: false,
      invalidKeys: ["MONGODB_URI"],
    });
  });

  it("treats an empty bootstrap allow-list as disabled", () => {
    process.env.AUTH_SECRET = "x".repeat(32);
    process.env.AUTH_GOOGLE_ID = "google-client";
    process.env.AUTH_GOOGLE_SECRET = "google-secret";
    process.env.ADMIN_EMAILS = "";

    expect(inspectAuthEnv()).toMatchObject({
      configured: true,
      value: { ADMIN_EMAILS: undefined },
    });
  });
});
