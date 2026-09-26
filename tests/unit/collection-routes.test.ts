import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionLandingPage } from "@/components/public/pages/collections";
import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import type { PublicCollection } from "@/domains/collections/public-contract";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import viDictionary from "@/lib/i18n/dictionaries/vi";
import { getCollectionLandingPageData } from "@/lib/public/demo-page-data";
import { catalogueRoutes, collectionRoutes } from "@/lib/seo/public-records";
import {
  getCollectionCatalogueMetadata,
  getCollectionLandingMetadata,
} from "@/lib/seo/route-metadata";
import { buildPublicSitemap } from "@/lib/seo/sitemap";
import { collectionStructuredData } from "@/lib/seo/structured-data";

type BreadcrumbItem = { position: number; name: string; item: string };

/** A collection translated into Vietnamese and English, read in English. */
const translated = {
  locale: "en",
  slug: "the-2026-collection",
  contentLocale: "en",
  translations: [
    { locale: "vi", slug: "bo-suu-tap-2026" },
    { locale: "en", slug: "the-2026-collection" },
  ],
} as const;

/** The same collection shown to a French reader, who gets the Vietnamese copy. */
const fallbackCopy = {
  locale: "fr",
  slug: "bo-suu-tap-2026",
  contentLocale: "vi",
  translations: [{ locale: "vi", slug: "bo-suu-tap-2026" }],
} as const;

async function demoCollection(): Promise<PublicCollection> {
  const collection = await demoCollectionRepository.getBySlug(
    "vi",
    "collection-2026",
  );
  if (!collection) throw new Error("Expected the DEMO 2026 collection.");
  return collection;
}

describe("collection routes", () => {
  it("makes the landing page the canonical address with one hreflang per translation", () => {
    const { routes, canonicalPath } = collectionRoutes(translated);

    expect(canonicalPath).toBe("/en/collections/the-2026-collection");
    expect(routes).toEqual([
      { locale: "vi", path: "/vi/collections/bo-suu-tap-2026" },
      { locale: "en", path: "/en/collections/the-2026-collection" },
    ]);
  });

  it("canonicalizes a fallback copy to the original and gives it no hreflang of its own", () => {
    const { routes, canonicalPath } = collectionRoutes(fallbackCopy);

    expect(canonicalPath).toBe("/vi/collections/bo-suu-tap-2026");
    expect(routes).toEqual([
      { locale: "vi", path: "/vi/collections/bo-suu-tap-2026" },
    ]);
    expect(routes.some((route) => route.locale === "fr")).toBe(false);
  });

  it("keeps the reader one segment below the landing page", () => {
    expect(catalogueRoutes(translated).canonicalPath).toBe(
      "/en/collections/the-2026-collection/catalogue",
    );
  });
});

describe("collection metadata", () => {
  it("gives the landing page and the reader the same canonical: the landing page", async () => {
    const [landing, catalogue] = await Promise.all([
      getCollectionLandingMetadata("vi", "collection-2026"),
      getCollectionCatalogueMetadata("vi", "collection-2026"),
    ]);

    expect(landing.alternates?.canonical).toBe(
      "http://localhost:3000/vi/collections/collection-2026",
    );
    expect(catalogue.alternates?.canonical).toBe(
      "http://localhost:3000/vi/collections/collection-2026",
    );
    expect(catalogue.alternates?.languages?.en).toBe(
      "http://localhost:3000/en/collections/collection-2026",
    );
    expect(landing.title).toBe("Bộ sưu tập 2026");
  });

  it("returns nothing for an unknown slug or locale", async () => {
    expect(await getCollectionLandingMetadata("vi", "khong-ton-tai")).toEqual(
      {},
    );
    expect(await getCollectionLandingMetadata("xx", "collection-2026")).toEqual(
      {},
    );
  });
});

describe("collection structured data", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emits one three-item trail ending at the landing page", async () => {
    const collection = await demoCollection();
    const documents = collectionStructuredData("vi", viDictionary, collection);

    expect(documents).toHaveLength(1);
    const [trail] = documents;
    expect(trail?.["@type"]).toBe("BreadcrumbList");

    const items = trail?.itemListElement as readonly BreadcrumbItem[];
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.name)).toEqual([
      viDictionary.nav.home,
      viDictionary.nav.collections,
      collection.title,
    ]);
    expect(items[1]?.item).toBe("https://example.test/vi/collections");
    expect(items[2]?.item).toBe(
      "https://example.test/vi/collections/collection-2026",
    );
    expect(items[2]?.item.endsWith("/catalogue")).toBe(false);
  });

  it("points a fallback copy's trail at the original landing page", async () => {
    const collection = await demoCollection();
    const shownInFrench: PublicCollection = {
      ...collection,
      locale: "fr",
      contentLocale: "vi",
      translations: [{ locale: "vi", slug: collection.slug }],
    };
    const [trail] = collectionStructuredData("fr", viDictionary, shownInFrench);
    const items = trail?.itemListElement as readonly BreadcrumbItem[];

    expect(items[0]?.item).toBe("https://example.test/fr");
    expect(items[2]?.item).toBe(
      "https://example.test/vi/collections/collection-2026",
    );
  });
});

describe("collection sitemap entries", () => {
  it("lists a landing page with its cover and groups its translations", () => {
    const sitemap = buildPublicSitemap(
      [
        {
          key: "collection:2026",
          locale: "vi",
          path: "/collections/bo-suu-tap-2026",
          isDemo: false,
          status: "published",
          lastModified: "2026-09-01T00:00:00.000Z",
          images: ["https://cdn.example/cover.jpg"],
        },
        {
          key: "collection:2026",
          locale: "en",
          path: "/collections/the-2026-collection",
          isDemo: false,
          status: "published",
          lastModified: "2026-09-01T00:00:00.000Z",
          images: ["https://cdn.example/cover.jpg"],
        },
      ],
      new URL("https://example.test/"),
    );

    expect(sitemap.map((entry) => entry.url)).toEqual([
      "https://example.test/vi/collections/bo-suu-tap-2026",
      "https://example.test/en/collections/the-2026-collection",
    ]);
    expect(sitemap[0]?.images).toEqual(["https://cdn.example/cover.jpg"]);
    expect(sitemap[0]?.alternates?.languages).toEqual({
      vi: "https://example.test/vi/collections/bo-suu-tap-2026",
      en: "https://example.test/en/collections/the-2026-collection",
      "x-default": "https://example.test/vi/collections/bo-suu-tap-2026",
    });
  });
});

describe("collection landing page", () => {
  it("links the collection's products by name and withholds the reader while no catalogue exists", async () => {
    const [dictionary, collection] = await Promise.all([
      getDictionary("vi"),
      demoCollection(),
    ]);
    const data = await getCollectionLandingPageData(
      "vi",
      dictionary,
      collection,
    );

    expect(data.breadcrumbs.map((item) => item.href)).toEqual([
      "/vi",
      "/vi/collections",
      "/vi/collections/collection-2026",
    ]);
    expect(data.breadcrumbs.at(-1)?.label).toBe(collection.title);
    // The DEMO fixture has no hosted catalogue: the note replaces the link.
    expect(data.catalogueLink).toBeNull();
    expect(data.availabilityNote).toBe(collection.flipbook.availabilityNote);
    expect(data.products).toHaveLength(collection.productIds.length);
    for (const product of data.products) {
      expect(product.href.startsWith("/vi/products/")).toBe(true);
      expect(product.name.length).toBeGreaterThan(0);
    }
    expect(data.allProductsLink.href).toBe("/vi/products");
  });

  it("offers the reader once a catalogue is attached", async () => {
    const [dictionary, collection] = await Promise.all([
      getDictionary("en"),
      demoCollectionRepository.getBySlug("en", "collection-2026"),
    ]);
    if (!collection) throw new Error("Expected the DEMO 2026 collection.");
    const withCatalogue: PublicCollection = {
      ...collection,
      flipbook: { ...collection.flipbook, pageCount: 12 },
    };

    const data = await getCollectionLandingPageData(
      "en",
      dictionary,
      withCatalogue,
    );

    expect(data.catalogueLink).toEqual({
      href: "/en/collections/collection-2026/catalogue",
      label: dictionary.collection.openBook,
    });
    expect(data.availabilityNote).toBeNull();
  });

  it("renders one h1, the trail, the copy and a link per product", async () => {
    const [dictionary, collection] = await Promise.all([
      getDictionary("vi"),
      demoCollection(),
    ]);
    const data = await getCollectionLandingPageData(
      "vi",
      dictionary,
      collection,
    );
    const markup = renderToStaticMarkup(
      CollectionLandingPage({ data, dictionary, isDemo: false }),
    );

    expect(markup.match(/<h1\b/g)).toHaveLength(1);
    expect(markup).toContain(collection.title);
    expect(markup).toContain(collection.summary);
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('href="/vi/collections"');
    for (const product of data.products) {
      expect(markup).toContain(`href="${product.href}"`);
    }
    expect(markup).not.toContain("/catalogue");
  });
});
