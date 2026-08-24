import { afterEach, describe, expect, it } from "vitest";

import {
  DataSourceConfigurationError,
  requireMongoPublicDataSource,
  resolvePublicDataSource,
} from "@/lib/data-source";

const originalDataSource = process.env.DATA_SOURCE;
const originalMongoUri = process.env.MONGODB_URI;

afterEach(() => {
  if (originalDataSource === undefined) delete process.env.DATA_SOURCE;
  else process.env.DATA_SOURCE = originalDataSource;
  if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = originalMongoUri;
});

describe("public data source resolution", () => {
  it("uses deterministic DEMO mode even when Mongo is configured", () => {
    process.env.DATA_SOURCE = "demo";
    process.env.MONGODB_URI = "mongodb://localhost:27017/reddoor";
    expect(resolvePublicDataSource()).toEqual({ kind: "demo" });
  });

  it("uses Mongo in auto mode only when its configuration exists", () => {
    process.env.DATA_SOURCE = "auto";
    delete process.env.MONGODB_URI;
    expect(resolvePublicDataSource()).toEqual({ kind: "demo" });

    process.env.MONGODB_URI = "mongodb://localhost:27017/reddoor";
    expect(resolvePublicDataSource()).toEqual({ kind: "mongo" });
  });

  it("does not silently fall back when Mongo mode is explicitly enabled", () => {
    process.env.DATA_SOURCE = "mongo";
    delete process.env.MONGODB_URI;
    expect(resolvePublicDataSource().kind).toBe("misconfigured");
    expect(() => requireMongoPublicDataSource()).toThrow(
      DataSourceConfigurationError,
    );
  });
});
