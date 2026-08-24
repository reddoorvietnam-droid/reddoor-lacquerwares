import {
  defaultLocale,
  localePath,
  locales,
  type Locale,
} from "@/lib/i18n/config";

const DEFAULT_SITE_URL = "http://localhost:3000";
const SAFE_SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export function getSiteUrl(
  value = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL,
): URL {
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
