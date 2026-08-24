import "server-only";

import { Types } from "mongoose";

import type {
  CollectionDto,
  CollectionTranslationDto,
  PublishedCollectionDto,
} from "@/domains/collections/persistence/dto";
import {
  getCollectionModel,
  getCollectionTranslationModel,
} from "@/domains/collections/persistence/models";
import {
  dateToIso,
  objectIdToString,
  persistedSeoToDto,
} from "@/lib/content/mongoose";
import { sanitizeRichTextHtml } from "@/lib/content/sanitize";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { Locale } from "@/lib/i18n/config";

export const COLLECTION_PROJECTION = {
  _id: 1,
  code: 1,
  year: 1,
  displayOrder: 1,
  status: 1,
  currentDraftTranslations: 1,
  currentPublishedTranslations: 1,
  deletedAt: 1,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: 1,
  updatedBy: 1,
} as const;

export const COLLECTION_TRANSLATION_PROJECTION = {
  _id: 1,
  collectionId: 1,
  version: 1,
  locale: 1,
  slug: 1,
  title: 1,
  summary: 1,
  landingHtml: 1,
  translationStatus: 1,
  sourceRevision: 1,
  reviewedBy: 1,
  publishedAt: 1,
  seo: 1,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: 1,
  updatedBy: 1,
} as const;

export interface CollectionPersistenceBaseRaw {
  _id: Types.ObjectId;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

export interface CollectionRaw extends CollectionPersistenceBaseRaw {
  code: string;
  year?: number;
  displayOrder: number;
  status: CollectionDto["status"];
  currentDraftTranslations: Array<{
    locale: Locale;
    translationId: Types.ObjectId;
  }>;
  currentPublishedTranslations: Array<{
    locale: Locale;
    translationId: Types.ObjectId;
  }>;
  deletedAt?: Date;
}

export interface CollectionTranslationRaw extends CollectionPersistenceBaseRaw {
  collectionId: Types.ObjectId;
  version: number;
  locale: Locale;
  slug: string;
  title: string;
  summary?: string;
  landingHtml: string;
  translationStatus: CollectionTranslationDto["translationStatus"];
  sourceRevision: number;
  reviewedBy?: Types.ObjectId;
  publishedAt?: Date;
  seo: unknown;
}

function metadata(raw: CollectionPersistenceBaseRaw) {
  return {
    id: objectIdToString(raw._id),
    revision: raw.revision,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    createdBy: objectIdToString(raw.createdBy),
    updatedBy: objectIdToString(raw.updatedBy),
  };
}

export function mapCollection(raw: CollectionRaw): CollectionDto {
  return {
    ...metadata(raw),
    code: raw.code,
    year: raw.year ?? null,
    displayOrder: raw.displayOrder,
    status: raw.status,
    currentDraftTranslations: raw.currentDraftTranslations.map((pointer) => ({
      locale: pointer.locale,
      translationId: objectIdToString(pointer.translationId),
    })),
    currentPublishedTranslations: raw.currentPublishedTranslations.map(
      (pointer) => ({
        locale: pointer.locale,
        translationId: objectIdToString(pointer.translationId),
      }),
    ),
    deletedAt: dateToIso(raw.deletedAt),
  };
}

export function mapCollectionTranslation(
  raw: CollectionTranslationRaw,
): CollectionTranslationDto {
  return {
    ...metadata(raw),
    collectionId: objectIdToString(raw.collectionId),
    version: raw.version,
    locale: raw.locale,
    slug: raw.slug,
    title: raw.title,
    summary: raw.summary ?? null,
    landingHtml: sanitizeRichTextHtml(raw.landingHtml),
    translationStatus: raw.translationStatus,
    sourceRevision: raw.sourceRevision,
    reviewedBy: raw.reviewedBy ? objectIdToString(raw.reviewedBy) : null,
    publishedAt: dateToIso(raw.publishedAt),
    seo: persistedSeoToDto(raw.seo),
  };
}

export interface CollectionPersistenceRepository {
  findById(id: string): Promise<CollectionDto | null>;
  findTranslationById(id: string): Promise<CollectionTranslationDto | null>;
  findPublishedById(
    collectionId: string,
    locale: Locale,
  ): Promise<PublishedCollectionDto | null>;
}

export class MongoCollectionPersistenceRepository implements CollectionPersistenceRepository {
  async findById(id: string): Promise<CollectionDto | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getCollectionModel()
      .findOne(
        { _id: id, deletedAt: { $exists: false } },
        COLLECTION_PROJECTION,
      )
      .lean()
      .exec()) as CollectionRaw | null;
    return raw ? mapCollection(raw) : null;
  }

  async findTranslationById(
    id: string,
  ): Promise<CollectionTranslationDto | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getCollectionTranslationModel()
      .findById(id, COLLECTION_TRANSLATION_PROJECTION)
      .lean()
      .exec()) as CollectionTranslationRaw | null;
    return raw ? mapCollectionTranslation(raw) : null;
  }

  async findPublishedById(
    collectionId: string,
    locale: Locale,
  ): Promise<PublishedCollectionDto | null> {
    const collection = await this.findById(collectionId);
    const pointer = collection?.currentPublishedTranslations.find(
      (item) => item.locale === locale,
    );

    if (!collection || collection.status !== "published" || !pointer) {
      return null;
    }

    const translation = await this.findTranslationById(pointer.translationId);
    if (
      !translation ||
      translation.locale !== locale ||
      translation.translationStatus !== "published"
    ) {
      return null;
    }

    return { collection, translation };
  }
}
