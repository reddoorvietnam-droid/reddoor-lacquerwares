import type { Metadata } from "next";

import { locales, type Locale } from "@/lib/i18n/config";
import {
  absoluteUrl,
  getSiteUrl,
  languageAlternates,
  localizedRouteAlternates,
  localizedUrl,
} from "@/lib/seo/urls";

export type PublicMetadataKind = "article" | "website";

export type PublicMetadataInput = {
  locale: Locale;
  path?: string;
  title: string;
  description: string;
  siteName: string;
  isDemo: boolean;
  indexable?: boolean;
  kind?: PublicMetadataKind;
  localizedRoutes?: readonly { locale: Locale; path: string }[];
  canonicalOverride?: string | null;
};

function canonicalOverrideUrl(value: string, siteUrl: URL): string {
  const resolved = new URL(value, siteUrl);
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    throw new TypeError("Canonical URLs must use HTTP or HTTPS.");
  }
  return resolved.toString();
}

export function publicRobots(indexable: boolean): Metadata["robots"] {
  if (!indexable) {
    return {
      index: false,
      follow: false,
      nocache: true,
      noarchive: true,
      noimageindex: true,
      nosnippet: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    };
  }

  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

export function buildPublicMetadata({
  locale,
  path = "",
  title,
  description,
  siteName,
  isDemo,
  indexable = true,
  kind = "website",
  localizedRoutes,
  canonicalOverride,
}: PublicMetadataInput): Metadata {
  const siteUrl = getSiteUrl();
  const currentRoute = localizedRoutes?.find(
    (route) => route.locale === locale,
  );
  const canonical = canonicalOverride
    ? canonicalOverrideUrl(canonicalOverride, siteUrl)
    : currentRoute
      ? absoluteUrl(currentRoute.path, siteUrl)
      : localizedUrl(locale, path, siteUrl);
  const canIndex = indexable && !isDemo;
  const alternateLocales = (
    localizedRoutes?.map((route) => route.locale) ?? locales
  ).filter((candidate) => candidate !== locale);

  return {
    metadataBase: siteUrl,
    // A title that already carries the brand is emitted verbatim; letting the
    // layout template append the brand again produced tabs such as
    // "Red Door — Vietnamese Handcrafted Lacquer | Red Door".
    title: title.startsWith(siteName) ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      languages:
        localizedRoutes && localizedRoutes.length > 0
          ? localizedRouteAlternates(localizedRoutes, siteUrl)
          : languageAlternates(path, siteUrl),
    },
    robots: publicRobots(canIndex),
    openGraph: {
      type: kind,
      title,
      description,
      url: canonical,
      siteName,
      locale: locale.replace("-", "_"),
      alternateLocale: alternateLocales.map((candidate) =>
        candidate.replace("-", "_"),
      ),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    ...(isDemo ? { other: { "content-status": "DEMO" } } : {}),
  };
}
