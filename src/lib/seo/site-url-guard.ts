/**
 * The public origin every canonical link, hreflang, sitemap entry, JSON-LD
 * URL and share image is built on, resolved the same way at build time (from
 * `next.config.ts`) and at request time (from `src/lib/seo/urls.ts`).
 *
 * This module deliberately has no imports: `next.config.ts` is loaded with
 * CommonJS resolution before any path alias exists, so it can only reach a
 * plain relative module.
 *
 * Precedence:
 *   1. `NEXT_PUBLIC_SITE_URL` when it is not a loopback address.
 *   2. Vercel's production domain (`VERCEL_PROJECT_PRODUCTION_URL`), which is
 *      only present when the project exposes system environment variables.
 *   3. `http://localhost:3000` for development and tests.
 *
 * A production build that would end on (3) is refused, because a loopback
 * canonical tells search engines that every live page is a copy of a page
 * they cannot reach — exactly what took the site out of Google's index.
 * `ALLOW_LOOPBACK_SITE_URL=1` is the escape hatch for a deliberate local
 * `next build`/`next start`; it must never be set on Vercel.
 */

export const DEFAULT_SITE_URL = "http://localhost:3000";

const LOOPBACK_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

export type SiteUrlEnv = {
  readonly NEXT_PUBLIC_SITE_URL?: string;
  readonly VERCEL_PROJECT_PRODUCTION_URL?: string;
  readonly NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?: string;
  readonly NODE_ENV?: string;
  readonly ALLOW_LOOPBACK_SITE_URL?: string;
};

export type SiteUrlSource = "explicit" | "vercel" | "loopback-default";

export type ResolvedSiteUrl = {
  readonly url: string;
  readonly source: SiteUrlSource;
};

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname.trim().toLowerCase());
}

export function isLoopbackUrl(value: string): boolean {
  try {
    return isLoopbackHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}

function trimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** The origin the site would use with the given environment, never throwing. */
export function resolveSiteUrl(env: SiteUrlEnv): ResolvedSiteUrl {
  const explicit = trimmed(env.NEXT_PUBLIC_SITE_URL);
  if (explicit && !isLoopbackUrl(explicit)) {
    return { url: explicit, source: "explicit" };
  }

  const vercelDomain = trimmed(
    env.VERCEL_PROJECT_PRODUCTION_URL ??
      env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  );
  if (vercelDomain) {
    return { url: `https://${vercelDomain}`, source: "vercel" };
  }

  return { url: explicit || DEFAULT_SITE_URL, source: "loopback-default" };
}

export class SiteUrlConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteUrlConfigurationError";
  }
}

/**
 * Why a resolved origin is unfit for a production deployment, or `null` when
 * it is fine. Exported so the build guard and the runtime share one verdict.
 */
export function productionSiteUrlProblem(
  resolved: ResolvedSiteUrl,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(resolved.url);
  } catch {
    return `"${resolved.url}" is not a valid URL.`;
  }

  if (
    resolved.source === "loopback-default" ||
    isLoopbackHostname(parsed.hostname)
  ) {
    return `it resolves to the loopback address ${parsed.origin}.`;
  }
  if (parsed.protocol !== "https:") {
    return `${parsed.origin} is not an https origin.`;
  }
  if (parsed.hostname.endsWith(".vercel.app")) {
    return `${parsed.hostname} is a Vercel alias, not the public domain.`;
  }
  return null;
}

/**
 * Resolve the origin and refuse a production build/runtime that would publish
 * a loopback, plain-http or Vercel-alias origin. Development and tests always
 * pass; `ALLOW_LOOPBACK_SITE_URL=1` disables the check for local production
 * builds only.
 */
export function assertProductionSiteUrl(env: SiteUrlEnv): ResolvedSiteUrl {
  const resolved = resolveSiteUrl(env);
  const isProduction = env.NODE_ENV === "production";
  const loopbackAllowed = trimmed(env.ALLOW_LOOPBACK_SITE_URL) === "1";

  if (!isProduction || loopbackAllowed) {
    return resolved;
  }

  const problem = productionSiteUrlProblem(resolved);
  if (problem) {
    throw new SiteUrlConfigurationError(
      `Refusing to build the public site for production: ${problem} ` +
        "Set NEXT_PUBLIC_SITE_URL to the public https origin (for example " +
        "https://reddoor.vn) in Vercel → Settings → Environment Variables " +
        "(Production and Preview) and redeploy — NEXT_PUBLIC_* values are " +
        "inlined at build time, so saving the variable alone changes nothing. " +
        "For a deliberate local production build set ALLOW_LOOPBACK_SITE_URL=1.",
    );
  }

  return resolved;
}
