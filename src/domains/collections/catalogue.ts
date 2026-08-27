import "server-only";

import { Schema, Types, type InferSchemaType } from "mongoose";

import {
  actorFields,
  getOrCreateModel,
  rootSchemaOptions,
} from "@/lib/content/mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { locales } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";

/**
 * The stored catalogue behind a collection's flipbook: one uploaded PDF per
 * collection and locale, kept in Cloudinary and described here.
 *
 * This lives beside the collection rather than inside it on purpose. The
 * collection document is governed by the versioned editorial workflow
 * (draft → review → publish) and its published metadata is immutable; a
 * catalogue upload is an asset swap that must not mint a new editorial
 * version. Publishing still gates visibility: the public site only joins this
 * record onto collections whose status is `published`.
 *
 * `publicId`/`version` name the asset at the provider; every delivered page
 * image is derived from them server-side (`buildPageImageUrl`), so no
 * transformation logic or signing material ever reaches the browser.
 */
export const collectionCatalogueSchema = new Schema(
  {
    collectionId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "Collection",
    },
    locale: { type: String, required: true, enum: locales },
    publicId: { type: String, required: true, trim: true, maxlength: 500 },
    /** Provider asset version; bumps on replacement so cached pages die. */
    assetVersion: { type: Number, required: true, min: 1 },
    pageCount: { type: Number, required: true, min: 1, max: 500 },
    /** First-page box in PDF points, for the reader's aspect ratio. */
    pageWidth: { type: Number, required: true, min: 1 },
    pageHeight: { type: Number, required: true, min: 1 },
    bytes: { type: Number, required: true, min: 1 },
    ...actorFields,
  },
  rootSchemaOptions,
);

collectionCatalogueSchema.index(
  { collectionId: 1, locale: 1 },
  { unique: true, name: "collection_catalogue_locale_unique" },
);

export type CollectionCatalogueRecord = InferSchemaType<
  typeof collectionCatalogueSchema
>;

export const getCollectionCatalogueModel = () =>
  getOrCreateModel<CollectionCatalogueRecord>(
    "CollectionCatalogue",
    collectionCatalogueSchema,
  );

export type CatalogueDescriptor = {
  readonly collectionId: string;
  readonly locale: Locale;
  readonly publicId: string;
  readonly assetVersion: number;
  readonly pageCount: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
};

type LeanCatalogue = {
  collectionId: Types.ObjectId;
  locale: Locale;
  publicId: string;
  assetVersion: number;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
};

/**
 * Catalogues for a set of collections, one per collection: the requested
 * locale's upload when it exists, otherwise any locale's — a catalogue in a
 * neighbouring language beats an empty reader.
 */
export async function findCataloguesForCollections(
  collectionIds: readonly string[],
  locale: Locale,
): Promise<ReadonlyMap<string, CatalogueDescriptor>> {
  if (collectionIds.length === 0) return new Map();
  await connectToDatabase();

  const rows = await getCollectionCatalogueModel()
    .find({
      collectionId: {
        $in: collectionIds
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      },
    })
    .select(
      "collectionId locale publicId assetVersion pageCount pageWidth pageHeight",
    )
    .lean<LeanCatalogue[]>()
    .exec();

  const byCollection = new Map<string, CatalogueDescriptor>();
  for (const row of rows) {
    const key = row.collectionId.toHexString();
    const existing = byCollection.get(key);
    if (existing && existing.locale === locale) continue;
    if (!existing || row.locale === locale || row.locale === "vi") {
      byCollection.set(key, {
        collectionId: key,
        locale: row.locale,
        publicId: row.publicId,
        assetVersion: row.assetVersion,
        pageCount: row.pageCount,
        pageWidth: row.pageWidth,
        pageHeight: row.pageHeight,
      });
    }
  }
  return byCollection;
}
