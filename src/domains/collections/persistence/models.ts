import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import {
  actorFields,
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
  seoFieldsMongooseSchema,
} from "@/lib/content/mongoose";
import { sanitizeRichTextHtml } from "@/lib/content/sanitize";
import { locales } from "@/lib/i18n/config";

const workflowStatuses = ["draft", "inReview", "published", "archived"];
const translationStatuses = ["draft", "inReview", "published", "needsUpdate"];

const translationPointerSchema = new Schema(
  {
    locale: { type: String, required: true, enum: locales },
    translationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "CollectionTranslation",
    },
  },
  nestedSchemaOptions,
);

function hasUniqueLocales(values: { locale: string }[]): boolean {
  return new Set(values.map(({ locale }) => locale)).size === values.length;
}

export const collectionSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    year: { type: Number, min: 1_000, max: 9_999 },
    displayOrder: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, required: true, enum: workflowStatuses },
    currentDraftTranslations: {
      type: [translationPointerSchema],
      required: true,
      default: [],
      validate: {
        validator: hasUniqueLocales,
        message: "Only one draft translation pointer is allowed per locale",
      },
    },
    currentPublishedTranslations: {
      type: [translationPointerSchema],
      required: true,
      default: [],
      validate: {
        validator: hasUniqueLocales,
        message: "Only one published translation pointer is allowed per locale",
      },
    },
    deletedAt: { type: Date },
    ...actorFields,
  },
  rootSchemaOptions,
);

collectionSchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
    name: "collection_code_unique_active",
  },
);
collectionSchema.index(
  { year: -1, displayOrder: 1 },
  { name: "collection_display_order" },
);
collectionSchema.index(
  { status: 1, displayOrder: 1 },
  { name: "collection_public_listing" },
);

export const collectionTranslationSchema = new Schema(
  {
    collectionId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "Collection",
    },
    version: { type: Number, required: true, min: 1, immutable: true },
    locale: { type: String, required: true, enum: locales, immutable: true },
    slug: { type: String, required: true, trim: true, maxlength: 160 },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    summary: { type: String, trim: true, maxlength: 1_000 },
    landingHtml: {
      type: String,
      required: true,
      maxlength: 50_000,
      set: (value: unknown) =>
        typeof value === "string" ? sanitizeRichTextHtml(value) : value,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: "Landing content cannot be empty after sanitization",
      },
    },
    translationStatus: {
      type: String,
      required: true,
      enum: translationStatuses,
    },
    sourceRevision: { type: Number, required: true, min: 1 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date },
    seo: { type: seoFieldsMongooseSchema, required: true, default: () => ({}) },
    ...actorFields,
  },
  rootSchemaOptions,
);

collectionTranslationSchema.index(
  { collectionId: 1, version: 1, locale: 1 },
  { unique: true, name: "collection_translation_locale_unique" },
);
collectionTranslationSchema.index(
  { locale: 1, translationStatus: 1, publishedAt: -1 },
  { name: "collection_translation_public_listing" },
);

export type CollectionRecord = InferSchemaType<typeof collectionSchema>;
export type CollectionTranslationRecord = InferSchemaType<
  typeof collectionTranslationSchema
>;

export const getCollectionModel = () =>
  getOrCreateModel<CollectionRecord>("Collection", collectionSchema);
export const getCollectionTranslationModel = () =>
  getOrCreateModel<CollectionTranslationRecord>(
    "CollectionTranslation",
    collectionTranslationSchema,
  );
