import type { NextConfig } from "next";

// Relative imports on purpose: this file is transpiled and required with
// CommonJS resolution before the app's `@/` alias exists, so it may only
// reach modules that themselves import nothing (both of these qualify).
import { defaultLocale } from "./src/lib/i18n/config";
import {
  assertProductionSiteUrl,
  resolveSiteUrl,
} from "./src/lib/seo/site-url-guard";

type Redirect = Awaited<
  ReturnType<NonNullable<NextConfig["redirects"]>>
>[number];

/*
 * Build-time site URL guard.
 *
 * `next build`, `next start` and `next typegen` all evaluate this file with
 * NODE_ENV=production, so a deployment whose NEXT_PUBLIC_SITE_URL is missing,
 * points at localhost, is plain http or is a *.vercel.app alias fails here on
 * the first line of the build log instead of shipping canonical, hreflang,
 * og:url, robots "Sitemap:" and sitemap <loc> URLs that no crawler can reach
 * (which is what removed the site from Google's index in 2026).
 *
 * The public origin is https://reddoor.vn. Development and tests never throw;
 * ALLOW_LOOPBACK_SITE_URL=1 (present in the local .env, never on Vercel) lets
 * a deliberate local production build through.
 */
const resolvedSiteUrl = assertProductionSiteUrl(process.env);

if (resolvedSiteUrl.source === "vercel") {
  console.warn(
    `[site-url] NEXT_PUBLIC_SITE_URL is not set; falling back to Vercel's ` +
      `production domain ${resolvedSiteUrl.url}. Set NEXT_PUBLIC_SITE_URL to ` +
      "the public https origin (https://reddoor.vn) in Vercel → Settings → " +
      "Environment Variables and redeploy so the origin is explicit.",
  );
}

/** Home of the default locale; every legacy URL that has no successor lands here. */
const HOME = `/${defaultLocale}`;

/**
 * Every production hostname that resolves to this deployment. Whichever of
 * them the resolved site URL names is the primary host; the others 308 to it.
 * The Vercel default alias is handled separately because it must keep /api
 * reachable for Vercel Cron.
 */
const KNOWN_HOSTS = [
  "reddoor.vn",
  "www.reddoor.vn",
  "lacquerwares.vn",
  "www.lacquerwares.vn",
] as const;

const VERCEL_ALIAS_HOST = "reddoor-lacquerwares.vercel.app";

/** `has: { type: "host" }` values are regular expressions anchored by Next. */
function hostMatcher(host: string): NonNullable<Redirect["has"]> {
  return [{ type: "host", value: host.replace(/\./g, "\\.") }];
}

/**
 * Host canonicalization (F03/F04). Emitted only when the resolved site URL is
 * one of the known production hosts, so `next dev`, unit tests and Playwright
 * (all on localhost) get no host rules at all.
 *
 * Ordering pitfall: Next takes the first matching redirect and `/:path*` also
 * matches the empty path, so the bare-host `/` rules must come first for every
 * secondary host or the bare host would land on `${origin}/` and need a second
 * hop through the root page's own 308 to `/vi`.
 */
function hostRedirects(): Redirect[] {
  const primary = new URL(resolveSiteUrl(process.env).url);

  if (!(KNOWN_HOSTS as readonly string[]).includes(primary.hostname)) {
    return [];
  }

  const secondaryHosts = KNOWN_HOSTS.filter(
    (host) => host !== primary.hostname,
  );

  return [
    // 1a. Bare secondary host → primary home, one hop.
    ...secondaryHosts.map((host): Redirect => ({
      source: "/",
      has: hostMatcher(host),
      destination: `${primary.origin}${HOME}`,
      permanent: true,
    })),
    // 1b. Any other path on a secondary host → same path on the primary host.
    //     The query string is passed through automatically.
    ...secondaryHosts.map((host): Redirect => ({
      source: "/:path*",
      has: hostMatcher(host),
      destination: `${primary.origin}/:path*`,
      permanent: true,
    })),
    // 2. Vercel default alias → primary host. Exact alias only — never a
    //    `.*\.vercel\.app` pattern, which would bounce preview deployments to
    //    production. `/api` is excluded because Vercel Cron invokes
    //    /api/cron/reminders on this alias and does not follow redirects.
    {
      source: "/:path((?!api/).*)",
      has: hostMatcher(VERCEL_ALIAS_HOST),
      destination: `${primary.origin}/:path`,
      permanent: true,
    },
  ];
}

/**
 * Legacy URLs from the three previous reddoor.vn sites (F06/F07 Option A):
 * a static HTML site, a WooCommerce shop and a Joomla/VirtueMart install.
 * Google and Bing still list some of them and old directory links point at
 * them; a 308 hands their signals to the new pages, a 404 drops them.
 *
 * All rules are host-independent, so they also cover the same paths when they
 * arrive on the primary host after a secondary-host redirect.
 */
const legacyRedirects: Redirect[] = [
  // 3. Static site (2016–2023).
  { source: "/index.html", destination: HOME, permanent: true },
  { source: "/about.html", destination: `${HOME}/about`, permanent: true },
  { source: "/services.html", destination: `${HOME}/process`, permanent: true },
  { source: "/contact.html", destination: `${HOME}/contact`, permanent: true },

  // 4. WooCommerce. None of the archived `?product=<sku>` SKUs exists in the
  //    current shop, so everything collapses onto the shop landing page. This
  //    rule sits before the section whitelist so `/shop/wp-admin/...` becomes
  //    `/vi/shop`, not `/vi/shop/wp-admin/...`. The incoming query
  //    (`?product=bl017-1200n`) is passed through to `/vi/shop?product=...`;
  //    the shop page ignores it and its canonical is the clean `/vi/shop`.
  { source: "/shop/:path*", destination: `${HOME}/shop`, permanent: true },

  // 5. Joomla/VirtueMart entry points (2007–2013). The `?option=com_...` query
  //    is passed through to `/vi?option=...`, which is deliberate: `/vi` is not
  //    robots-blocked and its canonical is the clean `/vi`, whereas sending
  //    them to `/vi/products?...` would emit a robots-disallowed Location.
  { source: "/index.php", destination: HOME, permanent: true },
  { source: "/index2.php", destination: HOME, permanent: true },
  { source: "/home/:path*", destination: HOME, permanent: true },

  // 6. Un-prefixed section paths (`/about`, `/products/foo`, …) → default
  //    locale. A whitelist, not a negative-lookahead catch-all: a catch-all
  //    would swallow /sitemap.xml, /robots.txt, /manifest.webmanifest, icons
  //    and every future root-level route. Shop is handled by rule 4. The bare
  //    `/` is intentionally absent — src/app/(root)/page.tsx already answers
  //    it with a static 308 to `/${defaultLocale}` (F48).
  {
    source:
      "/:section(about|contact|products|news|collections|process|privacy|terms|accessibility)/:path*",
    destination: `${HOME}/:section/:path*`,
    permanent: true,
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Next dev blocks cross-origin requests to /_next dev assets by default.
  // Tunnels (cloudflared, ngrok) serve the app from another origin, so their
  // hostnames must be allowlisted or the client bundle never loads.
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.io"],
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingIncludes: {
    "/api/paint-warehouse": ["./assets/paint-warehouse-template.xlsx"],
    "/api/materials/export": ["./assets/materials-template.xlsx"],
    "/api/sales-slips/[slipId]/export": [
      "./assets/sales-slip-template.xlsx",
      "./assets/fonts/*.ttf",
    ],
  },
  // The assistant reads an attached PDF with pdfjs-dist's legacy build on
  // the server. That build loads its worker through a specifier marked
  // `webpackIgnore`, which a bundled copy would resolve relative to the
  // emitted chunk instead of node_modules — working in dev and failing in
  // production. Keeping the package external makes it a plain Node require.
  serverExternalPackages: ["pdfjs-dist", "@react-pdf/renderer"],
  turbopack: {
    root: process.cwd(),
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 85],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      // Poster frames for the YouTube facade embed on the home page.
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
  /**
   * Redirects run before the filesystem (pages and /public) and before
   * proxy.ts; the first matching rule wins, so the groups are ordered:
   * host canonicalization, Vercel alias, legacy static, WooCommerce, Joomla,
   * un-prefixed sections. Only `/_next/*` is excluded automatically.
   */
  async redirects() {
    return [...hostRedirects(), ...legacyRedirects];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
