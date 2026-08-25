import { describe, expect, it } from "vitest";

import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import { demoContentRepository } from "@/domains/content/demo-repository";
import { demoNewsRepository } from "@/domains/news/demo-repository";
import { demoProductRepository } from "@/domains/products/demo-repository";
import { locales } from "@/lib/i18n/config";

describe("public repositories", () => {
  it("returns deterministic, approved, frozen data for every locale", async () => {
    for (const locale of locales) {
      const [content, products, collections, articles] = await Promise.all([
        demoContentRepository.getSnapshot(locale),
        demoProductRepository.list(locale),
        demoCollectionRepository.list(locale),
        demoNewsRepository.list(locale),
      ]);

      // Real, company-approved copy carries no DEMO marker. The assertion is
      // the inverse of the one this suite made while the repositories held
      // stand-in text, and it is what stops unapproved copy shipping again.
      expect(content).toMatchObject({ locale, marker: null, isDemo: false });
      expect(Object.isFrozen(content)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      expect(collections.length).toBeGreaterThan(0);
      expect(articles.length).toBeGreaterThan(0);
      expect(
        [...products, ...collections, ...articles].every(
          (item) => item.isDemo === false && item.marker === null,
        ),
      ).toBe(true);
      expect(
        [...products, ...collections, ...articles].every(Object.isFrozen),
      ).toBe(true);
    }
  });

  it("keeps every locale in parity on ids and slugs", async () => {
    const reference = await Promise.all([
      demoProductRepository.list("vi"),
      demoCollectionRepository.list("vi"),
      demoNewsRepository.list("vi"),
    ]);
    const expected = reference.map((records) =>
      records.map((record) => `${record.id}:${record.slug}`),
    );

    for (const locale of locales) {
      const actual = await Promise.all([
        demoProductRepository.list(locale),
        demoCollectionRepository.list(locale),
        demoNewsRepository.list(locale),
      ]);

      expect(
        actual.map((records) =>
          records.map((record) => `${record.id}:${record.slug}`),
        ),
      ).toEqual(expected);
    }
  });

  it("states only the facts the company has confirmed", async () => {
    const [products, collections, articles] = await Promise.all([
      demoProductRepository.list("vi"),
      demoCollectionRepository.list("vi"),
      demoNewsRepository.list("vi"),
    ]);

    // Everything is quoted against a specification, and no measurement or
    // catalogue reference has been supplied, so those fields stay empty.
    expect(
      products.every((product) => !product.showPrice && product.price === null),
    ).toBe(true);
    expect(
      products.every(
        (product) =>
          product.dimensions === null && product.internalReference === null,
      ),
    ).toBe(true);

    // 2026 is the one sourced edition year; the forthcoming collection has
    // none, and inventing one would be the exact failure this guards against.
    expect(collections.map((collection) => collection.year)).toEqual([
      2026,
      null,
    ]);

    // Articles are dated and attributed, but never to an invented person.
    expect(
      articles.every(
        (article) =>
          article.publishedAt !== null && article.author === "Red Door Vietnam",
      ),
    ).toBe(true);

    // No photograph has been delivered: every image is a reserved slot, and a
    // non-null src would mean a stand-in was being passed off as the piece.
    const images = [
      ...products.flatMap((product) => product.images),
      ...collections.map((collection) => collection.cover),
      ...articles.map((article) => article.image),
    ];
    expect(images.length).toBeGreaterThan(0);
    expect(
      images.every((image) => image.src === null && image.assetPending),
    ).toBe(true);
  });
});
