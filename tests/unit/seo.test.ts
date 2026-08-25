import { describe, expect, it } from "vitest";

import generatedSitemap from "@/app/sitemap";
import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import { demoNewsRepository } from "@/domains/news/demo-repository";
import { demoProductRepository } from "@/domains/products/demo-repository";
import { locales } from "@/lib/i18n/config";
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
  isPublicSitemapPath,
  isSafeSeoSlug,
  languageAlternates,
  localizedUrl,
  normalizeSeoPath,
  serializeJsonLd,
} from "@/lib/seo";

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

describe("public metadata", () => {
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
    expect(breadcrumbs.itemListElement).toHaveLength(2);
    expect(product).not.toHaveProperty("offers");
    expect(product).not.toHaveProperty("image");
    expect(article).not.toHaveProperty("datePublished");
    expect(article).not.toHaveProperty("author");
    expect(video).not.toHaveProperty("duration");
    expect(video).not.toHaveProperty("contentUrl");
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
        "/en/products?*",
        "/zh-CN/search/",
      ]),
    );
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
    expect(sitemap[0]?.alternates?.languages).toEqual({
      vi: "https://example.test/vi/about",
      en: "https://example.test/en/about",
      "x-default": "https://example.test/vi/about",
    });
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
        expect(
          urls.has(localizedUrl(locale, `/collections/${collection.slug}`)),
        ).toBe(true);
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
