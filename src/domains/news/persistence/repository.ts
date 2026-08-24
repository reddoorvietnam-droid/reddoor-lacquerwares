import "server-only";

import { Types } from "mongoose";

import type {
  ArticleDto,
  ArticleRevisionDto,
  ArticleTranslationDto,
  PublishedArticleDto,
} from "@/domains/news/persistence/dto";
import {
  getArticleModel,
  getArticleRevisionModel,
  getArticleTranslationModel,
} from "@/domains/news/persistence/models";
import {
  dateToIso,
  objectIdToString,
  persistedBlocksToDto,
  persistedSeoToDto,
} from "@/lib/content/mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { Locale } from "@/lib/i18n/config";

export const ARTICLE_PROJECTION = {
  _id: 1,
  internalId: 1,
  categoryId: 1,
  tagKeys: 1,
  authorId: 1,
  authorLabel: 1,
  status: 1,
  currentDraftRevisionId: 1,
  currentPublishedRevisionId: 1,
  publishedAt: 1,
  deletedAt: 1,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: 1,
  updatedBy: 1,
} as const;

export const ARTICLE_REVISION_PROJECTION = {
  _id: 1,
  articleId: 1,
  version: 1,
  sourceLocale: 1,
  sourceBlocks: 1,
  coverMediaId: 1,
  status: 1,
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

export const ARTICLE_TRANSLATION_PROJECTION = {
  _id: 1,
  articleId: 1,
  revisionId: 1,
  locale: 1,
  slug: 1,
  title: 1,
  summary: 1,
  body: 1,
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

export interface ArticlePersistenceBaseRaw {
  _id: Types.ObjectId;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

export interface ArticleRaw extends ArticlePersistenceBaseRaw {
  internalId: string;
  categoryId?: Types.ObjectId;
  tagKeys: string[];
  authorId?: Types.ObjectId;
  authorLabel?: string;
  status: ArticleDto["status"];
  currentDraftRevisionId?: Types.ObjectId;
  currentPublishedRevisionId?: Types.ObjectId;
  publishedAt?: Date;
  deletedAt?: Date;
}

export interface ArticleRevisionRaw extends ArticlePersistenceBaseRaw {
  articleId: Types.ObjectId;
  version: number;
  sourceLocale: Locale;
  sourceBlocks: unknown;
  coverMediaId?: Types.ObjectId;
  status: ArticleRevisionDto["status"];
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  publishedAt?: Date;
}

export interface ArticleTranslationRaw extends ArticlePersistenceBaseRaw {
  articleId: Types.ObjectId;
  revisionId: Types.ObjectId;
  locale: Locale;
  slug: string;
  title: string;
  summary: string;
  body: unknown;
  translationStatus: ArticleTranslationDto["translationStatus"];
  sourceRevision: number;
  reviewedBy?: Types.ObjectId;
  publishedAt?: Date;
  seo: unknown;
}

function metadata(raw: ArticlePersistenceBaseRaw) {
  return {
    id: objectIdToString(raw._id),
    revision: raw.revision,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    createdBy: objectIdToString(raw.createdBy),
    updatedBy: objectIdToString(raw.updatedBy),
  };
}

export function mapArticle(raw: ArticleRaw): ArticleDto {
  return {
    ...metadata(raw),
    internalId: raw.internalId,
    categoryId: raw.categoryId ? objectIdToString(raw.categoryId) : null,
    tagKeys: raw.tagKeys,
    authorId: raw.authorId ? objectIdToString(raw.authorId) : null,
    authorLabel: raw.authorLabel ?? null,
    status: raw.status,
    currentDraftRevisionId: raw.currentDraftRevisionId
      ? objectIdToString(raw.currentDraftRevisionId)
      : null,
    currentPublishedRevisionId: raw.currentPublishedRevisionId
      ? objectIdToString(raw.currentPublishedRevisionId)
      : null,
    publishedAt: dateToIso(raw.publishedAt),
    deletedAt: dateToIso(raw.deletedAt),
  };
}

export function mapArticleRevision(
  raw: ArticleRevisionRaw,
): ArticleRevisionDto {
  return {
    ...metadata(raw),
    articleId: objectIdToString(raw.articleId),
    version: raw.version,
    sourceLocale: raw.sourceLocale,
    sourceBlocks: persistedBlocksToDto(raw.sourceBlocks),
    coverMediaId: raw.coverMediaId ? objectIdToString(raw.coverMediaId) : null,
    status: raw.status,
    submittedAt: dateToIso(raw.submittedAt),
    reviewedAt: dateToIso(raw.reviewedAt),
    reviewedBy: raw.reviewedBy ? objectIdToString(raw.reviewedBy) : null,
    publishedAt: dateToIso(raw.publishedAt),
  };
}

export function mapArticleTranslation(
  raw: ArticleTranslationRaw,
): ArticleTranslationDto {
  return {
    ...metadata(raw),
    articleId: objectIdToString(raw.articleId),
    revisionId: objectIdToString(raw.revisionId),
    locale: raw.locale,
    slug: raw.slug,
    title: raw.title,
    summary: raw.summary,
    body: persistedBlocksToDto(raw.body),
    translationStatus: raw.translationStatus,
    sourceRevision: raw.sourceRevision,
    reviewedBy: raw.reviewedBy ? objectIdToString(raw.reviewedBy) : null,
    publishedAt: dateToIso(raw.publishedAt),
    seo: persistedSeoToDto(raw.seo),
  };
}

export interface ArticlePersistenceRepository {
  findById(id: string): Promise<ArticleDto | null>;
  findRevisionById(id: string): Promise<ArticleRevisionDto | null>;
  findTranslation(
    revisionId: string,
    locale: Locale,
  ): Promise<ArticleTranslationDto | null>;
  findPublishedById(
    articleId: string,
    locale: Locale,
  ): Promise<PublishedArticleDto | null>;
}

export class MongoArticlePersistenceRepository implements ArticlePersistenceRepository {
  async findById(id: string): Promise<ArticleDto | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getArticleModel()
      .findOne({ _id: id, deletedAt: { $exists: false } }, ARTICLE_PROJECTION)
      .lean()
      .exec()) as ArticleRaw | null;
    return raw ? mapArticle(raw) : null;
  }

  async findRevisionById(id: string): Promise<ArticleRevisionDto | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getArticleRevisionModel()
      .findById(id, ARTICLE_REVISION_PROJECTION)
      .lean()
      .exec()) as ArticleRevisionRaw | null;
    return raw ? mapArticleRevision(raw) : null;
  }

  async findTranslation(
    revisionId: string,
    locale: Locale,
  ): Promise<ArticleTranslationDto | null> {
    if (!Types.ObjectId.isValid(revisionId)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getArticleTranslationModel()
      .findOne({ revisionId, locale }, ARTICLE_TRANSLATION_PROJECTION)
      .lean()
      .exec()) as ArticleTranslationRaw | null;
    return raw ? mapArticleTranslation(raw) : null;
  }

  async findPublishedById(
    articleId: string,
    locale: Locale,
  ): Promise<PublishedArticleDto | null> {
    const article = await this.findById(articleId);

    if (
      !article ||
      article.status !== "published" ||
      !article.currentPublishedRevisionId
    ) {
      return null;
    }

    const [revision, translation] = await Promise.all([
      this.findRevisionById(article.currentPublishedRevisionId),
      this.findTranslation(article.currentPublishedRevisionId, locale),
    ]);

    if (
      !revision ||
      revision.status !== "published" ||
      !translation ||
      translation.translationStatus !== "published"
    ) {
      return null;
    }

    return { article, revision, translation };
  }
}
