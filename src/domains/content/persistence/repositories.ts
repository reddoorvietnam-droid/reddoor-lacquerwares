import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import {
  dateToIso,
  objectIdToString,
  persistedBlocksToDto,
  persistedSeoToDto,
} from "@/lib/content/mongoose";
import { localizedPathSchema } from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";
import type {
  ContentEntryDto,
  ContentRevisionDto,
  ContentTranslationDto,
  LocalizedEntityType,
  LocalizedRouteDto,
  PublishedContentDto,
  SiteSettingsDto,
} from "@/domains/content/persistence/dto";
import {
  getContentEntryModel,
  getContentRevisionModel,
  getContentTranslationModel,
  getLocalizedRouteModel,
  getSiteSettingsModel,
} from "@/domains/content/persistence/models";

export const SITE_SETTINGS_PROJECTION = {
  _id: 1,
  version: 1,
  status: 1,
  translations: 1,
  publicEmail: 1,
  publicPhone: 1,
  socialLinks: 1,
  publishedAt: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: 1,
  updatedBy: 1,
  revision: 1,
} as const;

export const CONTENT_ENTRY_PROJECTION = {
  _id: 1,
  code: 1,
  type: 1,
  placement: 1,
  status: 1,
  currentDraftRevisionId: 1,
  currentPublishedRevisionId: 1,
  deletedAt: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: 1,
  updatedBy: 1,
  revision: 1,
} as const;

export const CONTENT_REVISION_PROJECTION = {
  _id: 1,
  entryId: 1,
  version: 1,
  blocks: 1,
  status: 1,
  sourceLocale: 1,
  submittedAt: 1,
  reviewedAt: 1,
  reviewedBy: 1,
  publishedAt: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: 1,
  updatedBy: 1,
  revision: 1,
} as const;

export const CONTENT_TRANSLATION_PROJECTION = {
  _id: 1,
  entryId: 1,
  revisionId: 1,
  locale: 1,
  slug: 1,
  title: 1,
  summary: 1,
  blocks: 1,
  translationStatus: 1,
  sourceRevision: 1,
  reviewedBy: 1,
  publishedAt: 1,
  seo: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: 1,
  updatedBy: 1,
  revision: 1,
} as const;

export const LOCALIZED_ROUTE_PROJECTION = {
  _id: 1,
  locale: 1,
  path: 1,
  entityType: 1,
  entityId: 1,
  versionId: 1,
  active: 1,
  redirectToPath: 1,
  redirectStatus: 1,
  replacedByRouteId: 1,
  activatedAt: 1,
  deactivatedAt: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: 1,
  updatedBy: 1,
  revision: 1,
} as const;

interface BaseRaw {
  _id: Types.ObjectId;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

interface SiteSettingsRaw extends BaseRaw {
  version: number;
  status: SiteSettingsDto["status"];
  translations: Array<{
    locale: Locale;
    companyName: string;
    tagline?: string;
    description?: string;
    addressLabel?: string;
  }>;
  publicEmail?: string;
  publicPhone?: string;
  socialLinks: Array<{ platform: string; label: string; url: string }>;
  publishedAt?: Date;
}

interface ContentEntryRaw extends BaseRaw {
  code: string;
  type: ContentEntryDto["type"];
  placement: string;
  status: ContentEntryDto["status"];
  currentDraftRevisionId?: Types.ObjectId;
  currentPublishedRevisionId?: Types.ObjectId;
  deletedAt?: Date;
}

interface ContentRevisionRaw extends BaseRaw {
  entryId: Types.ObjectId;
  version: number;
  blocks: unknown;
  status: ContentRevisionDto["status"];
  sourceLocale: Locale;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  publishedAt?: Date;
}

interface ContentTranslationRaw extends BaseRaw {
  entryId: Types.ObjectId;
  revisionId: Types.ObjectId;
  locale: Locale;
  slug?: string;
  title: string;
  summary?: string;
  blocks: unknown;
  translationStatus: ContentTranslationDto["translationStatus"];
  sourceRevision: number;
  reviewedBy?: Types.ObjectId;
  publishedAt?: Date;
  seo: unknown;
}

interface LocalizedRouteRaw extends BaseRaw {
  locale: Locale;
  path: string;
  entityType: LocalizedEntityType;
  entityId: Types.ObjectId;
  versionId: Types.ObjectId;
  active: boolean;
  redirectToPath?: string;
  redirectStatus?: 301 | 302 | 307 | 308;
  replacedByRouteId?: Types.ObjectId;
  activatedAt?: Date;
  deactivatedAt?: Date;
}

function metadata(raw: BaseRaw) {
  return {
    id: objectIdToString(raw._id),
    revision: raw.revision,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    createdBy: objectIdToString(raw.createdBy),
    updatedBy: objectIdToString(raw.updatedBy),
  };
}

function mapContentEntry(raw: ContentEntryRaw): ContentEntryDto {
  return {
    ...metadata(raw),
    code: raw.code,
    type: raw.type,
    placement: raw.placement,
    status: raw.status,
    currentDraftRevisionId: raw.currentDraftRevisionId
      ? objectIdToString(raw.currentDraftRevisionId)
      : null,
    currentPublishedRevisionId: raw.currentPublishedRevisionId
      ? objectIdToString(raw.currentPublishedRevisionId)
      : null,
    deletedAt: dateToIso(raw.deletedAt),
  };
}

function mapContentRevision(raw: ContentRevisionRaw): ContentRevisionDto {
  return {
    ...metadata(raw),
    entryId: objectIdToString(raw.entryId),
    version: raw.version,
    blocks: persistedBlocksToDto(raw.blocks),
    status: raw.status,
    sourceLocale: raw.sourceLocale,
    submittedAt: dateToIso(raw.submittedAt),
    reviewedAt: dateToIso(raw.reviewedAt),
    reviewedBy: raw.reviewedBy ? objectIdToString(raw.reviewedBy) : null,
    publishedAt: dateToIso(raw.publishedAt),
  };
}

function mapContentTranslation(
  raw: ContentTranslationRaw,
): ContentTranslationDto {
  return {
    ...metadata(raw),
    entryId: objectIdToString(raw.entryId),
    revisionId: objectIdToString(raw.revisionId),
    locale: raw.locale,
    slug: raw.slug ?? null,
    title: raw.title,
    summary: raw.summary ?? null,
    blocks: persistedBlocksToDto(raw.blocks),
    translationStatus: raw.translationStatus,
    sourceRevision: raw.sourceRevision,
    reviewedBy: raw.reviewedBy ? objectIdToString(raw.reviewedBy) : null,
    publishedAt: dateToIso(raw.publishedAt),
    seo: persistedSeoToDto(raw.seo),
  };
}

function mapLocalizedRoute(raw: LocalizedRouteRaw): LocalizedRouteDto {
  return {
    ...metadata(raw),
    locale: raw.locale,
    path: raw.path,
    entityType: raw.entityType,
    entityId: objectIdToString(raw.entityId),
    versionId: objectIdToString(raw.versionId),
    active: raw.active,
    redirectToPath: raw.redirectToPath ?? null,
    redirectStatus: raw.redirectStatus ?? null,
    replacedByRouteId: raw.replacedByRouteId
      ? objectIdToString(raw.replacedByRouteId)
      : null,
    activatedAt: dateToIso(raw.activatedAt),
    deactivatedAt: dateToIso(raw.deactivatedAt),
  };
}

export interface SiteSettingsRepository {
  findPublished(locale: Locale): Promise<SiteSettingsDto | null>;
}

export class MongoSiteSettingsRepository implements SiteSettingsRepository {
  async findPublished(locale: Locale): Promise<SiteSettingsDto | null> {
    await connectToDatabase();
    const raw = (await getSiteSettingsModel()
      .findOne(
        { singletonKey: "site-settings", status: "published" },
        SITE_SETTINGS_PROJECTION,
      )
      .lean()
      .exec()) as SiteSettingsRaw | null;
    const translation = raw?.translations.find(
      (item) => item.locale === locale,
    );

    if (!raw || !translation) {
      return null;
    }

    return {
      ...metadata(raw),
      version: raw.version,
      status: raw.status,
      translation: {
        locale: translation.locale,
        companyName: translation.companyName,
        tagline: translation.tagline ?? null,
        description: translation.description ?? null,
        addressLabel: translation.addressLabel ?? null,
      },
      publicEmail: raw.publicEmail ?? null,
      publicPhone: raw.publicPhone ?? null,
      socialLinks: raw.socialLinks,
      publishedAt: dateToIso(raw.publishedAt),
    };
  }
}

export interface ContentRepository {
  findEntryById(id: string): Promise<ContentEntryDto | null>;
  findEntryByCode(code: string): Promise<ContentEntryDto | null>;
  findRevisionById(id: string): Promise<ContentRevisionDto | null>;
  findTranslation(
    revisionId: string,
    locale: Locale,
  ): Promise<ContentTranslationDto | null>;
  findPublishedByCode(
    code: string,
    locale: Locale,
  ): Promise<PublishedContentDto | null>;
}

export class MongoContentRepository implements ContentRepository {
  async findEntryById(id: string): Promise<ContentEntryDto | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getContentEntryModel()
      .findOne(
        { _id: id, deletedAt: { $exists: false } },
        CONTENT_ENTRY_PROJECTION,
      )
      .lean()
      .exec()) as ContentEntryRaw | null;

    return raw ? mapContentEntry(raw) : null;
  }

  async findEntryByCode(code: string): Promise<ContentEntryDto | null> {
    await connectToDatabase();
    const raw = (await getContentEntryModel()
      .findOne(
        { code: code.trim().toLowerCase(), deletedAt: { $exists: false } },
        CONTENT_ENTRY_PROJECTION,
      )
      .lean()
      .exec()) as ContentEntryRaw | null;

    return raw ? mapContentEntry(raw) : null;
  }

  async findRevisionById(id: string): Promise<ContentRevisionDto | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getContentRevisionModel()
      .findById(id, CONTENT_REVISION_PROJECTION)
      .lean()
      .exec()) as ContentRevisionRaw | null;

    return raw ? mapContentRevision(raw) : null;
  }

  async findTranslation(
    revisionId: string,
    locale: Locale,
  ): Promise<ContentTranslationDto | null> {
    if (!Types.ObjectId.isValid(revisionId)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getContentTranslationModel()
      .findOne({ revisionId, locale }, CONTENT_TRANSLATION_PROJECTION)
      .lean()
      .exec()) as ContentTranslationRaw | null;

    return raw ? mapContentTranslation(raw) : null;
  }

  async findPublishedByCode(
    code: string,
    locale: Locale,
  ): Promise<PublishedContentDto | null> {
    const entry = await this.findEntryByCode(code);

    if (
      !entry ||
      entry.status !== "published" ||
      !entry.currentPublishedRevisionId
    ) {
      return null;
    }

    const [revision, translation] = await Promise.all([
      this.findRevisionById(entry.currentPublishedRevisionId),
      this.findTranslation(entry.currentPublishedRevisionId, locale),
    ]);

    if (
      !revision ||
      revision.status !== "published" ||
      !translation ||
      translation.translationStatus !== "published"
    ) {
      return null;
    }

    return { entry, revision, translation };
  }
}

export interface LocalizedRouteRepository {
  findActive(locale: Locale, path: string): Promise<LocalizedRouteDto | null>;
  findActiveForEntity(
    entityType: LocalizedEntityType,
    entityId: string,
    locale: Locale,
  ): Promise<LocalizedRouteDto | null>;
  isPathAvailable(
    locale: Locale,
    path: string,
    excludingRouteId?: string,
  ): Promise<boolean>;
}

export class MongoLocalizedRouteRepository implements LocalizedRouteRepository {
  async findActive(
    locale: Locale,
    path: string,
  ): Promise<LocalizedRouteDto | null> {
    await connectToDatabase();
    const raw = (await getLocalizedRouteModel()
      .findOne(
        { locale, path: localizedPathSchema.parse(path), active: true },
        LOCALIZED_ROUTE_PROJECTION,
      )
      .lean()
      .exec()) as LocalizedRouteRaw | null;

    return raw ? mapLocalizedRoute(raw) : null;
  }

  async findActiveForEntity(
    entityType: LocalizedEntityType,
    entityId: string,
    locale: Locale,
  ): Promise<LocalizedRouteDto | null> {
    if (!Types.ObjectId.isValid(entityId)) {
      return null;
    }

    await connectToDatabase();
    const raw = (await getLocalizedRouteModel()
      .findOne(
        { entityType, entityId, locale, active: true },
        LOCALIZED_ROUTE_PROJECTION,
      )
      .lean()
      .exec()) as LocalizedRouteRaw | null;

    return raw ? mapLocalizedRoute(raw) : null;
  }

  async isPathAvailable(
    locale: Locale,
    path: string,
    excludingRouteId?: string,
  ): Promise<boolean> {
    const filter: Record<string, unknown> = {
      locale,
      path: localizedPathSchema.parse(path),
      active: true,
    };

    if (excludingRouteId && Types.ObjectId.isValid(excludingRouteId)) {
      filter._id = { $ne: new Types.ObjectId(excludingRouteId) };
    }

    await connectToDatabase();
    const collision = await getLocalizedRouteModel().exists(filter);
    return collision === null;
  }
}
