import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import { locales } from "@/lib/i18n/config";
import {
  actorFields,
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
  seoFieldsMongooseSchema,
  structuredBlocksMongooseField,
} from "@/lib/content/mongoose";

const workflowStatuses = ["draft", "inReview", "published", "archived"];
const translationStatuses = ["draft", "inReview", "published", "needsUpdate"];

const siteSettingsTranslationSchema = new Schema(
  {
    locale: { type: String, required: true, enum: locales },
    companyName: { type: String, required: true, trim: true, maxlength: 200 },
    tagline: { type: String, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 2_000 },
    addressLabel: { type: String, trim: true, maxlength: 500 },
  },
  nestedSchemaOptions,
);

const socialLinkSchema = new Schema(
  {
    platform: { type: String, required: true, trim: true, maxlength: 80 },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2_048,
      validate: {
        validator: (value: string) => {
          try {
            return new URL(value).protocol === "https:";
          } catch {
            return false;
          }
        },
        message: "Social links must use HTTPS",
      },
    },
  },
  nestedSchemaOptions,
);

function hasUniqueLocales(values: { locale: string }[]): boolean {
  return new Set(values.map(({ locale }) => locale)).size === values.length;
}

export const siteSettingsSchema = new Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      immutable: true,
      enum: ["site-settings"],
      default: "site-settings",
    },
    version: { type: Number, required: true, min: 1 },
    status: { type: String, required: true, enum: workflowStatuses },
    translations: {
      type: [siteSettingsTranslationSchema],
      required: true,
      validate: {
        validator: hasUniqueLocales,
        message: "Site settings can contain only one translation per locale",
      },
    },
    publicEmail: { type: String, trim: true, lowercase: true, maxlength: 320 },
    publicPhone: { type: String, trim: true, maxlength: 80 },
    socialLinks: { type: [socialLinkSchema], required: true, default: [] },
    publishedAt: { type: Date },
    ...actorFields,
  },
  rootSchemaOptions,
);

siteSettingsSchema.index(
  { singletonKey: 1, version: 1 },
  { unique: true, name: "site_settings_version_unique" },
);
siteSettingsSchema.index(
  { singletonKey: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "published" },
    name: "site_settings_single_published",
  },
);

export const contentEntrySchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    type: {
      type: String,
      required: true,
      enum: ["page", "section", "processStage", "global"],
    },
    placement: { type: String, required: true, trim: true, maxlength: 160 },
    status: { type: String, required: true, enum: workflowStatuses },
    currentDraftRevisionId: {
      type: Schema.Types.ObjectId,
      ref: "ContentRevision",
    },
    currentPublishedRevisionId: {
      type: Schema.Types.ObjectId,
      ref: "ContentRevision",
    },
    deletedAt: { type: Date },
    ...actorFields,
  },
  rootSchemaOptions,
);

contentEntrySchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
    name: "content_entry_code_unique_active",
  },
);
contentEntrySchema.index(
  { type: 1, status: 1, placement: 1 },
  { name: "content_entry_public_listing" },
);

export const contentRevisionSchema = new Schema(
  {
    entryId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "ContentEntry",
    },
    version: { type: Number, required: true, min: 1, immutable: true },
    blocks: structuredBlocksMongooseField,
    status: { type: String, required: true, enum: workflowStatuses },
    sourceLocale: { type: String, required: true, enum: locales },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date },
    ...actorFields,
  },
  rootSchemaOptions,
);

contentRevisionSchema.index(
  { entryId: 1, version: 1 },
  { unique: true, name: "content_revision_version_unique" },
);
contentRevisionSchema.index(
  { entryId: 1, status: 1, version: -1 },
  { name: "content_revision_workflow" },
);

export const contentTranslationSchema = new Schema(
  {
    entryId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "ContentEntry",
    },
    revisionId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "ContentRevision",
    },
    locale: { type: String, required: true, enum: locales, immutable: true },
    slug: { type: String, trim: true, maxlength: 160 },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    summary: { type: String, trim: true, maxlength: 1_000 },
    blocks: structuredBlocksMongooseField,
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

contentTranslationSchema.index(
  { entryId: 1, revisionId: 1, locale: 1 },
  { unique: true, name: "content_translation_locale_unique" },
);
contentTranslationSchema.index(
  { locale: 1, translationStatus: 1, publishedAt: -1 },
  { name: "content_translation_public_listing" },
);

export const localizedRouteSchema = new Schema(
  {
    locale: { type: String, required: true, enum: locales, immutable: true },
    path: {
      type: String,
      required: true,
      trim: true,
      maxlength: 512,
      validate: {
        validator: (value: string) =>
          value.startsWith("/") &&
          !value.startsWith("//") &&
          !value.includes("?") &&
          !value.includes("#") &&
          !value.includes("\\"),
        message: "Localized route must be an absolute application path",
      },
    },
    entityType: {
      type: String,
      required: true,
      enum: ["content", "product", "article", "collection"],
      immutable: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    versionId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    active: { type: Boolean, required: true, default: true },
    redirectToPath: { type: String, trim: true, maxlength: 512 },
    redirectStatus: { type: Number, enum: [301, 302, 307, 308] },
    replacedByRouteId: { type: Schema.Types.ObjectId, ref: "LocalizedRoute" },
    activatedAt: { type: Date },
    deactivatedAt: { type: Date },
    ...actorFields,
  },
  rootSchemaOptions,
);

localizedRouteSchema.index(
  { locale: 1, path: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: "localized_route_active_path_unique",
  },
);
localizedRouteSchema.index(
  { entityType: 1, entityId: 1, locale: 1, active: 1 },
  { name: "localized_route_entity_lookup" },
);

export type SiteSettingsRecord = InferSchemaType<typeof siteSettingsSchema>;
export type ContentEntryRecord = InferSchemaType<typeof contentEntrySchema>;
export type ContentRevisionRecord = InferSchemaType<
  typeof contentRevisionSchema
>;
export type ContentTranslationRecord = InferSchemaType<
  typeof contentTranslationSchema
>;
export type LocalizedRouteRecord = InferSchemaType<typeof localizedRouteSchema>;

export const getSiteSettingsModel = () =>
  getOrCreateModel<SiteSettingsRecord>("SiteSettings", siteSettingsSchema);
export const getContentEntryModel = () =>
  getOrCreateModel<ContentEntryRecord>("ContentEntry", contentEntrySchema);
export const getContentRevisionModel = () =>
  getOrCreateModel<ContentRevisionRecord>(
    "ContentRevision",
    contentRevisionSchema,
  );
export const getContentTranslationModel = () =>
  getOrCreateModel<ContentTranslationRecord>(
    "ContentTranslation",
    contentTranslationSchema,
  );
export const getLocalizedRouteModel = () =>
  getOrCreateModel<LocalizedRouteRecord>(
    "LocalizedRoute",
    localizedRouteSchema,
  );
