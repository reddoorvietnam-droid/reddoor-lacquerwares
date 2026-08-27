import "server-only";

import type { Metadata } from "next";

import { isLocale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { encodeSeoSlug } from "@/lib/seo/urls";
import {
  getPublicCollectionRepository,
  getPublicNewsRepository,
  getPublicProductRepository,
} from "@/lib/public/repositories";

const collectionRepository = getPublicCollectionRepository();
const newsRepository = getPublicNewsRepository();
const productRepository = getPublicProductRepository();

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

const STATIC_DEFINITIONS: Record<DemoStaticPage, StaticDefinition> = {
  accessibility: {
    path: "/accessibility",
    copy: (dictionary) => ({
      title: dictionary.pages.accessibilityTitle,
      description: dictionary.legal.accessibilityIntro,
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
      description: dictionary.legal.privacyIntro,
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
      description: dictionary.legal.termsIntro,
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
    siteName: dictionary.meta.siteName,
    // Every static route now carries approved copy, legal pages included.
    isDemo: false,
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
    productRepository.getBySlug(localeValue, slug),
  ]);
  if (!product) return {};

  return buildPublicMetadata({
    locale: localeValue,
    path: `/products/${encodeSeoSlug(product.slug)}`,
    title: product.name,
    description: product.summary,
    siteName: dictionary.meta.siteName,
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
    collectionRepository.getBySlug(localeValue, slug),
  ]);
  if (!collection) return {};

  return buildPublicMetadata({
    locale: localeValue,
    path: `/collections/${encodeSeoSlug(collection.slug)}/catalogue`,
    title: collection.title,
    description: collection.summary,
    siteName: dictionary.meta.siteName,
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
    newsRepository.getBySlug(localeValue, slug),
  ]);
  if (!article) return {};

  return buildPublicMetadata({
    locale: localeValue,
    path: `/news/${encodeSeoSlug(article.slug)}`,
    title: article.title,
    description: article.excerpt,
    siteName: dictionary.meta.siteName,
    isDemo: article.isDemo,
    kind: "article",
  });
}
