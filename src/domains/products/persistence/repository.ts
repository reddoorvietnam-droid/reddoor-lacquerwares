import "server-only";

import { Types } from "mongoose";

import type {
  ProductDto,
  ProductTranslationDto,
  ProductVersionDto,
  PublishedProductDto,
} from "@/domains/products/persistence/dto";
import {
  getProductModel,
  getProductTranslationModel,
  getProductVersionModel,
} from "@/domains/products/persistence/models";
import {
  dateToIso,
  decimal128ToString,
  objectIdToString,
  persistedBlocksToDto,
  persistedSeoToDto,
} from "@/lib/content/mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { Locale } from "@/lib/i18n/config";

export const PRODUCT_PROJECTION = {
  _id: 1,
  internalId: 1,
  sku: 1,
  categoryId: 1,
  collectionIds: 1,
  materialKeys: 1,
  finishKeys: 1,
  searchTokens: 1,
  status: 1,
  currentDraftVersionId: 1,
  currentPublishedVersionId: 1,
  deletedAt: 1,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: 1,
  updatedBy: 1,
} as const;

export const PRODUCT_VERSION_PROJECTION = {
  _id: 1,
  productId: 1,
  version: 1,
  status: 1,
  dimensions: 1,
  weight: 1,
  materials: 1,
  colors: 1,
  finishes: 1,
  leadTimeDays: 1,
  mediaIds: 1,
  showPrice: 1,
  publicPrice: 1,
  relatedProductIds: 1,
  bomVersionId: 1,
  submittedAt: 1,
  reviewedAt: 1,
  reviewedBy: 1,
  publishedAt: 1,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: 1,
  updatedBy: 1,
} as const;

export const PRODUCT_TRANSLATION_PROJECTION = {
  _id: 1,
  productId: 1,
  versionId: 1,
  locale: 1,
  slug: 1,
  title: 1,
  shortDescription: 1,
  description: 1,
  story: 1,
  careInstructions: 1,
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

export interface ProductPersistenceBaseRaw {
  _id: Types.ObjectId;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

export interface ProductRaw extends ProductPersistenceBaseRaw {
  internalId: string;
  sku: string;
  categoryId?: Types.ObjectId;
  collectionIds: Types.ObjectId[];
  materialKeys: string[];
  finishKeys: string[];
  searchTokens: string[];
  status: ProductDto["status"];
  group?: ProductDto["group"];
  isAvailable?: boolean;
  categoryKey?: string;
  currentDraftVersionId?: Types.ObjectId;
  currentPublishedVersionId?: Types.ObjectId;
  deletedAt?: Date;
}

export interface ProductVersionRaw extends ProductPersistenceBaseRaw {
  productId: Types.ObjectId;
  version: number;
  status: ProductVersionDto["status"];
  dimensions?: {
    length?: Types.Decimal128;
    width?: Types.Decimal128;
    height?: Types.Decimal128;
    unit: "mm" | "cm" | "m" | "in";
  };
  weight?: {
    value: Types.Decimal128;
    unit: "g" | "kg" | "lb";
  };
  materials: string[];
  colors: string[];
  finishes: string[];
  leadTimeDays?: number;
  mediaIds: Types.ObjectId[];
  showPrice: boolean;
  publicPrice?: {
    amount: Types.Decimal128;
    currency: "VND" | "USD" | "EUR";
  };
  relatedProductIds: Types.ObjectId[];
  bomVersionId?: Types.ObjectId;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  publishedAt?: Date;
}

export interface ProductTranslationRaw extends ProductPersistenceBaseRaw {
  productId: Types.ObjectId;
  versionId: Types.ObjectId;
  locale: Locale;
  slug: string;
  title: string;
  shortDescription?: string;
  description: unknown;
  story: unknown;
  careInstructions: unknown;
  translationStatus: ProductTranslationDto["translationStatus"];
  sourceRevision: number;
  reviewedBy?: Types.ObjectId;
  publishedAt?: Date;
  seo: unknown;
}

function metadata(raw: ProductPersistenceBaseRaw) {
  return {
    id: objectIdToString(raw._id),
    revision: raw.revision,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    createdBy: objectIdToString(raw.createdBy),
    updatedBy: objectIdToString(raw.updatedBy),
  };
}

export function mapProduct(raw: ProductRaw): ProductDto {
  return {
    ...metadata(raw),
    internalId: raw.internalId,
    sku: raw.sku,
    categoryId: raw.categoryId ? objectIdToString(raw.categoryId) : null,
    collectionIds: raw.collectionIds.map(objectIdToString),
    materialKeys: raw.materialKeys,
    finishKeys: raw.finishKeys,
    searchTokens: raw.searchTokens,
    status: raw.status,
    // Documents written before the catalogue grouping existed carry neither
    // field; they read as an unavailable production item until an editor says
    // otherwise, which is the safe way round for a public listing.
    group: raw.group ?? "processing",
    isAvailable: raw.isAvailable ?? false,
    categoryKey: raw.categoryKey ?? "",
    currentDraftVersionId: raw.currentDraftVersionId
      ? objectIdToString(raw.currentDraftVersionId)
      : null,
    currentPublishedVersionId: raw.currentPublishedVersionId
      ? objectIdToString(raw.currentPublishedVersionId)
      : null,
    deletedAt: dateToIso(raw.deletedAt),
  };
}

export function mapProductVersion(raw: ProductVersionRaw): ProductVersionDto {
  const publicPriceAmount = raw.publicPrice
    ? decimal128ToString(raw.publicPrice.amount)
    : null;
  const weightValue = raw.weight ? decimal128ToString(raw.weight.value) : null;

  if (raw.publicPrice && publicPriceAmount === null) {
    throw new Error("Persisted product price has no decimal amount");
  }

  if (raw.weight && weightValue === null) {
    throw new Error("Persisted product weight has no decimal value");
  }

  return {
    ...metadata(raw),
    productId: objectIdToString(raw.productId),
    version: raw.version,
    status: raw.status,
    dimensions: raw.dimensions
      ? {
          length: decimal128ToString(raw.dimensions.length),
          width: decimal128ToString(raw.dimensions.width),
          height: decimal128ToString(raw.dimensions.height),
          unit: raw.dimensions.unit,
        }
      : null,
    weight:
      raw.weight && weightValue
        ? { value: weightValue, unit: raw.weight.unit }
        : null,
    materials: raw.materials,
    colors: raw.colors,
    finishes: raw.finishes,
    leadTimeDays: raw.leadTimeDays ?? null,
    mediaIds: raw.mediaIds.map(objectIdToString),
    showPrice: raw.showPrice,
    publicPrice:
      raw.publicPrice && publicPriceAmount
        ? { amount: publicPriceAmount, currency: raw.publicPrice.currency }
        : null,
    relatedProductIds: raw.relatedProductIds.map(objectIdToString),
    bomVersionId: raw.bomVersionId ? objectIdToString(raw.bomVersionId) : null,
    submittedAt: dateToIso(raw.submittedAt),
    reviewedAt: dateToIso(raw.reviewedAt),
    reviewedBy: raw.reviewedBy ? objectIdToString(raw.reviewedBy) : null,
    publishedAt: dateToIso(raw.publishedAt),
  };
}

export function mapProductTranslation(
  raw: ProductTranslationRaw,
): ProductTranslationDto {
  return {
    ...metadata(raw),
    productId: objectIdToString(raw.productId),
    versionId: objectIdToString(raw.versionId),
    locale: raw.locale,
    slug: raw.slug,
    title: raw.title,
    shortDescription: raw.shortDescription ?? null,
    description: persistedBlocksToDto(raw.description),
    story: persistedBlocksToDto(raw.story),
    careInstructions: persistedBlocksToDto(raw.careInstructions),
    translationStatus: raw.translationStatus,
    sourceRevision: raw.sourceRevision,
    reviewedBy: raw.reviewedBy ? objectIdToString(raw.reviewedBy) : null,
    publishedAt: dateToIso(raw.publishedAt),
    seo: persistedSeoToDto(raw.seo),
  };
}

export interface ProductPersistenceRepository {
  findById(id: string): Promise<ProductDto | null>;
  findBySku(sku: string): Promise<ProductDto | null>;
  findVersionById(id: string): Promise<ProductVersionDto | null>;
  findTranslation(
    versionId: string,
    locale: Locale,
  ): Promise<ProductTranslationDto | null>;
  findPublishedById(
    productId: string,
    locale: Locale,
  ): Promise<PublishedProductDto | null>;
}

export class MongoProductPersistenceRepository implements ProductPersistenceRepository {
  async findById(id: string): Promise<ProductDto | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getProductModel()
      .findOne({ _id: id, deletedAt: { $exists: false } }, PRODUCT_PROJECTION)
      .lean()
      .exec()) as ProductRaw | null;
    return raw ? mapProduct(raw) : null;
  }

  async findBySku(sku: string): Promise<ProductDto | null> {
    await connectToDatabase();
    const raw = (await getProductModel()
      .findOne(
        { sku: sku.trim().toUpperCase(), deletedAt: { $exists: false } },
        PRODUCT_PROJECTION,
      )
      .lean()
      .exec()) as ProductRaw | null;
    return raw ? mapProduct(raw) : null;
  }

  async findVersionById(id: string): Promise<ProductVersionDto | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getProductVersionModel()
      .findById(id, PRODUCT_VERSION_PROJECTION)
      .lean()
      .exec()) as ProductVersionRaw | null;
    return raw ? mapProductVersion(raw) : null;
  }

  async findTranslation(
    versionId: string,
    locale: Locale,
  ): Promise<ProductTranslationDto | null> {
    if (!Types.ObjectId.isValid(versionId)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getProductTranslationModel()
      .findOne({ versionId, locale }, PRODUCT_TRANSLATION_PROJECTION)
      .lean()
      .exec()) as ProductTranslationRaw | null;
    return raw ? mapProductTranslation(raw) : null;
  }

  async findPublishedById(
    productId: string,
    locale: Locale,
  ): Promise<PublishedProductDto | null> {
    const product = await this.findById(productId);

    if (
      !product ||
      product.status !== "published" ||
      !product.currentPublishedVersionId
    ) {
      return null;
    }

    const [version, translation] = await Promise.all([
      this.findVersionById(product.currentPublishedVersionId),
      this.findTranslation(product.currentPublishedVersionId, locale),
    ]);

    if (
      !version ||
      version.status !== "published" ||
      !translation ||
      translation.translationStatus !== "published"
    ) {
      return null;
    }

    return { product, version, translation };
  }
}
