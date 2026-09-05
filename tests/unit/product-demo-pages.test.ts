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
  available: "",
  category: "",
  collection: "",
  group: "",
  page: "",
  query: "",
  sort: "",
};

/**
 * Smaller than the real page size (twelve) so the eight-product demo
 * catalogue still spans several pages; passed to the listing explicitly.
 */
const PAGE_SIZE = 3;

describe("product public pages", () => {
  it("builds truthful category and collection filters", async () => {
    const [dictionary, products] = await Promise.all([
      getDictionary("en"),
      demoProductRepository.list("en"),
    ]);
    const target = products[0];

    if (!target) throw new Error("Expected a DEMO product fixture.");

    const collection = target.collectionIds[0];

    if (!collection) throw new Error("Expected DEMO filter values.");

    const data = await getDemoProductListingPageData("en", dictionary, {
      ...EMPTY_QUERY,
      category: target.categorySlug,
      collection,
    });

    expect(data.filterGroups.map((group) => group.name)).toEqual([
      "category",
      "collection",
    ]);
    expect(data.products.map((product) => product.id)).toEqual([target.id]);
    expect(data.clearFiltersLink?.href).toBe("/en/products");
  });

  it("counts every group tab against the other active filters", async () => {
    const [dictionary, products] = await Promise.all([
      getDictionary("en"),
      demoProductRepository.list("en"),
    ]);
    const data = await getDemoProductListingPageData("en", dictionary, {
      ...EMPTY_QUERY,
      group: "develop",
    });
    const byValue = new Map(data.groupTabs.map((tab) => [tab.value, tab]));

    expect([...byValue.keys()]).toEqual(["all", "processing", "develop"]);
    expect(byValue.get("all")?.count).toBe(products.length);
    // The tab a visitor is not standing in still reports what they would land
    // on, so the counts must not collapse to the current selection.
    expect(byValue.get("processing")?.count).toBe(
      products.filter((product) => product.group === "processing").length,
    );
    expect(byValue.get("develop")?.isCurrent).toBe(true);
    expect(data.products.every((product) => product.id.length > 0)).toBe(true);
  });

  it("keeps the stock toggle orthogonal to the chosen group", async () => {
    const [dictionary, products] = await Promise.all([
      getDictionary("en"),
      demoProductRepository.list("en"),
    ]);
    const data = await getDemoProductListingPageData("en", dictionary, {
      ...EMPTY_QUERY,
      available: "1",
      group: "processing",
    });
    const expected = products.filter(
      (product) => product.group === "processing" && product.isAvailable,
    );

    expect(expected.length).toBeGreaterThan(0);
    expect(data.availableOnlyActive).toBe(true);
    expect(data.products.length).toBe(expected.length);

    // Switching tab must carry the toggle, and un-toggling must keep the tab.
    const developTab = data.groupTabs.find((tab) => tab.value === "develop");
    const developUrl = new URL(developTab?.href ?? "", "https://example.test");
    expect(developUrl.searchParams.get("available")).toBe("1");

    const offUrl = new URL(data.availableOnlyHref, "https://example.test");
    expect(offUrl.searchParams.get("group")).toBe("processing");
    expect(offUrl.searchParams.has("available")).toBe(false);

    expect(
      data.products.every(
        (product) => product.statusLabel === dictionary.product.availableBadge,
      ),
    ).toBe(true);
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
    // Derived from the catalogue rather than hard-coded, so adding or removing
    // a product family changes the fixture and not this assertion.
    const pageCount = Math.ceil(products.length / PAGE_SIZE);

    expect(pageCount).toBeGreaterThan(1);

    const firstPage = await getDemoProductListingPageData(
      "en",
      dictionary,
      {
        ...EMPTY_QUERY,
        sort: "name-desc",
      },
      { pageSize: PAGE_SIZE },
    );
    const lastPage = await getDemoProductListingPageData(
      "en",
      dictionary,
      {
        ...EMPTY_QUERY,
        page: String(pageCount),
        sort: "name-desc",
      },
      { pageSize: PAGE_SIZE },
    );

    expect(firstPage.products.map((product) => product.name)).toEqual(
      expectedNames.slice(0, PAGE_SIZE),
    );
    expect(lastPage.products.map((product) => product.name)).toEqual(
      expectedNames.slice((pageCount - 1) * PAGE_SIZE),
    );
    expect(firstPage.pagination?.currentLabel).toBe(`Page 1 / ${pageCount}`);
    expect(lastPage.pagination?.currentLabel).toBe(
      `Page ${pageCount} / ${pageCount}`,
    );
  });

  it("preserves active filters and sorting in pagination links", async () => {
    const [dictionary, products] = await Promise.all([
      getDictionary("en"),
      demoProductRepository.list("en"),
    ]);
    const pageCount = Math.ceil(
      products.filter((product) => product.group === "processing").length /
        PAGE_SIZE,
    );

    expect(pageCount).toBeGreaterThan(1);

    const firstPage = await getDemoProductListingPageData(
      "en",
      dictionary,
      {
        ...EMPTY_QUERY,
        group: "processing",
        sort: "name-asc",
      },
      { pageSize: PAGE_SIZE },
    );
    const nextHref = firstPage.pagination?.next?.href;

    if (!nextHref) throw new Error("Expected a second DEMO product page.");

    const nextUrl = new URL(nextHref, "https://example.test");
    expect(nextUrl.searchParams.get("group")).toBe("processing");
    expect(nextUrl.searchParams.get("sort")).toBe("name-asc");
    expect(nextUrl.searchParams.get("page")).toBe("2");

    const clampedPage = await getDemoProductListingPageData(
      "en",
      dictionary,
      {
        ...EMPTY_QUERY,
        group: "processing",
        page: "999",
        sort: "name-asc",
      },
      { pageSize: PAGE_SIZE },
    );
    expect(clampedPage.pagination?.currentLabel).toBe(
      `Page ${pageCount} / ${pageCount}`,
    );
    const previousHref = clampedPage.pagination?.previous?.href;

    if (!previousHref) throw new Error("Expected a previous product page.");

    const previousUrl = new URL(previousHref, "https://example.test");
    expect(previousUrl.searchParams.get("group")).toBe("processing");
    // Page one is expressed by omitting the parameter, not by `page=1`.
    if (pageCount - 1 > 1) {
      expect(previousUrl.searchParams.get("page")).toBe(String(pageCount - 1));
    } else {
      expect(previousUrl.searchParams.has("page")).toBe(false);
    }
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
