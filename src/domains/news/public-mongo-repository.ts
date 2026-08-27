import "server-only";

import { Types } from "mongoose";
import { unstable_cache } from "next/cache";

import { categoryTag, splitCategoryFromTags } from "@/domains/news/categories";
import {
  getArticleModel,
  getArticleTranslationModel,
} from "@/domains/news/persistence/models";
import type {
  PublicNewsArticle,
  PublicNewsListOptions,
  PublicNewsRepository,
} from "@/domains/news/public-contract";
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
 * Reads the articles the newsroom workflow has published: root record,
 * current revision, and a translation must all be `published` before a story
 * is visible.
 *
 * No article-category taxonomy is persisted yet, so category fields are
 * empty, a `categorySlug` filter matches nothing, and `featuredOnly` means
 * "the most recent stories" — which is what a front page wants from a
 * newsroom anyway.
 */

type LeanArticle = {
  _id: Types.ObjectId;
  tagKeys?: string[];
  authorLabel?: string;
  currentPublishedRevisionId?: Types.ObjectId;
  publishedAt?: Date;
};

type LeanTranslation = {
  articleId: Types.ObjectId;
  revisionId: Types.ObjectId;
  locale: Locale;
  slug: string;
  title: string;
  summary: string;
  body?: unknown[];
};

function coverImage(
  stored: StoredImageDescriptor | undefined,
  slug: string,
  title: string,
): PublicNewsArticle["image"] {
  if (stored) {
    try {
      const storage = CloudinaryMediaStorage.fromEnvironment();
      return {
        assetKey: `news-${slug}-01`,
        src: storage.buildImageUrl(stored.publicId, stored.assetVersion, 1600),
        alt: stored.alt ?? title,
        width: stored.width,
        height: stored.height,
        assetPending: false,
        replacementHint: "",
      };
    } catch {
      // Storage unconfigured on this machine; fall through to the slot.
    }
  }
  return pendingImage(`news-${slug}-01`, title, 1600, 1000);
}

function mapArticle(
  article: LeanArticle,
  translation: LeanTranslation,
  cover: StoredImageDescriptor | undefined,
  locale: Locale,
  sortOrder: number,
): PublicNewsArticle {
  const { category, tags } = splitCategoryFromTags(article.tagKeys ?? []);
  return {
    id: article._id.toHexString(),
    marker: null,
    isDemo: false,
    locale,
    slug: translation.slug,
    title: translation.title,
    excerpt: translation.summary,
    content: blocksToParagraphs(translation.body as never[]).map((text) => ({
      type: "paragraph" as const,
      text,
    })),
    categorySlug: category?.slug ?? "",
    categoryLabel: category?.labels[locale] ?? "",
    tags,
    author: article.authorLabel ?? null,
    publishedAt: article.publishedAt
      ? article.publishedAt.toISOString().slice(0, 10)
      : null,
    image: coverImage(cover, translation.slug, translation.title),
    featured: false,
    sortOrder,
  };
}

async function loadPublished(
  locale: Locale,
  options: PublicNewsListOptions & { slug?: string; id?: string },
): Promise<PublicNewsArticle[]> {
  await connectToDatabase();

  const filter: Record<string, unknown> = {
    status: "published",
    deletedAt: { $exists: false },
    currentPublishedRevisionId: { $exists: true, $ne: null },
  };
  if (options.categorySlug) {
    filter.tagKeys = categoryTag(options.categorySlug);
  }
  if (options.id) {
    if (!Types.ObjectId.isValid(options.id)) return [];
    filter._id = new Types.ObjectId(options.id);
  }

  const articles = await getArticleModel()
    .find(filter)
    .select("_id tagKeys authorLabel currentPublishedRevisionId publishedAt")
    .sort({ publishedAt: -1 })
    .lean<LeanArticle[]>()
    .exec();
  if (articles.length === 0) return [];

  const revisionIds = articles
    .map((a) => a.currentPublishedRevisionId)
    .filter((id): id is Types.ObjectId => id !== undefined);
  const translations = await getArticleTranslationModel()
    .find({ revisionId: { $in: revisionIds }, translationStatus: "published" })
    .select("articleId revisionId locale slug title summary body")
    .lean<LeanTranslation[]>()
    .exec();

  const translationsByRevision = new Map<string, LeanTranslation[]>();
  for (const t of translations) {
    const key = t.revisionId.toHexString();
    translationsByRevision.set(key, [
      ...(translationsByRevision.get(key) ?? []),
      t,
    ]);
  }

  const covers = await findImagesForEntities(
    "article",
    articles.map((article) => article._id.toHexString()),
  );

  const mapped: PublicNewsArticle[] = [];
  for (const article of articles) {
    const key = article.currentPublishedRevisionId?.toHexString();
    if (!key) continue;
    const translation = pickTranslation(
      translationsByRevision.get(key) ?? [],
      locale,
    );
    if (!translation) continue;
    if (options.slug && translation.slug !== options.slug) continue;
    mapped.push(
      mapArticle(
        article,
        translation,
        covers.get(article._id.toHexString())?.[0],
        locale,
        mapped.length,
      ),
    );
  }

  const offset = options.offset ?? 0;
  const end = options.limit !== undefined ? offset + options.limit : undefined;
  return mapped.slice(offset, end);
}

const cachedLoad = unstable_cache(
  async (locale: Locale, options: Record<string, unknown>) =>
    loadPublished(locale, options),
  ["public-news-v1"],
  { revalidate: 300, tags: ["articles:public"] },
);

export const mongoPublicNewsRepository: PublicNewsRepository = {
  async list(locale, options = {}) {
    return cachedLoad(locale, {
      categorySlug: options.categorySlug,
      featuredOnly: options.featuredOnly,
      offset: options.offset,
      limit: options.limit,
    });
  },
  async getById(locale, id) {
    const [article] = await cachedLoad(locale, { id });
    return article ?? null;
  },
  async getBySlug(locale, slug) {
    const [article] = await cachedLoad(locale, { slug });
    return article ?? null;
  },
};
