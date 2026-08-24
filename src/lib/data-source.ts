import "server-only";

import { getBaseEnv, inspectMongoEnv } from "@/lib/env/server";

export type PublicDataSourceResolution =
  | { kind: "demo" }
  | { kind: "mongo" }
  | { kind: "misconfigured"; missing: readonly string[] };

export class DataSourceConfigurationError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super("The configured public data source is unavailable.");
    this.name = "DataSourceConfigurationError";
    this.missing = missing;
  }
}

/**
 * `auto` selects DEMO only when Mongo is absent. Once Mongo is selected, query
 * failures are surfaced and never silently replaced with DEMO content.
 */
export function resolvePublicDataSource(): PublicDataSourceResolution {
  const mode = getBaseEnv().DATA_SOURCE;
  if (mode === "demo") return { kind: "demo" };

  const mongo = inspectMongoEnv();
  if (mongo.configured) return { kind: "mongo" };

  if (mode === "mongo") {
    return { kind: "misconfigured", missing: mongo.invalidKeys };
  }

  return { kind: "demo" };
}

export function requireMongoPublicDataSource(): boolean {
  const resolution = resolvePublicDataSource();
  if (resolution.kind === "misconfigured") {
    throw new DataSourceConfigurationError(resolution.missing);
  }
  return resolution.kind === "mongo";
}
