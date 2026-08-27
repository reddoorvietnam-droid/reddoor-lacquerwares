import "server-only";

import { Types } from "mongoose";
import { unstable_cache } from "next/cache";

import {
  findCataloguesForCollections,
  type CatalogueDescriptor,
} from "@/domains/collections/catalogue";
import {
  getCollectionModel,
  getCollectionTranslationModel,
} from "@/domains/collections/persistence/models";
import type {
  PublicCollection,
  PublicCollectionListOptions,
  PublicCollectionRepository,
} from "@/domains/collections/public-contract";
import { getProductModel } from "@/domains/products/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
import type { Locale } from "@/lib/i18n/config";
import {
  htmlToParagraphs,
  pendingImage,
  pickTranslation,
} from "@/lib/public/published-mapping";

/**
 * Reads the collections the CMS has published. The root record carries the
 * pointer map of published translations per locale; only translations that
 * pointer map names are eligible, which is what makes an edit-in-progress
 * invisible until it is published again.
 *
 * `featuredOnly` returns the top of the curated display order — the closest
 * persisted notion of "featured" until a flag is modelled.
 */

type LeanPointer = { locale: Locale; translationId: Types.ObjectId };

type LeanCollection = {
  _id: Types.ObjectId;
  year?: number;
  displayOrder: number;
  currentPublishedTranslations?: LeanPointer[];
};

type LeanTranslation = {
  _id: Types.ObjectId;
  collectionId: Types.ObjectId;
  locale: Locale;
  slug: string;
  title: string;
  summary?: string;
  landingHtml: string;
  translationStatus: string;
};

/**
 * The catalogue upload is what turns the reserved cover slot into a real
 * image: page one of the PDF, delivered from the CDN. Without storage
 * configuration the cover honestly stays a pending slot.
 */
function coverFor(
  catalogue: CatalogueDescriptor | null,
  slug: string,
  title: string,
): PublicCollection["cover"] {
  if (catalogue) {
    try {
      const storage = CloudinaryMediaStorage.fromEnvironment();
      return {
        assetKey: `collection-${slug}-cover`,
        src: storage.buildPageImageUrl({
          publicId: catalogue.publicId,
          pageNumber: 1,
          width: 960,
          version: catalogue.assetVersion,
        }),
        alt: title,
        width: catalogue.pageWidth,
        height: catalogue.pageHeight,
        assetPending: false,
        replacementHint: "",
      };
    } catch {
      // Storage unconfigured on this machine; fall through to the slot.
    }
  }
  return pendingImage(`collection-${slug}-cover`, title, 1400, 1866);
}

function mapCollection(
  collection: LeanCollection,
  translation: LeanTranslation,
  productIds: readonly string[],
  catalogue: CatalogueDescriptor | null,
  locale: Locale,
  sortOrder: number,
): PublicCollection {
  return {
    id: collection._id.toHexString(),
    marker: null,
    isDemo: false,
    locale,
    slug: translation.slug,
    title: translation.title,
    editionLabel: collection.year ? String(collection.year) : "",
    year: collection.year ?? null,
    summary: translation.summary ?? "",
    introParagraphs: htmlToParagraphs(translation.landingHtml),
    cover: coverFor(catalogue, translation.slug, translation.title),
    productIds,
    flipbook: catalogue
      ? {
          status: "availableOnRequest",
          pdfUrl: null,
          pageCount: catalogue.pageCount,
          downloadAllowed: false,
          availabilityNote: "",
        }
      : {
          status: "notConfigured",
          pdfUrl: null,
          pageCount: null,
          downloadAllowed: false,
          availabilityNote: "",
        },
    featured: false,
    sortOrder,
  };
}

async function loadPublished(
  locale: Locale,
  options: PublicCollectionListOptions & { slug?: string; id?: string },
): Promise<PublicCollection[]> {
  await connectToDatabase();

  const filter: Record<string, unknown> = {
    status: "published",
    deletedAt: { $exists: false },
  };
  if (options.id) {
    if (!Types.ObjectId.isValid(options.id)) return [];
    filter._id = new Types.ObjectId(options.id);
  }

  const collections = await getCollectionModel()
    .find(filter)
    .select("_id year displayOrder currentPublishedTranslations")
    .sort({ displayOrder: 1, year: -1 })
    .lean<LeanCollection[]>()
    .exec();
  if (collections.length === 0) return [];

  const pointerIds = collections.flatMap((collection) =>
    (collection.currentPublishedTranslations ?? []).map(
      ({ translationId }) => translationId,
    ),
  );
  const translations = await getCollectionTranslationModel()
    .find({ _id: { $in: pointerIds }, translationStatus: "published" })
    .select(
      "_id collectionId locale slug title summary landingHtml translationStatus",
    )
    .lean<LeanTranslation[]>()
    .exec();
  const translationById = new Map(
    translations.map((t) => [t._id.toHexString(), t]),
  );

  const chosen: Array<{
    collection: LeanCollection;
    translation: LeanTranslation;
  }> = [];
  for (const collection of collections) {
    const candidates = (collection.currentPublishedTranslations ?? [])
      .map(({ translationId }) =>
        translationById.get(translationId.toHexString()),
      )
      .filter((t): t is LeanTranslation => t !== undefined);
    const translation = pickTranslation(candidates, locale);
    if (!translation) continue;
    if (options.slug && translation.slug !== options.slug) continue;
    chosen.push({ collection, translation });
  }

  // One query answers membership for every collection on the page.
  const memberProducts = await getProductModel()
    .find({
      status: "published",
      deletedAt: { $exists: false },
      collectionIds: { $in: chosen.map(({ collection }) => collection._id) },
    })
    .select("_id collectionIds")
    .lean<Array<{ _id: Types.ObjectId; collectionIds?: Types.ObjectId[] }>>()
    .exec();
  const productsByCollection = new Map<string, string[]>();
  for (const product of memberProducts) {
    for (const collectionId of product.collectionIds ?? []) {
      const key = collectionId.toHexString();
      productsByCollection.set(key, [
        ...(productsByCollection.get(key) ?? []),
        product._id.toHexString(),
      ]);
    }
  }

  const catalogues = await findCataloguesForCollections(
    chosen.map(({ collection }) => collection._id.toHexString()),
    locale,
  );

  const mapped = chosen.map(({ collection, translation }, index) =>
    mapCollection(
      collection,
      translation,
      productsByCollection.get(collection._id.toHexString()) ?? [],
      catalogues.get(collection._id.toHexString()) ?? null,
      locale,
      index,
    ),
  );
  return options.limit !== undefined ? mapped.slice(0, options.limit) : mapped;
}

const cachedLoad = unstable_cache(
  async (locale: Locale, options: Record<string, unknown>) =>
    loadPublished(locale, options),
  ["public-collections-v1"],
  { revalidate: 300, tags: ["collections:public"] },
);

export const mongoPublicCollectionRepository: PublicCollectionRepository = {
  async list(locale, options = {}) {
    return cachedLoad(locale, {
      featuredOnly: options.featuredOnly,
      limit: options.limit,
    });
  },
  async getById(locale, id) {
    const [collection] = await cachedLoad(locale, { id });
    return collection ?? null;
  },
  async getBySlug(locale, slug) {
    const [collection] = await cachedLoad(locale, { slug });
    return collection ?? null;
  },
};
