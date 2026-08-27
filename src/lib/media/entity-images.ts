import "server-only";

import { Schema, Types, type InferSchemaType } from "mongoose";

import {
  actorFields,
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";

/**
 * Photographs attached to an editorial entity — an article's cover, a
 * product's gallery — stored at Cloudinary and described here.
 *
 * Same reasoning as the collection catalogue sidecar: the entity documents
 * are governed by the versioned editorial workflow, and swapping a photograph
 * is an asset operation that must not mint an editorial revision. Publishing
 * still gates visibility, because the public readers only join this record
 * onto published entities.
 *
 * One document per entity; `images` is ordered and the first entry is the
 * primary photograph.
 */

export const imageEntityKinds = ["article", "product"] as const;
export type ImageEntityKind = (typeof imageEntityKinds)[number];

const storedImageSchema = new Schema(
  {
    publicId: { type: String, required: true, trim: true, maxlength: 500 },
    assetVersion: { type: Number, required: true, min: 1 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    bytes: { type: Number, required: true, min: 1 },
    alt: { type: String, trim: true, maxlength: 300 },
  },
  nestedSchemaOptions,
);

export const entityImagesSchema = new Schema(
  {
    entityType: { type: String, required: true, enum: imageEntityKinds },
    entityId: { type: Schema.Types.ObjectId, required: true },
    images: { type: [storedImageSchema], required: true, default: [] },
    ...actorFields,
  },
  rootSchemaOptions,
);

entityImagesSchema.index(
  { entityType: 1, entityId: 1 },
  { unique: true, name: "entity_images_unique" },
);

export type EntityImagesRecord = InferSchemaType<typeof entityImagesSchema>;

export const getEntityImagesModel = () =>
  getOrCreateModel<EntityImagesRecord>("EntityImages", entityImagesSchema);

export type StoredImageDescriptor = {
  readonly publicId: string;
  readonly assetVersion: number;
  readonly width: number;
  readonly height: number;
  readonly alt: string | null;
};

type LeanEntityImages = {
  entityId: Types.ObjectId;
  images: Array<{
    publicId: string;
    assetVersion: number;
    width: number;
    height: number;
    alt?: string;
  }>;
};

/** Ordered image lists for a set of entities of one kind, keyed by id. */
export async function findImagesForEntities(
  entityType: ImageEntityKind,
  entityIds: readonly string[],
): Promise<ReadonlyMap<string, readonly StoredImageDescriptor[]>> {
  if (entityIds.length === 0) return new Map();
  await connectToDatabase();

  const rows = await getEntityImagesModel()
    .find({
      entityType,
      entityId: {
        $in: entityIds
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      },
    })
    .select("entityId images")
    .lean<LeanEntityImages[]>()
    .exec();

  return new Map(
    rows.map((row) => [
      row.entityId.toHexString(),
      row.images.map((image) => ({
        publicId: image.publicId,
        assetVersion: image.assetVersion,
        width: image.width,
        height: image.height,
        alt: image.alt ?? null,
      })),
    ]),
  );
}
