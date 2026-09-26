import { describe, expect, it } from "vitest";

import {
  assertProductionSiteUrl,
  DEFAULT_SITE_URL,
  isLoopbackHostname,
  isLoopbackUrl,
  productionSiteUrlProblem,
  resolveSiteUrl,
  SiteUrlConfigurationError,
  type SiteUrlEnv,
} from "@/lib/seo/site-url-guard";

const production = (env: SiteUrlEnv): SiteUrlEnv => ({
  NODE_ENV: "production",
  ...env,
});

describe("resolveSiteUrl precedence", () => {
  it("prefers an explicit public origin over the Vercel domain", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: " https://reddoor.vn ",
        VERCEL_PROJECT_PRODUCTION_URL: "www.lacquerwares.vn",
      }),
    ).toEqual({ url: "https://reddoor.vn", source: "explicit" });
  });

  it("falls back to the Vercel production domain when the explicit value is loopback or missing", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        VERCEL_PROJECT_PRODUCTION_URL: "reddoor.vn",
      }),
    ).toEqual({ url: "https://reddoor.vn", source: "vercel" });

    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "reddoor.vn",
      }),
    ).toEqual({ url: "https://reddoor.vn", source: "vercel" });
  });

  it("ends on the loopback default when nothing usable is configured", () => {
    expect(resolveSiteUrl({})).toEqual({
      url: DEFAULT_SITE_URL,
      source: "loopback-default",
    });
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "   " })).toEqual({
      url: DEFAULT_SITE_URL,
      source: "loopback-default",
    });
    // A deliberate local port is honoured, but still flagged as loopback.
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100" }),
    ).toEqual({ url: "http://127.0.0.1:3100", source: "loopback-default" });
  });

  it("recognises every loopback spelling", () => {
    for (const host of [
      "localhost",
      "LOCALHOST",
      "127.0.0.1",
      "0.0.0.0",
      "[::1]",
    ]) {
      expect(isLoopbackHostname(host)).toBe(true);
    }
    expect(isLoopbackHostname("reddoor.vn")).toBe(false);
    expect(isLoopbackUrl("http://[::1]:3000/vi")).toBe(true);
    expect(isLoopbackUrl("https://reddoor.vn")).toBe(false);
    expect(isLoopbackUrl("not a url")).toBe(false);
  });
});

describe("assertProductionSiteUrl", () => {
  it.each([
    [
      "localhost",
      { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" },
      /loopback/,
    ],
    ["127.0.0.1", { NEXT_PUBLIC_SITE_URL: "https://127.0.0.1" }, /loopback/],
    ["nothing configured", {}, /loopback/],
    ["plain http", { NEXT_PUBLIC_SITE_URL: "http://reddoor.vn" }, /https/],
    [
      "a Vercel alias",
      { NEXT_PUBLIC_SITE_URL: "https://reddoor-lacquerwares.vercel.app" },
      /Vercel alias/,
    ],
    [
      "a Vercel alias via the fallback",
      { VERCEL_PROJECT_PRODUCTION_URL: "reddoor-lacquerwares.vercel.app" },
      /Vercel alias/,
    ],
    [
      "an unparsable value",
      { NEXT_PUBLIC_SITE_URL: "reddoor.vn" },
      /not a valid URL/,
    ],
  ])("refuses a production build on %s", (_label, env, message) => {
    const attempt = () => assertProductionSiteUrl(production(env));

    expect(attempt).toThrow(SiteUrlConfigurationError);
    expect(attempt).toThrow(message);
    expect(attempt).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(attempt).toThrow(/https:\/\/reddoor\.vn/);
  });

  it("accepts the public https origin", () => {
    expect(
      assertProductionSiteUrl(
        production({ NEXT_PUBLIC_SITE_URL: "https://reddoor.vn" }),
      ),
    ).toEqual({ url: "https://reddoor.vn", source: "explicit" });
  });

  it("accepts the Vercel production domain when the explicit value is missing", () => {
    expect(
      assertProductionSiteUrl(
        production({ VERCEL_PROJECT_PRODUCTION_URL: "reddoor.vn" }),
      ),
    ).toEqual({ url: "https://reddoor.vn", source: "vercel" });
  });

  it("honours ALLOW_LOOPBACK_SITE_URL=1 and nothing else", () => {
    expect(
      assertProductionSiteUrl(
        production({
          NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
          ALLOW_LOOPBACK_SITE_URL: "1",
        }),
      ),
    ).toEqual({ url: "http://localhost:3000", source: "loopback-default" });

    expect(() =>
      assertProductionSiteUrl(
        production({
          NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
          ALLOW_LOOPBACK_SITE_URL: "true",
        }),
      ),
    ).toThrow(SiteUrlConfigurationError);
  });

  it("never throws outside production", () => {
    const environments: SiteUrlEnv[] = [
      { NODE_ENV: "development" },
      { NODE_ENV: "test" },
      {},
    ];

    for (const env of environments) {
      expect(
        assertProductionSiteUrl({
          ...env,
          NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        }),
      ).toEqual({ url: "http://localhost:3000", source: "loopback-default" });
      expect(assertProductionSiteUrl(env)).toEqual({
        url: DEFAULT_SITE_URL,
        source: "loopback-default",
      });
    }
  });
});

describe("productionSiteUrlProblem", () => {
  it("returns null only for a public https origin", () => {
    expect(
      productionSiteUrlProblem({
        url: "https://reddoor.vn",
        source: "explicit",
      }),
    ).toBeNull();
    expect(
      productionSiteUrlProblem({
        url: "https://reddoor.vn",
        source: "loopback-default",
      }),
    ).toMatch(/loopback/);
    expect(
      productionSiteUrlProblem({
        url: "http://reddoor.vn",
        source: "explicit",
      }),
    ).toMatch(/not an https origin/);
  });
});
