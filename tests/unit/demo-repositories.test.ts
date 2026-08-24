import { describe, expect, it } from "vitest";

import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import { demoContentRepository } from "@/domains/content/demo-repository";
import { demoNewsRepository } from "@/domains/news/demo-repository";
import { demoProductRepository } from "@/domains/products/demo-repository";
import { locales } from "@/lib/i18n/config";

describe("public demo repositories", () => {
  it("returns deterministic, labelled, frozen data for every locale", async () => {
    for (const locale of locales) {
      const [content, products, collections, articles] = await Promise.all([
        demoContentRepository.getSnapshot(locale),
        demoProductRepository.list(locale),
        demoCollectionRepository.list(locale),
        demoNewsRepository.list(locale),
      ]);

      expect(content).toMatchObject({ locale, marker: "DEMO", isDemo: true });
      expect(Object.isFrozen(content)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      expect(collections.length).toBeGreaterThan(0);
      expect(articles.length).toBeGreaterThan(0);
      expect(
        [...products, ...collections, ...articles].every((item) => item.isDemo),
      ).toBe(true);
      expect(
        [...products, ...collections, ...articles].every(Object.isFrozen),
      ).toBe(true);
    }
  });

  it("does not expose unverified price, collection year, or publication dates", async () => {
    const [products, collections, articles] = await Promise.all([
      demoProductRepository.list("vi"),
      demoCollectionRepository.list("vi"),
      demoNewsRepository.list("vi"),
    ]);

    expect(
      products.every((product) => !product.showPrice && product.price === null),
    ).toBe(true);
    expect(collections.every((collection) => collection.year === null)).toBe(
      true,
    );
    expect(articles.every((article) => article.publishedAt === null)).toBe(
      true,
    );
  });
});
