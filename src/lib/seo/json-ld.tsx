import type { ReactElement } from "react";

type JsonLdValue =
  | boolean
  | number
  | string
  | null
  | readonly JsonLdValue[]
  | { readonly [key: string]: JsonLdValue | undefined };

export type JsonLdDocument = {
  readonly "@context": "https://schema.org";
  readonly "@type": string;
  readonly [key: string]: JsonLdValue | undefined;
};

type OrganizationJsonLdInput = {
  name: string;
  url: string;
  description?: string | null;
  legalName?: string | null;
  logoUrl?: string | null;
  sameAs?: readonly string[];
};

type WebsiteJsonLdInput = {
  name: string;
  url: string;
  locale: string;
  description?: string | null;
  searchUrlTemplate?: string | null;
};

export type BreadcrumbJsonLdItem = {
  name: string;
  url: string;
};

type ProductJsonLdInput = {
  name: string;
  url: string;
  description?: string | null;
  imageUrls?: readonly string[];
  sku?: string | null;
  materials?: readonly string[];
  brandName?: string | null;
};

type ArticleJsonLdInput = {
  headline: string;
  url: string;
  description?: string | null;
  imageUrls?: readonly string[];
  datePublished?: string | null;
  dateModified?: string | null;
  authorName?: string | null;
  publisherName?: string | null;
};

type VideoJsonLdInput = {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  contentUrl?: string | null;
  embedUrl?: string | null;
  duration?: string | null;
};

function present(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function presentValues(values: readonly string[] | undefined): string[] {
  return values?.filter(present) ?? [];
}

function optionalAbsoluteUrl(value: string | null | undefined): string | null {
  if (!present(value)) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function buildOrganizationJsonLd({
  name,
  url,
  description,
  legalName,
  logoUrl,
  sameAs,
}: OrganizationJsonLdInput): JsonLdDocument {
  const logo = optionalAbsoluteUrl(logoUrl);
  const socialProfiles = presentValues(sameAs)
    .map(optionalAbsoluteUrl)
    .filter(present);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    ...(present(description) ? { description } : {}),
    ...(present(legalName) ? { legalName } : {}),
    ...(logo ? { logo } : {}),
    ...(socialProfiles.length > 0 ? { sameAs: socialProfiles } : {}),
  };
}

export function buildWebsiteJsonLd({
  name,
  url,
  locale,
  description,
  searchUrlTemplate,
}: WebsiteJsonLdInput): JsonLdDocument {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    inLanguage: locale,
    ...(present(description) ? { description } : {}),
    ...(present(searchUrlTemplate)
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: searchUrlTemplate,
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };
}

export function buildBreadcrumbJsonLd(
  items: readonly BreadcrumbJsonLdItem[],
): JsonLdDocument {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildProductJsonLd({
  name,
  url,
  description,
  imageUrls,
  sku,
  materials,
  brandName,
}: ProductJsonLdInput): JsonLdDocument {
  const images = presentValues(imageUrls)
    .map(optionalAbsoluteUrl)
    .filter(present);
  const material = presentValues(materials);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    url,
    ...(present(description) ? { description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    ...(present(sku) ? { sku } : {}),
    ...(material.length > 0 ? { material } : {}),
    ...(present(brandName)
      ? { brand: { "@type": "Brand", name: brandName } }
      : {}),
  };
}

export function buildArticleJsonLd({
  headline,
  url,
  description,
  imageUrls,
  datePublished,
  dateModified,
  authorName,
  publisherName,
}: ArticleJsonLdInput): JsonLdDocument {
  const images = presentValues(imageUrls)
    .map(optionalAbsoluteUrl)
    .filter(present);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    mainEntityOfPage: url,
    ...(present(description) ? { description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    ...(present(datePublished) ? { datePublished } : {}),
    ...(present(dateModified) ? { dateModified } : {}),
    ...(present(authorName)
      ? { author: { "@type": "Person", name: authorName } }
      : {}),
    ...(present(publisherName)
      ? {
          publisher: { "@type": "Organization", name: publisherName },
        }
      : {}),
  };
}

export function buildVideoJsonLd({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  contentUrl,
  embedUrl,
  duration,
}: VideoJsonLdInput): JsonLdDocument {
  const thumbnail = optionalAbsoluteUrl(thumbnailUrl);
  const content = optionalAbsoluteUrl(contentUrl);
  const embed = optionalAbsoluteUrl(embedUrl);

  if (!thumbnail) {
    throw new TypeError("VideoObject requires an absolute thumbnail URL.");
  }

  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name,
    description,
    thumbnailUrl: thumbnail,
    uploadDate,
    ...(content ? { contentUrl: content } : {}),
    ...(embed ? { embedUrl: embed } : {}),
    ...(present(duration) ? { duration } : {}),
  };
}

export function serializeJsonLd(value: JsonLdDocument): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({
  data,
  enabled = true,
}: {
  data: JsonLdDocument;
  enabled?: boolean;
}): ReactElement | null {
  if (!enabled) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
