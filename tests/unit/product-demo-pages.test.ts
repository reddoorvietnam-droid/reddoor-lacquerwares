import { describe, expect, it } from "vitest";

import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import { demoProductRepository } from "@/domains/products/demo-repository";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getDemoProductDetailPageData,
  getDemoProductListingPageData,
  type DemoProductListingQuery,
} from "@/lib/public/demo-page-data";

const EMPTY_QUERY: DemoProductListingQuery = {
  category: "",
  collection: "",
  finish: "",
  material: "",
  page: "",
  query: "",
  sort: "",
};

describe("DEMO product public pages", () => {
  it("builds truthful category, collection, material, and finish filters", async () => {
    const [dictionary, products] = await Promise.all([
      getDictionary("en"),
      demoProductRepository.list("en"),
    ]);
    const target = products[0];

    if (!target) throw new Error("Expected a DEMO product fixture.");

    const collection = target.collectionIds[0];
    const material = target.materialLabels[0];

    if (!collection || !material) {
      throw new Error("Expected DEMO filter values.");
    }

    const data = await getDemoProductListingPageData("en", dictionary, {
      ...EMPTY_QUERY,
      category: target.categorySlug,
      collection,
      finish: target.finishLabel,
      material,
    });

    expect(data.filterGroups.map((group) => group.name)).toEqual([
      "category",
      "collection",
      "material",
      "finish",
    ]);
    expect(data.products.map((product) => product.id)).toEqual([target.id]);
    expect(data.clearFiltersLink?.href).toBe("/en/products");
  });

  it("sorts by localized product name and paginates three records at a time", async () => {
    const [dictionary, products] = await Promise.all([
      getDictionary("en"),
      demoProductRepository.list("en"),
    ]);
    const collator = new Intl.Collator("en", {
      numeric: true,
      sensitivity: "base",
    });
    const expectedNames = [...products]
      .sort((left, right) => collator.compare(right.name, left.name))
      .map((product) => product.name);

    const firstPage = await getDemoProductListingPageData("en", dictionary, {
      ...EMPTY_QUERY,
      sort: "name-desc",
    });
    const secondPage = await getDemoProductListingPageData("en", dictionary, {
      ...EMPTY_QUERY,
      page: "2",
      sort: "name-desc",
    });

    expect(firstPage.products.map((product) => product.name)).toEqual(
      expectedNames.slice(0, 3),
    );
    expect(secondPage.products.map((product) => product.name)).toEqual(
      expectedNames.slice(3),
    );
    expect(firstPage.pagination?.currentLabel).toBe("Page 1 / 2");
    expect(secondPage.pagination?.currentLabel).toBe("Page 2 / 2");
  });

  it("preserves active filters and sorting in pagination links", async () => {
    const [dictionary, products] = await Promise.all([
      getDictionary("en"),
      demoProductRepository.list("en"),
    ]);
    const material = products[0]?.materialLabels[0];

    if (!material) throw new Error("Expected a DEMO material fixture.");

    const firstPage = await getDemoProductListingPageData("en", dictionary, {
      ...EMPTY_QUERY,
      material,
      sort: "name-asc",
    });
    const nextHref = firstPage.pagination?.next?.href;

    if (!nextHref) throw new Error("Expected a second DEMO product page.");

    const nextUrl = new URL(nextHref, "https://example.test");
    expect(nextUrl.searchParams.get("material")).toBe(material);
    expect(nextUrl.searchParams.get("sort")).toBe("name-asc");
    expect(nextUrl.searchParams.get("page")).toBe("2");

    const clampedPage = await getDemoProductListingPageData("en", dictionary, {
      ...EMPTY_QUERY,
      material,
      page: "999",
      sort: "name-asc",
    });
    expect(clampedPage.pagination?.currentLabel).toBe("Page 2 / 2");
    const previousHref = clampedPage.pagination?.previous?.href;

    if (!previousHref) throw new Error("Expected a previous product page.");

    const previousUrl = new URL(previousHref, "https://example.test");
    expect(previousUrl.searchParams.get("material")).toBe(material);
    expect(previousUrl.searchParams.has("page")).toBe(false);
  });

  it("indexes localized collection names in product search", async () => {
    const [dictionary, collections] = await Promise.all([
      getDictionary("en"),
      demoCollectionRepository.list("en"),
    ]);
    const collection = collections[0];

    if (!collection) throw new Error("Expected a DEMO collection fixture.");

    const data = await getDemoProductListingPageData("en", dictionary, {
      ...EMPTY_QUERY,
      query: collection.title,
    });

    expect(data.products.length).toBeGreaterThan(0);
    expect(
      data.products.every((product) =>
        collection.productIds.includes(product.id),
      ),
    ).toBe(true);
  });

  it("exposes explicit empty optional-media states without invented facts", async () => {
    const [dictionary, product] = await Promise.all([
      getDictionary("en"),
      demoProductRepository.list("en").then((products) => products[0]),
    ]);

    if (!product) throw new Error("Expected a DEMO product fixture.");

    const data = await getDemoProductDetailPageData(
      "en",
      dictionary,
      product.slug,
    );

    expect(data).not.toBeNull();
    expect(data?.video).toBeNull();
    expect(data?.variants).toEqual([]);
    expect(data?.processSteps).toEqual([]);
    expect(data?.gallery.length).toBeGreaterThan(0);
    expect(data?.gallery.every((media) => media.src === null)).toBe(true);
  });
});
