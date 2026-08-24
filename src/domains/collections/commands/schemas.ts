import { z } from "zod";

import {
  localeSchema,
  localizedPathSchema,
  objectIdStringSchema,
  revisionWorkflowStatusSchema,
  seoFieldsSchema,
  slugSchema,
} from "@/lib/content/contracts";
import { locales } from "@/lib/i18n/config";

const optimisticRevisionSchema = z.number().int().min(0);

function uniqueLocales(
  values: ReadonlyArray<{ locale: string }>,
  context: z.RefinementCtx,
) {
  if (new Set(values.map(({ locale }) => locale)).size !== values.length) {
    context.addIssue({
      code: "custom",
      message: "Collection translations must use unique locales.",
      path: ["translations"],
    });
  }
}

export const collectionMetadataSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    year: z.number().int().min(1_000).max(9_999).nullish(),
    displayOrder: z.number().int().min(0).max(1_000_000).default(0),
  })
  .strict();

export const collectionDraftTranslationSchema = z
  .object({
    locale: localeSchema,
    slug: slugSchema,
    title: z.string().trim().min(1).max(300),
    summary: z.string().trim().min(1).max(1_000).nullish(),
    landingHtml: z.string().trim().min(1).max(50_000),
    seo: seoFieldsSchema.default({ noIndex: false }),
  })
  .strict();

export const createCollectionDraftInputSchema = z
  .object({
    metadata: collectionMetadataSchema,
    translations: z
      .array(collectionDraftTranslationSchema)
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine((value, context) => uniqueLocales(value.translations, context));

export const createCollectionRevisionDraftInputSchema = z
  .object({
    collectionId: objectIdStringSchema,
    expectedCollectionRevision: optimisticRevisionSchema,
    translations: z
      .array(collectionDraftTranslationSchema)
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine((value, context) => uniqueLocales(value.translations, context));

export const updateCollectionDraftTranslationSchema =
  collectionDraftTranslationSchema.extend({
    translationId: objectIdStringSchema,
    expectedRevision: optimisticRevisionSchema,
  });

export const updateCollectionDraftInputSchema = z
  .object({
    collectionId: objectIdStringSchema,
    expectedCollectionRevision: optimisticRevisionSchema,
    metadata: collectionMetadataSchema,
    translations: z
      .array(updateCollectionDraftTranslationSchema)
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine((value, context) => uniqueLocales(value.translations, context));

export const expectedCollectionTranslationRevisionSchema = z
  .object({
    translationId: objectIdStringSchema,
    locale: localeSchema,
    expectedRevision: optimisticRevisionSchema,
  })
  .strict();

const workflowFields = {
  collectionId: objectIdStringSchema,
  expectedCollectionRevision: optimisticRevisionSchema,
  expectedTranslations: z
    .array(expectedCollectionTranslationRevisionSchema)
    .min(1)
    .max(locales.length),
} as const;

function validateExpected(
  value: { expectedTranslations: ReadonlyArray<{ locale: string }> },
  context: z.RefinementCtx,
) {
  uniqueLocales(value.expectedTranslations, context);
}

export const submitCollectionForReviewInputSchema = z
  .object(workflowFields)
  .strict()
  .superRefine(validateExpected);

export const returnCollectionToDraftInputSchema = z
  .object({
    ...workflowFields,
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict()
  .superRefine(validateExpected);

export const publishCollectionInputSchema = z
  .object({
    ...workflowFields,
    routes: z
      .array(
        z.object({ locale: localeSchema, path: localizedPathSchema }).strict(),
      )
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine((value, context) => {
    validateExpected(value, context);
    uniqueLocales(value.routes, context);
  });

export const listCollectionsInputSchema = z
  .object({
    query: z.string().trim().max(120).optional(),
    status: revisionWorkflowStatusSchema.optional(),
    offset: z.number().int().min(0).max(10_000).default(0),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict()
  .default({ offset: 0, limit: 50 });

export const readCollectionInputSchema = z
  .object({ collectionId: objectIdStringSchema })
  .strict();

export type CollectionMetadataInput = z.output<typeof collectionMetadataSchema>;
export type CollectionDraftTranslationInput = z.output<
  typeof collectionDraftTranslationSchema
>;
export type CreateCollectionDraftInput = z.output<
  typeof createCollectionDraftInputSchema
>;
export type CreateCollectionRevisionDraftInput = z.output<
  typeof createCollectionRevisionDraftInputSchema
>;
export type UpdateCollectionDraftInput = z.output<
  typeof updateCollectionDraftInputSchema
>;
export type SubmitCollectionForReviewInput = z.output<
  typeof submitCollectionForReviewInputSchema
>;
export type ReturnCollectionToDraftInput = z.output<
  typeof returnCollectionToDraftInputSchema
>;
export type PublishCollectionInput = z.output<
  typeof publishCollectionInputSchema
>;
export type ListCollectionsInput = z.output<typeof listCollectionsInputSchema>;
