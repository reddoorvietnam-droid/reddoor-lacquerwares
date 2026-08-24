import { z } from "zod";

import { locales } from "@/lib/i18n/config";

const localeValues = locales as [
  (typeof locales)[number],
  ...(typeof locales)[number][],
];

export const localeSchema = z.enum(localeValues);

export const objectIdStringSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, "Expected a MongoDB ObjectId string");

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(
    /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u,
    "Slug must contain words separated by single hyphens",
  );

export const localizedPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("?") &&
      !value.includes("#") &&
      !value.includes("\\"),
    "Path must be an absolute application path without a query or fragment",
  );

const publicUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => {
    if (value.startsWith("/")) {
      return !value.startsWith("//");
    }

    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Expected a relative path or HTTPS URL");

export const seoFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(70).optional(),
    description: z.string().trim().min(1).max(180).optional(),
    canonicalOverride: publicUrlSchema.optional(),
    imageMediaId: objectIdStringSchema.optional(),
    noIndex: z.boolean().default(false),
  })
  .strict();

const blockIdSchema = z.string().trim().min(1).max(80);
const plainTextSchema = z.string().trim().min(1).max(20_000);

export const headingBlockSchema = z
  .object({
    blockId: blockIdSchema,
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    text: z.string().trim().min(1).max(300),
  })
  .strict();

export const paragraphBlockSchema = z
  .object({
    blockId: blockIdSchema,
    type: z.literal("paragraph"),
    text: plainTextSchema,
  })
  .strict();

export const richTextBlockSchema = z
  .object({
    blockId: blockIdSchema,
    type: z.literal("richText"),
    html: z.string().trim().min(1).max(50_000),
  })
  .strict();

export const imageBlockSchema = z
  .object({
    blockId: blockIdSchema,
    type: z.literal("image"),
    mediaId: objectIdStringSchema,
    alt: z.string().trim().min(1).max(300),
    caption: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const quoteBlockSchema = z
  .object({
    blockId: blockIdSchema,
    type: z.literal("quote"),
    text: z.string().trim().min(1).max(2_000),
    attribution: z.string().trim().min(1).max(300).optional(),
  })
  .strict();

export const listBlockSchema = z
  .object({
    blockId: blockIdSchema,
    type: z.literal("list"),
    style: z.enum(["ordered", "unordered"]),
    items: z.array(z.string().trim().min(1).max(1_000)).min(1).max(50),
  })
  .strict();

export const callToActionBlockSchema = z
  .object({
    blockId: blockIdSchema,
    type: z.literal("callToAction"),
    label: z.string().trim().min(1).max(120),
    href: publicUrlSchema,
  })
  .strict();

export const structuredBlockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  paragraphBlockSchema,
  richTextBlockSchema,
  imageBlockSchema,
  quoteBlockSchema,
  listBlockSchema,
  callToActionBlockSchema,
]);

export const structuredBlocksSchema = z.array(structuredBlockSchema).max(250);

export const translationStatusSchema = z.enum([
  "draft",
  "inReview",
  "published",
  "needsUpdate",
]);

export const revisionWorkflowStatusSchema = z.enum([
  "draft",
  "inReview",
  "published",
  "archived",
]);

export const stableContentStatusSchema = z.enum([
  "draft",
  "inReview",
  "published",
  "archived",
]);

export const productStatusSchema = z.enum([
  "draft",
  "inReview",
  "published",
  "discontinued",
  "archived",
]);

export type SeoFieldsInput = z.input<typeof seoFieldsSchema>;
export type SeoFields = z.output<typeof seoFieldsSchema>;
export type StructuredBlock = z.infer<typeof structuredBlockSchema>;
export type TranslationStatus = z.infer<typeof translationStatusSchema>;
export type RevisionWorkflowStatus = z.infer<
  typeof revisionWorkflowStatusSchema
>;
export type StableContentStatus = z.infer<typeof stableContentStatusSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
