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
const contentVersionSchema = z.number().int().min(1);

const blockListSchema = structuredBlocksSchema.superRefine(
  (blocks, context) => {
    const seen = new Set<string>();

    blocks.forEach((block, index) => {
      if (seen.has(block.blockId)) {
        context.addIssue({
          code: "custom",
          message: "Block identifiers must be unique within a block list.",
          path: [index, "blockId"],
        });
      }

      seen.add(block.blockId);
    });
  },
);

const draftTranslationFields = {
  locale: localeSchema,
  slug: slugSchema.optional(),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(1).max(1_000).optional(),
  blocks: blockListSchema.default([]),
  seo: seoFieldsSchema.default({ noIndex: false }),
} as const;

export const contentDraftTranslationSchema = z
  .object(draftTranslationFields)
  .strict();

const draftPayloadFields = {
  sourceLocale: localeSchema,
  blocks: blockListSchema.default([]),
  translations: z
    .array(contentDraftTranslationSchema)
    .min(1)
    .max(locales.length),
} as const;

function validateDraftLocales(
  value: {
    sourceLocale: string;
    translations: ReadonlyArray<{ locale: string }>;
  },
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();

  value.translations.forEach((translation, index) => {
    if (seen.has(translation.locale)) {
      context.addIssue({
        code: "custom",
        message: "A draft can contain only one translation per locale.",
        path: ["translations", index, "locale"],
      });
    }

    seen.add(translation.locale);
  });

  if (!seen.has(value.sourceLocale)) {
    context.addIssue({
      code: "custom",
      message: "The source locale must have a draft translation.",
      path: ["sourceLocale"],
    });
  }
}

export const createEntryDraftInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type: z.enum(["page", "section", "processStage", "global"]),
    placement: z.string().trim().min(1).max(160),
    ...draftPayloadFields,
  })
  .strict()
  .superRefine(validateDraftLocales);

export const createRevisionDraftInputSchema = z
  .object({
    entryId: objectIdStringSchema,
    expectedEntryRevision: optimisticRevisionSchema,
    ...draftPayloadFields,
  })
  .strict()
  .superRefine(validateDraftLocales);

export const updateDraftTranslationSchema = z
  .object({
    ...draftTranslationFields,
    expectedRevision: optimisticRevisionSchema.optional(),
  })
  .strict();

export const updateDraftInputSchema = z
  .object({
    entryId: objectIdStringSchema,
    expectedEntryRevision: optimisticRevisionSchema,
    revisionId: objectIdStringSchema,
    expectedRevision: optimisticRevisionSchema,
    placement: z.string().trim().min(1).max(160),
    sourceLocale: localeSchema,
    blocks: blockListSchema.default([]),
    translations: z
      .array(updateDraftTranslationSchema)
      .min(1)
      .max(locales.length),
  })
  .strict()
  .superRefine(validateDraftLocales);

export const expectedTranslationRevisionSchema = z
  .object({
    locale: localeSchema,
    expectedRevision: optimisticRevisionSchema,
  })
  .strict();

const workflowTargetFields = {
  entryId: objectIdStringSchema,
  expectedEntryRevision: optimisticRevisionSchema,
  revisionId: objectIdStringSchema,
  expectedRevision: optimisticRevisionSchema,
  expectedTranslations: z
    .array(expectedTranslationRevisionSchema)
    .min(1)
    .max(locales.length),
} as const;

function validateExpectedTranslationLocales(
  value: { expectedTranslations: ReadonlyArray<{ locale: string }> },
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();

  value.expectedTranslations.forEach((translation, index) => {
    if (seen.has(translation.locale)) {
      context.addIssue({
        code: "custom",
        message: "Expected translation revisions must use unique locales.",
        path: ["expectedTranslations", index, "locale"],
      });
    }

    seen.add(translation.locale);
  });
}

export const submitForReviewInputSchema = z
  .object(workflowTargetFields)
  .strict()
  .superRefine(validateExpectedTranslationLocales);

export const returnToDraftInputSchema = z
  .object({
    ...workflowTargetFields,
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict()
  .superRefine(validateExpectedTranslationLocales);

export const publishRouteSchema = z
  .object({
    locale: localeSchema,
    path: localizedPathSchema,
  })
  .strict();

export const publishContentInputSchema = z
  .object({
    ...workflowTargetFields,
    routes: z.array(publishRouteSchema).max(locales.length).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    validateExpectedTranslationLocales(value, context);
    const seen = new Set<string>();

    value.routes.forEach((route, index) => {
      if (seen.has(route.locale)) {
        context.addIssue({
          code: "custom",
          message: "Publish routes must use unique locales.",
          path: ["routes", index, "locale"],
        });
      }

      seen.add(route.locale);
    });
  });

export const listContentEntriesInputSchema = z
  .object({
    query: z.string().trim().max(120).optional(),
    status: revisionWorkflowStatusSchema.optional(),
    offset: z.number().int().min(0).max(10_000).default(0),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict()
  .default({ offset: 0, limit: 50 });

export const readContentEntryInputSchema = z
  .object({ entryId: objectIdStringSchema })
  .strict();

export const contentRevisionVersionSchema = contentVersionSchema;

export type CreateEntryDraftInput = z.output<
  typeof createEntryDraftInputSchema
>;
export type CreateRevisionDraftInput = z.output<
  typeof createRevisionDraftInputSchema
>;
export type UpdateDraftInput = z.output<typeof updateDraftInputSchema>;
export type SubmitForReviewInput = z.output<typeof submitForReviewInputSchema>;
export type ReturnToDraftInput = z.output<typeof returnToDraftInputSchema>;
export type PublishContentInput = z.output<typeof publishContentInputSchema>;
export type ListContentEntriesInput = z.output<
  typeof listContentEntriesInputSchema
>;
export type ReadContentEntryInput = z.output<
  typeof readContentEntryInputSchema
>;
