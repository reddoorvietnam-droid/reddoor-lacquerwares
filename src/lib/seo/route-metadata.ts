import "server-only";

import type { Metadata } from "next";

import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import { demoNewsRepository } from "@/domains/news/demo-repository";
import { demoProductRepository } from "@/domains/products/demo-repository";
import { isLocale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { encodeSeoSlug } from "@/lib/seo/urls";

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
  | "terms";

type StaticDefinition = {
  path: string;
  copy: (dictionary: PublicDictionary) => {
    title: string;
    description: string;
  };
};

/**
 * Static routes whose copy is still a placeholder. These stay `noindex` until
 * the company supplies real policy and accessibility text; every other static
 * route now carries approved content and must be indexable, so a blanket
 * `isDemo: true` here would quietly keep the finished site out of search.
 */
const PLACEHOLDER_STATIC_PAGES = new Set<DemoStaticPage>([
  "privacy",
  "terms",
  "accessibility",
]);

const STATIC_DEFINITIONS: Record<DemoStaticPage, StaticDefinition> = {
  accessibility: {
    path: "/accessibility",
    copy: (dictionary) => ({
      title: dictionary.pages.accessibilityTitle,
      description: dictionary.common.replaceContentNotice,
    }),
  },
  about: {
    path: "/about",
    copy: (dictionary) => ({
      title: dictionary.pages.aboutTitle,
      description: dictionary.pages.aboutIntro,
    }),
  },
  collections: {
    path: "/collections",
    copy: (dictionary) => ({
      title: dictionary.pages.collectionsTitle,
      description: dictionary.pages.collectionsIntro,
    }),
  },
  contact: {
    path: "/contact",
    copy: (dictionary) => ({
      title: dictionary.pages.contactTitle,
      description: dictionary.pages.contactIntro,
    }),
  },
  home: {
    path: "",
    copy: (dictionary) => ({
      title: dictionary.meta.siteTitle,
      description: dictionary.meta.siteDescription,
    }),
  },
  news: {
    path: "/news",
    copy: (dictionary) => ({
      title: dictionary.pages.newsTitle,
      description: dictionary.pages.newsIntro,
    }),
  },
  privacy: {
    path: "/privacy",
    copy: (dictionary) => ({
      title: dictionary.pages.privacyTitle,
      description: dictionary.common.replaceContentNotice,
    }),
  },
  process: {
    path: "/process",
    copy: (dictionary) => ({
      title: dictionary.pages.processTitle,
      description: dictionary.pages.processIntro,
    }),
  },
  products: {
    path: "/products",
    copy: (dictionary) => ({
      title: dictionary.pages.productsTitle,
      description: dictionary.pages.productsIntro,
    }),
  },
  search: {
    path: "/search",
    copy: (dictionary) => ({
      title: dictionary.pages.searchTitle,
      description: dictionary.meta.siteDescription,
    }),
  },
  terms: {
    path: "/terms",
    copy: (dictionary) => ({
      title: dictionary.pages.termsTitle,
      description: dictionary.common.replaceContentNotice,
    }),
  },
};

export async function getDemoStaticPageMetadata(
  localeValue: string,
  page: DemoStaticPage,
  indexable = true,
): Promise<Metadata> {
  if (!isLocale(localeValue)) return {};

  const dictionary = await getDictionary(localeValue);
  const definition = STATIC_DEFINITIONS[page];
  const copy = definition.copy(dictionary);

  return buildPublicMetadata({
    locale: localeValue,
    path: definition.path,
    title: copy.title,
    description: copy.description,
    siteName: dictionary.meta.siteTitle,
    isDemo: PLACEHOLDER_STATIC_PAGES.has(page),
    indexable,
  });
}

export async function getDemoProductMetadata(
  localeValue: string,
  slug: string,
): Promise<Metadata> {
  if (!isLocale(localeValue)) return {};

  const [dictionary, product] = await Promise.all([
    getDictionary(localeValue),
    demoProductRepository.getBySlug(localeValue, slug),
  ]);
  if (!product) return {};

  return buildPublicMetadata({
    locale: localeValue,
    path: `/products/${encodeSeoSlug(product.slug)}`,
    title: product.name,
    description: product.summary,
    siteName: dictionary.meta.siteTitle,
    isDemo: product.isDemo,
  });
}

export async function getDemoCollectionMetadata(
  localeValue: string,
  slug: string,
): Promise<Metadata> {
  if (!isLocale(localeValue)) return {};

  const [dictionary, collection] = await Promise.all([
    getDictionary(localeValue),
    demoCollectionRepository.getBySlug(localeValue, slug),
  ]);
  if (!collection) return {};

  return buildPublicMetadata({
    locale: localeValue,
    path: `/collections/${encodeSeoSlug(collection.slug)}`,
    title: collection.title,
    description: collection.summary,
    siteName: dictionary.meta.siteTitle,
    isDemo: collection.isDemo,
  });
}

export async function getDemoNewsMetadata(
  localeValue: string,
  slug: string,
): Promise<Metadata> {
  if (!isLocale(localeValue)) return {};

  const [dictionary, article] = await Promise.all([
    getDictionary(localeValue),
    demoNewsRepository.getBySlug(localeValue, slug),
  ]);
  if (!article) return {};

  return buildPublicMetadata({
    locale: localeValue,
    path: `/news/${encodeSeoSlug(article.slug)}`,
    title: article.title,
    description: article.excerpt,
    siteName: dictionary.meta.siteTitle,
    isDemo: article.isDemo,
    kind: "article",
  });
}
