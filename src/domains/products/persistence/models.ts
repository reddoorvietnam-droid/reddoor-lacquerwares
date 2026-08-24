import "server-only";

import { type InferSchemaType, Schema, Types } from "mongoose";

import { locales } from "@/lib/i18n/config";
import {
  actorFields,
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
  seoFieldsMongooseSchema,
  structuredBlocksMongooseField,
} from "@/lib/content/mongoose";

const productStatuses = [
  "draft",
  "inReview",
  "published",
  "discontinued",
  "archived",
];
const workflowStatuses = ["draft", "inReview", "published", "archived"];
const translationStatuses = ["draft", "inReview", "published", "needsUpdate"];

const nonNegativeDecimalValidator = {
  validator: (value: Types.Decimal128 | null | undefined) =>
    value === null ||
    value === undefined ||
    /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.toString()),
  message: "Decimal value must be non-negative",
};

const dimensionsSchema = new Schema(
  {
    length: {
      type: Schema.Types.Decimal128,
      validate: nonNegativeDecimalValidator,
    },
    width: {
      type: Schema.Types.Decimal128,
      validate: nonNegativeDecimalValidator,
    },
    height: {
      type: Schema.Types.Decimal128,
      validate: nonNegativeDecimalValidator,
    },
    unit: { type: String, required: true, enum: ["mm", "cm", "m", "in"] },
  },
  nestedSchemaOptions,
);

const weightSchema = new Schema(
  {
    value: {
      type: Schema.Types.Decimal128,
      required: true,
      validate: nonNegativeDecimalValidator,
    },
    unit: { type: String, required: true, enum: ["g", "kg", "lb"] },
  },
  nestedSchemaOptions,
);

const moneySchema = new Schema(
  {
    amount: {
      type: Schema.Types.Decimal128,
      required: true,
      validate: nonNegativeDecimalValidator,
    },
    currency: { type: String, required: true, enum: ["VND", "USD", "EUR"] },
  },
  nestedSchemaOptions,
);

export const productSchema = new Schema(
  {
    internalId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    categoryId: { type: Schema.Types.ObjectId, ref: "ProductCategory" },
    collectionIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Collection" }],
      default: [],
    },
    materialKeys: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
      default: [],
    },
    finishKeys: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
      default: [],
    },
    searchTokens: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
      default: [],
    },
    status: { type: String, required: true, enum: productStatuses },
    currentDraftVersionId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVersion",
    },
    currentPublishedVersionId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVersion",
    },
    deletedAt: { type: Date },
    ...actorFields,
  },
  rootSchemaOptions,
);

productSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
    name: "product_sku_unique_active",
  },
);
productSchema.index(
  { internalId: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
    name: "product_internal_id_unique_active",
  },
);
productSchema.index(
  { status: 1, categoryId: 1, updatedAt: -1 },
  { name: "product_category_listing" },
);
productSchema.index(
  { collectionIds: 1, status: 1 },
  { name: "product_collection_listing" },
);
productSchema.index(
  { materialKeys: 1, status: 1 },
  { name: "product_material_listing" },
);
productSchema.index(
  { finishKeys: 1, status: 1 },
  { name: "product_finish_listing" },
);
productSchema.index(
  { searchTokens: 1, status: 1 },
  { name: "product_token_search" },
);

export const productVersionSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "Product",
    },
    version: { type: Number, required: true, min: 1, immutable: true },
    status: { type: String, required: true, enum: workflowStatuses },
    dimensions: { type: dimensionsSchema },
    weight: { type: weightSchema },
    materials: {
      type: [{ type: String, trim: true, maxlength: 200 }],
      default: [],
    },
    colors: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
    finishes: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
    leadTimeDays: { type: Number, min: 0, max: 3_650 },
    mediaIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "MediaAsset" }],
      default: [],
    },
    showPrice: { type: Boolean, required: true, default: false },
    publicPrice: {
      type: moneySchema,
      required: function () {
        return this.showPrice;
      },
    },
    relatedProductIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Product" }],
      default: [],
    },
    bomVersionId: { type: Schema.Types.ObjectId, ref: "BomVersion" },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date },
    ...actorFields,
  },
  rootSchemaOptions,
);

productVersionSchema.index(
  { productId: 1, version: 1 },
  { unique: true, name: "product_version_unique" },
);
productVersionSchema.index(
  { productId: 1, status: 1, version: -1 },
  { name: "product_version_workflow" },
);
export const productTranslationSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "Product",
    },
    versionId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "ProductVersion",
    },
    locale: { type: String, required: true, enum: locales, immutable: true },
    slug: { type: String, required: true, trim: true, maxlength: 160 },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    shortDescription: { type: String, trim: true, maxlength: 500 },
    description: structuredBlocksMongooseField,
    story: structuredBlocksMongooseField,
    careInstructions: structuredBlocksMongooseField,
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

productTranslationSchema.index(
  { productId: 1, versionId: 1, locale: 1 },
  { unique: true, name: "product_translation_locale_unique" },
);
productTranslationSchema.index(
  { locale: 1, translationStatus: 1, publishedAt: -1 },
  { name: "product_translation_public_listing" },
);

export type ProductRecord = InferSchemaType<typeof productSchema>;
export type ProductVersionRecord = InferSchemaType<typeof productVersionSchema>;
export type ProductTranslationRecord = InferSchemaType<
  typeof productTranslationSchema
>;

export const getProductModel = () =>
  getOrCreateModel<ProductRecord>("Product", productSchema);
export const getProductVersionModel = () =>
  getOrCreateModel<ProductVersionRecord>(
    "ProductVersion",
    productVersionSchema,
  );
export const getProductTranslationModel = () =>
  getOrCreateModel<ProductTranslationRecord>(
    "ProductTranslation",
    productTranslationSchema,
  );
