import { shopTextLocaleFor, shopTextLocales } from "@/domains/shop/contracts";
import type { Locale, LocalizedSlug } from "@/lib/i18n/config";
import type { PublicMetadataImage } from "@/lib/seo/metadata";
import {
  absoluteMediaUrl,
  getSiteUrl,
  translatedRoutes,
  type TranslatedRecord,
} from "@/lib/seo/urls";

/**
 * Canonical and hreflang routes for each kind of public detail page, shared
 * by the page metadata, the structured data and the sitemap so the three can
 * never disagree about which URL is the original.
 */

export function productRoutes(product: TranslatedRecord) {
  return translatedRoutes(product, (slug) => `/products/${slug}`);
}

export function articleRoutes(article: TranslatedRecord) {
  return translatedRoutes(article, (slug) => `/news/${slug}`);
}

/**
 * The collection landing page is the collection's canonical address: the
 * page with the title, the cover, the editorial copy and the product links.
 */
export function collectionRoutes(collection: TranslatedRecord) {
  return translatedRoutes(collection, (slug) => `/collections/${slug}`);
}

/**
 * The flipbook reader is an alternate presentation of the same collection
 * (images only, no crawlable body), so its metadata canonicalizes to
 * `collectionRoutes`; these paths exist for links and IndexNow submissions.
 */
export function catalogueRoutes(collection: TranslatedRecord) {
  return translatedRoutes(
    collection,
    (slug) => `/collections/${slug}/catalogue`,
  );
}

/**
 * The shop is written in Vietnamese and English only and keeps one slug in
 * every locale; the other four locales show the English copy, so they
 * canonicalize to it.
 */
export function shopItemRecord(item: {
  locale: Locale;
  slug: string;
}): TranslatedRecord {
  const translations: LocalizedSlug[] = shopTextLocales.map((locale) => ({
    locale,
    slug: item.slug,
  }));
  return {
    locale: item.locale,
    slug: item.slug,
    contentLocale: shopTextLocaleFor(item.locale),
    translations,
  };
}

export function shopItemRoutes(item: { locale: Locale; slug: string }) {
  return translatedRoutes(shopItemRecord(item), (slug) => `/shop/${slug}`);
}

type ImageLike = {
  readonly src: string | null;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly assetPending?: boolean;
};

/**
 * Delivered photographs as absolute share images, most representative
 * first. Reserved slots (no photograph yet) are skipped, never advertised.
 */
export function deliveredImages(
  images: readonly ImageLike[],
  limit = 4,
  siteUrl: URL = getSiteUrl(),
): PublicMetadataImage[] {
  return images
    .filter((image) => !image.assetPending)
    .flatMap((image) => {
      const url = absoluteMediaUrl(image.src, siteUrl);
      return url
        ? [{ url, width: image.width, height: image.height, alt: image.alt }]
        : [];
    })
    .slice(0, limit);
}
