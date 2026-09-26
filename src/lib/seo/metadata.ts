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

export type PublicMetadataImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

/** Size of the generated brand card in `app/[locale]/opengraph-image.tsx`. */
const BRAND_CARD_SIZE = { width: 1200, height: 630 } as const;

export type PublicMetadataInput = {
  locale: Locale;
  path?: string;
  title: string;
  description: string;
  siteName: string;
  isDemo: boolean;
  indexable?: boolean;
  /**
   * A filtered or paginated view of an indexable listing (`?category=`,
   * `?group=`, `?page=`...). Crawlable and followed so its links still count,
   * but neither indexed nor offered as a canonical or hreflang target: the
   * clean listing is the only version search engines should keep.
   */
  filteredView?: boolean;
  kind?: PublicMetadataKind;
  localizedRoutes?: readonly { locale: Locale; path: string }[];
  canonicalOverride?: string | null;
  /**
   * Share images, most representative first. Without them the generated
   * brand card is used: a page's `openGraph` replaces its parent's wholesale,
   * so leaving images out would ship the page with no preview at all.
   */
  images?: readonly PublicMetadataImage[];
  publishedTime?: string | null;
  modifiedTime?: string | null;
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

/** `noindex, follow`: the single mechanism Google recommends for filter views. */
const FILTERED_VIEW_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true,
  },
};

export function buildPublicMetadata({
  locale,
  path = "",
  title,
  description,
  siteName,
  isDemo,
  indexable = true,
  filteredView = false,
  kind = "website",
  localizedRoutes,
  canonicalOverride,
  images,
  publishedTime,
  modifiedTime,
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
  const shareImages =
    images && images.length > 0
      ? images.map((image) => ({ ...image }))
      : [
          {
            url: localizedUrl(locale, "/opengraph-image", siteUrl),
            ...BRAND_CARD_SIZE,
            alt: siteName,
          },
        ];

  return {
    metadataBase: siteUrl,
    // A title that already carries the brand is emitted verbatim; letting the
    // layout template append the brand again produced tabs such as
    // "Red Door — Vietnamese Handcrafted Lacquer | Red Door".
    title: title.startsWith(siteName) ? { absolute: title } : title,
    description,
    // `null`, never an omitted key: Next merges segment metadata key by key,
    // so a missing `alternates` would keep the locale layout's canonical to
    // the locale home on a page that must carry no canonical at all.
    alternates: filteredView
      ? null
      : {
          canonical,
          languages:
            localizedRoutes && localizedRoutes.length > 0
              ? localizedRouteAlternates(localizedRoutes, siteUrl)
              : languageAlternates(path, siteUrl),
        },
    robots: filteredView ? FILTERED_VIEW_ROBOTS : publicRobots(canIndex),
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
      images: shareImages,
      ...(kind === "article" && publishedTime ? { publishedTime } : {}),
      ...(kind === "article" && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: shareImages,
    },
    ...(isDemo ? { other: { "content-status": "DEMO" } } : {}),
  };
}
