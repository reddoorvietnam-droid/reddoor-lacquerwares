import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoContentRepository } from "@/domains/content/demo-repository";
import { demoNewsRepository } from "@/domains/news/demo-repository";
import type { PublicNewsArticle } from "@/domains/news/public-contract";
import viDictionary from "@/lib/i18n/dictionaries/vi";
import { buildArticleJsonLd } from "@/lib/seo/json-ld";
import {
  articleStructuredData,
  homeStructuredData,
  sectionStructuredData,
} from "@/lib/seo/structured-data";

type BreadcrumbItem = { position: number; name: string; item: string };

const CLOUDINARY = "https://res.cloudinary.com/demo/image/upload";

describe("structured data for public pages", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gives a section page one two-item trail from home to the section", () => {
    const documents = sectionStructuredData("ja", viDictionary, {
      name: viDictionary.nav.products,
      path: "/products",
    });

    expect(documents).toHaveLength(1);
    const [trail] = documents;
    expect(trail?.["@type"]).toBe("BreadcrumbList");

    const items = trail?.itemListElement as readonly BreadcrumbItem[];
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: viDictionary.nav.home,
      item: "https://example.test/ja",
    });
    expect(items[1]).toMatchObject({
      position: 2,
      name: viDictionary.nav.products,
    });
    expect(items[1]?.item.endsWith("/products")).toBe(true);
    expect(items[1]?.item).toBe("https://example.test/ja/products");
  });

  it("declares the English company form and both domains as brand aliases", async () => {
    const content = await demoContentRepository.getSnapshot("vi");
    const [organization, website] = homeStructuredData(
      "vi",
      viDictionary,
      content,
    );

    expect(organization?.["@type"]).toBe("Organization");
    expect(organization?.alternateName).toEqual(
      expect.arrayContaining([
        "Red Door Vietnam",
        "RED DOOR Co., Ltd",
        "REDDOOR VIETNAM",
        "reddoor.vn",
        "lacquerwares.vn",
      ]),
    );
    expect(website?.["@type"]).toBe("WebSite");
    expect(website?.alternateName).toEqual(
      expect.arrayContaining(["RED DOOR Co., Ltd", "reddoor.vn"]),
    );

    // Preference order matters to Google: the spoken name comes first.
    const aliases = organization?.alternateName as readonly string[];
    expect(aliases.indexOf("Red Door Vietnam")).toBeLessThan(
      aliases.indexOf("reddoor.vn"),
    );
  });

  it("emits author.url only for an absolute author URL", () => {
    const base = {
      headline: "Ghi chép từ xưởng",
      url: "https://example.test/vi/news/ghi-chep",
      authorName: "Red Door",
      authorType: "Organization" as const,
    };

    const withUrl = buildArticleJsonLd({
      ...base,
      authorUrl: "https://example.test/",
    });
    const withoutUrl = buildArticleJsonLd(base);
    const relative = buildArticleJsonLd({ ...base, authorUrl: "/" });

    expect(withUrl.author).toEqual({
      "@type": "Organization",
      name: "Red Door",
      url: "https://example.test/",
    });
    expect(withoutUrl.author).toEqual({
      "@type": "Organization",
      name: "Red Door",
    });
    expect(relative.author).not.toHaveProperty("url");
  });

  it("lists an article's cover, then its crops, then body photographs", async () => {
    const [demo] = await demoNewsRepository.list("vi");
    if (!demo) throw new Error("The demo newsroom is empty.");

    const cover = `${CLOUDINARY}/w_1600,c_limit,f_auto,q_auto/v1/news/cover`;
    const variants = ["16:9", "4:3", "1:1"].map(
      (aspect) =>
        `${CLOUDINARY}/w_1200,ar_${aspect},c_fill,g_auto,f_auto,q_auto/v1/news/cover`,
    );
    const body = `${CLOUDINARY}/w_1600,c_limit,f_auto,q_auto/v1/news/body`;
    const article: PublicNewsArticle = {
      ...demo,
      image: { ...demo.image, src: cover, assetPending: false, variants },
      content: [
        ...demo.content,
        {
          type: "image",
          src: body,
          alt: "",
          caption: null,
          width: 2400,
          height: 1792,
        },
        // The cover placed again in the body must not be listed twice.
        {
          type: "image",
          src: cover,
          alt: "",
          caption: null,
          width: 1600,
          height: 1000,
        },
      ],
    };

    const [articleDocument, trail] = articleStructuredData(
      "vi",
      viDictionary,
      article,
    );

    expect(articleDocument?.["@type"]).toBe("Article");
    expect(articleDocument?.image).toEqual([cover, ...variants, body]);
    expect(articleDocument?.author).toEqual({
      "@type": "Organization",
      name: demo.author,
      url: "https://example.test/",
    });
    expect(articleDocument?.datePublished).toBe(demo.publishedAt);
    expect(trail?.["@type"]).toBe("BreadcrumbList");
  });

  it("advertises no image for a reserved slot, crops included", async () => {
    const [demo] = await demoNewsRepository.list("vi");
    if (!demo) throw new Error("The demo newsroom is empty.");

    const [articleDocument] = articleStructuredData("vi", viDictionary, {
      ...demo,
      image: {
        ...demo.image,
        variants: [`${CLOUDINARY}/w_1200,ar_1:1,c_fill/v1/news/cover`],
      },
    });

    expect(demo.image.assetPending).toBe(true);
    expect(articleDocument).not.toHaveProperty("image");
  });
});
