import type {
  RevisionWorkflowStatus,
  SeoFields,
  StableContentStatus,
  StructuredBlock,
  TranslationStatus,
} from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";

export interface PersistenceMetadataDto {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface LocalizedSiteSettingsDto {
  locale: Locale;
  companyName: string;
  tagline: string | null;
  description: string | null;
  addressLabel: string | null;
}

export interface SiteSettingsDto extends PersistenceMetadataDto {
  version: number;
  status: RevisionWorkflowStatus;
  translation: LocalizedSiteSettingsDto;
  publicEmail: string | null;
  publicPhone: string | null;
  socialLinks: ReadonlyArray<{
    platform: string;
    label: string;
    url: string;
  }>;
  publishedAt: string | null;
}

export interface ContentEntryDto extends PersistenceMetadataDto {
  code: string;
  type: "page" | "section" | "processStage" | "global";
  placement: string;
  status: StableContentStatus;
  currentDraftRevisionId: string | null;
  currentPublishedRevisionId: string | null;
  deletedAt: string | null;
}

export interface ContentRevisionDto extends PersistenceMetadataDto {
  entryId: string;
  version: number;
  blocks: StructuredBlock[];
  status: RevisionWorkflowStatus;
  sourceLocale: Locale;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  publishedAt: string | null;
}

export interface ContentTranslationDto extends PersistenceMetadataDto {
  entryId: string;
  revisionId: string;
  locale: Locale;
  slug: string | null;
  title: string;
  summary: string | null;
  blocks: StructuredBlock[];
  translationStatus: TranslationStatus;
  sourceRevision: number;
  reviewedBy: string | null;
  publishedAt: string | null;
  seo: SeoFields;
}

export interface PublishedContentDto {
  entry: ContentEntryDto;
  revision: ContentRevisionDto;
  translation: ContentTranslationDto;
}

export type LocalizedEntityType =
  "content" | "product" | "article" | "collection";

export interface LocalizedRouteDto extends PersistenceMetadataDto {
  locale: Locale;
  path: string;
  entityType: LocalizedEntityType;
  entityId: string;
  versionId: string;
  active: boolean;
  redirectToPath: string | null;
  redirectStatus: 301 | 302 | 307 | 308 | null;
  replacedByRouteId: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
}
