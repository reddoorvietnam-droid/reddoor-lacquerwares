import { z } from "zod";

import {
  localeSchema,
  localizedPathSchema,
  objectIdStringSchema,
  revisionWorkflowStatusSchema,
  seoFieldsSchema,
  slugSchema,
  structuredBlocksSchema,
} from "@/lib/content/contracts";
import { locales } from "@/lib/i18n/config";

const optimisticRevisionSchema = z.number().int().min(0);
const optionalObjectIdSchema = objectIdStringSchema.nullish();

function uniqueStrings(values: readonly string[], context: z.RefinementCtx) {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: "custom", message: "Values must be unique." });
  }
}

const blockListSchema = structuredBlocksSchema.superRefine((blocks, context) =>
  uniqueStrings(
    blocks.map(({ blockId }) => blockId),
    context,
  ),
);

export const articleMetadataSchema = z
  .object({
    internalId: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(80)
      .regex(/^[A-Z0-9]+(?:[-_.][A-Z0-9]+)*$/),
    categoryId: optionalObjectIdSchema,
    tagKeys: z
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
      .superRefine(uniqueStrings)
      .default([]),
    authorId: optionalObjectIdSchema,
    authorLabel: z.string().trim().min(1).max(200).nullish(),
  })
  .strict();

export const articleRevisionDraftSchema = z
  .object({
    sourceLocale: localeSchema,
    sourceBlocks: blockListSchema.default([]),
    coverMediaId: optionalObjectIdSchema,
  })
  .strict();

export const articleDraftTranslationSchema = z
  .object({
    locale: localeSchema,
    slug: slugSchema,
    title: z.string().trim().min(1).max(300),
    summary: z.string().trim().min(1).max(1_000),
    body: blockListSchema.default([]),
    seo: seoFieldsSchema.default({ noIndex: false }),
  })
  .strict();

function validateTranslations(
  value: {
    revision: { sourceLocale: string };
    translations: ReadonlyArray<{ locale: string }>;
  },
  context: z.RefinementCtx,
): void {
  const values = value.translations.map(({ locale }) => locale);
  if (new Set(values).size !== values.length) {
    context.addIssue({
      code: "custom",
      message:
        "An article revision can contain only one translation per locale.",
      path: ["translations"],
    });
  }
  if (!values.includes(value.revision.sourceLocale)) {
    context.addIssue({
      code: "custom",
      message: "The source locale must have an article translation.",
      path: ["revision", "sourceLocale"],
    });
  }
}

export const createArticleDraftInputSchema = z
  .object({
    metadata: articleMetadataSchema,
    revision: articleRevisionDraftSchema,
    translations: z
      .array(articleDraftTranslationSchema)
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine(validateTranslations);

export const createArticleRevisionDraftInputSchema = z
  .object({
    articleId: objectIdStringSchema,
    expectedArticleRevision: optimisticRevisionSchema,
    revision: articleRevisionDraftSchema,
    translations: z
      .array(articleDraftTranslationSchema)
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine(validateTranslations);

const updateArticleTranslationSchema = articleDraftTranslationSchema.extend({
  expectedRevision: optimisticRevisionSchema.optional(),
});

export const updateArticleDraftInputSchema = z
  .object({
    articleId: objectIdStringSchema,
    expectedArticleRevision: optimisticRevisionSchema,
    revisionId: objectIdStringSchema,
    expectedRevision: optimisticRevisionSchema,
    metadata: articleMetadataSchema,
    revision: articleRevisionDraftSchema,
    translations: z
      .array(updateArticleTranslationSchema)
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine(validateTranslations);

export const expectedArticleTranslationRevisionSchema = z
  .object({
    locale: localeSchema,
    expectedRevision: optimisticRevisionSchema,
  })
  .strict();

const workflowFields = {
  articleId: objectIdStringSchema,
  expectedArticleRevision: optimisticRevisionSchema,
  revisionId: objectIdStringSchema,
  expectedRevision: optimisticRevisionSchema,
  expectedTranslations: z
    .array(expectedArticleTranslationRevisionSchema)
    .min(1)
    .max(locales.length),
} as const;

function validateExpectedTranslations(
  value: { expectedTranslations: ReadonlyArray<{ locale: string }> },
  context: z.RefinementCtx,
): void {
  uniqueStrings(
    value.expectedTranslations.map(({ locale }) => locale),
    context,
  );
}

export const submitArticleForReviewInputSchema = z
  .object(workflowFields)
  .strict()
  .superRefine(validateExpectedTranslations);

export const returnArticleToDraftInputSchema = z
  .object({
    ...workflowFields,
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict()
  .superRefine(validateExpectedTranslations);

export const articlePublishRouteSchema = z
  .object({ locale: localeSchema, path: localizedPathSchema })
  .strict();

export const publishArticleInputSchema = z
  .object({
    ...workflowFields,
    routes: z.array(articlePublishRouteSchema).min(1).max(locales.length),
  })
  .strict()
  .superRefine((value, context) => {
    validateExpectedTranslations(value, context);
    uniqueStrings(
      value.routes.map(({ locale }) => locale),
      context,
    );
  });

export const listArticlesInputSchema = z
  .object({
    query: z.string().trim().max(120).optional(),
    status: revisionWorkflowStatusSchema.optional(),
    offset: z.number().int().min(0).max(10_000).default(0),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict()
  .default({ offset: 0, limit: 50 });

export const readArticleInputSchema = z
  .object({ articleId: objectIdStringSchema })
  .strict();

export type ArticleMetadataInput = z.output<typeof articleMetadataSchema>;
export type ArticleRevisionDraftInput = z.output<
  typeof articleRevisionDraftSchema
>;
export type ArticleDraftTranslationInput = z.output<
  typeof articleDraftTranslationSchema
>;
export type CreateArticleDraftInput = z.output<
  typeof createArticleDraftInputSchema
>;
export type CreateArticleRevisionDraftInput = z.output<
  typeof createArticleRevisionDraftInputSchema
>;
export type UpdateArticleDraftInput = z.output<
  typeof updateArticleDraftInputSchema
>;
export type SubmitArticleForReviewInput = z.output<
  typeof submitArticleForReviewInputSchema
>;
export type ReturnArticleToDraftInput = z.output<
  typeof returnArticleToDraftInputSchema
>;
export type PublishArticleInput = z.output<typeof publishArticleInputSchema>;
export type ListArticlesInput = z.output<typeof listArticlesInputSchema>;
