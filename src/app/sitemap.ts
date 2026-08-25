import type { MetadataRoute } from "next";

import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import { demoContentRepository } from "@/domains/content/demo-repository";
import { demoNewsRepository } from "@/domains/news/demo-repository";
import { demoProductRepository } from "@/domains/products/demo-repository";
import { locales } from "@/lib/i18n/config";
import {
  buildPublicSitemap,
  type PublicSitemapSource,
} from "@/lib/seo/sitemap";

const STATIC_PUBLIC_PATHS = [
  "",
  "/about",
  "/products",
  "/collections",
  "/process",
  "/news",
  "/contact",
  "/privacy",
  "/terms",
  "/accessibility",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const localizedSources = await Promise.all(
    locales.map(async (locale): Promise<PublicSitemapSource[]> => {
      const [content, products, collections, articles] = await Promise.all([
        demoContentRepository.getSnapshot(locale),
        demoProductRepository.list(locale),
        demoCollectionRepository.list(locale),
        demoNewsRepository.list(locale),
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
        ...collections.map((collection) => ({
          key: `collection:${collection.id}`,
          locale,
          path: `/collections/${collection.slug}`,
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
      ];
    }),
  );

  // Only approved, indexable records reach the sitemap; anything still marked
  // as a placeholder is filtered out upstream,
  // publishable data replaces the in-memory repositories.
  return buildPublicSitemap(localizedSources.flat());
}
