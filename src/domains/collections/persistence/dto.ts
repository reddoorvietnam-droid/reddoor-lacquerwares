import type {
  RevisionWorkflowStatus,
  SeoFields,
  TranslationStatus,
} from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";

interface CollectionPersistenceMetadataDto {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CollectionDto extends CollectionPersistenceMetadataDto {
  code: string;
  year: number | null;
  displayOrder: number;
  status: RevisionWorkflowStatus;
  currentDraftTranslations: Array<{
    locale: Locale;
    translationId: string;
  }>;
  currentPublishedTranslations: Array<{
    locale: Locale;
    translationId: string;
  }>;
  deletedAt: string | null;
}

export interface CollectionTranslationDto extends CollectionPersistenceMetadataDto {
  collectionId: string;
  version: number;
  locale: Locale;
  slug: string;
  title: string;
  summary: string | null;
  landingHtml: string;
  translationStatus: TranslationStatus;
  sourceRevision: number;
  reviewedBy: string | null;
  publishedAt: string | null;
  seo: SeoFields;
}

export interface PublishedCollectionDto {
  collection: CollectionDto;
  translation: CollectionTranslationDto;
}
