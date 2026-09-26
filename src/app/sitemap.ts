import type { MetadataRoute } from "next";

import { shopTextLocaleFor } from "@/domains/shop/contracts";
import { locales } from "@/lib/i18n/config";
import {
  buildPublicSitemap,
  type PublicSitemapSource,
} from "@/lib/seo/sitemap";
import { deliveredImages } from "@/lib/seo/public-records";
import { absoluteUrl } from "@/lib/seo/urls";
import {
  getPublicCollectionRepository,
  getPublicContentRepository,
  getPublicNewsRepository,
  getPublicProductRepository,
  getPublicShopRepository,
} from "@/lib/public/repositories";

const collectionRepository = getPublicCollectionRepository();
const contentRepository = getPublicContentRepository();
const newsRepository = getPublicNewsRepository();
const productRepository = getPublicProductRepository();
const shopRepository = getPublicShopRepository();

const STATIC_PUBLIC_PATHS = [
  "",
  "/about",
  "/products",
  "/collections",
  "/process",
  "/news",
  "/shop",
  "/contact",
  "/privacy",
  "/terms",
  "/accessibility",
] as const;

/**
 * The three photographs on the home page, in reading order: the product
 * still-life hero, the artisan polishing a tray, and the workshop's red
 * doors. Static assets, so the sitemap names them directly.
 */
const HOME_IMAGE_PATHS = [
  "/hinh_nen_rd1.jpg",
  "/cau_chuyen.jpg",
  "/about-us/red_door.jpg",
] as const;

function imageUrls(
  images: Parameters<typeof deliveredImages>[0],
  limit?: number,
): string[] {
  return deliveredImages(images, limit).map((image) => image.url);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const localizedSources = await Promise.all(
    locales.map(async (locale): Promise<PublicSitemapSource[]> => {
      const [content, products, collections, articles, shopItems] =
        await Promise.all([
          contentRepository.getSnapshot(locale),
          productRepository.list(locale),
          collectionRepository.list(locale),
          newsRepository.list(locale),
          shopRepository.list(locale),
        ]);

      // A record listed in a locale it has no translation for only shows
      // another locale's copy there; that page canonicalizes to the original
      // and so stays out of the sitemap.
      return [
        ...STATIC_PUBLIC_PATHS.map((path) => ({
          key: `static:${path || "home"}`,
          locale,
          path,
          isDemo: content.isDemo,
          status: "published" as const,
          ...(path === ""
            ? { images: HOME_IMAGE_PATHS.map((image) => absoluteUrl(image)) }
            : {}),
        })),
        ...products
          .filter((product) => product.contentLocale === locale)
          .map((product) => ({
            key: `product:${product.id}`,
            locale,
            path: `/products/${product.slug}`,
            isDemo: product.isDemo,
            status: "published" as const,
            lastModified: product.updatedAt,
            images: imageUrls(product.images, 10),
          })),
        // Every published collection has a landing page, catalogue or not;
        // the flipbook reader canonicalizes to it and is left out.
        ...collections
          .filter((collection) => collection.contentLocale === locale)
          .map((collection) => ({
            key: `collection:${collection.id}`,
            locale,
            path: `/collections/${collection.slug}`,
            isDemo: collection.isDemo,
            status: "published" as const,
            lastModified: collection.updatedAt,
            images: imageUrls([collection.cover]),
          })),
        ...articles
          .filter((article) => article.contentLocale === locale)
          .map((article) => ({
            key: `article:${article.id}`,
            locale,
            path: `/news/${article.slug}`,
            isDemo: article.isDemo,
            status: "published" as const,
            lastModified: article.updatedAt ?? article.publishedAt,
            images: imageUrls([article.image]),
          })),
        ...shopItems
          .filter(() => shopTextLocaleFor(locale) === locale)
          .map((item) => ({
            key: `shop:${item.id}`,
            locale,
            path: `/shop/${item.slug}`,
            isDemo: false,
            status: "published" as const,
            lastModified: item.updatedAt,
            images: imageUrls(item.images, 10),
          })),
      ];
    }),
  );

  // Only approved, indexable records reach the sitemap; anything still marked
  // as a placeholder is filtered out upstream,
  // publishable data replaces the in-memory repositories.
  return buildPublicSitemap(localizedSources.flat());
}
