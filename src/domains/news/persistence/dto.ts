import type {
  RevisionWorkflowStatus,
  SeoFields,
  StructuredBlock,
  TranslationStatus,
} from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";

interface NewsPersistenceMetadataDto {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface ArticleDto extends NewsPersistenceMetadataDto {
  internalId: string;
  categoryId: string | null;
  tagKeys: string[];
  authorId: string | null;
  authorLabel: string | null;
  status: RevisionWorkflowStatus;
  currentDraftRevisionId: string | null;
  currentPublishedRevisionId: string | null;
  publishedAt: string | null;
  deletedAt: string | null;
}

export interface ArticleRevisionDto extends NewsPersistenceMetadataDto {
  articleId: string;
  version: number;
  sourceLocale: Locale;
  sourceBlocks: StructuredBlock[];
  coverMediaId: string | null;
  status: RevisionWorkflowStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  publishedAt: string | null;
}

export interface ArticleTranslationDto extends NewsPersistenceMetadataDto {
  articleId: string;
  revisionId: string;
  locale: Locale;
  slug: string;
  title: string;
  summary: string;
  body: StructuredBlock[];
  translationStatus: TranslationStatus;
  sourceRevision: number;
  reviewedBy: string | null;
  publishedAt: string | null;
  seo: SeoFields;
}

export interface PublishedArticleDto {
  article: ArticleDto;
  revision: ArticleRevisionDto;
  translation: ArticleTranslationDto;
}
