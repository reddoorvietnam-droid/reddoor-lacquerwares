import { afterEach, describe, expect, it } from "vitest";

import {
  getBaseEnv,
  inspectAiEnv,
  inspectAuthEnv,
  inspectMongoEnv,
} from "@/lib/env/server";

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

    expect(inspectAuthEnv()).toEqual({
      configured: false,
      invalidKeys: ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
    });
  });

  it("has no sign-in without Google, whatever else is set", () => {
    process.env.AUTH_SECRET = "0".repeat(48);
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    // The retired role-preview switch no longer opens anything.
    process.env.DEV_LOGIN_PASSWORD = "anything";

    try {
      expect(inspectAuthEnv()).toEqual({
        configured: false,
        invalidKeys: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
      });
    } finally {
      delete process.env.DEV_LOGIN_PASSWORD;
    }
  });

  it("accepts the Google pair only as a pair, and never an empty value", () => {
    process.env.AUTH_SECRET = "0".repeat(48);
    process.env.AUTH_GOOGLE_ID = "client-id";
    delete process.env.AUTH_GOOGLE_SECRET;

    expect(inspectAuthEnv()).toEqual({
      configured: false,
      invalidKeys: ["AUTH_GOOGLE_SECRET"],
    });

    process.env.AUTH_GOOGLE_SECRET = "   ";
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

describe("AI provider environment", () => {
  const keys = [
    "AI_PROVIDER",
    "ANTHROPIC_API_KEY",
    "OPENAI_COMPAT_BASE_URL",
    "OPENAI_COMPAT_API_KEY",
    "OPENAI_COMPAT_REASONING_EFFORT",
    "AI_MODEL",
  ] as const;
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("defaults to Claude and names the missing key", () => {
    for (const key of keys) delete process.env[key];

    expect(inspectAiEnv()).toEqual({
      configured: false,
      invalidKeys: ["ANTHROPIC_API_KEY"],
    });

    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(inspectAiEnv()).toMatchObject({
      configured: true,
      value: { AI_PROVIDER: "anthropic", AI_MODEL: "claude-opus-5" },
    });
  });

  it("requires base URL, key and an explicit model for an OpenAI-compatible endpoint", () => {
    for (const key of keys) delete process.env[key];
    process.env.AI_PROVIDER = "openai-compatible";

    expect(inspectAiEnv()).toEqual({
      configured: false,
      invalidKeys: [
        "OPENAI_COMPAT_BASE_URL",
        "OPENAI_COMPAT_API_KEY",
        "AI_MODEL",
      ],
    });

    process.env.OPENAI_COMPAT_BASE_URL =
      "https://generativelanguage.googleapis.com/v1beta/openai/";
    process.env.OPENAI_COMPAT_API_KEY = "test-key";
    process.env.AI_MODEL = "gemini-2.5-flash";
    process.env.OPENAI_COMPAT_REASONING_EFFORT = "low";
    // No Anthropic key is needed on this path.
    expect(inspectAiEnv()).toMatchObject({
      configured: true,
      value: {
        AI_PROVIDER: "openai-compatible",
        AI_MODEL: "gemini-2.5-flash",
        OPENAI_COMPAT_REASONING_EFFORT: "low",
      },
    });
  });

  it("rejects a malformed endpoint URL by name", () => {
    for (const key of keys) delete process.env[key];
    process.env.AI_PROVIDER = "openai-compatible";
    process.env.OPENAI_COMPAT_BASE_URL = "not a url";
    process.env.OPENAI_COMPAT_API_KEY = "test-key";
    process.env.AI_MODEL = "gemini-2.5-flash";

    expect(inspectAiEnv()).toEqual({
      configured: false,
      invalidKeys: ["OPENAI_COMPAT_BASE_URL"],
    });
  });
});
