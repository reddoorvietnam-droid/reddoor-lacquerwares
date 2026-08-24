import { afterEach, describe, expect, it } from "vitest";

import { getBaseEnv } from "@/lib/env/server";

const originalDataSource = process.env.DATA_SOURCE;

afterEach(() => {
  if (originalDataSource === undefined) {
    delete process.env.DATA_SOURCE;
  } else {
    process.env.DATA_SOURCE = originalDataSource;
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
});
