import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import { locales } from "@/lib/i18n/config";
import {
  actorFields,
  getOrCreateModel,
  rootSchemaOptions,
  seoFieldsMongooseSchema,
  structuredBlocksMongooseField,
} from "@/lib/content/mongoose";

const workflowStatuses = ["draft", "inReview", "published", "archived"];
const translationStatuses = ["draft", "inReview", "published", "needsUpdate"];

export const articleSchema = new Schema(
  {
    internalId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    categoryId: { type: Schema.Types.ObjectId, ref: "ArticleCategory" },
    tagKeys: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
      default: [],
    },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    authorLabel: { type: String, trim: true, maxlength: 200 },
    status: { type: String, required: true, enum: workflowStatuses },
    currentDraftRevisionId: {
      type: Schema.Types.ObjectId,
      ref: "ArticleRevision",
    },
    currentPublishedRevisionId: {
      type: Schema.Types.ObjectId,
      ref: "ArticleRevision",
    },
    publishedAt: { type: Date },
    deletedAt: { type: Date },
    ...actorFields,
  },
  rootSchemaOptions,
);

articleSchema.index(
  { internalId: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
    name: "article_internal_id_unique_active",
  },
);
articleSchema.index(
  { status: 1, publishedAt: -1 },
  { name: "article_public_listing" },
);
articleSchema.index(
  { categoryId: 1, publishedAt: -1 },
  { name: "article_category_listing" },
);
articleSchema.index(
  { tagKeys: 1, status: 1, publishedAt: -1 },
  { name: "article_tag_listing" },
);

export const articleRevisionSchema = new Schema(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "Article",
    },
    version: { type: Number, required: true, min: 1, immutable: true },
    sourceLocale: { type: String, required: true, enum: locales },
    sourceBlocks: structuredBlocksMongooseField,
    coverMediaId: { type: Schema.Types.ObjectId, ref: "MediaAsset" },
    status: { type: String, required: true, enum: workflowStatuses },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date },
    ...actorFields,
  },
  rootSchemaOptions,
);

articleRevisionSchema.index(
  { articleId: 1, version: 1 },
  { unique: true, name: "article_revision_version_unique" },
);
articleRevisionSchema.index(
  { articleId: 1, status: 1, version: -1 },
  { name: "article_revision_workflow" },
);

export const articleTranslationSchema = new Schema(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "Article",
    },
    revisionId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "ArticleRevision",
    },
    locale: { type: String, required: true, enum: locales, immutable: true },
    slug: { type: String, required: true, trim: true, maxlength: 160 },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    summary: { type: String, required: true, trim: true, maxlength: 1_000 },
    body: structuredBlocksMongooseField,
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

articleTranslationSchema.index(
  { articleId: 1, revisionId: 1, locale: 1 },
  { unique: true, name: "article_translation_locale_unique" },
);
articleTranslationSchema.index(
  { locale: 1, translationStatus: 1, publishedAt: -1 },
  { name: "article_translation_public_listing" },
);

export type ArticleRecord = InferSchemaType<typeof articleSchema>;
export type ArticleRevisionRecord = InferSchemaType<
  typeof articleRevisionSchema
>;
export type ArticleTranslationRecord = InferSchemaType<
  typeof articleTranslationSchema
>;

export const getArticleModel = () =>
  getOrCreateModel<ArticleRecord>("Article", articleSchema);
export const getArticleRevisionModel = () =>
  getOrCreateModel<ArticleRevisionRecord>(
    "ArticleRevision",
    articleRevisionSchema,
  );
export const getArticleTranslationModel = () =>
  getOrCreateModel<ArticleTranslationRecord>(
    "ArticleTranslation",
    articleTranslationSchema,
  );
