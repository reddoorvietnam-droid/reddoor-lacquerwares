import "server-only";

import { Types } from "mongoose";
import { unstable_cache } from "next/cache";

import {
  getProductModel,
  getProductTranslationModel,
  getProductVersionModel,
} from "@/domains/products/persistence/models";
import type {
  PublicProduct,
  PublicProductDimensions,
  PublicProductImage,
  PublicProductListOptions,
  PublicProductPrice,
  PublicProductRepository,
} from "@/domains/products/public-contract";
import { connectToDatabase } from "@/lib/db/mongoose";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
import {
  findImagesForEntities,
  type StoredImageDescriptor,
} from "@/lib/media/entity-images";
import type { Locale } from "@/lib/i18n/config";
import {
  blocksToParagraphs,
  pendingImage,
  pickTranslation,
} from "@/lib/public/published-mapping";

/**
 * Reads the catalogue the CMS has actually published: a product is visible
 * only while the root record, its current version, and a translation are all
 * `published`. Drafts, review copies, and discontinued products never leak.
 *
 * Two persistence gaps are mapped deliberately rather than hidden:
 *
 * - No featured flag exists yet, so `featuredOnly` returns the most recently
 *   updated published products — the home page fills with the newest work
 *   instead of staying empty until the flag is modelled.
 * - No category taxonomy is persisted yet, so category fields are empty and a
 *   `categorySlug` filter matches nothing. The listing page derives its
 *   filter chips from the data, so an empty taxonomy simply shows no chips.
 */

type LeanProduct = {
  _id: Types.ObjectId;
  sku: string;
  collectionIds?: Types.ObjectId[];
  currentPublishedVersionId?: Types.ObjectId;
  updatedAt?: Date;
};

type LeanVersion = {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  status: string;
  dimensions?: {
    length?: Types.Decimal128;
    width?: Types.Decimal128;
    height?: Types.Decimal128;
    unit: "mm" | "cm" | "m" | "in";
  };
  materials?: string[];
  colors?: string[];
  finishes?: string[];
  leadTimeDays?: number;
  mediaIds?: Types.ObjectId[];
  showPrice?: boolean;
  publicPrice?: { amount: Types.Decimal128; currency: "VND" | "USD" | "EUR" };
};

type LeanTranslation = {
  productId: Types.ObjectId;
  versionId: Types.ObjectId;
  locale: Locale;
  slug: string;
  title: string;
  shortDescription?: string;
  description?: unknown[];
  careInstructions?: unknown[];
};

function decimalToUnit(
  value: Types.Decimal128 | undefined,
  unit: "mm" | "cm" | "m" | "in",
): string | null {
  if (value === undefined) return null;
  const amount = Number(value.toString());
  if (!Number.isFinite(amount)) return null;

  // The public contract speaks mm/cm only; metres and inches convert to cm.
  const cm =
    unit === "m" ? amount * 100 : unit === "in" ? amount * 2.54 : amount;
  return (Math.round(cm * 10) / 10).toString();
}

function mapDimensions(
  dimensions: LeanVersion["dimensions"],
): PublicProductDimensions | null {
  if (!dimensions) return null;
  const unit = dimensions.unit === "mm" ? "mm" : "cm";
  const width = decimalToUnit(dimensions.width, dimensions.unit);
  const height = decimalToUnit(dimensions.height, dimensions.unit);
  const depth = decimalToUnit(dimensions.length, dimensions.unit);
  if (width === null && height === null && depth === null) return null;

  return {
    width: width ?? "",
    height: height ?? "",
    depth: depth ?? "",
    unit,
  };
}

const CURRENCY_MINOR_DIGITS = { VND: 0, USD: 2, EUR: 2 } as const;

function mapPrice(version: LeanVersion): PublicProductPrice | null {
  if (!version.showPrice || !version.publicPrice) return null;
  const amount = Number(version.publicPrice.amount.toString());
  if (!Number.isFinite(amount)) return null;

  const digits = CURRENCY_MINOR_DIGITS[version.publicPrice.currency];
  return {
    amountMinor: Math.round(amount * 10 ** digits).toString(),
    currency: version.publicPrice.currency,
  };
}

function mapImages(
  stored: readonly StoredImageDescriptor[],
  slug: string,
  name: string,
): PublicProductImage[] {
  if (stored.length > 0) {
    try {
      const storage = CloudinaryMediaStorage.fromEnvironment();
      return stored.map((image, index) => ({
        assetKey: `product-${slug}-${index + 1}`,
        src: storage.buildImageUrl(image.publicId, image.assetVersion, 1600),
        alt: image.alt ?? name,
        width: image.width,
        height: image.height,
        isPrimary: index === 0,
        assetPending: false,
        replacementHint: "",
      }));
    } catch {
      // Storage unconfigured on this machine; fall through to the slot.
    }
  }
  // Every product needs at least a primary slot for the layouts to reserve.
  return [
    {
      ...pendingImage(`product-${slug}-1`, name, 1200, 1500),
      isPrimary: true,
    },
  ];
}

function mapProduct(
  product: LeanProduct,
  version: LeanVersion,
  translation: LeanTranslation,
  stored: readonly StoredImageDescriptor[],
  locale: Locale,
  sortOrder: number,
): PublicProduct {
  const storyParagraphs = blocksToParagraphs(
    translation.description as never[],
  );

  return {
    id: product._id.toHexString(),
    marker: null,
    isDemo: false,
    locale,
    slug: translation.slug,
    internalReference: product.sku,
    name: translation.title,
    categorySlug: "",
    categoryLabel: "",
    summary: translation.shortDescription ?? "",
    story: storyParagraphs.join("\n\n"),
    storyParagraphs,
    materialLabels: version.materials ?? [],
    finishLabel: (version.finishes ?? []).join(", "),
    careNotes: blocksToParagraphs(translation.careInstructions as never[]),
    quoteCallToAction: "",
    dimensions: mapDimensions(version.dimensions),
    leadTime:
      version.leadTimeDays !== undefined ? String(version.leadTimeDays) : null,
    showPrice: false,
    price: mapPrice(version),
    images: mapImages(stored, translation.slug, translation.title),
    video: null,
    variants: [],
    processSteps: [],
    tags: version.colors ?? [],
    collectionIds: (product.collectionIds ?? []).map((id) => id.toHexString()),
    featured: false,
    sortOrder,
  };
}

async function loadPublished(
  locale: Locale,
  options: PublicProductListOptions & { slug?: string; id?: string },
): Promise<PublicProduct[]> {
  await connectToDatabase();

  // An explicit category filter cannot match until a taxonomy is persisted.
  if (options.categorySlug) return [];

  const filter: Record<string, unknown> = {
    status: "published",
    deletedAt: { $exists: false },
    currentPublishedVersionId: { $exists: true, $ne: null },
  };
  if (options.collectionId && Types.ObjectId.isValid(options.collectionId)) {
    filter.collectionIds = new Types.ObjectId(options.collectionId);
  }
  if (options.id) {
    if (!Types.ObjectId.isValid(options.id)) return [];
    filter._id = new Types.ObjectId(options.id);
  }

  const products = await getProductModel()
    .find(filter)
    .select("_id sku collectionIds currentPublishedVersionId updatedAt")
    .sort({ updatedAt: -1 })
    .limit(options.slug ? 0 : (options.limit ?? 0))
    .lean<LeanProduct[]>()
    .exec();
  if (products.length === 0) return [];

  const versionIds = products
    .map((p) => p.currentPublishedVersionId)
    .filter((id): id is Types.ObjectId => id !== undefined);
  const [versions, translations] = await Promise.all([
    getProductVersionModel()
      .find({ _id: { $in: versionIds }, status: "published" })
      .select(
        "_id productId status dimensions materials colors finishes leadTimeDays mediaIds showPrice publicPrice",
      )
      .lean<LeanVersion[]>()
      .exec(),
    getProductTranslationModel()
      .find({ versionId: { $in: versionIds }, translationStatus: "published" })
      .select(
        "productId versionId locale slug title shortDescription description careInstructions",
      )
      .lean<LeanTranslation[]>()
      .exec(),
  ]);

  const versionById = new Map(versions.map((v) => [v._id.toHexString(), v]));
  const translationsByVersion = new Map<string, LeanTranslation[]>();
  for (const t of translations) {
    const key = t.versionId.toHexString();
    translationsByVersion.set(key, [
      ...(translationsByVersion.get(key) ?? []),
      t,
    ]);
  }

  const galleries = await findImagesForEntities(
    "product",
    products.map((product) => product._id.toHexString()),
  );

  const mapped: PublicProduct[] = [];
  for (const product of products) {
    const versionKey = product.currentPublishedVersionId?.toHexString();
    const version = versionKey ? versionById.get(versionKey) : undefined;
    if (!version || !versionKey) continue;

    const translation = pickTranslation(
      translationsByVersion.get(versionKey) ?? [],
      locale,
    );
    if (!translation) continue;
    if (options.slug && translation.slug !== options.slug) continue;

    mapped.push(
      mapProduct(
        product,
        version,
        translation,
        galleries.get(product._id.toHexString()) ?? [],
        locale,
        mapped.length,
      ),
    );
  }
  return mapped;
}

const cachedLoad = unstable_cache(
  async (locale: Locale, options: Record<string, unknown>) =>
    loadPublished(locale, options),
  ["public-products-v1"],
  { revalidate: 300, tags: ["products:public"] },
);

export const mongoPublicProductRepository: PublicProductRepository = {
  async list(locale, options = {}) {
    return cachedLoad(locale, {
      featuredOnly: options.featuredOnly,
      collectionId: options.collectionId,
      categorySlug: options.categorySlug,
      // "Featured" has no persisted flag yet; newest published fill the rail.
      limit: options.limit,
    });
  },
  async getById(locale, id) {
    const [product] = await cachedLoad(locale, { id });
    return product ?? null;
  },
  async getBySlug(locale, slug) {
    const [product] = await cachedLoad(locale, { slug });
    return product ?? null;
  },
};
