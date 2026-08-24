import "server-only";

import type { AboutHistoryPageData } from "@/components/public/pages/about-history";
import type {
  CollectionCardView,
  CollectionLandingPageData,
  CollectionListingPageData,
  CollectionProductLinkView,
} from "@/components/public/pages/collections";
import type { ContactRequestQuotePageData } from "@/components/public/pages/contact-request-quote";
import type { LacquerProcessPageData } from "@/components/public/pages/lacquer-process";
import type { LegalDocumentPageData } from "@/components/public/pages/legal";
import type {
  NewsArticlePageData,
  NewsCardView,
  NewsListingPageData,
} from "@/components/public/pages/news";
import type {
  ProductCardView,
  ProductDetailPageData,
  ProductFilterOptionView,
  ProductListingPageData,
  ProductSpecificationView,
} from "@/components/public/pages/products";
import type {
  SearchPageData,
  SearchResultView,
} from "@/components/public/pages/search";
import type { PublicPageMedia } from "@/components/public/pages/shared";
import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import type {
  PublicCollection,
  PublicCollectionCover,
} from "@/domains/collections/public-contract";
import { demoContentRepository } from "@/domains/content/demo-repository";
import type { PublicImageAsset } from "@/domains/content/public-contract";
import { demoNewsRepository } from "@/domains/news/demo-repository";
import type {
  PublicNewsArticle,
  PublicNewsImage,
} from "@/domains/news/public-contract";
import { demoProductRepository } from "@/domains/products/demo-repository";
import type {
  PublicProduct,
  PublicProductDimensions,
  PublicProductImage,
} from "@/domains/products/public-contract";
import { localePath, locales, type Locale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";

type DemoMediaSource =
  | PublicImageAsset
  | PublicProductImage
  | PublicCollectionCover
  | PublicNewsImage;

export type DemoProductListingQuery = {
  category: string;
  material: string;
  query: string;
  sort: string;
};

export type DemoNewsListingQuery = {
  category: string;
};

export type DemoSearchQuery = {
  query: string;
  scope: string;
};

function toDemoMedia(
  media: DemoMediaSource,
  dictionary: PublicDictionary,
): PublicPageMedia {
  return {
    id: media.assetKey,
    src: null,
    alt: media.alt,
    width: media.width,
    height: media.height,
    caption: dictionary.common.demoLabel,
  };
}

function productHref(locale: Locale, product: PublicProduct): string {
  return localePath(locale, `/products/${product.slug}`);
}

function collectionHref(locale: Locale, collection: PublicCollection): string {
  return localePath(locale, `/collections/${collection.slug}`);
}

function newsHref(locale: Locale, article: PublicNewsArticle): string {
  return localePath(locale, `/news/${article.slug}`);
}

function uniqueOptions(
  entries: readonly ProductFilterOptionView[],
): ProductFilterOptionView[] {
  return Array.from(
    new Map(entries.map((entry) => [entry.value, entry])).values(),
  );
}

function mapProductCard(
  locale: Locale,
  dictionary: PublicDictionary,
  product: PublicProduct,
): ProductCardView {
  const primaryImage = product.images.find((image) => image.isPrimary);
  const image = primaryImage ?? product.images[0];

  if (!image) {
    throw new Error(`DEMO product ${product.id} is missing its media record.`);
  }

  return {
    id: product.id,
    href: productHref(locale, product),
    name: product.name,
    excerpt: product.summary,
    categoryLabel: product.categoryLabel,
    materialLabel:
      product.materialLabels.length > 0
        ? product.materialLabels.join(", ")
        : null,
    media: toDemoMedia(image, dictionary),
    badges: product.tags,
    statusLabel: dictionary.common.demoLabel,
  };
}

function mapCollectionCard(
  locale: Locale,
  dictionary: PublicDictionary,
  collection: PublicCollection,
): CollectionCardView {
  return {
    id: collection.id,
    href: collectionHref(locale, collection),
    title: collection.title,
    excerpt: collection.summary,
    cover: toDemoMedia(collection.cover, dictionary),
    yearLabel: collection.editionLabel,
    localeLabel: null,
    pageCountLabel: null,
    statusLabel: dictionary.common.demoLabel,
  };
}

function formatPublishedDate(
  locale: Locale,
  dictionary: PublicDictionary,
  value: string | null,
): { dateTime: string; label: string } {
  if (!value) {
    return { dateTime: "", label: dictionary.common.demoLabel };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { dateTime: "", label: dictionary.common.demoLabel };
  }

  return {
    dateTime: value,
    label: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date),
  };
}

function mapNewsCard(
  locale: Locale,
  dictionary: PublicDictionary,
  article: PublicNewsArticle,
): NewsCardView {
  const published = formatPublishedDate(
    locale,
    dictionary,
    article.publishedAt,
  );

  return {
    id: article.id,
    href: newsHref(locale, article),
    title: article.title,
    excerpt: article.excerpt,
    categoryLabel: article.categoryLabel,
    authorName: article.author,
    publishedAt: published.dateTime,
    publishedLabel: published.label,
    media: toDemoMedia(article.image, dictionary),
  };
}

function withQuery(
  path: string,
  values: Readonly<Record<string, string>>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) search.set(key, value);
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function normalized(value: string, locale: Locale): string {
  return value.trim().toLocaleLowerCase(locale);
}

function includesQuery(
  values: readonly string[],
  query: string,
  locale: Locale,
): boolean {
  if (!query) return true;
  return normalized(values.join(" "), locale).includes(query);
}

function formatDimensions(dimensions: PublicProductDimensions | null): string | null {
  if (!dimensions) return null;
  return `${dimensions.width} × ${dimensions.height} × ${dimensions.depth} ${dimensions.unit}`;
}

export async function getDemoAboutHistoryPageData(
  locale: Locale,
  dictionary: PublicDictionary,
): Promise<AboutHistoryPageData> {
  const content = await demoContentRepository.getSnapshot(locale);

  return {
    archiveNote: content.company.contentNotice,
    closingLink: {
      href: `${localePath(locale, "/contact")}#request-quote`,
      label: dictionary.common.requestQuote,
    },
    closingText: dictionary.home.contactBody,
    closingTitle: dictionary.home.contactTitle,
    heroEyebrow: content.company.eyebrow,
    heroMedia: toDemoMedia(content.company.heroImage, dictionary),
    highlights: [],
    historyDescription: dictionary.pages.aboutIntro,
    historyEyebrow: content.company.eyebrow,
    historyTitle: dictionary.home.historyTitle,
    milestones: content.history.map((milestone) => ({
      id: milestone.id,
      periodLabel: milestone.periodLabel,
      title: milestone.title,
      description: milestone.summary,
      media: toDemoMedia(milestone.image, dictionary),
    })),
    overviewParagraphs: [content.company.summary],
    principles: [],
    principlesDescription: dictionary.home.craftBody,
    principlesEyebrow: dictionary.home.eyebrow,
    principlesTitle: dictionary.home.craftTitle,
  };
}

export async function getDemoProductListingPageData(
  locale: Locale,
  dictionary: PublicDictionary,
  options: DemoProductListingQuery,
): Promise<ProductListingPageData> {
  const [content, allProducts] = await Promise.all([
    demoContentRepository.getSnapshot(locale),
    demoProductRepository.list(locale),
  ]);
  const query = normalized(options.query, locale);
  const filteredProducts = allProducts.filter((product) => {
    if (options.category && product.categorySlug !== options.category) {
      return false;
    }
    if (
      options.material &&
      !product.materialLabels.includes(options.material)
    ) {
      return false;
    }
    return includesQuery(
      [
        product.name,
        product.summary,
        product.categoryLabel,
        ...product.materialLabels,
        ...product.tags,
      ],
      query,
      locale,
    );
  });
  const categoryOptions = uniqueOptions(
    allProducts.map((product) => ({
      value: product.categorySlug,
      label: product.categoryLabel,
    })),
  );
  const materialOptions = uniqueOptions(
    allProducts.flatMap((product) =>
      product.materialLabels.map((material) => ({
        value: material,
        label: material,
      })),
    ),
  );
  const hasFilters = Boolean(
    options.query || options.category || options.material,
  );

  return {
    applyFiltersLabel: dictionary.product.filters,
    clearFiltersLink: hasFilters
      ? {
          href: localePath(locale, "/products"),
          label: dictionary.common.viewAll,
        }
      : null,
    emptyDescription: dictionary.pages.productsIntro,
    emptyTitle: dictionary.pages.productsTitle,
    filterAction: localePath(locale, "/products"),
    filterGroups: [
      {
        id: "category",
        name: "category",
        label: dictionary.product.category,
        currentValue: options.category,
        options: [
          { value: "", label: dictionary.common.viewAll },
          ...categoryOptions,
        ],
      },
      {
        id: "material",
        name: "material",
        label: dictionary.product.material,
        currentValue: options.material,
        options: [
          { value: "", label: dictionary.common.viewAll },
          ...materialOptions,
        ],
      },
    ],
    heroEyebrow: content.company.eyebrow,
    heroMedia: toDemoMedia(content.company.heroImage, dictionary),
    pagination: null,
    products: filteredProducts.map((product) =>
      mapProductCard(locale, dictionary, product),
    ),
    query: options.query,
    resultSummary: `${filteredProducts.length} · ${dictionary.pages.productsTitle}`,
    searchPlaceholder: dictionary.common.search,
    sortCurrentValue: "default",
    sortName: "sort",
    sortOptions: [{ value: "default", label: dictionary.product.sort }],
  };
}

export async function getDemoProductDetailPageData(
  locale: Locale,
  dictionary: PublicDictionary,
  slug: string,
): Promise<ProductDetailPageData | null> {
  const [product, allProducts] = await Promise.all([
    demoProductRepository.getBySlug(locale, slug),
    demoProductRepository.list(locale),
  ]);
  if (!product) return null;

  const dimensions = formatDimensions(product.dimensions);
  const specifications: ProductSpecificationView[] = [
    {
      id: "category",
      label: dictionary.product.category,
      value: product.categoryLabel,
    },
    ...product.materialLabels.map((material, index) => ({
      id: `material-${index}`,
      label: dictionary.product.material,
      value: material,
    })),
    {
      id: "finish",
      label: dictionary.product.finish,
      value: product.finishLabel,
    },
  ];
  if (dimensions) {
    specifications.push({
      id: "dimensions",
      label: dictionary.product.dimensions,
      value: dimensions,
    });
  }
  if (product.leadTime) {
    specifications.push({
      id: "lead-time",
      label: dictionary.product.leadTime,
      value: product.leadTime,
    });
  }

  return {
    backLink: {
      href: localePath(locale, "/products"),
      label: dictionary.pages.productsTitle,
    },
    badges: product.tags,
    categoryLabel: product.categoryLabel,
    dimensions,
    finish: product.finishLabel,
    gallery: product.images.map((image) => toDemoMedia(image, dictionary)),
    galleryLabel: product.name,
    intro: product.summary,
    leadTime: product.leadTime,
    madeToOrder: false,
    material:
      product.materialLabels.length > 0
        ? product.materialLabels.join(", ")
        : null,
    name: product.name,
    primaryActions: [
      {
        href: `${localePath(locale, "/contact")}#request-quote`,
        label: dictionary.common.requestQuote,
      },
    ],
    relatedProducts: allProducts
      .filter((candidate) => candidate.id !== product.id)
      .slice(0, 3)
      .map((candidate) => mapProductCard(locale, dictionary, candidate)),
    specifications,
    storyParagraphs: [product.story],
  };
}

export async function getDemoCollectionListingPageData(
  locale: Locale,
  dictionary: PublicDictionary,
): Promise<CollectionListingPageData> {
  const [content, collections] = await Promise.all([
    demoContentRepository.getSnapshot(locale),
    demoCollectionRepository.list(locale),
  ]);

  return {
    collections: collections.map((collection) =>
      mapCollectionCard(locale, dictionary, collection),
    ),
    emptyDescription: dictionary.pages.collectionsIntro,
    emptyTitle: dictionary.pages.collectionsTitle,
    heroEyebrow: content.company.eyebrow,
    heroMedia: toDemoMedia(content.company.heroImage, dictionary),
    pagination: null,
    resultSummary: `${collections.length} · ${dictionary.pages.collectionsTitle}`,
    yearLinks: [],
    yearNavigationLabel: dictionary.pages.collectionsTitle,
  };
}

export async function getDemoCollectionLandingPageData(
  locale: Locale,
  dictionary: PublicDictionary,
  slug: string,
): Promise<CollectionLandingPageData | null> {
  const [collection, allProducts] = await Promise.all([
    demoCollectionRepository.getBySlug(locale, slug),
    demoProductRepository.list(locale),
  ]);
  if (!collection) return null;

  const cover = toDemoMedia(collection.cover, dictionary);
  const products: CollectionProductLinkView[] = allProducts
    .filter((product) => collection.productIds.includes(product.id))
    .map((product) => {
      const image =
        product.images.find((candidate) => candidate.isPrimary) ??
        product.images[0];
      if (!image) {
        throw new Error(`DEMO product ${product.id} is missing its media record.`);
      }
      return {
        id: product.id,
        href: productHref(locale, product),
        title: product.name,
        meta: product.categoryLabel,
        media: toDemoMedia(image, dictionary),
      };
    });

  return {
    backLink: {
      href: localePath(locale, "/collections"),
      label: dictionary.pages.collectionsTitle,
    },
    chapters: [],
    chaptersLabel: dictionary.collection.openBook,
    cover,
    downloadLink: null,
    facts: [],
    fallbackDescription: collection.summary,
    fallbackPages: [cover],
    fallbackTitle: dictionary.collection.openBook,
    flipbookDescription: collection.summary,
    flipbookLink: null,
    flipbookUnavailableLabel: dictionary.collection.downloadDisabled,
    heroEyebrow: collection.editionLabel,
    intro: collection.summary,
    products,
    productsDescription: collection.summary,
    title: collection.title,
  };
}

export async function getDemoLacquerProcessPageData(
  locale: Locale,
  dictionary: PublicDictionary,
): Promise<LacquerProcessPageData> {
  const content = await demoContentRepository.getSnapshot(locale);

  return {
    closingDescription: dictionary.home.contactBody,
    closingEyebrow: content.company.eyebrow,
    closingLink: {
      href: `${localePath(locale, "/contact")}#request-quote`,
      label: dictionary.common.requestQuote,
    },
    closingTitle: dictionary.home.contactTitle,
    heroEyebrow: content.company.eyebrow,
    heroMedia: toDemoMedia(content.company.heroImage, dictionary),
    overviewDescription: dictionary.home.craftBody,
    overviewEyebrow: dictionary.home.eyebrow,
    overviewMedia: toDemoMedia(content.company.heroImage, dictionary),
    overviewParagraphs: [content.company.summary],
    overviewTitle: dictionary.home.craftTitle,
    steps: content.process.map((stage) => ({
      id: stage.id,
      numberLabel: stage.stepLabel,
      title: stage.title,
      summary: stage.summary,
      detailParagraphs: [],
      media: toDemoMedia(stage.image, dictionary),
      meta: [dictionary.common.demoLabel],
    })),
    stepsLabel: dictionary.pages.processTitle,
  };
}

export async function getDemoNewsListingPageData(
  locale: Locale,
  dictionary: PublicDictionary,
  options: DemoNewsListingQuery,
): Promise<NewsListingPageData> {
  const [content, allArticles, articles] = await Promise.all([
    demoContentRepository.getSnapshot(locale),
    demoNewsRepository.list(locale),
    demoNewsRepository.list(
      locale,
      options.category ? { categorySlug: options.category } : undefined,
    ),
  ]);
  const featuredArticle = articles.find((article) => article.featured) ?? null;
  const categories = Array.from(
    new Map(
      allArticles.map((article) => [
        article.categorySlug,
        article.categoryLabel,
      ]),
    ),
  );
  const path = localePath(locale, "/news");

  return {
    categoryLinks: [
      { href: path, label: dictionary.common.viewAll },
      ...categories.map(([value, label]) => ({
        href: withQuery(path, { category: value }),
        label,
      })),
    ],
    categoryNavigationLabel: dictionary.pages.newsTitle,
    emptyDescription: dictionary.pages.newsIntro,
    emptyTitle: dictionary.pages.newsTitle,
    featured: featuredArticle
      ? mapNewsCard(locale, dictionary, featuredArticle)
      : null,
    featuredLabel: dictionary.common.demoLabel,
    heroEyebrow: content.company.eyebrow,
    heroMedia: toDemoMedia(content.company.heroImage, dictionary),
    items: articles
      .filter((article) => article.id !== featuredArticle?.id)
      .map((article) => mapNewsCard(locale, dictionary, article)),
    pagination: null,
    resultSummary: `${articles.length} · ${dictionary.pages.newsTitle}`,
  };
}

export async function getDemoNewsArticlePageData(
  locale: Locale,
  dictionary: PublicDictionary,
  slug: string,
): Promise<NewsArticlePageData | null> {
  const [article, allArticles] = await Promise.all([
    demoNewsRepository.getBySlug(locale, slug),
    demoNewsRepository.list(locale),
  ]);
  if (!article) return null;

  const published = formatPublishedDate(
    locale,
    dictionary,
    article.publishedAt,
  );

  return {
    authorName: article.author,
    backLink: {
      href: localePath(locale, "/news"),
      label: dictionary.pages.newsTitle,
    },
    blocks: article.content.map((block, index) => ({
      id: `${article.id}-block-${index + 1}`,
      type: "paragraph" as const,
      text: block.text,
    })),
    categoryLabel: article.categoryLabel,
    excerpt: article.excerpt,
    heroMedia: toDemoMedia(article.image, dictionary),
    publishedAt: published.dateTime,
    publishedLabel: published.label,
    relatedItems: allArticles
      .filter((candidate) => candidate.id !== article.id)
      .slice(0, 3)
      .map((candidate) => mapNewsCard(locale, dictionary, candidate)),
    title: article.title,
    tocItems: [],
    tocLabel: dictionary.pages.newsTitle,
  };
}

export async function getDemoContactRequestQuotePageData(
  locale: Locale,
  dictionary: PublicDictionary,
): Promise<ContactRequestQuotePageData> {
  const [content, products] = await Promise.all([
    demoContentRepository.getSnapshot(locale),
    demoProductRepository.list(locale),
  ]);
  const contact = content.settings.contact;
  const contactPoints = [
    ...(contact.email
      ? [
          {
            id: "email",
            label: dictionary.contact.email,
            value: contact.email,
            href: `mailto:${contact.email}`,
            note: contact.notice,
          },
        ]
      : []),
    ...(contact.phone
      ? [
          {
            id: "phone",
            label: dictionary.contact.phone,
            value: contact.phone,
            href: `tel:${contact.phone}`,
            note: contact.notice,
          },
        ]
      : []),
    ...(contact.address
      ? [
          {
            id: "address",
            label: dictionary.nav.contact,
            value: contact.address,
            href: null,
            note: contact.notice,
          },
        ]
      : []),
  ];

  return {
    acceptedAttachmentTypes: "",
    attachmentHelp: dictionary.contact.demoNotice,
    consentDescription: dictionary.contact.demoNotice,
    consentLink: {
      href: localePath(locale, "/privacy"),
      label: dictionary.footer.privacy,
    },
    contactDescription: contact.notice,
    contactEyebrow: content.company.eyebrow,
    contactPoints,
    contactTitle: dictionary.pages.contactTitle,
    countryOptions: [],
    deadlineHelp: dictionary.contact.demoNotice,
    formDescription: dictionary.contact.demoNotice,
    formEyebrow: dictionary.common.requestQuote,
    formTitle: dictionary.pages.contactTitle,
    heroEyebrow: content.company.eyebrow,
    heroMedia: toDemoMedia(content.company.heroImage, dictionary),
    interestOptions: products.map((product) => ({
      value: product.id,
      label: product.name,
    })),
    quantityPlaceholder: dictionary.contact.quantity,
    submissionUnavailableDescription: contact.notice,
    submissionUnavailableTitle: dictionary.contact.demoNotice,
  };
}

export async function getDemoSearchPageData(
  locale: Locale,
  dictionary: PublicDictionary,
  options: DemoSearchQuery,
): Promise<SearchPageData> {
  const [products, collections, articles] = await Promise.all([
    demoProductRepository.list(locale),
    demoCollectionRepository.list(locale),
    demoNewsRepository.list(locale),
  ]);
  const query = normalized(options.query, locale);
  const allowedScopes = new Set(["products", "collections", "news"]);
  const scope = allowedScopes.has(options.scope) ? options.scope : "";
  const results: SearchResultView[] = [];

  if (query && (!scope || scope === "products")) {
    results.push(
      ...products
        .filter((product) =>
          includesQuery(
            [
              product.name,
              product.summary,
              product.categoryLabel,
              ...product.materialLabels,
              ...product.tags,
            ],
            query,
            locale,
          ),
        )
        .map((product) => ({
          id: product.id,
          href: productHref(locale, product),
          title: product.name,
          excerpt: product.summary,
          typeLabel: dictionary.nav.products,
          meta: [product.categoryLabel, ...product.tags],
        })),
    );
  }

  if (query && (!scope || scope === "collections")) {
    results.push(
      ...collections
        .filter((collection) =>
          includesQuery(
            [collection.title, collection.summary, collection.editionLabel],
            query,
            locale,
          ),
        )
        .map((collection) => ({
          id: collection.id,
          href: collectionHref(locale, collection),
          title: collection.title,
          excerpt: collection.summary,
          typeLabel: dictionary.nav.collections,
          meta: [collection.editionLabel],
        })),
    );
  }

  if (query && (!scope || scope === "news")) {
    results.push(
      ...articles
        .filter((article) =>
          includesQuery(
            [
              article.title,
              article.excerpt,
              article.categoryLabel,
              ...article.tags,
            ],
            query,
            locale,
          ),
        )
        .map((article) => ({
          id: article.id,
          href: newsHref(locale, article),
          title: article.title,
          excerpt: article.excerpt,
          typeLabel: dictionary.nav.news,
          meta: [article.categoryLabel, ...article.tags],
        })),
    );
  }

  const path = localePath(locale, "/search");
  const scopeLinks = [
    { value: "", label: dictionary.common.viewAll },
    { value: "products", label: dictionary.nav.products },
    { value: "collections", label: dictionary.nav.collections },
    { value: "news", label: dictionary.nav.news },
  ].map((item) => ({
    href: withQuery(path, { q: options.query, scope: item.value }),
    label: item.label,
  }));

  return {
    action: path,
    emptyDescription: dictionary.meta.siteDescription,
    emptyTitle: dictionary.pages.searchTitle,
    heroEyebrow: dictionary.common.demoLabel,
    intro: dictionary.meta.siteDescription,
    pagination: null,
    placeholder: dictionary.common.search,
    query: options.query,
    resultSummary: `${results.length} · ${dictionary.pages.searchTitle}`,
    results,
    scopeLabel: dictionary.pages.searchTitle,
    scopeLinks,
    suggestions: [
      {
        href: localePath(locale, "/products"),
        label: dictionary.nav.products,
      },
      {
        href: localePath(locale, "/collections"),
        label: dictionary.nav.collections,
      },
      { href: localePath(locale, "/news"), label: dictionary.nav.news },
    ],
    suggestionsLabel: dictionary.common.explore,
  };
}

export function getDemoLegalDocumentPageData(
  dictionary: PublicDictionary,
): LegalDocumentPageData {
  return {
    contactPanel: null,
    contentsLabel: dictionary.footer.legal,
    eyebrow: dictionary.common.demoLabel,
    intro: dictionary.common.replaceContentNotice,
    lastUpdatedLabel: dictionary.common.demoLabel,
    sections: [
      {
        id: "demo-content",
        title: dictionary.common.demoLabel,
        blocks: [
          {
            id: "demo-content-notice",
            type: "paragraph",
            text: dictionary.common.replaceContentNotice,
          },
        ],
      },
    ],
  };
}

export async function getDemoProductStaticParams() {
  const records = await Promise.all(
    locales.map(async (locale) => {
      const products = await demoProductRepository.list(locale);
      return products.map((product) => ({ locale, slug: product.slug }));
    }),
  );
  return records.flat();
}

export async function getDemoCollectionStaticParams() {
  const records = await Promise.all(
    locales.map(async (locale) => {
      const collections = await demoCollectionRepository.list(locale);
      return collections.map((collection) => ({
        locale,
        slug: collection.slug,
      }));
    }),
  );
  return records.flat();
}

export async function getDemoNewsStaticParams() {
  const records = await Promise.all(
    locales.map(async (locale) => {
      const articles = await demoNewsRepository.list(locale);
      return articles.map((article) => ({ locale, slug: article.slug }));
    }),
  );
  return records.flat();
}
