import "server-only";

import type { AboutHistoryPageData } from "@/components/public/pages/about-history";
import type {
  CollectionCardView,
  CollectionListingPageData,
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
import type {
  PublicContentBlock,
  PublicPageMedia,
} from "@/components/public/pages/shared";
import type {
  PublicCollection,
  PublicCollectionCover,
} from "@/domains/collections/public-contract";
import type { PublicImageAsset } from "@/domains/content/public-contract";
import type {
  PublicNewsArticle,
  PublicNewsImage,
} from "@/domains/news/public-contract";
import type {
  PublicProduct,
  PublicProductDimensions,
  PublicProductImage,
} from "@/domains/products/public-contract";
import { localePath, locales, type Locale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";
import {
  getPublicCollectionRepository,
  getPublicContentRepository,
  getPublicNewsRepository,
  getPublicProductRepository,
} from "@/lib/public/repositories";

const collectionRepository = getPublicCollectionRepository();
const contentRepository = getPublicContentRepository();
const newsRepository = getPublicNewsRepository();
const productRepository = getPublicProductRepository();

type DemoMediaSource =
  | PublicImageAsset
  | PublicProductImage
  | PublicCollectionCover
  | PublicNewsImage;

export type DemoProductListingQuery = {
  category: string;
  collection: string;
  finish: string;
  material: string;
  page: string;
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

/**
 * Maps a domain image record to the shape the page components render.
 *
 * No caption is emitted. While an asset is still a reserved slot the box itself
 * already states its size, and once a real photograph lands a caption belongs
 * to the photograph, not to this mapping.
 */
function toPageMedia(media: DemoMediaSource): PublicPageMedia {
  return {
    id: media.assetKey,
    src: media.src,
    alt: media.alt,
    width: media.width,
    height: media.height,
  };
}

function productHref(locale: Locale, product: PublicProduct): string {
  return localePath(locale, `/products/${product.slug}`);
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
    media: toPageMedia(image),
    badges: product.tags,
    statusLabel: null,
  };
}

function mapCollectionCard(
  locale: Locale,
  dictionary: PublicDictionary,
  collection: PublicCollection,
): CollectionCardView {
  const hasCatalogue =
    collection.flipbook.pageCount !== null && collection.flipbook.pageCount > 0;

  return {
    id: collection.id,
    // The catalogue reader is the collection's only page now; until a PDF is
    // attached the card announces the collection without linking anywhere.
    href: hasCatalogue
      ? localePath(locale, `/collections/${collection.slug}/catalogue`)
      : null,
    title: collection.title,
    excerpt: collection.summary,
    cover: toPageMedia(collection.cover),
    yearLabel: collection.editionLabel,
    localeLabel: null,
    pageCountLabel: hasCatalogue ? dictionary.collection.openBook : null,
    statusLabel: null,
  };
}

function formatPublishedDate(
  locale: Locale,
  dictionary: PublicDictionary,
  value: string | null,
): { dateTime: string; label: string } {
  if (!value) {
    return { dateTime: "", label: dictionary.common.updatingLabel };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { dateTime: "", label: dictionary.common.updatingLabel };
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
    media: toPageMedia(article.image),
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

function formatDimensions(
  dimensions: PublicProductDimensions | null,
): string | null {
  if (!dimensions) return null;
  return `${dimensions.width} × ${dimensions.height} × ${dimensions.depth} ${dimensions.unit}`;
}

const DEMO_PRODUCT_PAGE_SIZE = 3;
const DEMO_PRODUCT_SORT_VALUES = [
  "default",
  "featured",
  "name-asc",
  "name-desc",
] as const;

type DemoProductSort = (typeof DEMO_PRODUCT_SORT_VALUES)[number];

function productSort(value: string): DemoProductSort {
  return DEMO_PRODUCT_SORT_VALUES.includes(value as DemoProductSort)
    ? (value as DemoProductSort)
    : "default";
}

function selectedOption(
  value: string,
  options: readonly ProductFilterOptionView[],
): string {
  return options.some((option) => option.value === value) ? value : "";
}

function productPage(value: string, pageCount: number): number {
  if (!/^\d+$/.test(value)) return 1;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, Math.max(pageCount, 1));
}

export async function getDemoAboutHistoryPageData(
  locale: Locale,
  dictionary: PublicDictionary,
): Promise<AboutHistoryPageData> {
  const content = await contentRepository.getSnapshot(locale);

  return {
    contentIsDemo: content.isDemo,
    archiveNote: null,
    closingLink: {
      href: `${localePath(locale, "/contact")}#request-quote`,
      label: dictionary.common.requestQuote,
    },
    closingText: dictionary.home.contactBody,
    closingTitle: dictionary.home.contactTitle,
    heroEyebrow: content.company.eyebrow,
    heroMedia: {
      id: "about-hero",
      src: "/nen_about_us_rd.jpg",
      alt: content.company.eyebrow,
      width: 1600,
      height: 1000,
    },
    // Verifiable facts about the workshop: where it works, how the products
    // are tested, and where they ship.
    highlights: [
      {
        id: "village",
        label: dictionary.about.highlightVillageLabel,
        value: dictionary.about.highlightVillageValue,
      },
      {
        id: "compliance",
        label: dictionary.about.highlightComplianceLabel,
        value: dictionary.about.highlightComplianceValue,
      },
      {
        id: "markets",
        label: dictionary.about.highlightMarketsLabel,
        value: dictionary.about.highlightMarketsValue,
      },
    ],
    historyDescription: dictionary.pages.aboutIntro,
    historyEyebrow: content.company.eyebrow,
    historyTitle: dictionary.home.historyTitle,
    milestones: content.history.map((milestone) => ({
      id: milestone.id,
      periodLabel: milestone.periodLabel,
      title: milestone.title,
      description: milestone.summary,
      media: toPageMedia(milestone.image),
    })),
    overviewParagraphs: [content.company.summary],
    principles: [
      {
        id: "craft",
        kicker: dictionary.about.pillarKicker,
        title: dictionary.about.pillarCraftTitle,
        description: dictionary.about.pillarCraftDescription,
        media: null,
      },
      {
        id: "material",
        kicker: dictionary.about.pillarKicker,
        title: dictionary.about.pillarMaterialTitle,
        description: dictionary.about.pillarMaterialDescription,
        media: null,
      },
      {
        id: "standard",
        kicker: dictionary.about.pillarKicker,
        title: dictionary.about.pillarStandardTitle,
        description: dictionary.about.pillarStandardDescription,
        media: null,
      },
    ],
    principlesDescription: dictionary.about.pillarsDescription,
    principlesEyebrow: dictionary.home.eyebrow,
    principlesTitle: dictionary.home.craftTitle,
  };
}

export async function getDemoProductListingPageData(
  locale: Locale,
  dictionary: PublicDictionary,
  options: DemoProductListingQuery,
): Promise<ProductListingPageData> {
  const [content, allProducts, collections] = await Promise.all([
    contentRepository.getSnapshot(locale),
    productRepository.list(locale),
    collectionRepository.list(locale),
  ]);
  const query = normalized(options.query, locale);
  const collectionTitles = new Map(
    collections.map((collection) => [collection.id, collection.title]),
  );
  const categoryOptions = uniqueOptions(
    allProducts.map((product) => ({
      value: product.categorySlug,
      label: product.categoryLabel,
    })),
  );
  const collectionOptions = collections
    .filter((collection) =>
      allProducts.some((product) =>
        product.collectionIds.includes(collection.id),
      ),
    )
    .map((collection) => ({
      value: collection.id,
      label: collection.title,
    }));
  const materialOptions = uniqueOptions(
    allProducts.flatMap((product) =>
      product.materialLabels.map((material) => ({
        value: material,
        label: material,
      })),
    ),
  );
  const finishOptions = uniqueOptions(
    allProducts.map((product) => ({
      value: product.finishLabel,
      label: product.finishLabel,
    })),
  );
  const category = selectedOption(options.category, categoryOptions);
  const collection = selectedOption(options.collection, collectionOptions);
  const material = selectedOption(options.material, materialOptions);
  const finish = selectedOption(options.finish, finishOptions);
  const sort = productSort(options.sort);
  const filteredProducts = allProducts.filter((product) => {
    if (category && product.categorySlug !== category) {
      return false;
    }
    if (collection && !product.collectionIds.includes(collection)) {
      return false;
    }
    if (material && !product.materialLabels.includes(material)) {
      return false;
    }
    if (finish && product.finishLabel !== finish) {
      return false;
    }
    return includesQuery(
      [
        product.name,
        product.summary,
        product.categoryLabel,
        ...product.materialLabels,
        product.finishLabel,
        ...product.collectionIds.map(
          (collectionId) => collectionTitles.get(collectionId) ?? "",
        ),
        ...product.tags,
      ],
      query,
      locale,
    );
  });
  const collator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: "base",
  });
  const sortedProducts = [...filteredProducts].sort((left, right) => {
    if (sort === "featured") {
      return (
        Number(right.featured) - Number(left.featured) ||
        left.sortOrder - right.sortOrder
      );
    }
    if (sort === "name-asc") {
      return collator.compare(left.name, right.name);
    }
    if (sort === "name-desc") {
      return collator.compare(right.name, left.name);
    }
    return left.sortOrder - right.sortOrder;
  });
  const pageCount = Math.max(
    1,
    Math.ceil(sortedProducts.length / DEMO_PRODUCT_PAGE_SIZE),
  );
  const currentPage = productPage(options.page, pageCount);
  const pageStart = (currentPage - 1) * DEMO_PRODUCT_PAGE_SIZE;
  const pageProducts = sortedProducts.slice(
    pageStart,
    pageStart + DEMO_PRODUCT_PAGE_SIZE,
  );
  const hasFilters = Boolean(
    query || category || collection || material || finish || sort !== "default",
  );
  const productsPath = localePath(locale, "/products");
  const pageHref = (page: number) =>
    withQuery(productsPath, {
      q: options.query.trim(),
      category,
      collection,
      material,
      finish,
      sort: sort === "default" ? "" : sort,
      page: page > 1 ? String(page) : "",
    });
  const firstResult = sortedProducts.length > 0 ? pageStart + 1 : 0;
  const lastResult = Math.min(
    pageStart + pageProducts.length,
    sortedProducts.length,
  );

  return {
    contentIsDemo: sortedProducts.some((entry) => entry.isDemo),
    applyFiltersLabel: dictionary.product.filters,
    clearFiltersLink: hasFilters
      ? {
          href: productsPath,
          label: dictionary.common.viewAll,
        }
      : null,
    emptyDescription: dictionary.pages.productsIntro,
    emptyTitle: dictionary.pages.productsTitle,
    filterAction: productsPath,
    filterGroups: [
      {
        id: "category",
        name: "category",
        label: dictionary.product.category,
        currentValue: category,
        options: [
          { value: "", label: dictionary.common.viewAll },
          ...categoryOptions,
        ],
      },
      {
        id: "collection",
        name: "collection",
        label: dictionary.product.collection,
        currentValue: collection,
        options: [
          { value: "", label: dictionary.common.viewAll },
          ...collectionOptions,
        ],
      },
      {
        id: "material",
        name: "material",
        label: dictionary.product.material,
        currentValue: material,
        options: [
          { value: "", label: dictionary.common.viewAll },
          ...materialOptions,
        ],
      },
      {
        id: "finish",
        name: "finish",
        label: dictionary.product.finish,
        currentValue: finish,
        options: [
          { value: "", label: dictionary.common.viewAll },
          ...finishOptions,
        ],
      },
    ],
    heroEyebrow: content.company.eyebrow,
    heroMedia: toPageMedia(content.company.heroImage),
    pagination:
      pageCount > 1
        ? {
            currentLabel: `${dictionary.product.page} ${currentPage} / ${pageCount}`,
            previous:
              currentPage > 1
                ? {
                    href: pageHref(currentPage - 1),
                    label: dictionary.common.previous,
                  }
                : null,
            next:
              currentPage < pageCount
                ? {
                    href: pageHref(currentPage + 1),
                    label: dictionary.common.next,
                  }
                : null,
          }
        : null,
    products: pageProducts.map((product) =>
      mapProductCard(locale, dictionary, product),
    ),
    query: options.query,
    resultSummary: `${firstResult}–${lastResult} / ${sortedProducts.length} · ${dictionary.pages.productsTitle}`,
    searchPlaceholder: dictionary.common.search,
    sortCurrentValue: sort,
    sortName: "sort",
    sortOptions: [
      { value: "default", label: dictionary.product.sortDefault },
      { value: "featured", label: dictionary.product.sortFeatured },
      { value: "name-asc", label: dictionary.product.sortNameAscending },
      { value: "name-desc", label: dictionary.product.sortNameDescending },
    ],
  };
}

export async function getDemoProductDetailPageData(
  locale: Locale,
  dictionary: PublicDictionary,
  slug: string,
): Promise<ProductDetailPageData | null> {
  const [product, allProducts] = await Promise.all([
    productRepository.getBySlug(locale, slug),
    productRepository.list(locale),
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
  // Care instructions entered in the CMS surface with the other facts; a
  // dedicated section can take over if the detail page grows one.
  product.careNotes.forEach((note, index) => {
    specifications.push({
      id: `care-${index + 1}`,
      label: dictionary.product.care,
      value: note,
    });
  });

  return {
    contentIsDemo: product.isDemo,
    backLink: {
      href: localePath(locale, "/products"),
      label: dictionary.pages.productsTitle,
    },
    badges: product.tags,
    categoryLabel: product.categoryLabel,
    dimensions,
    finish: product.finishLabel,
    gallery: product.images.map((image) => toPageMedia(image)),
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
    processSteps: product.processSteps.map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
    })),
    relatedProducts: allProducts
      .filter((candidate) => candidate.id !== product.id)
      .slice(0, 3)
      .map((candidate) => mapProductCard(locale, dictionary, candidate)),
    specifications,
    // The domain already stores the story as separate paragraphs; collapsing
    // them into one block ran the whole description together on the page.
    storyParagraphs: product.storyParagraphs,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      description: variant.description,
    })),
    video: product.video
      ? {
          captionsLanguage: product.video.captionsLanguage,
          captionsSrc: product.video.captionsSrc,
          mimeType: product.video.mimeType,
          poster: product.video.poster
            ? toPageMedia(product.video.poster)
            : null,
          src: product.video.src,
          title: product.video.title,
        }
      : null,
  };
}

export async function getDemoCollectionListingPageData(
  locale: Locale,
  dictionary: PublicDictionary,
): Promise<CollectionListingPageData> {
  const [content, collections] = await Promise.all([
    contentRepository.getSnapshot(locale),
    collectionRepository.list(locale),
  ]);

  return {
    contentIsDemo: collections.some((entry) => entry.isDemo),
    collections: collections.map((collection) =>
      mapCollectionCard(locale, dictionary, collection),
    ),
    emptyDescription: dictionary.pages.collectionsIntro,
    emptyTitle: dictionary.pages.collectionsTitle,
    heroEyebrow: content.company.eyebrow,
    heroMedia: toPageMedia(content.company.heroImage),
    pagination: null,
    resultSummary: `${collections.length} · ${dictionary.pages.collectionsTitle}`,
    yearLinks: [],
    yearNavigationLabel: dictionary.pages.collectionsTitle,
  };
}

export async function getDemoLacquerProcessPageData(
  locale: Locale,
  dictionary: PublicDictionary,
): Promise<LacquerProcessPageData> {
  const content = await contentRepository.getSnapshot(locale);

  return {
    contentIsDemo: content.isDemo,
    closingDescription: dictionary.home.contactBody,
    closingEyebrow: content.company.eyebrow,
    closingLink: {
      href: `${localePath(locale, "/contact")}#request-quote`,
      label: dictionary.common.requestQuote,
    },
    closingTitle: dictionary.home.contactTitle,
    heroEyebrow: content.company.eyebrow,
    heroMedia: toPageMedia(content.company.heroImage),
    overviewDescription: dictionary.home.craftBody,
    overviewEyebrow: dictionary.home.eyebrow,
    overviewMedia: toPageMedia(content.company.heroImage),
    overviewParagraphs: [content.company.summary],
    overviewTitle: dictionary.home.craftTitle,
    steps: content.process.map((stage) => ({
      id: stage.id,
      numberLabel: stage.stepLabel,
      title: stage.title,
      summary: stage.summary,
      detailParagraphs: [],
      media: toPageMedia(stage.image),
      meta: [stage.stepLabel],
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
    contentRepository.getSnapshot(locale),
    newsRepository.list(locale),
    newsRepository.list(
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
    contentIsDemo: articles.some((entry) => entry.isDemo),
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
    featuredLabel: dictionary.common.featured,
    heroEyebrow: content.company.eyebrow,
    heroMedia: toPageMedia(content.company.heroImage),
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
    newsRepository.getBySlug(locale, slug),
    newsRepository.list(locale),
  ]);
  if (!article) return null;

  const published = formatPublishedDate(
    locale,
    dictionary,
    article.publishedAt,
  );

  return {
    contentIsDemo: article.isDemo,
    authorName: article.author,
    backLink: {
      href: localePath(locale, "/news"),
      label: dictionary.pages.newsTitle,
    },
    blocks: article.content.flatMap((block, index): PublicContentBlock[] => {
      const id = `${article.id}-block-${index + 1}`;
      switch (block.type) {
        case "paragraph":
          return [{ id, type: "paragraph", text: block.text }];
        case "heading":
          return [
            { id, type: "heading", level: block.level, text: block.text },
          ];
        case "quote":
          return [
            {
              id,
              type: "quote",
              text: block.text,
              attribution: block.attribution,
            },
          ];
        case "list":
          return [{ id, type: "list", style: block.style, items: block.items }];
        case "image":
          return [
            {
              id,
              type: "media",
              caption: block.caption,
              media: {
                id,
                src: block.src,
                alt: block.alt,
                width: block.width,
                height: block.height,
              },
            },
          ];
        case "divider":
          return [{ id, type: "divider" }];
        case "embed":
          return [
            {
              id,
              type: "embed",
              youtubeId: block.youtubeId,
              title: article.title,
              playLabel: dictionary.common.playVideo,
            },
          ];
        case "callToAction":
          return [
            { id, type: "callToAction", label: block.label, href: block.href },
          ];
        default:
          return [];
      }
    }),
    categoryLabel: article.categoryLabel,
    excerpt: article.excerpt,
    heroMedia: toPageMedia(article.image),
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
    contentRepository.getSnapshot(locale),
    productRepository.list(locale),
  ]);
  const contact = content.settings.contact;
  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  const collator = new Intl.Collator(locale);
  const countryOptions = ["VN", "CN", "JP", "FR", "DE"]
    .map((countryCode) => ({
      value: countryCode,
      label: regionNames.of(countryCode) ?? countryCode,
    }))
    .sort((left, right) => collator.compare(left.label, right.label));
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
    ...(contact.fax
      ? [
          {
            id: "fax",
            label: dictionary.contact.fax,
            value: contact.fax,
            // A fax number is not dialable from a browser, so no tel: link.
            href: null,
            note: contact.notice,
          },
        ]
      : []),
    ...(contact.address
      ? [
          {
            id: "address",
            label: dictionary.contact.officeAddress,
            value: contact.address,
            href: null,
            note: contact.notice,
          },
        ]
      : []),
    // The workshop and the warehouse are separate sites from the office, and
    // buyers arranging a visit or a pickup need the right one.
    ...(contact.factoryAddress
      ? [
          {
            id: "factory",
            label: dictionary.contact.factoryAddress,
            value: contact.factoryAddress,
            href: null,
            note: contact.notice,
          },
        ]
      : []),
    ...(contact.warehouseAddress
      ? [
          {
            id: "warehouse",
            label: dictionary.contact.warehouseAddress,
            value: contact.warehouseAddress,
            href: null,
            note: contact.notice,
          },
        ]
      : []),
  ];

  return {
    contentIsDemo: content.isDemo,
    acceptedAttachmentTypes: ".pdf,.jpg,.jpeg,.png,.webp",
    attachmentHelp: dictionary.contact.attachmentHelp,
    consentDescription: dictionary.contact.consentHelp,
    consentLink: {
      href: localePath(locale, "/privacy"),
      label: dictionary.footer.privacy,
    },
    // The hero already carries the page intro; the contact-points column
    // introduces the company itself instead of repeating it.
    contactDescription: content.company.summary,
    contactEyebrow: content.company.eyebrow,
    contactPoints,
    contactTitle: dictionary.pages.contactTitle,
    countryOptions: [
      ...countryOptions,
      { value: "OTHER", label: dictionary.contact.countryOther },
    ],
    deadlineHelp: dictionary.contact.deadlineHelp,
    formDescription: dictionary.home.contactBody,
    formEyebrow: dictionary.common.requestQuote,
    formTitle: dictionary.home.contactTitle,
    heroEyebrow: content.company.eyebrow,
    heroMedia: toPageMedia(content.company.heroImage),
    interestOptions: products.map((product) => ({
      value: product.id,
      label: product.name,
    })),
    map: {
      description: dictionary.contact.mapDescription,
      // `hl` follows the visitor's locale so the map's own labels match the
      // surrounding page rather than defaulting to the pasted URL's language.
      embedUrl: contact.mapEmbedUrl
        ? `${contact.mapEmbedUrl}&hl=${locale}`
        : null,
      placeUrl: contact.mapUrl,
      placeLinkLabel: dictionary.contact.openInMaps,
      loadLabel: dictionary.contact.loadMap,
      title: dictionary.contact.mapTitle,
      unavailableDescription: dictionary.contact.mapUnavailable,
    },
    quantityPlaceholder: dictionary.contact.quantity,
    submissionUnavailableDescription: dictionary.contact.formNotice,
    submissionUnavailableTitle: dictionary.contact.formNoticeTitle,
  };
}

export async function getDemoSearchPageData(
  locale: Locale,
  dictionary: PublicDictionary,
  options: DemoSearchQuery,
): Promise<SearchPageData> {
  const [products, collections, articles] = await Promise.all([
    productRepository.list(locale),
    collectionRepository.list(locale),
    newsRepository.list(locale),
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
          href:
            collection.flipbook.pageCount !== null &&
            collection.flipbook.pageCount > 0
              ? localePath(locale, `/collections/${collection.slug}/catalogue`)
              : localePath(locale, "/collections"),
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
    contentIsDemo: false,
    action: path,
    emptyDescription: dictionary.meta.siteDescription,
    emptyTitle: dictionary.pages.searchTitle,
    heroEyebrow: dictionary.pages.searchTitle,
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

export type LegalDocumentKind = "privacy" | "terms" | "accessibility";

export function getLegalDocumentPageData(
  locale: Locale,
  dictionary: PublicDictionary,
  kind: LegalDocumentKind,
): LegalDocumentPageData {
  const document = {
    privacy: {
      intro: dictionary.legal.privacyIntro,
      sections: dictionary.legal.privacySections,
    },
    terms: {
      intro: dictionary.legal.termsIntro,
      sections: dictionary.legal.termsSections,
    },
    accessibility: {
      intro: dictionary.legal.accessibilityIntro,
      sections: dictionary.legal.accessibilitySections,
    },
  }[kind];

  return {
    contactPanel: {
      title: dictionary.home.contactTitle,
      description: dictionary.home.contactBody,
      link: {
        href: `${localePath(locale, "/contact")}#request-quote`,
        label: dictionary.common.requestQuote,
      },
    },
    contentsLabel: dictionary.footer.legal,
    eyebrow: dictionary.footer.legal,
    intro: document.intro,
    lastUpdatedLabel: dictionary.legal.lastUpdated,
    sections: document.sections.map((section, index) => ({
      id: `${kind}-section-${index + 1}`,
      title: section.title,
      blocks: [
        {
          id: `${kind}-section-${index + 1}-body`,
          type: "paragraph",
          text: section.body,
        },
      ],
    })),
  };
}

export async function getDemoProductStaticParams() {
  const records = await Promise.all(
    locales.map(async (locale) => {
      const products = await productRepository.list(locale);
      return products.map((product) => ({ locale, slug: product.slug }));
    }),
  );
  return records.flat();
}

export async function getDemoNewsStaticParams() {
  const records = await Promise.all(
    locales.map(async (locale) => {
      const articles = await newsRepository.list(locale);
      return articles.map((article) => ({ locale, slug: article.slug }));
    }),
  );
  return records.flat();
}
