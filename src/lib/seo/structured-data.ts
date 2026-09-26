import "server-only";

import type { PublicCollection } from "@/domains/collections/public-contract";
import type { PublicContentSnapshot } from "@/domains/content/public-contract";
import type { PublicNewsArticle } from "@/domains/news/public-contract";
import type { PublicProduct } from "@/domains/products/public-contract";
import type { PublicShopItem } from "@/domains/shop/public-contract";
import type { Locale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildWebsiteJsonLd,
  type JsonLdDocument,
} from "@/lib/seo/json-ld";
import {
  articleRoutes,
  collectionRoutes,
  deliveredImages,
  productRoutes,
  shopItemRoutes,
} from "@/lib/seo/public-records";
import { absoluteMediaUrl, absoluteUrl, localizedUrl } from "@/lib/seo/urls";

/**
 * Structured data for the public pages: who the company is (home page), and
 * where each detail page sits (breadcrumbs), plus the article and shop offer
 * facts Google can show as rich results. Only facts the site already
 * publishes are used; nothing is invented to fill a schema field.
 */

/**
 * Other names the company is searched and cited by, in order of preference
 * (Google reads `alternateName` in listed order). They tie "Red Door
 * Vietnam", the signboard name, the English company form the site prints
 * in five locales ("RED DOOR Co., Ltd"), the one-word spelling people type
 * ("Reddoor") and the two domain names to one entity.
 */
const BRAND_ALIASES = [
  "Red Door Vietnam",
  "Red Door Việt Nam",
  "RED DOOR VIET NAM",
  "RED DOOR Co., Ltd",
  "Red Door Lacquerwares",
  "Reddoor Vietnam",
  "REDDOOR VIETNAM",
  "reddoor.vn",
  "lacquerwares.vn",
] as const;

/** Enough for the cover, its three crops and a couple of body photographs. */
const ARTICLE_IMAGE_LIMIT = 6;

/** The signboard logo; Google wants a crawlable image of at least 112 px. */
const BRAND_LOGO_PATH = "/logo_rd.jpg";

function organizationId(): string {
  return `${absoluteUrl("/")}#organization`;
}

export function brandLogoUrl(): string {
  return absoluteUrl(BRAND_LOGO_PATH);
}

/** Organization and WebSite: the home page's statement of identity. */
export function homeStructuredData(
  locale: Locale,
  dictionary: PublicDictionary,
  content: PublicContentSnapshot,
): JsonLdDocument[] {
  const siteRoot = absoluteUrl("/");
  const siteName = dictionary.meta.siteName;
  const contact = content.settings.contact;
  const aliases = [
    content.company.displayName,
    content.settings.siteName,
    ...BRAND_ALIASES,
  ];

  return [
    buildOrganizationJsonLd({
      id: organizationId(),
      name: siteName,
      alternateNames: aliases,
      url: siteRoot,
      description: dictionary.meta.siteDescription,
      legalName: content.company.legalName,
      logoUrl: brandLogoUrl(),
      email: contact.email,
      telephone: contact.phone,
      address: contact.address,
      addressCountry: "VN",
      sameAs: content.settings.socialLinks.flatMap((link) =>
        link.href ? [link.href] : [],
      ),
    }),
    buildWebsiteJsonLd({
      name: siteName,
      alternateNames: aliases,
      url: siteRoot,
      locale,
      description: dictionary.meta.siteDescription,
      publisherId: organizationId(),
    }),
  ];
}

function breadcrumbs(
  locale: Locale,
  dictionary: PublicDictionary,
  section: { name: string; path: string },
  leaf: { name: string; url: string },
): JsonLdDocument {
  return buildBreadcrumbJsonLd([
    { name: dictionary.nav.home, url: localizedUrl(locale) },
    { name: section.name, url: localizedUrl(locale, section.path) },
    leaf,
  ]);
}

/**
 * A section page (products, news, about, …) sits one level below home. The
 * two-item trail lets search results show the section's localized label
 * instead of the English URL segment; it carries no CMS content, so it is
 * emitted on every request.
 */
export function sectionStructuredData(
  locale: Locale,
  dictionary: PublicDictionary,
  section: { name: string; path: string },
): JsonLdDocument[] {
  return [
    buildBreadcrumbJsonLd([
      { name: dictionary.nav.home, url: localizedUrl(locale) },
      { name: section.name, url: localizedUrl(locale, section.path) },
    ]),
  ];
}

/**
 * Every photograph an article can be shown with: the cover first, then its
 * fixed-frame crops, then the photographs placed in the body. Reserved slots
 * are skipped, duplicates collapse, and the list is capped so a photo essay
 * does not dump its whole gallery into the schema.
 */
function articleImageUrls(article: PublicNewsArticle): string[] {
  const cover = deliveredImages([article.image]).map((image) => image.url);
  const variants = article.image.assetPending
    ? []
    : (article.image.variants ?? []);
  const inline = article.content.flatMap((block) =>
    block.type === "image" ? (absoluteMediaUrl(block.src) ?? []) : [],
  );
  return [...new Set([...cover, ...variants, ...inline])].slice(
    0,
    ARTICLE_IMAGE_LIMIT,
  );
}

export function productStructuredData(
  locale: Locale,
  dictionary: PublicDictionary,
  product: PublicProduct,
): JsonLdDocument[] {
  // Catalogue pieces are quoted, never priced, so there is no Offer; a
  // Product without one fails Google's product-snippet check, which is why
  // the page carries breadcrumbs only.
  const url = absoluteUrl(productRoutes(product).canonicalPath);
  return [
    breadcrumbs(
      locale,
      dictionary,
      { name: dictionary.nav.products, path: "/products" },
      { name: product.name, url },
    ),
  ];
}

export function articleStructuredData(
  locale: Locale,
  dictionary: PublicDictionary,
  article: PublicNewsArticle,
): JsonLdDocument[] {
  const url = absoluteUrl(articleRoutes(article).canonicalPath);
  const siteName = dictionary.meta.siteName;
  return [
    buildArticleJsonLd({
      headline: article.title,
      url,
      description: article.excerpt,
      imageUrls: articleImageUrls(article),
      datePublished: article.publishedAt,
      dateModified: article.updatedAt ?? article.publishedAt,
      // The newsroom signs as the company; no personal byline is confirmed,
      // so the company's home page is the author's identifier.
      authorName: article.author ?? siteName,
      authorType: "Organization",
      authorUrl: absoluteUrl("/"),
      publisherName: siteName,
      publisherLogoUrl: brandLogoUrl(),
      inLanguage: article.contentLocale,
    }),
    breadcrumbs(
      locale,
      dictionary,
      { name: dictionary.nav.news, path: "/news" },
      { name: article.title, url },
    ),
  ];
}

export function shopItemStructuredData(
  locale: Locale,
  dictionary: PublicDictionary,
  item: PublicShopItem,
): JsonLdDocument[] {
  const url = absoluteUrl(shopItemRoutes(item).canonicalPath);
  const siteName = dictionary.meta.siteName;
  return [
    buildProductJsonLd({
      name: item.name,
      url,
      description: item.summary,
      imageUrls: deliveredImages(item.images).map((image) => image.url),
      brandName: siteName,
      offer: {
        price: item.price.amount,
        priceCurrency: item.price.currency,
        inStock: item.inStock,
        url,
        sellerName: siteName,
      },
    }),
    breadcrumbs(
      locale,
      dictionary,
      { name: dictionary.nav.shop, path: "/shop" },
      { name: item.name, url },
    ),
  ];
}

/**
 * Home → Collections → the collection, ending at the landing page. The
 * flipbook reader emits the same trail: it is an alternate presentation of
 * the collection, not a further level below it.
 */
export function collectionStructuredData(
  locale: Locale,
  dictionary: PublicDictionary,
  collection: PublicCollection,
): JsonLdDocument[] {
  const url = absoluteUrl(collectionRoutes(collection).canonicalPath);
  return [
    breadcrumbs(
      locale,
      dictionary,
      { name: dictionary.nav.collections, path: "/collections" },
      { name: collection.title, url },
    ),
  ];
}
