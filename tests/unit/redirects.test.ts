import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "../../next.config";

/**
 * `unstable_getResponseFromNextConfig` is Next's own harness for
 * `next.config.js` routing: it validates the rules exactly like `next build`,
 * matches `has: { type: "host" }` against the request host, merges the
 * incoming query into the destination and picks the status code — so these
 * tests exercise the real matcher rather than a re-implementation.
 */

const PRIMARY = "https://reddoor.vn";
const SECONDARY_HOSTS = [
  "www.reddoor.vn",
  "lacquerwares.vn",
  "www.lacquerwares.vn",
] as const;
const VERCEL_ALIAS = "https://reddoor-lacquerwares.vercel.app";

type Redirect = Awaited<
  ReturnType<NonNullable<typeof nextConfig.redirects>>
>[number];

function useSiteUrl(value: string) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", undefined);
}

async function route(url: string) {
  const response = await unstable_getResponseFromNextConfig({
    url,
    nextConfig,
  });
  return {
    status: response.status,
    location: response.headers.get("location"),
  };
}

async function expectRedirect(url: string, location: string) {
  await expect(route(url)).resolves.toEqual({ status: 308, location });
}

async function expectPassThrough(url: string) {
  await expect(route(url)).resolves.toEqual({ status: 200, location: null });
}

async function loadRules(): Promise<Redirect[]> {
  return nextConfig.redirects!();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("legacy URL redirects on the primary host", () => {
  it("maps the old static site pages", async () => {
    useSiteUrl(PRIMARY);

    await expectRedirect(`${PRIMARY}/index.html`, `${PRIMARY}/vi`);
    await expectRedirect(`${PRIMARY}/about.html`, `${PRIMARY}/vi/about`);
    await expectRedirect(`${PRIMARY}/services.html`, `${PRIMARY}/vi/process`);
    await expectRedirect(`${PRIMARY}/contact.html`, `${PRIMARY}/vi/contact`);
  });

  it("collapses every WooCommerce path onto the shop landing page", async () => {
    useSiteUrl(PRIMARY);

    await expectRedirect(`${PRIMARY}/shop`, `${PRIMARY}/vi/shop`);
    await expectRedirect(
      `${PRIMARY}/shop/wp-admin/admin-ajax.php`,
      `${PRIMARY}/vi/shop`,
    );
    // The query is passed through by design; the shop page ignores it and
    // keeps a clean canonical.
    await expectRedirect(
      `${PRIMARY}/shop?product=bl017-1200n`,
      `${PRIMARY}/vi/shop?product=bl017-1200n`,
    );
  });

  it("sends the Joomla entry points to the default-locale home", async () => {
    useSiteUrl(PRIMARY);

    await expectRedirect(`${PRIMARY}/index.php`, `${PRIMARY}/vi`);
    await expectRedirect(`${PRIMARY}/index2.php`, `${PRIMARY}/vi`);
    await expectRedirect(`${PRIMARY}/home/index.php`, `${PRIMARY}/vi`);
    await expectRedirect(`${PRIMARY}/home`, `${PRIMARY}/vi`);
    // Option A (F07): the VirtueMart query lands on /vi?…, never on a
    // robots-blocked /vi/products?… URL.
    await expectRedirect(
      `${PRIMARY}/index.php?option=com_virtuemart&product_id=132`,
      `${PRIMARY}/vi?option=com_virtuemart&product_id=132`,
    );
  });

  it("prefixes un-prefixed section paths with the default locale", async () => {
    useSiteUrl(PRIMARY);

    await expectRedirect(`${PRIMARY}/about`, `${PRIMARY}/vi/about`);
    await expectRedirect(
      `${PRIMARY}/products/foo`,
      `${PRIMARY}/vi/products/foo`,
    );
    await expectRedirect(
      `${PRIMARY}/news/a/b?page=2`,
      `${PRIMARY}/vi/news/a/b?page=2`,
    );
    await expectRedirect(`${PRIMARY}/privacy`, `${PRIMARY}/vi/privacy`);
  });

  it("leaves real routes, metadata files and assets untouched", async () => {
    useSiteUrl(PRIMARY);

    for (const path of [
      "/",
      "/api/x",
      "/api/cron/reminders",
      "/sitemap.xml",
      "/robots.txt",
      "/manifest.webmanifest",
      "/opengraph-image",
      "/icon.png",
      "/vi",
      "/vi/products",
      "/en/products/foo",
      "/_next/static/x.js",
      "/unknown-section/foo",
    ]) {
      await expectPassThrough(`${PRIMARY}${path}`);
    }
  });
});

describe("host canonicalization", () => {
  it("sends every secondary host to the primary host in one hop", async () => {
    useSiteUrl(PRIMARY);

    for (const host of SECONDARY_HOSTS) {
      // The bare host goes straight to the default-locale home …
      await expectRedirect(`https://${host}/`, `${PRIMARY}/vi`);
      // … and any other path keeps its path and query.
      await expectRedirect(
        `https://${host}/vi/about?page=2`,
        `${PRIMARY}/vi/about?page=2`,
      );
      await expectRedirect(`https://${host}/api/x`, `${PRIMARY}/api/x`);
    }
  });

  it("redirects the exact Vercel alias but keeps /api reachable for Cron", async () => {
    useSiteUrl(PRIMARY);

    await expectRedirect(`${VERCEL_ALIAS}/vi`, `${PRIMARY}/vi`);
    await expectRedirect(
      `${VERCEL_ALIAS}/vi/products?page=2`,
      `${PRIMARY}/vi/products?page=2`,
    );
    await expectPassThrough(`${VERCEL_ALIAS}/api/cron/reminders`);
    // Preview deployments must not bounce to production.
    await expectPassThrough("https://reddoor-lacquerwares-git-x.vercel.app/vi");
  });

  it("emits host rules for the three secondary hosts and the alias, all permanent", async () => {
    useSiteUrl(PRIMARY);
    const rules = await loadRules();

    expect(rules.every((rule) => rule.permanent === true)).toBe(true);

    const hostOf = (rule: Redirect) =>
      rule.has
        ?.find((item) => item.type === "host")
        ?.value?.replace(/\\\./g, ".");
    const hostRules = rules.filter((rule) => hostOf(rule));

    const rootRules = hostRules.filter((rule) => rule.source === "/");
    const pathRules = hostRules.filter((rule) => rule.source === "/:path*");
    expect(rootRules.map(hostOf).sort()).toEqual([...SECONDARY_HOSTS].sort());
    expect(pathRules.map(hostOf).sort()).toEqual([...SECONDARY_HOSTS].sort());
    // `/:path*` also matches the empty path, so the `/` rules must come first.
    expect(
      Math.max(...rootRules.map((rule) => rules.indexOf(rule))),
    ).toBeLessThan(Math.min(...pathRules.map((rule) => rules.indexOf(rule))));

    const aliasRule = hostRules.find(
      (rule) => hostOf(rule) === "reddoor-lacquerwares.vercel.app",
    );
    expect(aliasRule?.source).toBe("/:path((?!api/).*)");

    for (const rule of hostRules) {
      expect(new URL(rule.destination).origin).toBe(PRIMARY);
    }
    // Nothing redirects the primary host itself.
    expect(hostRules.map(hostOf)).not.toContain("reddoor.vn");
  });

  it("derives the primary host from the resolved site URL", async () => {
    useSiteUrl("https://www.lacquerwares.vn");

    await expectRedirect(
      "https://reddoor.vn/vi/about",
      "https://www.lacquerwares.vn/vi/about",
    );
    await expectPassThrough("https://www.lacquerwares.vn/vi/about");
  });

  it("emits no host rules when the site URL is a loopback address", async () => {
    useSiteUrl("http://localhost:3000");
    const rules = await loadRules();

    expect(rules.some((rule) => rule.has)).toBe(false);
    expect(rules.length).toBeGreaterThan(0);
    // Legacy rules still apply locally.
    await expectRedirect(
      "http://localhost:3000/about.html",
      "http://localhost:3000/vi/about",
    );
    await expectPassThrough("http://localhost:3000/");
  });
});
