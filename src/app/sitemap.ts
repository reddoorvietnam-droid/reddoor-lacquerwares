import type { MetadataRoute } from "next";

import { locales } from "@/lib/i18n/config";
import {
  buildPublicSitemap,
  type PublicSitemapSource,
} from "@/lib/seo/sitemap";
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

      return [
        ...STATIC_PUBLIC_PATHS.map((path) => ({
          key: `static:${path || "home"}`,
          locale,
          path,
          isDemo: content.isDemo,
          status: "published" as const,
        })),
        ...products.map((product) => ({
          key: `product:${product.id}`,
          locale,
          path: `/products/${product.slug}`,
          isDemo: product.isDemo,
          status: "published" as const,
        })),
        ...collections
          .filter(
            (collection) =>
              collection.flipbook.pageCount !== null &&
              collection.flipbook.pageCount > 0,
          )
          .map((collection) => ({
            key: `collection:${collection.id}`,
            locale,
            path: `/collections/${collection.slug}/catalogue`,
            isDemo: collection.isDemo,
            status: "published" as const,
          })),
        ...articles.map((article) => ({
          key: `article:${article.id}`,
          locale,
          path: `/news/${article.slug}`,
          isDemo: article.isDemo,
          status: "published" as const,
        })),
        ...shopItems.map((item) => ({
          key: `shop:${item.id}`,
          locale,
          path: `/shop/${item.slug}`,
          isDemo: false,
          status: "published" as const,
          lastModified: item.updatedAt,
        })),
      ];
    }),
  );

  // Only approved, indexable records reach the sitemap; anything still marked
  // as a placeholder is filtered out upstream,
  // publishable data replaces the in-memory repositories.
  return buildPublicSitemap(localizedSources.flat());
}
