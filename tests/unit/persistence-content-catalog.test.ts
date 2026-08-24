import { Types } from "mongoose";
import { describe, expect, it } from "vitest";

import {
  collectionSchema,
  collectionTranslationSchema,
  getCollectionModel,
  getCollectionTranslationModel,
} from "@/domains/collections/persistence/models";
import {
  contentEntrySchema,
  contentRevisionSchema,
  contentTranslationSchema,
  getContentEntryModel,
  getContentTranslationModel,
  getLocalizedRouteModel,
  localizedRouteSchema,
  siteSettingsSchema,
} from "@/domains/content/persistence/models";
import {
  articleRevisionSchema,
  articleSchema,
  articleTranslationSchema,
} from "@/domains/news/persistence/models";
import {
  getProductModel,
  getProductVersionModel,
  productSchema,
  productTranslationSchema,
  productVersionSchema,
} from "@/domains/products/persistence/models";
import {
  localeSchema,
  seoFieldsSchema,
  structuredBlockSchema,
} from "@/lib/content/contracts";
import {
  sanitizeRichTextHtml,
  sanitizeStructuredBlocksForPersistence,
} from "@/lib/content/sanitize";

const actorId = new Types.ObjectId();
const ownerId = new Types.ObjectId();

const rootSchemas = [
  siteSettingsSchema,
  contentEntrySchema,
  contentRevisionSchema,
  contentTranslationSchema,
  localizedRouteSchema,
  productSchema,
  productVersionSchema,
  productTranslationSchema,
  articleSchema,
  articleRevisionSchema,
  articleTranslationSchema,
  collectionSchema,
  collectionTranslationSchema,
];

function indexByName(
  schema: (typeof rootSchemas)[number],
  name: string,
): Record<string, unknown> | undefined {
  return schema.indexes().find(([, options]) => options.name === name)?.[1];
}

describe("content and catalog persistence conventions", () => {
  it("applies strict, timestamped, optimistic root schema defaults", () => {
    for (const schema of rootSchemas) {
      expect(schema.options.strict).toBe("throw");
      expect(schema.options.timestamps).toBe(true);
      expect(schema.options.optimisticConcurrency).toBe(true);
      expect(schema.options.minimize).toBe(false);
      expect(schema.options.versionKey).toBe("revision");
    }
  });

  it("declares route and soft-delete uniqueness as partial indexes", () => {
    expect(
      indexByName(localizedRouteSchema, "localized_route_active_path_unique"),
    ).toMatchObject({
      unique: true,
      partialFilterExpression: { active: true },
    });
    expect(
      indexByName(productSchema, "product_sku_unique_active"),
    ).toMatchObject({
      unique: true,
      partialFilterExpression: { deletedAt: { $exists: false } },
    });
    expect(
      indexByName(contentEntrySchema, "content_entry_code_unique_active"),
    ).toMatchObject({
      unique: true,
      partialFilterExpression: { deletedAt: { $exists: false } },
    });
  });

  it("returns the same compiled models during hot reload", () => {
    expect(getProductModel()).toBe(getProductModel());
    expect(getContentEntryModel()).toBe(getContentEntryModel());
    expect(getLocalizedRouteModel()).toBe(getLocalizedRouteModel());
    expect(getCollectionModel()).toBe(getCollectionModel());
  });

  it("throws instead of silently dropping unknown root fields", () => {
    expect(
      () =>
        new (getProductModel())({
          internalId: "P-001",
          sku: "SKU-001",
          status: "draft",
          createdBy: actorId,
          updatedBy: actorId,
          unexpectedClientField: "must not persist",
        }),
    ).toThrow();
  });
});

describe("localized and structured content boundaries", () => {
  it("accepts only configured locales and rejects unknown SEO keys", () => {
    expect(localeSchema.safeParse("zh-CN").success).toBe(true);
    expect(localeSchema.safeParse("zh").success).toBe(false);
    expect(
      seoFieldsSchema.safeParse({ noIndex: false, injected: "value" }).success,
    ).toBe(false);
  });

  it("validates blocks by discriminator", () => {
    expect(
      structuredBlockSchema.safeParse({
        blockId: "intro",
        type: "heading",
        level: 2,
        text: "Living lacquer",
      }).success,
    ).toBe(true);
    expect(
      structuredBlockSchema.safeParse({
        blockId: "intro",
        type: "heading",
        html: "<p>Wrong field for this discriminator</p>",
      }).success,
    ).toBe(false);
  });

  it("sanitizes persisted and rendered rich text with an allowlist", () => {
    const unsafe =
      '<p onclick="steal()">Safe <strong>craft</strong></p><script>alert(1)</script><a href="javascript:steal()">bad</a>';
    const sanitized = sanitizeRichTextHtml(unsafe);

    expect(sanitized).toContain("<strong>craft</strong>");
    expect(sanitized).not.toMatch(/script|onclick|javascript:/i);

    const blocks = sanitizeStructuredBlocksForPersistence([
      { blockId: "body", type: "richText", html: unsafe },
    ]);
    expect(blocks[0]).toMatchObject({ type: "richText" });
    expect("html" in blocks[0]! ? blocks[0].html : "").not.toMatch(
      /script|onclick|javascript:/i,
    );
  });

  it("rejects an unsupported locale and malformed structured block in Mongoose", async () => {
    const Translation = getContentTranslationModel();
    const invalid = new Translation({
      entryId: ownerId,
      revisionId: new Types.ObjectId(),
      locale: "es",
      title: "Title",
      blocks: [{ blockId: "broken", type: "heading", html: "wrong" }],
      translationStatus: "draft",
      sourceRevision: 1,
      seo: { noIndex: false },
      createdBy: actorId,
      updatedBy: actorId,
    });

    await expect(invalid.validate()).rejects.toMatchObject({
      errors: {
        locale: expect.anything(),
        blocks: expect.anything(),
      },
    });
  });
});

describe("catalog value validation", () => {
  it("keeps Decimal128 values exact and requires a visible public price", async () => {
    const Version = getProductVersionModel();
    const valid = new Version({
      productId: ownerId,
      version: 1,
      status: "draft",
      showPrice: true,
      publicPrice: { amount: "1234567890.125", currency: "USD" },
      createdBy: actorId,
      updatedBy: actorId,
    });
    await expect(valid.validate()).resolves.toBeUndefined();
    expect(valid.publicPrice?.amount.toString()).toBe("1234567890.125");

    const missingPrice = new Version({
      productId: ownerId,
      version: 2,
      status: "draft",
      showPrice: true,
      createdBy: actorId,
      updatedBy: actorId,
    });
    await expect(missingPrice.validate()).rejects.toHaveProperty(
      "errors.publicPrice",
    );
  });

  it("sanitizes collection landing HTML and rejects duplicate locale pointers", async () => {
    const Translation = getCollectionTranslationModel();
    const translation = new Translation({
      collectionId: ownerId,
      version: 1,
      locale: "vi",
      slug: "bo-suu-tap-demo",
      title: "Bộ sưu tập DEMO",
      landingHtml: '<p onclick="bad()">Nội dung</p><script>bad()</script>',
      translationStatus: "draft",
      sourceRevision: 1,
      seo: { noIndex: true },
      createdBy: actorId,
      updatedBy: actorId,
    });
    await expect(translation.validate()).resolves.toBeUndefined();
    expect(translation.landingHtml).not.toMatch(/script|onclick/i);

    const Collection = getCollectionModel();
    const duplicatePointers = new Collection({
      code: "demo-collection",
      displayOrder: 0,
      status: "draft",
      currentDraftTranslations: [
        { locale: "vi", translationId: new Types.ObjectId() },
        { locale: "vi", translationId: new Types.ObjectId() },
      ],
      createdBy: actorId,
      updatedBy: actorId,
    });
    await expect(duplicatePointers.validate()).rejects.toHaveProperty(
      "errors.currentDraftTranslations",
    );
  });
});
