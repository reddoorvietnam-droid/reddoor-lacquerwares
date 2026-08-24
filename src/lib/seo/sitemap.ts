import type { MetadataRoute } from "next";

import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { getSiteUrl, localizedUrl, normalizeSeoPath } from "@/lib/seo/urls";

export type PublicSitemapSource = {
  key: string;
  locale: Locale;
  path?: string;
  isDemo: boolean;
  status: "draft" | "published";
  lastModified?: string | Date;
  changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority?: number;
};

const PRIVATE_TOP_LEVEL_SEGMENTS = new Set(["admin", "api", "auth", "private"]);

export function isPublicSitemapPath(path: string): boolean {
  let normalizedPath: string;

  try {
    normalizedPath = normalizeSeoPath(path);
  } catch {
    return false;
  }

  const [firstSegment] = normalizedPath.split("/").filter(Boolean);

  if (firstSegment && PRIVATE_TOP_LEVEL_SEGMENTS.has(firstSegment)) {
    return false;
  }

  return normalizedPath !== "/search";
}

export function isSitemapEligible(source: PublicSitemapSource): boolean {
  return (
    source.status === "published" &&
    !source.isDemo &&
    isPublicSitemapPath(source.path ?? "")
  );
}

export function buildPublicSitemap(
  sources: readonly PublicSitemapSource[],
  siteUrl: URL = getSiteUrl(),
): MetadataRoute.Sitemap {
  const eligibleSources = sources.filter(isSitemapEligible);
  const byKey = new Map<string, PublicSitemapSource[]>();

  for (const source of eligibleSources) {
    const translations = byKey.get(source.key) ?? [];
    translations.push(source);
    byKey.set(source.key, translations);
  }

  const entries = eligibleSources.map((source) => {
    const translations = byKey.get(source.key) ?? [];
    const languages = Object.fromEntries(
      translations.map((translation) => [
        translation.locale,
        localizedUrl(translation.locale, translation.path ?? "", siteUrl),
      ]),
    );
    const defaultTranslation = translations.find(
      (translation) => translation.locale === defaultLocale,
    );

    if (defaultTranslation) {
      languages["x-default"] = localizedUrl(
        defaultTranslation.locale,
        defaultTranslation.path ?? "",
        siteUrl,
      );
    }

    return {
      url: localizedUrl(source.locale, source.path ?? "", siteUrl),
      ...(source.lastModified ? { lastModified: source.lastModified } : {}),
      ...(source.changeFrequency
        ? { changeFrequency: source.changeFrequency }
        : {}),
      ...(typeof source.priority === "number"
        ? { priority: source.priority }
        : {}),
      ...(Object.keys(languages).length > 0
        ? { alternates: { languages } }
        : {}),
    } satisfies MetadataRoute.Sitemap[number];
  });

  return Array.from(
    new Map(entries.map((entry) => [entry.url, entry])).values(),
  );
}
