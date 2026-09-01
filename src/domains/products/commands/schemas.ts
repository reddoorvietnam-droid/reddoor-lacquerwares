import { z } from "zod";

import {
  localeSchema,
  localizedPathSchema,
  objectIdStringSchema,
  productGroupSchema,
  productStatusSchema,
  seoFieldsSchema,
  slugSchema,
  structuredBlocksSchema,
} from "@/lib/content/contracts";
import { findProductCategory } from "@/domains/products/categories";
import { locales } from "@/lib/i18n/config";

const optimisticRevisionSchema = z.number().int().min(0);
const optionalObjectIdSchema = objectIdStringSchema.nullish();
const nonNegativeDecimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);

function uniqueStrings(
  values: readonly string[],
  context: z.RefinementCtx,
): void {
  if (new Set(values).size !== values.length) {
    context.addIssue({
      code: "custom",
      message: "Values must be unique.",
    });
  }
}

const uniqueObjectIdsSchema = z
  .array(objectIdStringSchema)
  .max(250)
  .superRefine(uniqueStrings);
const uniqueKeysSchema = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  )
  .max(100)
  .superRefine(uniqueStrings);
const uniqueLabelsSchema = z
  .array(z.string().trim().min(1).max(200))
  .max(100)
  .superRefine(uniqueStrings);

const blockListSchema = structuredBlocksSchema.superRefine(
  (blocks, context) => {
    const ids = blocks.map(({ blockId }) => blockId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Block identifiers must be unique within a block list.",
      });
    }
  },
);

export const productMetadataSchema = z
  .object({
    internalId: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(80)
      .regex(/^[A-Z0-9]+(?:[-_.][A-Z0-9]+)*$/),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(80)
      .regex(/^[A-Z0-9]+(?:[-_.][A-Z0-9]+)*$/),
    categoryId: optionalObjectIdSchema,
    group: productGroupSchema.default("processing"),
    isAvailable: z.boolean().default(false),
    categoryKey: z
      .string()
      .trim()
      .toLowerCase()
      .max(80)
      .refine((value) => value === "" || findProductCategory(value) !== null, {
        message: "Unknown product category.",
      })
      .default(""),
    collectionIds: uniqueObjectIdsSchema.default([]),
    materialKeys: uniqueKeysSchema.default([]),
    finishKeys: uniqueKeysSchema.default([]),
    searchTokens: z
      .array(z.string().trim().toLowerCase().min(1).max(120))
      .max(250)
      .superRefine(uniqueStrings)
      .default([]),
  })
  .strict();

const dimensionsSchema = z
  .object({
    length: nonNegativeDecimalSchema.nullish(),
    width: nonNegativeDecimalSchema.nullish(),
    height: nonNegativeDecimalSchema.nullish(),
    unit: z.enum(["mm", "cm", "m", "in"]),
  })
  .strict();

const weightSchema = z
  .object({
    value: nonNegativeDecimalSchema,
    unit: z.enum(["g", "kg", "lb"]),
  })
  .strict();

const publicPriceSchema = z
  .object({
    amount: nonNegativeDecimalSchema,
    currency: z.enum(["VND", "USD", "EUR"]),
  })
  .strict();

export const productVersionDraftSchema = z
  .object({
    dimensions: dimensionsSchema.nullish(),
    weight: weightSchema.nullish(),
    materials: uniqueLabelsSchema.default([]),
    colors: uniqueLabelsSchema.default([]),
    finishes: uniqueLabelsSchema.default([]),
    leadTimeDays: z.number().int().min(0).max(3_650).nullish(),
    mediaIds: uniqueObjectIdsSchema.default([]),
    showPrice: z.boolean().default(false),
    publicPrice: publicPriceSchema.nullish(),
    relatedProductIds: uniqueObjectIdsSchema.default([]),
    bomVersionId: optionalObjectIdSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.showPrice && !value.publicPrice) {
      context.addIssue({
        code: "custom",
        message: "A public price is required when showPrice is enabled.",
        path: ["publicPrice"],
      });
    }
    if (!value.showPrice && value.publicPrice) {
      context.addIssue({
        code: "custom",
        message: "A hidden price must not be persisted as publicPrice.",
        path: ["publicPrice"],
      });
    }
  });

export const productDraftTranslationSchema = z
  .object({
    locale: localeSchema,
    slug: slugSchema,
    title: z.string().trim().min(1).max(300),
    shortDescription: z.string().trim().min(1).max(500).nullish(),
    description: blockListSchema.default([]),
    story: blockListSchema.default([]),
    careInstructions: blockListSchema.default([]),
    seo: seoFieldsSchema.default({ noIndex: false }),
  })
  .strict();

function validateTranslations(
  value: { translations: ReadonlyArray<{ locale: string }> },
  context: z.RefinementCtx,
): void {
  const localeValues = value.translations.map(({ locale }) => locale);
  if (new Set(localeValues).size !== localeValues.length) {
    context.addIssue({
      code: "custom",
      message: "A version can contain only one translation per locale.",
      path: ["translations"],
    });
  }
}

export const createProductDraftInputSchema = z
  .object({
    metadata: productMetadataSchema,
    version: productVersionDraftSchema,
    translations: z
      .array(productDraftTranslationSchema)
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine(validateTranslations);

export const createProductRevisionDraftInputSchema = z
  .object({
    productId: objectIdStringSchema,
    expectedProductRevision: optimisticRevisionSchema,
    version: productVersionDraftSchema,
    translations: z
      .array(productDraftTranslationSchema)
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine(validateTranslations);

const updateProductTranslationSchema = productDraftTranslationSchema.extend({
  expectedRevision: optimisticRevisionSchema.optional(),
});

export const updateProductDraftInputSchema = z
  .object({
    productId: objectIdStringSchema,
    expectedProductRevision: optimisticRevisionSchema,
    versionId: objectIdStringSchema,
    expectedVersionRevision: optimisticRevisionSchema,
    metadata: productMetadataSchema,
    version: productVersionDraftSchema,
    translations: z
      .array(updateProductTranslationSchema)
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine(validateTranslations);

export const expectedProductTranslationRevisionSchema = z
  .object({
    locale: localeSchema,
    expectedRevision: optimisticRevisionSchema,
  })
  .strict();

const workflowFields = {
  productId: objectIdStringSchema,
  expectedProductRevision: optimisticRevisionSchema,
  versionId: objectIdStringSchema,
  expectedVersionRevision: optimisticRevisionSchema,
  expectedTranslations: z
    .array(expectedProductTranslationRevisionSchema)
    .min(1)
    .max(locales.length),
} as const;

function validateExpectedTranslations(
  value: { expectedTranslations: ReadonlyArray<{ locale: string }> },
  context: z.RefinementCtx,
): void {
  const localeValues = value.expectedTranslations.map(({ locale }) => locale);
  if (new Set(localeValues).size !== localeValues.length) {
    context.addIssue({
      code: "custom",
      message: "Expected translation revisions must use unique locales.",
      path: ["expectedTranslations"],
    });
  }
}

export const submitProductForReviewInputSchema = z
  .object(workflowFields)
  .strict()
  .superRefine(validateExpectedTranslations);

export const returnProductToDraftInputSchema = z
  .object({
    ...workflowFields,
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict()
  .superRefine(validateExpectedTranslations);

export const productPublishRouteSchema = z
  .object({ locale: localeSchema, path: localizedPathSchema })
  .strict();

export const publishProductInputSchema = z
  .object({
    ...workflowFields,
    routes: z.array(productPublishRouteSchema).min(1).max(locales.length),
  })
  .strict()
  .superRefine((value, context) => {
    validateExpectedTranslations(value, context);
    const routeLocales = value.routes.map(({ locale }) => locale);
    if (new Set(routeLocales).size !== routeLocales.length) {
      context.addIssue({
        code: "custom",
        message: "Publish routes must use unique locales.",
        path: ["routes"],
      });
    }
  });

export const listProductsInputSchema = z
  .object({
    query: z.string().trim().max(120).optional(),
    status: productStatusSchema.optional(),
    offset: z.number().int().min(0).max(10_000).default(0),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict()
  .default({ offset: 0, limit: 50 });

export const readProductInputSchema = z
  .object({ productId: objectIdStringSchema })
  .strict();

export type ProductMetadataInput = z.output<typeof productMetadataSchema>;
export type ProductVersionDraftInput = z.output<
  typeof productVersionDraftSchema
>;
export type ProductDraftTranslationInput = z.output<
  typeof productDraftTranslationSchema
>;
export type CreateProductDraftInput = z.output<
  typeof createProductDraftInputSchema
>;
export type CreateProductRevisionDraftInput = z.output<
  typeof createProductRevisionDraftInputSchema
>;
export type UpdateProductDraftInput = z.output<
  typeof updateProductDraftInputSchema
>;
export type SubmitProductForReviewInput = z.output<
  typeof submitProductForReviewInputSchema
>;
export type ReturnProductToDraftInput = z.output<
  typeof returnProductToDraftInputSchema
>;
export type PublishProductInput = z.output<typeof publishProductInputSchema>;
export type ListProductsInput = z.output<typeof listProductsInputSchema>;
