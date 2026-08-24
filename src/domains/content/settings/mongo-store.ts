import "server-only";

import type { ClientSession } from "mongodb";
import { Types } from "mongoose";

import type { AuditEventInput } from "@/domains/audit/contracts";
import { appendAuditEventWithSession } from "@/domains/audit/mongo-repository";
import {
  type CreateSiteSettingsDraftStoreInput,
  type PublishSiteSettingsStoreInput,
  type ReturnSiteSettingsToDraftStoreInput,
  type SiteSettingsAdminAggregateDto,
  type SiteSettingsCommandStore,
  SiteSettingsCommandStoreError,
  type SiteSettingsStoreAccessScope,
  type SiteSettingsVersionDto,
  type SubmitSiteSettingsForReviewStoreInput,
  type UpdateSiteSettingsDraftStoreInput,
} from "@/domains/content/settings/contracts";
import {
  siteSettingsSocialLinkSchema,
  type PublishedSettingsExpectation,
  type SiteSettingsPayload,
} from "@/domains/content/settings/schemas";
import { getSiteSettingsModel } from "@/domains/content/persistence/models";
import { SITE_SETTINGS_PROJECTION } from "@/domains/content/persistence/repositories";
import type { RevisionWorkflowStatus } from "@/lib/content/contracts";
import { dateToIso, objectIdToString } from "@/lib/content/mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { locales, type Locale } from "@/lib/i18n/config";

type BaseRaw = {
  _id: Types.ObjectId;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
};

type SiteSettingsTranslationRaw = {
  locale: Locale;
  companyName: string;
  tagline?: string;
  description?: string;
  addressLabel?: string;
};

type SiteSettingsRaw = BaseRaw & {
  singletonKey: "site-settings";
  version: number;
  status: RevisionWorkflowStatus;
  translations: SiteSettingsTranslationRaw[];
  publicEmail?: string;
  publicPhone?: string;
  socialLinks: Array<{
    platform: string;
    label: string;
    url: string;
  }>;
  publishedAt?: Date;
};

function asObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new SiteSettingsCommandStoreError(
      "PERSISTENCE_FAILURE",
      `${field} must be a valid persisted identifier.`,
    );
  }

  return new Types.ObjectId(value);
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

function translationStatus(
  status: RevisionWorkflowStatus,
): "draft" | "inReview" | "published" {
  if (status === "draft" || status === "inReview") {
    return status;
  }

  return "published";
}

function mapSettings(raw: SiteSettingsRaw): SiteSettingsVersionDto {
  const status = translationStatus(raw.status);
  const translations = raw.translations.map((translation) => ({
    locale: translation.locale,
    companyName: translation.companyName,
    tagline: translation.tagline ?? null,
    description: translation.description ?? null,
    addressLabel: translation.addressLabel ?? null,
    status,
  }));
  const translationsByLocale = new Map(
    translations.map((translation) => [translation.locale, translation]),
  );

  return {
    ...metadata(raw),
    version: raw.version,
    status: raw.status,
    translations,
    translationQuality: locales.map((locale) => {
      const translation = translationsByLocale.get(locale);
      return translation
        ? { locale, status: translation.status, quality: "ready" as const }
        : { locale, status: "missing" as const, quality: "missing" as const };
    }),
    publicEmail: raw.publicEmail ?? null,
    publicPhone: raw.publicPhone ?? null,
    socialLinks: raw.socialLinks.map((link) =>
      siteSettingsSocialLinkSchema.parse(link),
    ),
    publishedAt: dateToIso(raw.publishedAt),
  };
}

function writePayload(payload: SiteSettingsPayload): Record<string, unknown> {
  return {
    translations: payload.translations.map((translation) => ({
      locale: translation.locale,
      companyName: translation.companyName,
      ...(translation.tagline === undefined
        ? {}
        : { tagline: translation.tagline }),
      ...(translation.description === undefined
        ? {}
        : { description: translation.description }),
      ...(translation.addressLabel === undefined
        ? {}
        : { addressLabel: translation.addressLabel }),
    })),
    socialLinks: payload.socialLinks.map((link) => ({ ...link })),
    ...(payload.publicEmail === undefined
      ? {}
      : { publicEmail: payload.publicEmail }),
    ...(payload.publicPhone === undefined
      ? {}
      : { publicPhone: payload.publicPhone }),
  };
}

function updatePayload(payload: SiteSettingsPayload): Record<string, unknown> {
  const unset: Record<string, 1> = {};
  if (payload.publicEmail === undefined) {
    unset.publicEmail = 1;
  }
  if (payload.publicPhone === undefined) {
    unset.publicPhone = 1;
  }

  return {
    $set: writePayload(payload),
    ...(Object.keys(unset).length === 0 ? {} : { $unset: unset }),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function matchesPublishedExpectation(
  expectation: PublishedSettingsExpectation,
  published: SiteSettingsRaw | null,
): boolean {
  if (!expectation.exists) {
    return !published;
  }

  return Boolean(
    published &&
    published._id.equals(expectation.settingsId) &&
    published.revision === expectation.expectedRevision,
  );
}

function hasAllTranslations(raw: SiteSettingsRaw): boolean {
  const translatedLocales = new Set(
    raw.translations
      .filter((translation) => translation.companyName.trim().length > 0)
      .map((translation) => translation.locale),
  );

  return (
    translatedLocales.size === locales.length &&
    locales.every((locale) => translatedLocales.has(locale))
  );
}

function validateAtomicPublishAudit(
  input: PublishSiteSettingsStoreInput,
): AuditEventInput {
  const event = input.auditEvent;
  const valid =
    event.actor.type === "user" &&
    event.actor.userId === input.actorId &&
    event.action === "site-settings.published" &&
    event.resourceType === "siteSettings" &&
    event.resourceId === input.settingsId &&
    event.occurredAt.getTime() === input.occurredAt.getTime() &&
    event.permissionDecision?.permission === "content.publish" &&
    event.permissionDecision.outcome === "allowed" &&
    event.permissionDecision.scope === "all";

  if (!valid) {
    throw new SiteSettingsCommandStoreError(
      "PERSISTENCE_FAILURE",
      "The atomic publication audit does not match the settings command.",
    );
  }

  return event;
}

export class MongoSiteSettingsCommandStore implements SiteSettingsCommandStore {
  async readCurrent(
    scope: SiteSettingsStoreAccessScope,
  ): Promise<SiteSettingsAdminAggregateDto> {
    if (scope.kind === "none") {
      return { draft: null, published: null };
    }

    await connectToDatabase();
    return this.#readCurrent(undefined);
  }

  async createDraft(
    input: CreateSiteSettingsDraftStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto> {
    return this.#transaction(async (session) => {
      const SiteSettings = getSiteSettingsModel();
      const current = await this.#readCurrent(session);

      if (current.draft) {
        throw new SiteSettingsCommandStoreError(
          "DRAFT_EXISTS",
          "A current site-settings draft already exists.",
        );
      }

      const published = (await SiteSettings.findOne(
        { singletonKey: "site-settings", status: "published" },
        SITE_SETTINGS_PROJECTION,
      )
        .session(session)
        .lean<SiteSettingsRaw>()
        .exec()) as SiteSettingsRaw | null;

      if (!matchesPublishedExpectation(input.basePublished, published)) {
        throw new SiteSettingsCommandStoreError(
          "STALE_REVISION",
          "Published site settings changed before draft creation committed.",
        );
      }

      const latest = await SiteSettings.findOne(
        { singletonKey: "site-settings" },
        { version: 1 },
      )
        .sort({ version: -1 })
        .session(session)
        .lean<{ version: number }>()
        .exec();
      const actorId = asObjectId(input.actorId, "actorId");

      await SiteSettings.create(
        [
          {
            _id: new Types.ObjectId(),
            singletonKey: "site-settings",
            version: (latest?.version ?? 0) + 1,
            status: "draft",
            ...writePayload(input),
            createdBy: actorId,
            updatedBy: actorId,
            createdAt: input.occurredAt,
            updatedAt: input.occurredAt,
          },
        ],
        { session },
      );

      return this.#requireCurrentDraft(session);
    }, "DRAFT_EXISTS");
  }

  async updateDraft(
    scope: SiteSettingsStoreAccessScope,
    input: UpdateSiteSettingsDraftStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto> {
    if (scope.kind === "none") {
      throw new SiteSettingsCommandStoreError(
        "NOT_FOUND",
        "The site-settings draft is outside the authorized scope.",
      );
    }

    return this.#transaction(async (session) => {
      const settingsId = asObjectId(input.settingsId, "settingsId");
      const actorId = asObjectId(input.actorId, "actorId");
      const operation = updatePayload(input);
      const updated = await getSiteSettingsModel()
        .findOneAndUpdate(
          {
            _id: settingsId,
            singletonKey: "site-settings",
            status: "draft",
            revision: input.expectedRevision,
          },
          {
            ...operation,
            $set: {
              ...(operation.$set as Record<string, unknown>),
              updatedBy: actorId,
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<SiteSettingsRaw>()
        .exec();

      if (!updated) {
        await this.#throwMutationFailure(input.settingsId, "draft", session);
      }

      return this.#requireCurrentDraft(session);
    });
  }

  async submitForReview(
    scope: SiteSettingsStoreAccessScope,
    input: SubmitSiteSettingsForReviewStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto> {
    if (scope.kind === "none") {
      throw new SiteSettingsCommandStoreError(
        "NOT_FOUND",
        "The site-settings draft is outside the authorized scope.",
      );
    }

    return this.#transaction(async (session) => {
      const updated = await getSiteSettingsModel()
        .findOneAndUpdate(
          {
            _id: asObjectId(input.settingsId, "settingsId"),
            singletonKey: "site-settings",
            status: "draft",
            revision: input.expectedRevision,
          },
          {
            $set: {
              status: "inReview",
              updatedBy: asObjectId(input.actorId, "actorId"),
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<SiteSettingsRaw>()
        .exec();

      if (!updated) {
        await this.#throwMutationFailure(input.settingsId, "draft", session);
      }
      if (!hasAllTranslations(updated as SiteSettingsRaw)) {
        throw new SiteSettingsCommandStoreError(
          "INCOMPLETE_TRANSLATIONS",
          "All six locale translations are required before review.",
        );
      }

      return this.#requireCurrentDraft(session);
    });
  }

  async returnToDraft(
    input: ReturnSiteSettingsToDraftStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto> {
    return this.#transaction(async (session) => {
      const updated = await getSiteSettingsModel()
        .findOneAndUpdate(
          {
            _id: asObjectId(input.settingsId, "settingsId"),
            singletonKey: "site-settings",
            status: "inReview",
            revision: input.expectedRevision,
          },
          {
            $set: {
              status: "draft",
              updatedBy: asObjectId(input.actorId, "actorId"),
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<SiteSettingsRaw>()
        .exec();

      if (!updated) {
        await this.#throwMutationFailure(input.settingsId, "inReview", session);
      }

      return this.#requireCurrentDraft(session);
    });
  }

  async publish(
    input: PublishSiteSettingsStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto> {
    return this.#transaction(async (session) => {
      const SiteSettings = getSiteSettingsModel();
      const settingsId = asObjectId(input.settingsId, "settingsId");
      const auditEvent = validateAtomicPublishAudit(input);
      const candidate = (await SiteSettings.findOne(
        {
          _id: settingsId,
          singletonKey: "site-settings",
          status: "inReview",
          revision: input.expectedRevision,
        },
        SITE_SETTINGS_PROJECTION,
      )
        .session(session)
        .lean<SiteSettingsRaw>()
        .exec()) as SiteSettingsRaw | null;

      if (!candidate) {
        await this.#throwMutationFailure(input.settingsId, "inReview", session);
      }
      if (!hasAllTranslations(candidate as SiteSettingsRaw)) {
        throw new SiteSettingsCommandStoreError(
          "INCOMPLETE_TRANSLATIONS",
          "All six locale translations are required before publication.",
        );
      }

      const actorId = asObjectId(input.actorId, "actorId");
      await SiteSettings.updateMany(
        {
          singletonKey: "site-settings",
          status: "published",
          _id: { $ne: settingsId },
        },
        {
          $set: {
            status: "archived",
            updatedBy: actorId,
            updatedAt: input.occurredAt,
          },
          $inc: { revision: 1 },
        },
        { runValidators: true, session },
      ).exec();

      const published = await SiteSettings.findOneAndUpdate(
        {
          _id: settingsId,
          singletonKey: "site-settings",
          status: "inReview",
          revision: input.expectedRevision,
        },
        {
          $set: {
            status: "published",
            publishedAt: input.occurredAt,
            updatedBy: actorId,
            updatedAt: input.occurredAt,
          },
          $inc: { revision: 1 },
        },
        { new: true, runValidators: true, session },
      )
        .lean<SiteSettingsRaw>()
        .exec();

      if (!published) {
        throw new SiteSettingsCommandStoreError(
          "STALE_REVISION",
          "The reviewed site settings changed before publication committed.",
        );
      }

      await appendAtomicAuditEvent(auditEvent, session);

      const aggregate = await this.#readCurrent(session);
      if (aggregate.published?.id !== input.settingsId || aggregate.draft) {
        throw new SiteSettingsCommandStoreError(
          "PERSISTENCE_FAILURE",
          "The published site-settings pointer is inconsistent.",
        );
      }
      return aggregate;
    });
  }

  async #readCurrent(
    session: ClientSession | undefined,
  ): Promise<SiteSettingsAdminAggregateDto> {
    const raws = (await getSiteSettingsModel()
      .find(
        {
          singletonKey: "site-settings",
          status: { $in: ["draft", "inReview", "published"] },
        },
        SITE_SETTINGS_PROJECTION,
      )
      .sort({ version: -1 })
      .session(session ?? null)
      .lean<SiteSettingsRaw[]>()
      .exec()) as SiteSettingsRaw[];
    const drafts = raws.filter(
      ({ status }) => status === "draft" || status === "inReview",
    );
    const published = raws.filter(({ status }) => status === "published");

    if (drafts.length > 1 || published.length > 1) {
      throw new SiteSettingsCommandStoreError(
        "PERSISTENCE_FAILURE",
        "Site settings contain conflicting current versions.",
      );
    }

    return {
      draft: drafts[0] ? mapSettings(drafts[0]) : null,
      published: published[0] ? mapSettings(published[0]) : null,
    };
  }

  async #requireCurrentDraft(
    session: ClientSession,
  ): Promise<SiteSettingsAdminAggregateDto> {
    const aggregate = await this.#readCurrent(session);
    if (!aggregate.draft) {
      throw new SiteSettingsCommandStoreError(
        "PERSISTENCE_FAILURE",
        "The committed site-settings draft could not be reloaded.",
      );
    }
    return aggregate;
  }

  async #throwMutationFailure(
    settingsId: string,
    expectedStatus: "draft" | "inReview",
    session: ClientSession,
  ): Promise<never> {
    const existing = (await getSiteSettingsModel()
      .findById(asObjectId(settingsId, "settingsId"), {
        _id: 1,
        status: 1,
      })
      .session(session)
      .lean<{ _id: Types.ObjectId; status: RevisionWorkflowStatus }>()
      .exec()) as {
      _id: Types.ObjectId;
      status: RevisionWorkflowStatus;
    } | null;

    if (!existing) {
      throw new SiteSettingsCommandStoreError(
        "NOT_FOUND",
        "The requested site-settings version was not found.",
      );
    }
    if (existing.status === "published" || existing.status === "archived") {
      throw new SiteSettingsCommandStoreError(
        "PUBLISHED_VERSION_IMMUTABLE",
        "Published site-settings payloads are immutable.",
      );
    }
    if (existing.status !== expectedStatus) {
      throw new SiteSettingsCommandStoreError(
        "DRAFT_NOT_FOUND",
        "The site-settings version is not in the required workflow state.",
      );
    }

    throw new SiteSettingsCommandStoreError(
      "STALE_REVISION",
      "The site-settings version changed before the command committed.",
    );
  }

  async #transaction<T>(
    operation: (session: ClientSession) => Promise<T>,
    duplicateCode:
      "DRAFT_EXISTS" | "PERSISTENCE_FAILURE" = "PERSISTENCE_FAILURE",
  ): Promise<T> {
    const database = await connectToDatabase();

    try {
      return await database.connection.transaction(operation, {
        readPreference: "primary",
        writeConcern: { w: "majority" },
      });
    } catch (error) {
      if (error instanceof SiteSettingsCommandStoreError) {
        throw error;
      }
      if (isDuplicateKeyError(error)) {
        throw new SiteSettingsCommandStoreError(
          duplicateCode,
          "A unique site-settings constraint changed before commit.",
        );
      }

      throw new SiteSettingsCommandStoreError(
        "PERSISTENCE_FAILURE",
        "The site-settings command could not be persisted.",
      );
    }
  }
}

export const mongoSiteSettingsCommandStore =
  new MongoSiteSettingsCommandStore();
