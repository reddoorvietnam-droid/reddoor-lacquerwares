import "server-only";

import type { Metadata } from "next";

import { isLocale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import {
  articleRoutes,
  collectionRoutes,
  deliveredImages,
  productRoutes,
  shopItemRoutes,
} from "@/lib/seo/public-records";
import {
  getPublicCollectionRepository,
  getPublicNewsRepository,
  getPublicProductRepository,
  getPublicShopRepository,
} from "@/lib/public/repositories";

const collectionRepository = getPublicCollectionRepository();
const newsRepository = getPublicNewsRepository();
const productRepository = getPublicProductRepository();
const shopRepository = getPublicShopRepository();

export type DemoStaticPage =
  | "accessibility"
  | "about"
  | "collections"
  | "contact"
  | "home"
  | "news"
  | "privacy"
  | "process"
  | "products"
  | "search"
  | "shop"
  | "terms";

type StaticDefinition = {
  path: string;
  copy: (dictionary: PublicDictionary) => {
    title: string;
    description: string;
  };
};

/**
 * Section pages take their <title> from `pages.*Heading`, the same string
 * that renders as their <h1> (the layout template appends " | Red Door").
 * Every description comes from `meta.pageDescriptions`, written for the
 * search snippet and kept apart from the on-page hero copy (`pages.*Intro`).
 * The noindex search page reuses the home description.
 */
const STATIC_DEFINITIONS: Record<DemoStaticPage, StaticDefinition> = {
  accessibility: {
    path: "/accessibility",
    copy: (dictionary) => ({
      title: dictionary.pages.accessibilityTitle,
      description: dictionary.meta.pageDescriptions.accessibility,
    }),
  },
  about: {
    path: "/about",
    copy: (dictionary) => ({
      title: dictionary.pages.aboutHeading,
      description: dictionary.meta.pageDescriptions.about,
    }),
  },
  collections: {
    path: "/collections",
    copy: (dictionary) => ({
      title: dictionary.pages.collectionsHeading,
      description: dictionary.meta.pageDescriptions.collections,
    }),
  },
  contact: {
    path: "/contact",
    copy: (dictionary) => ({
      title: dictionary.pages.contactHeading,
      description: dictionary.meta.pageDescriptions.contact,
    }),
  },
  home: {
    path: "",
    copy: (dictionary) => ({
      title: dictionary.meta.siteTitle,
      description: dictionary.meta.pageDescriptions.home,
    }),
  },
  news: {
    path: "/news",
    copy: (dictionary) => ({
      title: dictionary.pages.newsHeading,
      description: dictionary.meta.pageDescriptions.news,
    }),
  },
  privacy: {
    path: "/privacy",
    copy: (dictionary) => ({
      title: dictionary.pages.privacyTitle,
      description: dictionary.meta.pageDescriptions.privacy,
    }),
  },
  process: {
    path: "/process",
    copy: (dictionary) => ({
      title: dictionary.pages.processHeading,
      description: dictionary.meta.pageDescriptions.process,
    }),
  },
  products: {
    path: "/products",
    copy: (dictionary) => ({
      title: dictionary.pages.productsHeading,
      description: dictionary.meta.pageDescriptions.products,
    }),
  },
  search: {
    path: "/search",
    copy: (dictionary) => ({
      title: dictionary.pages.searchTitle,
      description: dictionary.meta.pageDescriptions.home,
    }),
  },
  shop: {
    path: "/shop",
    copy: (dictionary) => ({
      title: dictionary.pages.shopHeading,
      description: dictionary.meta.pageDescriptions.shop,
    }),
  },
  terms: {
    path: "/terms",
    copy: (dictionary) => ({
      title: dictionary.pages.termsTitle,
      description: dictionary.meta.pageDescriptions.terms,
    }),
  },
};

export type StaticPageMetadataOptions = {
  /** `false` = noindex, nofollow (the search page). Defaults to indexable. */
  indexable?: boolean;
  /** A filtered listing view: noindex, follow, no canonical or hreflang. */
  filteredView?: boolean;
};

export async function getDemoStaticPageMetadata(
  localeValue: string,
  page: DemoStaticPage,
  options: boolean | StaticPageMetadataOptions = true,
): Promise<Metadata> {
  if (!isLocale(localeValue)) return {};

  const resolved: StaticPageMetadataOptions =
    typeof options === "boolean" ? { indexable: options } : options;
  const { indexable = true, filteredView = false } = resolved;
  const dictionary = await getDictionary(localeValue);
  const definition = STATIC_DEFINITIONS[page];
  const copy = definition.copy(dictionary);

  return buildPublicMetadata({
    locale: localeValue,
    path: definition.path,
    title: copy.title,
    description: copy.description,
    siteName: dictionary.meta.siteName,
    // Every static route now carries approved copy, legal pages included.
    isDemo: false,
    indexable,
    filteredView,
  });
}

export async function getDemoProductMetadata(
  localeValue: string,
  slug: string,
): Promise<Metadata> {
  if (!isLocale(localeValue)) return {};

  const [dictionary, product] = await Promise.all([
    getDictionary(localeValue),
    productRepository.getBySlug(localeValue, slug),
  ]);
  if (!product) return {};

  const { routes, canonicalPath } = productRoutes(product);
  return buildPublicMetadata({
    locale: localeValue,
    title: product.name,
    description: product.summary,
    siteName: dictionary.meta.siteName,
    isDemo: product.isDemo,
    localizedRoutes: routes,
    canonicalOverride: canonicalPath,
    images: deliveredImages(product.images),
  });
}

/**
 * Both collection routes share one metadata record. The landing page is the
 * canonical URL; the flipbook reader at `/catalogue` is an alternate
 * presentation of the same collection (page images only, no crawlable body),
 * so it declares the landing page as its canonical and the landing page's
 * hreflang set as its own. Otherwise the two would be indexed as
 * near-duplicates with the same title, description and cover.
 */
async function collectionMetadata(
  localeValue: string,
  slug: string,
): Promise<Metadata> {
  if (!isLocale(localeValue)) return {};

  const [dictionary, collection] = await Promise.all([
    getDictionary(localeValue),
    collectionRepository.getBySlug(localeValue, slug),
  ]);
  if (!collection) return {};

  const { routes, canonicalPath } = collectionRoutes(collection);
  return buildPublicMetadata({
    locale: localeValue,
    title: collection.title,
    description: collection.summary,
    siteName: dictionary.meta.siteName,
    isDemo: collection.isDemo,
    localizedRoutes: routes,
    canonicalOverride: canonicalPath,
    images: deliveredImages([collection.cover]),
  });
}

export function getCollectionLandingMetadata(
  localeValue: string,
  slug: string,
): Promise<Metadata> {
  return collectionMetadata(localeValue, slug);
}

export function getCollectionCatalogueMetadata(
  localeValue: string,
  slug: string,
): Promise<Metadata> {
  return collectionMetadata(localeValue, slug);
}

export async function getDemoNewsMetadata(
  localeValue: string,
  slug: string,
): Promise<Metadata> {
  if (!isLocale(localeValue)) return {};

  const [dictionary, article] = await Promise.all([
    getDictionary(localeValue),
    newsRepository.getBySlug(localeValue, slug),
  ]);
  if (!article) return {};

  const { routes, canonicalPath } = articleRoutes(article);
  return buildPublicMetadata({
    locale: localeValue,
    title: article.title,
    description: article.excerpt,
    siteName: dictionary.meta.siteName,
    isDemo: article.isDemo,
    kind: "article",
    localizedRoutes: routes,
    canonicalOverride: canonicalPath,
    images: deliveredImages([article.image]),
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
  });
}

export async function getShopItemMetadata(
  localeValue: string,
  slug: string,
): Promise<Metadata> {
  if (!isLocale(localeValue)) return {};

  const [dictionary, item] = await Promise.all([
    getDictionary(localeValue),
    shopRepository.getBySlug(localeValue, slug),
  ]);
  if (!item) return {};

  const { routes, canonicalPath } = shopItemRoutes(item);
  return buildPublicMetadata({
    locale: localeValue,
    title: item.name,
    description: item.summary,
    siteName: dictionary.meta.siteName,
    isDemo: false,
    localizedRoutes: routes,
    canonicalOverride: canonicalPath,
    images: deliveredImages(item.images),
  });
}
