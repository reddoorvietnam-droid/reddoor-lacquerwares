import { afterEach, describe, expect, it, vi } from "vitest";

import generatedSitemap from "@/app/sitemap";
import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import { demoNewsRepository } from "@/domains/news/demo-repository";
import { demoProductRepository } from "@/domains/products/demo-repository";
import { locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildPublicMetadata,
  buildPublicSitemap,
  buildRobots,
  buildVideoJsonLd,
  buildWebsiteJsonLd,
  encodeSeoSlug,
  getSiteUrl,
  isPublicSitemapPath,
  isSafeSeoSlug,
  languageAlternates,
  localizedUrl,
  normalizeSeoPath,
  serializeJsonLd,
  translatedRoutes,
} from "@/lib/seo";
import {
  hasTranslationSlug,
  preferExactSlug,
  translationSlugs,
} from "@/lib/public/published-mapping";
import { deliveredImages, shopItemRoutes } from "@/lib/seo/public-records";

const siteUrl = new URL("https://example.test/");

describe("SEO URLs and slugs", () => {
  it("builds deterministic localized URLs and complete language alternates", () => {
    expect(localizedUrl("zh-CN", "/products", siteUrl)).toBe(
      "https://example.test/zh-CN/products",
    );

    const alternates = languageAlternates("/about", siteUrl);
    expect(alternates.vi).toBe("https://example.test/vi/about");
    expect(alternates.en).toBe("https://example.test/en/about");
    expect(alternates["zh-CN"]).toBe("https://example.test/zh-CN/about");
    expect(alternates["x-default"]).toBe("https://example.test/vi/about");
  });

  it("accepts stable slugs and rejects path/query injection", () => {
    expect(isSafeSeoSlug("living-lacquer-01")).toBe(true);
    expect(isSafeSeoSlug("sơn-mài")).toBe(true);
    expect(encodeSeoSlug("sơn-mài")).toBe("s%C6%A1n-m%C3%A0i");
    expect(isSafeSeoSlug("../admin")).toBe(false);
    expect(isSafeSeoSlug("product?q=hidden")).toBe(false);
    expect(() => encodeSeoSlug("unsafe/slug")).toThrow(TypeError);
    expect(() => normalizeSeoPath("/products?q=demo")).toThrow(TypeError);
  });
});

describe("public site URL", () => {
  // The guard reads only these keys; clearing them isolates each case from
  // the developer's .env and from Vercel's injected system variables.
  function clearSiteUrlEnv() {
    for (const key of [
      "NEXT_PUBLIC_SITE_URL",
      "VERCEL_PROJECT_PRODUCTION_URL",
      "NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
      "ALLOW_LOOPBACK_SITE_URL",
    ]) {
      vi.stubEnv(key, "");
    }
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps an explicit public URL", () => {
    clearSiteUrlEnv();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.reddoor.example");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "reddoor.vercel.app");

    expect(getSiteUrl().toString()).toBe("https://www.reddoor.example/");
  });

  it("never lets a leftover localhost value reach production canonicals", () => {
    clearSiteUrlEnv();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "reddoor.example");

    expect(getSiteUrl().toString()).toBe("https://reddoor.example/");
  });

  it("refuses a production origin that would fall back to localhost", () => {
    clearSiteUrlEnv();
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getSiteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("lets a deliberate local production build keep localhost", () => {
    clearSiteUrlEnv();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_LOOPBACK_SITE_URL", "1");

    expect(getSiteUrl().toString()).toBe("http://localhost:3000/");
  });

  it("defaults to localhost outside production", () => {
    clearSiteUrlEnv();
    vi.stubEnv("NODE_ENV", "test");

    expect(getSiteUrl().toString()).toBe("http://localhost:3000/");
  });
});

describe("translated detail routes", () => {
  const product = {
    locale: "vi" as const,
    slug: "bat-son-mai",
    contentLocale: "vi" as const,
    translations: [
      { locale: "vi" as const, slug: "bat-son-mai" },
      { locale: "en" as const, slug: "lacquer-bowl" },
    ],
  };
  const productPath = (slug: string) => `/products/${slug}`;

  it("lists only real translations, each at its own slug", () => {
    const { routes, canonicalPath } = translatedRoutes(product, productPath);

    expect(routes).toEqual([
      { locale: "vi", path: "/vi/products/bat-son-mai" },
      { locale: "en", path: "/en/products/lacquer-bowl" },
    ]);
    expect(canonicalPath).toBe("/vi/products/bat-son-mai");
  });

  it("canonicalizes a fallback page to the copy it shows", () => {
    // /fr/products/bat-son-mai shows the Vietnamese copy: it must not be
    // indexed as a French duplicate.
    const { routes, canonicalPath } = translatedRoutes(
      { ...product, locale: "fr" },
      productPath,
    );

    expect(routes.map((route) => route.locale)).toEqual(["vi", "en"]);
    expect(canonicalPath).toBe("/vi/products/bat-son-mai");
  });

  it("keeps a page whose own locale holds the content self-canonical", () => {
    const { routes, canonicalPath } = translatedRoutes(
      { ...product, locale: "ja", contentLocale: "ja" },
      productPath,
    );

    expect(routes.map((route) => route.locale)).toEqual(["vi", "en", "ja"]);
    expect(canonicalPath).toBe("/ja/products/bat-son-mai");
  });

  it("points the four English-copy shop locales at the English page", () => {
    expect(
      shopItemRoutes({ locale: "de", slug: "khay-son-mai" }).canonicalPath,
    ).toBe("/en/shop/khay-son-mai");
    expect(
      shopItemRoutes({ locale: "vi", slug: "khay-son-mai" }).canonicalPath,
    ).toBe("/vi/shop/khay-son-mai");
  });

  it("finds a record by any translation's slug, exact matches first", () => {
    const published = [
      { locale: "vi" as const, slug: "bat-son-mai" },
      { locale: "en" as const, slug: "lacquer-bowl" },
      { locale: "en" as const, slug: "duplicate-en" },
    ];

    expect(hasTranslationSlug(published, "lacquer-bowl")).toBe(true);
    expect(hasTranslationSlug(published, "unknown")).toBe(false);
    expect(translationSlugs(published)).toEqual([
      { locale: "vi", slug: "bat-son-mai" },
      { locale: "en", slug: "lacquer-bowl" },
    ]);
    expect(
      preferExactSlug(
        [{ slug: "other" }, { slug: "lacquer-bowl" }],
        "lacquer-bowl",
      ).map((record) => record.slug),
    ).toEqual(["lacquer-bowl", "other"]);
  });

  it("shares delivered photographs only, never reserved slots", () => {
    const images = deliveredImages(
      [
        { src: null, alt: "Pending", width: 1200, height: 1500 },
        {
          src: "/about-us/workshop.jpg",
          alt: "Workshop",
          width: 1600,
          height: 1000,
        },
        {
          src: "https://res.cloudinary.com/demo/image/upload/v1/tray",
          alt: "Tray",
          width: 1600,
          height: 1600,
          assetPending: false,
        },
      ],
      4,
      siteUrl,
    );

    expect(images).toEqual([
      {
        url: "https://example.test/about-us/workshop.jpg",
        width: 1600,
        height: 1000,
        alt: "Workshop",
      },
      {
        url: "https://res.cloudinary.com/demo/image/upload/v1/tray",
        width: 1600,
        height: 1600,
        alt: "Tray",
      },
    ]);
  });
});

describe("public metadata", () => {
  it("always ships a share image, the brand card by default", () => {
    const fallback = buildPublicMetadata({
      locale: "vi",
      path: "/about",
      title: "Về chúng tôi",
      description: "Giới thiệu.",
      siteName: "Red Door",
      isDemo: false,
    });
    const withPhoto = buildPublicMetadata({
      locale: "vi",
      path: "/news/bai-viet",
      title: "Bài viết",
      description: "Tóm tắt.",
      siteName: "Red Door",
      isDemo: false,
      kind: "article",
      images: [{ url: "https://cdn.example/cover.jpg", alt: "Cover" }],
      publishedTime: "2026-09-05",
    });

    expect(fallback.openGraph?.images).toEqual([
      {
        url: "http://localhost:3000/vi/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Red Door",
      },
    ]);
    expect(fallback.twitter?.images).toEqual(fallback.openGraph?.images);
    expect(withPhoto.openGraph).toMatchObject({
      images: [{ url: "https://cdn.example/cover.jpg", alt: "Cover" }],
      publishedTime: "2026-09-05",
    });
  });

  it("uses the canonical override and only the listed translations", () => {
    const metadata = buildPublicMetadata({
      locale: "fr",
      title: "Bát sơn mài",
      description: "Mô tả.",
      siteName: "Red Door",
      isDemo: false,
      localizedRoutes: [
        { locale: "vi", path: "/vi/products/bat-son-mai" },
        { locale: "en", path: "/en/products/lacquer-bowl" },
      ],
      canonicalOverride: "/vi/products/bat-son-mai",
    });

    expect(metadata.alternates?.canonical).toBe(
      "http://localhost:3000/vi/products/bat-son-mai",
    );
    expect(metadata.alternates?.languages).toEqual({
      vi: "http://localhost:3000/vi/products/bat-son-mai",
      en: "http://localhost:3000/en/products/lacquer-bowl",
      "x-default": "http://localhost:3000/vi/products/bat-son-mai",
    });
  });

  it("sets canonical, hreflang, OG, Twitter, and noindex for DEMO content", () => {
    const metadata = buildPublicMetadata({
      locale: "en",
      path: "/products/living-lacquer-01",
      title: "Living Lacquer 01",
      description: "Clearly identified demonstration copy.",
      siteName: "Red Door — Living Lacquer",
      isDemo: true,
    });

    expect(metadata.alternates?.canonical).toBe(
      "http://localhost:3000/en/products/living-lacquer-01",
    );
    expect(metadata.alternates?.languages?.["x-default"]).toBe(
      "http://localhost:3000/vi/products/living-lacquer-01",
    );
    expect(metadata.openGraph?.url).toBe(
      "http://localhost:3000/en/products/living-lacquer-01",
    );
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.other).toEqual({ "content-status": "DEMO" });
  });

  it("allows indexing only when the content is both approved and non-DEMO", () => {
    const metadata = buildPublicMetadata({
      locale: "vi",
      title: "Approved",
      description: "Approved content.",
      siteName: "Red Door",
      isDemo: false,
      indexable: true,
    });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("keeps a filtered listing crawlable but unindexed, with no canonical", () => {
    const metadata = buildPublicMetadata({
      locale: "vi",
      path: "/products",
      title: "Sản phẩm",
      description: "Danh mục.",
      siteName: "Red Door",
      isDemo: false,
      filteredView: true,
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.robots).toMatchObject({
      googleBot: { index: false, follow: true },
    });
    // `null` on purpose: an omitted key would inherit the locale layout's
    // canonical, and a filtered view must carry neither canonical nor hreflang.
    expect(metadata.alternates).toBeNull();
    expect(metadata.openGraph?.url).toBe("http://localhost:3000/vi/products");
  });
});

describe("JSON-LD", () => {
  it("escapes script-breaking input before rendering", () => {
    const payload = buildOrganizationJsonLd({
      name: "</script><script>alert(1)</script>",
      url: "https://example.test/",
      logoUrl: "javascript:alert(1)",
      sameAs: ["https://social.example/profile", "not-a-url"],
    });
    const serialized = serializeJsonLd(payload);

    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(payload).not.toHaveProperty("logo");
    expect(payload.sameAs).toEqual(["https://social.example/profile"]);
  });

  it("builds typed schemas without inventing optional facts", () => {
    const website = buildWebsiteJsonLd({
      name: "Red Door",
      url: "https://example.test/en",
      locale: "en",
    });
    const breadcrumbs = buildBreadcrumbJsonLd([
      { name: "Home", url: "https://example.test/en" },
      { name: "Products", url: "https://example.test/en/products" },
    ]);
    const product = buildProductJsonLd({
      name: "Sample",
      url: "https://example.test/en/products/sample",
    });
    const article = buildArticleJsonLd({
      headline: "Sample article",
      url: "https://example.test/en/news/sample",
    });
    const video = buildVideoJsonLd({
      name: "Documented process",
      description: "Approved process footage.",
      thumbnailUrl: "https://example.test/media/process-poster.jpg",
      uploadDate: "2026-08-24",
    });

    expect(website).not.toHaveProperty("potentialAction");
    expect(website).not.toHaveProperty("alternateName");
    expect(breadcrumbs.itemListElement).toHaveLength(2);
    expect(product).not.toHaveProperty("offers");
    expect(product).not.toHaveProperty("image");
    expect(article).not.toHaveProperty("datePublished");
    expect(article).not.toHaveProperty("author");
    expect(video).not.toHaveProperty("duration");
    expect(video).not.toHaveProperty("contentUrl");
  });

  it("describes the company with its aliases and published contact facts", () => {
    const organization = buildOrganizationJsonLd({
      id: "https://example.test/#organization",
      name: "Red Door",
      alternateNames: ["Red Door", "Red Door Vietnam", "Red Door Vietnam"],
      url: "https://example.test/",
      email: "sales@example.test",
      telephone: "+84 903 000 000",
      address: "Hạ Thái, Hà Nội",
      addressCountry: "VN",
    });

    expect(organization).toMatchObject({
      "@id": "https://example.test/#organization",
      alternateName: ["Red Door Vietnam"],
      address: {
        "@type": "PostalAddress",
        streetAddress: "Hạ Thái, Hà Nội",
        addressCountry: "VN",
      },
      contactPoint: { "@type": "ContactPoint", contactType: "sales" },
    });
  });

  it("adds a shop offer with price, currency and stock", () => {
    const product = buildProductJsonLd({
      name: "Khay sơn mài",
      url: "https://example.test/vi/shop/khay",
      brandName: "Red Door",
      offer: {
        price: "1250000",
        priceCurrency: "VND",
        inStock: false,
        url: "https://example.test/vi/shop/khay",
        sellerName: "Red Door",
      },
    });

    expect(product.offers).toEqual({
      "@type": "Offer",
      url: "https://example.test/vi/shop/khay",
      price: "1250000",
      priceCurrency: "VND",
      availability: "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Red Door" },
    });
  });

  it("signs company editorial as an organization with a publisher logo", () => {
    const article = buildArticleJsonLd({
      headline: "Ghi chép từ xưởng",
      url: "https://example.test/vi/news/ghi-chep",
      authorName: "Red Door",
      authorType: "Organization",
      publisherName: "Red Door",
      publisherLogoUrl: "https://example.test/logo_rd.jpg",
      inLanguage: "vi",
    });

    expect(article).toMatchObject({
      inLanguage: "vi",
      author: { "@type": "Organization", name: "Red Door" },
      publisher: {
        logo: {
          "@type": "ImageObject",
          url: "https://example.test/logo_rd.jpg",
        },
      },
    });
  });
});

describe("static page titles", () => {
  it("keeps every section heading within 60 characters once the brand is appended", async () => {
    const dictionaries = await Promise.all(
      locales.map(
        async (locale) => [locale, await getDictionary(locale)] as const,
      ),
    );

    for (const [locale, dictionary] of dictionaries) {
      const headings = [
        dictionary.pages.aboutHeading,
        dictionary.pages.productsHeading,
        dictionary.pages.collectionsHeading,
        dictionary.pages.processHeading,
        dictionary.pages.newsHeading,
        dictionary.pages.contactHeading,
        dictionary.pages.shopHeading,
      ];

      for (const heading of headings) {
        const title = `${heading} | ${dictionary.meta.siteName}`;
        expect([...title].length, `${locale}: ${title}`).toBeLessThanOrEqual(
          60,
        );
        // The layout template must apply, so no heading may start with the
        // brand (buildPublicMetadata switches to an absolute title then).
        expect(heading.startsWith(dictionary.meta.siteName), title).toBe(false);
      }
    }
  });
});

describe("robots and sitemap", () => {
  it("keeps public pages crawlable while excluding internal and search routes", () => {
    const robots = buildRobots(siteUrl);
    const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;

    expect(rules?.allow).toBe("/");
    expect(rules?.disallow).toEqual(
      expect.arrayContaining([
        "/admin/",
        "/api/",
        "/auth/",
        "/private/",
        "/vi/search",
        "/zh-CN/search/",
        "/vi/private/",
      ]),
    );
    // Filtered listings are crawlable: they carry `noindex, follow` in HTML,
    // which a robots-blocked URL could never show the crawler.
    expect(rules?.disallow).not.toContain("/en/products?*");
    expect(rules?.disallow).not.toContain("/vi/news?*");
    expect(robots.sitemap).toBe("https://example.test/sitemap.xml");
  });

  it("excludes DEMO, draft, search, private, and filtered sources", () => {
    expect(isPublicSitemapPath("/products")).toBe(true);
    expect(isPublicSitemapPath("/search")).toBe(false);
    expect(isPublicSitemapPath("/admin/orders")).toBe(false);
    expect(isPublicSitemapPath("/private/preview")).toBe(false);
    expect(isPublicSitemapPath("/products?q=demo")).toBe(false);

    const sitemap = buildPublicSitemap(
      [
        {
          key: "about",
          locale: "vi",
          path: "/about",
          isDemo: false,
          status: "published",
        },
        {
          key: "about",
          locale: "en",
          path: "/about",
          isDemo: false,
          status: "published",
        },
        {
          key: "demo-product",
          locale: "en",
          path: "/products/demo",
          isDemo: true,
          status: "published",
        },
        {
          key: "draft-article",
          locale: "en",
          path: "/news/draft",
          isDemo: false,
          status: "draft",
        },
        {
          key: "search",
          locale: "en",
          path: "/search",
          isDemo: false,
          status: "published",
        },
      ],
      siteUrl,
    );

    expect(sitemap).toHaveLength(2);
    expect(sitemap[0]).not.toHaveProperty("lastModified");
    expect(sitemap[0]).not.toHaveProperty("images");
    expect(sitemap[0]?.alternates?.languages).toEqual({
      vi: "https://example.test/vi/about",
      en: "https://example.test/en/about",
      "x-default": "https://example.test/vi/about",
    });
  });

  it("escapes image URLs, which Next writes into the XML verbatim", () => {
    const [entry] = buildPublicSitemap(
      [
        {
          key: "article",
          locale: "vi",
          path: "/news/bai-viet",
          isDemo: false,
          status: "published",
          lastModified: null,
          images: ["https://cdn.example/cover.jpg?w=1600&q=80"],
        },
      ],
      siteUrl,
    );

    expect(entry?.images).toEqual([
      "https://cdn.example/cover.jpg?w=1600&amp;q=80",
    ]);
    expect(entry).not.toHaveProperty("lastModified");
  });

  it("publishes the approved repositories and still withholds search and private paths", async () => {
    // The repositories now hold copy the company stands behind, so the sitemap
    // is expected to be populated. What must stay true is that nothing marked
    // DEMO, and no search or admin path, can reach it — the exclusion above
    // covers the DEMO case directly.
    const [entries, products, collections, articles] = await Promise.all([
      generatedSitemap(),
      demoProductRepository.list("vi"),
      demoCollectionRepository.list("vi"),
      demoNewsRepository.list("vi"),
    ]);
    const urls = new Set(entries.map((entry) => entry.url));

    expect(entries.length).toBeGreaterThan(0);

    for (const locale of locales) {
      for (const product of products) {
        expect(
          urls.has(localizedUrl(locale, `/products/${product.slug}`)),
        ).toBe(true);
      }
      for (const collection of collections) {
        // Every collection is listed at its landing page, catalogue or not;
        // the flipbook reader canonicalizes to the landing and stays out.
        expect(
          urls.has(localizedUrl(locale, `/collections/${collection.slug}`)),
        ).toBe(true);
        expect(
          urls.has(
            localizedUrl(locale, `/collections/${collection.slug}/catalogue`),
          ),
        ).toBe(false);
      }
      for (const article of articles) {
        expect(urls.has(localizedUrl(locale, `/news/${article.slug}`))).toBe(
          true,
        );
      }
    }

    expect(
      [...urls].some(
        (url) => url.includes("/search") || url.includes("/admin"),
      ),
    ).toBe(false);
  });
});
