import {
  defaultLocale,
  localePath,
  locales,
  type Locale,
  type LocalizedSlug,
} from "@/lib/i18n/config";
import { assertProductionSiteUrl } from "@/lib/seo/site-url-guard";

export { isLoopbackUrl } from "@/lib/seo/site-url-guard";

const SAFE_SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

/**
 * The public origin every canonical link, hreflang and sitemap entry is built
 * on, resolved by `site-url-guard` exactly as `next.config.ts` resolves it at
 * build time. Precedence: an explicit non-loopback `NEXT_PUBLIC_SITE_URL`
 * (https://reddoor.vn in production) → Vercel's production domain
 * (`VERCEL_PROJECT_PRODUCTION_URL`) → `http://localhost:3000` for
 * development and tests. Under NODE_ENV=production the guard refuses a
 * loopback, plain-http or *.vercel.app origin unless
 * `ALLOW_LOOPBACK_SITE_URL=1` (local `next build`/`next start` only), because
 * a localhost canonical tells Google the whole live site is a copy of a page
 * it cannot reach.
 */
function configuredSiteUrl(): string {
  return assertProductionSiteUrl(process.env).url;
}

export function getSiteUrl(value = configuredSiteUrl()): URL {
  const siteUrl = new URL(value);

  if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
    throw new TypeError("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.");
  }

  siteUrl.pathname = "/";
  siteUrl.search = "";
  siteUrl.hash = "";

  return siteUrl;
}

export function normalizeSeoPath(path = ""): string {
  const value = path.trim();

  if (value.includes("?") || value.includes("#") || value.includes("\\")) {
    throw new TypeError(
      "SEO paths cannot contain a query, hash, or backslash.",
    );
  }

  const segments = value.split("/").filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new TypeError("SEO paths cannot contain dot segments.");
  }

  return segments.length > 0 ? `/${segments.join("/")}` : "";
}

export function isSafeSeoSlug(value: string): boolean {
  const normalized = value.normalize("NFC");
  return (
    normalized === value &&
    value.length > 0 &&
    value.length <= 160 &&
    SAFE_SLUG_PATTERN.test(value)
  );
}

export function encodeSeoSlug(value: string): string {
  if (!isSafeSeoSlug(value)) {
    throw new TypeError(`Unsafe public slug: ${value}`);
  }

  return encodeURIComponent(value);
}

export function absoluteUrl(path: string, siteUrl: URL = getSiteUrl()): string {
  const normalizedPath = normalizeSeoPath(path);
  return new URL(normalizedPath || "/", siteUrl).toString();
}

export function localizedUrl(
  locale: Locale,
  path = "",
  siteUrl: URL = getSiteUrl(),
): string {
  return absoluteUrl(localePath(locale, normalizeSeoPath(path)), siteUrl);
}

export function languageAlternates(
  path = "",
  siteUrl: URL = getSiteUrl(),
): Record<string, string> {
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, localizedUrl(locale, path, siteUrl)]),
  );

  return {
    ...languages,
    "x-default": localizedUrl(defaultLocale, path, siteUrl),
  };
}

export function localizedRouteAlternates(
  routes: readonly { locale: Locale; path: string }[],
  siteUrl: URL = getSiteUrl(),
): Record<string, string> {
  const languages = Object.fromEntries(
    routes.map((route) => [route.locale, absoluteUrl(route.path, siteUrl)]),
  );
  const defaultRoute =
    routes.find((route) => route.locale === defaultLocale) ?? routes[0];

  return {
    ...languages,
    ...(defaultRoute
      ? { "x-default": absoluteUrl(defaultRoute.path, siteUrl) }
      : {}),
  };
}

/**
 * An image address as an absolute URL: CDN links pass through, site-relative
 * paths resolve against the public origin, anything else is dropped.
 */
export function absoluteMediaUrl(
  src: string | null | undefined,
  siteUrl: URL = getSiteUrl(),
): string | null {
  if (!src) return null;

  try {
    const url = new URL(src, siteUrl);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export type TranslatedRecord = {
  readonly locale: Locale;
  readonly slug: string;
  readonly contentLocale: Locale;
  readonly translations: readonly LocalizedSlug[];
};

/**
 * Canonical and hreflang routes for a record whose slug differs per language.
 * Only real translations become alternates, each at its own slug. A page
 * showing another locale's copy canonicalizes to that original, so the
 * untranslated copy never competes with it as a duplicate.
 */
export function translatedRoutes(
  record: TranslatedRecord,
  pathForSlug: (encodedSlug: string) => string,
): {
  routes: { locale: Locale; path: string }[];
  canonicalPath: string;
} {
  const routeFor = (locale: Locale, slug: string) => ({
    locale,
    path: localePath(locale, pathForSlug(encodeSeoSlug(slug))),
  });
  const routes = record.translations
    .filter((translation) => isSafeSeoSlug(translation.slug))
    .map((translation) => routeFor(translation.locale, translation.slug));

  if (
    record.contentLocale === record.locale &&
    !routes.some((route) => route.locale === record.locale)
  ) {
    routes.push(routeFor(record.locale, record.slug));
  }

  const canonical =
    routes.find((route) => route.locale === record.contentLocale) ??
    routeFor(record.locale, record.slug);

  return { routes, canonicalPath: canonical.path };
}
