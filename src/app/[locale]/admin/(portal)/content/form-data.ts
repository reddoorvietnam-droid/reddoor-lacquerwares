import "server-only";

import { z } from "zod";

import type {
  CreateEntryDraftInput,
  UpdateDraftInput,
} from "@/domains/content/commands";
import {
  localeSchema,
  objectIdStringSchema,
  type SeoFields,
  type StructuredBlock,
} from "@/lib/content/contracts";
import { locales, type Locale } from "@/lib/i18n/config";

const contentTypeSchema = z.enum(["page", "section", "processStage", "global"]);

const optionalObjectIdFormSchema = z.union([
  z.literal(""),
  objectIdStringSchema,
]);

const translationFormSchema = z
  .object({
    locale: localeSchema,
    translationId: optionalObjectIdFormSchema,
    expectedRevision: z.coerce.number().int().min(0),
    title: z.string().trim().max(300),
    slug: z.string().trim().max(160),
    summary: z.string().trim().max(1_000),
    body: z.string().trim().max(50_000),
    seoTitle: z.string().trim().max(70),
    seoDescription: z.string().trim().max(180),
    noIndex: z.boolean(),
  })
  .strict()
  .superRefine((translation, context) => {
    const hasLocalizedContent = Boolean(
      translation.slug ||
      translation.summary ||
      translation.body ||
      translation.seoTitle ||
      translation.seoDescription,
    );

    if (hasLocalizedContent && !translation.title) {
      context.addIssue({
        code: "custom",
        path: ["title"],
        message: "A title is required when localized content is present.",
      });
    }
  });

const editorFormSchema = z
  .object({
    entryId: optionalObjectIdFormSchema,
    revisionId: optionalObjectIdFormSchema,
    expectedEntryRevision: z.coerce.number().int().min(0),
    expectedRevision: z.coerce.number().int().min(0),
    code: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type: contentTypeSchema,
    placement: z.string().trim().min(1).max(160),
    sourceLocale: localeSchema,
    translations: z.array(translationFormSchema).length(locales.length),
  })
  .strict()
  .superRefine((value, context) => {
    const editing = Boolean(value.entryId || value.revisionId);
    if (editing && (!value.entryId || !value.revisionId)) {
      context.addIssue({
        code: "custom",
        path: ["entryId"],
        message: "Entry and revision identifiers must be supplied together.",
      });
    }

    const persistedLocales = value.translations
      .filter((translation) => translation.title)
      .map((translation) => translation.locale);
    if (!persistedLocales.includes(value.sourceLocale)) {
      context.addIssue({
        code: "custom",
        path: ["sourceLocale"],
        message: "The source language must contain a titled translation.",
      });
    }
  });

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function paragraphBlocks(body: string, locale: Locale): StructuredBlock[] {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => ({
      blockId: `${locale}-paragraph-${index + 1}`,
      type: "paragraph" as const,
      text: paragraph,
    }));
}

function seoFields(input: {
  seoTitle: string;
  seoDescription: string;
  noIndex: boolean;
}): SeoFields {
  return {
    ...(input.seoTitle ? { title: input.seoTitle } : {}),
    ...(input.seoDescription ? { description: input.seoDescription } : {}),
    noIndex: input.noIndex,
  };
}

function rawTranslation(formData: FormData, index: number) {
  const prefix = `translations.${index}`;
  return {
    locale: text(formData, `${prefix}.locale`),
    translationId: text(formData, `${prefix}.translationId`),
    expectedRevision: text(formData, `${prefix}.expectedRevision`),
    title: text(formData, `${prefix}.title`),
    slug: text(formData, `${prefix}.slug`),
    summary: text(formData, `${prefix}.summary`),
    body: text(formData, `${prefix}.body`),
    seoTitle: text(formData, `${prefix}.seoTitle`),
    seoDescription: text(formData, `${prefix}.seoDescription`),
    noIndex: formData.has(`${prefix}.noIndex`),
  };
}

export type ParsedContentEditorCommand =
  | { mode: "create"; input: CreateEntryDraftInput }
  | { mode: "update"; input: UpdateDraftInput };

/** Reads only known form keys before the domain schemas validate them again. */
export function parseContentEditorFormData(
  formData: FormData,
): ParsedContentEditorCommand {
  const parsed = editorFormSchema.parse({
    entryId: text(formData, "entryId"),
    revisionId: text(formData, "revisionId"),
    expectedEntryRevision: text(formData, "expectedEntryRevision"),
    expectedRevision: text(formData, "expectedRevision"),
    code: text(formData, "code"),
    type: text(formData, "type"),
    placement: text(formData, "placement"),
    sourceLocale: text(formData, "sourceLocale"),
    translations: locales.map((_, index) => rawTranslation(formData, index)),
  });

  const translations = parsed.translations
    .filter((translation) => translation.title)
    .map((translation) => ({
      locale: translation.locale,
      ...(translation.slug ? { slug: translation.slug } : {}),
      title: translation.title,
      ...(translation.summary ? { summary: translation.summary } : {}),
      blocks: paragraphBlocks(translation.body, translation.locale),
      seo: seoFields(translation),
      ...(translation.translationId
        ? { expectedRevision: translation.expectedRevision }
        : {}),
    }));
  const sourceBlocks =
    translations.find(({ locale }) => locale === parsed.sourceLocale)?.blocks ??
    [];

  if (!parsed.entryId || !parsed.revisionId) {
    return {
      mode: "create",
      input: {
        code: parsed.code,
        type: parsed.type,
        placement: parsed.placement,
        sourceLocale: parsed.sourceLocale,
        blocks: sourceBlocks,
        translations: translations.map((translation) => ({
          locale: translation.locale,
          ...(translation.slug ? { slug: translation.slug } : {}),
          title: translation.title,
          ...(translation.summary ? { summary: translation.summary } : {}),
          blocks: translation.blocks,
          seo: translation.seo,
        })),
      },
    };
  }

  return {
    mode: "update",
    input: {
      entryId: parsed.entryId,
      expectedEntryRevision: parsed.expectedEntryRevision,
      revisionId: parsed.revisionId,
      expectedRevision: parsed.expectedRevision,
      placement: parsed.placement,
      sourceLocale: parsed.sourceLocale,
      blocks: sourceBlocks,
      translations,
    },
  };
}
