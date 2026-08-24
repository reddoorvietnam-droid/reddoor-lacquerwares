import "server-only";

import type { ClientSession } from "mongodb";
import type { UpdateQuery } from "mongoose";
import { Types } from "mongoose";

import { appendAuditEventWithSession } from "@/domains/audit/mongo-repository";
import {
  type ContentAdminAggregateDto,
  type ContentCommandStore,
  ContentCommandStoreError,
  type ContentEntryListDto,
  type ContentStoreAccessScope,
  type CreateEntryDraftStoreInput,
  type CreateRevisionDraftStoreInput,
  type PublishContentStoreInput,
  type ReturnToDraftStoreInput,
  type SubmitForReviewStoreInput,
  type UpdateDraftStoreInput,
} from "@/domains/content/commands/contracts";
import type {
  ListContentEntriesInput,
  UpdateDraftInput,
} from "@/domains/content/commands/schemas";
import type {
  ContentEntryDto,
  ContentRevisionDto,
  ContentTranslationDto,
} from "@/domains/content/persistence/dto";
import {
  getContentEntryModel,
  getContentRevisionModel,
  getContentTranslationModel,
  getLocalizedRouteModel,
} from "@/domains/content/persistence/models";
import {
  CONTENT_ENTRY_PROJECTION,
  CONTENT_REVISION_PROJECTION,
  CONTENT_TRANSLATION_PROJECTION,
} from "@/domains/content/persistence/repositories";
import type {
  RevisionWorkflowStatus,
  StableContentStatus,
  TranslationStatus,
} from "@/lib/content/contracts";
import {
  dateToIso,
  objectIdToString,
  persistedBlocksToDto,
  persistedSeoToDto,
} from "@/lib/content/mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { Locale } from "@/lib/i18n/config";

type BaseRaw = {
  _id: Types.ObjectId;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
};

type ContentEntryRaw = BaseRaw & {
  code: string;
  type: ContentEntryDto["type"];
  placement: string;
  status: StableContentStatus;
  currentDraftRevisionId?: Types.ObjectId;
  currentPublishedRevisionId?: Types.ObjectId;
  deletedAt?: Date;
};

type ContentRevisionRaw = BaseRaw & {
  entryId: Types.ObjectId;
  version: number;
  blocks: unknown;
  status: RevisionWorkflowStatus;
  sourceLocale: Locale;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  publishedAt?: Date;
};

type ContentTranslationRaw = BaseRaw & {
  entryId: Types.ObjectId;
  revisionId: Types.ObjectId;
  locale: Locale;
  slug?: string;
  title: string;
  summary?: string;
  blocks: unknown;
  translationStatus: TranslationStatus;
  sourceRevision: number;
  reviewedBy?: Types.ObjectId;
  publishedAt?: Date;
  seo: unknown;
};

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

function mapEntry(raw: ContentEntryRaw): ContentEntryDto {
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

function mapRevision(raw: ContentRevisionRaw): ContentRevisionDto {
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

function mapTranslation(raw: ContentTranslationRaw): ContentTranslationDto {
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

function asObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new ContentCommandStoreError(
      "PERSISTENCE_FAILURE",
      `${field} must be a valid persisted identifier.`,
    );
  }

  return new Types.ObjectId(value);
}

function scopeFilter(scope: ContentStoreAccessScope): Record<string, unknown> {
  if (scope.kind === "none") {
    return { _id: { $exists: false } };
  }

  if (scope.kind === "own") {
    return { createdBy: asObjectId(scope.ownerUserId, "ownerUserId") };
  }

  return {};
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function translationWriteFields(
  translation:
    | UpdateDraftInput["translations"][number]
    | CreateEntryDraftStoreInput["translations"][number]
    | CreateRevisionDraftStoreInput["translations"][number],
): Record<string, unknown> {
  return {
    locale: translation.locale,
    title: translation.title,
    blocks: translation.blocks,
    seo: {
      noIndex: translation.seo.noIndex,
      ...(translation.seo.title === undefined
        ? {}
        : { title: translation.seo.title }),
      ...(translation.seo.description === undefined
        ? {}
        : { description: translation.seo.description }),
      ...(translation.seo.canonicalOverride === undefined
        ? {}
        : { canonicalOverride: translation.seo.canonicalOverride }),
      ...(translation.seo.imageMediaId === undefined
        ? {}
        : {
            imageMediaId: asObjectId(
              translation.seo.imageMediaId,
              "seo.imageMediaId",
            ),
          }),
    },
    ...(translation.slug === undefined ? {} : { slug: translation.slug }),
    ...(translation.summary === undefined
      ? {}
      : { summary: translation.summary }),
  };
}

function draftTranslationWriteFields(
  translation:
    | CreateEntryDraftStoreInput["translations"][number]
    | CreateRevisionDraftStoreInput["translations"][number],
): Record<string, unknown> {
  return translationWriteFields(translation);
}

function ensureExactExpectedTranslations(
  actual: readonly ContentTranslationRaw[],
  expected: ReadonlyArray<{ locale: Locale; expectedRevision: number }>,
): void {
  const expectedByLocale = new Map(
    expected.map((translation) => [
      translation.locale,
      translation.expectedRevision,
    ]),
  );

  if (
    expectedByLocale.size !== actual.length ||
    actual.some(
      (translation) =>
        expectedByLocale.get(translation.locale) !== translation.revision,
    )
  ) {
    throw new ContentCommandStoreError(
      "STALE_REVISION",
      "The translation set changed before the command was committed.",
    );
  }
}

export class MongoContentCommandStore implements ContentCommandStore {
  async listEntries(
    scope: ContentStoreAccessScope,
    input: ListContentEntriesInput,
  ): Promise<ContentEntryListDto> {
    if (scope.kind === "none") {
      return { items: [], offset: input.offset, limit: input.limit, total: 0 };
    }

    await connectToDatabase();
    const filter: Record<string, unknown> = {
      ...scopeFilter(scope),
      deletedAt: { $exists: false },
      ...(input.status ? { status: input.status } : {}),
    };

    if (input.query) {
      const expression = new RegExp(escapeRegularExpression(input.query), "i");
      filter.$or = [{ code: expression }, { placement: expression }];
    }

    const [entryRaws, total] = await Promise.all([
      getContentEntryModel()
        .find(filter, CONTENT_ENTRY_PROJECTION)
        .sort({ updatedAt: -1, _id: 1 })
        .skip(input.offset)
        .limit(input.limit)
        .lean<ContentEntryRaw[]>()
        .exec(),
      getContentEntryModel().countDocuments(filter).exec(),
    ]);
    const revisionIds = entryRaws.flatMap((entry) => [
      ...(entry.currentDraftRevisionId ? [entry.currentDraftRevisionId] : []),
      ...(entry.currentPublishedRevisionId
        ? [entry.currentPublishedRevisionId]
        : []),
    ]);
    const revisions =
      revisionIds.length === 0
        ? []
        : await getContentRevisionModel()
            .find({ _id: { $in: revisionIds } }, CONTENT_REVISION_PROJECTION)
            .lean<ContentRevisionRaw[]>()
            .exec();
    const translations =
      revisionIds.length === 0
        ? []
        : await getContentTranslationModel()
            .find(
              { revisionId: { $in: revisionIds } },
              CONTENT_TRANSLATION_PROJECTION,
            )
            .sort({ locale: 1 })
            .lean<ContentTranslationRaw[]>()
            .exec();
    const revisionById = new Map(
      revisions.map((revision) => [objectIdToString(revision._id), revision]),
    );

    return {
      items: entryRaws.map((raw) => {
        const draftId = raw.currentDraftRevisionId?.toHexString() ?? null;
        const publishedId =
          raw.currentPublishedRevisionId?.toHexString() ?? null;
        const preferredRevisionId = draftId ?? publishedId;

        return {
          entry: mapEntry(raw),
          draftVersion: draftId
            ? (revisionById.get(draftId)?.version ?? null)
            : null,
          publishedVersion: publishedId
            ? (revisionById.get(publishedId)?.version ?? null)
            : null,
          translations: preferredRevisionId
            ? translations
                .filter(
                  (translation) =>
                    translation.revisionId.toHexString() ===
                    preferredRevisionId,
                )
                .map((translation) => ({
                  locale: translation.locale,
                  title: translation.title,
                  status: translation.translationStatus,
                }))
            : [],
        };
      }),
      offset: input.offset,
      limit: input.limit,
      total,
    };
  }

  async readEntry(
    scope: ContentStoreAccessScope,
    entryId: string,
  ): Promise<ContentAdminAggregateDto | null> {
    if (scope.kind === "none" || !Types.ObjectId.isValid(entryId)) {
      return null;
    }

    await connectToDatabase();
    return this.#readAggregate(entryId, scope);
  }

  async createEntryDraft(
    input: CreateEntryDraftStoreInput,
  ): Promise<ContentAdminAggregateDto> {
    return this.#transaction(async (session) => {
      const actorId = asObjectId(input.actorId, "actorId");
      const entryId = new Types.ObjectId();
      const revisionId = new Types.ObjectId();

      await getContentEntryModel().create(
        [
          {
            _id: entryId,
            code: input.code,
            type: input.type,
            placement: input.placement,
            status: "draft",
            currentDraftRevisionId: revisionId,
            createdBy: actorId,
            updatedBy: actorId,
            createdAt: input.occurredAt,
            updatedAt: input.occurredAt,
          },
        ],
        { session },
      );
      await getContentRevisionModel().create(
        [
          {
            _id: revisionId,
            entryId,
            version: 1,
            blocks: input.blocks,
            status: "draft",
            sourceLocale: input.sourceLocale,
            createdBy: actorId,
            updatedBy: actorId,
            createdAt: input.occurredAt,
            updatedAt: input.occurredAt,
          },
        ],
        { session },
      );
      await getContentTranslationModel().create(
        input.translations.map((translation) => ({
          _id: new Types.ObjectId(),
          entryId,
          revisionId,
          ...draftTranslationWriteFields(translation),
          translationStatus: "draft" as const,
          sourceRevision: 1,
          createdBy: actorId,
          updatedBy: actorId,
          createdAt: input.occurredAt,
          updatedAt: input.occurredAt,
        })),
        { session },
      );

      return this.#requireAggregate(
        entryId.toHexString(),
        { kind: "all" },
        session,
      );
    }, "CODE_CONFLICT");
  }

  async createRevisionDraft(
    scope: ContentStoreAccessScope,
    input: CreateRevisionDraftStoreInput,
  ): Promise<ContentAdminAggregateDto> {
    return this.#transaction(async (session) => {
      const actorId = asObjectId(input.actorId, "actorId");
      const entryId = asObjectId(input.entryId, "entryId");
      const entry = await getContentEntryModel()
        .findOne(
          {
            _id: entryId,
            ...scopeFilter(scope),
            revision: input.expectedEntryRevision,
            deletedAt: { $exists: false },
          },
          CONTENT_ENTRY_PROJECTION,
        )
        .session(session)
        .lean<ContentEntryRaw>()
        .exec();

      if (!entry) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The content entry changed before a new draft could be created.",
        );
      }

      if (entry.currentDraftRevisionId) {
        throw new ContentCommandStoreError(
          "DRAFT_EXISTS",
          "This content entry already has a draft revision.",
        );
      }

      if (!entry.currentPublishedRevisionId) {
        throw new ContentCommandStoreError(
          "NOT_FOUND",
          "A new revision requires an existing published revision.",
        );
      }

      const latest = await getContentRevisionModel()
        .findOne({ entryId }, { version: 1 })
        .sort({ version: -1 })
        .session(session)
        .lean<{ version: number }>()
        .exec();
      const version = (latest?.version ?? 0) + 1;
      const revisionId = new Types.ObjectId();

      await getContentRevisionModel().create(
        [
          {
            _id: revisionId,
            entryId,
            version,
            blocks: input.blocks,
            status: "draft",
            sourceLocale: input.sourceLocale,
            createdBy: actorId,
            updatedBy: actorId,
            createdAt: input.occurredAt,
            updatedAt: input.occurredAt,
          },
        ],
        { session },
      );
      await getContentTranslationModel().create(
        input.translations.map((translation) => ({
          _id: new Types.ObjectId(),
          entryId,
          revisionId,
          ...draftTranslationWriteFields(translation),
          translationStatus: "draft" as const,
          sourceRevision: version,
          createdBy: actorId,
          updatedBy: actorId,
          createdAt: input.occurredAt,
          updatedAt: input.occurredAt,
        })),
        { session },
      );
      const updatedEntry = await getContentEntryModel()
        .findOneAndUpdate(
          {
            _id: entryId,
            ...scopeFilter(scope),
            revision: input.expectedEntryRevision,
            currentDraftRevisionId: { $exists: false },
          },
          {
            $set: {
              currentDraftRevisionId: revisionId,
              updatedBy: actorId,
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<ContentEntryRaw>()
        .exec();

      if (!updatedEntry) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The content entry changed before the draft pointer was committed.",
        );
      }

      return this.#requireAggregate(input.entryId, scope, session);
    }, "DRAFT_EXISTS");
  }

  async updateDraft(
    scope: ContentStoreAccessScope,
    input: UpdateDraftStoreInput,
  ): Promise<ContentAdminAggregateDto> {
    return this.#transaction(async (session) => {
      const actorId = asObjectId(input.actorId, "actorId");
      const entryId = asObjectId(input.entryId, "entryId");
      const revisionId = asObjectId(input.revisionId, "revisionId");
      const updatedEntry = await getContentEntryModel()
        .findOneAndUpdate(
          {
            _id: entryId,
            ...scopeFilter(scope),
            revision: input.expectedEntryRevision,
            currentDraftRevisionId: revisionId,
            deletedAt: { $exists: false },
          },
          {
            $set: {
              placement: input.placement,
              updatedBy: actorId,
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<ContentEntryRaw>()
        .exec();

      if (!updatedEntry) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The content entry changed before the draft update was committed.",
        );
      }

      const updatedRevision = await getContentRevisionModel()
        .findOneAndUpdate(
          {
            _id: revisionId,
            entryId,
            revision: input.expectedRevision,
            status: "draft",
          },
          {
            $set: {
              sourceLocale: input.sourceLocale,
              blocks: input.blocks,
              updatedBy: actorId,
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<ContentRevisionRaw>()
        .exec();

      if (!updatedRevision) {
        throw new ContentCommandStoreError(
          "PUBLISHED_REVISION_IMMUTABLE",
          "Only the active draft revision can be updated.",
        );
      }

      const existingTranslations = await getContentTranslationModel()
        .find({ entryId, revisionId }, CONTENT_TRANSLATION_PROJECTION)
        .session(session)
        .lean<ContentTranslationRaw[]>()
        .exec();
      const updateByLocale = new Map(
        input.translations.map((translation) => [
          translation.locale,
          translation,
        ]),
      );

      for (const existing of existingTranslations) {
        const update = updateByLocale.get(existing.locale);
        if (!update || update.expectedRevision !== existing.revision) {
          throw new ContentCommandStoreError(
            "STALE_REVISION",
            "A translation changed before the draft update was committed.",
          );
        }
      }

      for (const translation of input.translations) {
        const existing = existingTranslations.find(
          (candidate) => candidate.locale === translation.locale,
        );

        if (existing) {
          const updatedTranslation = await getContentTranslationModel()
            .findOneAndUpdate(
              {
                _id: existing._id,
                revision: translation.expectedRevision,
                translationStatus: "draft",
              },
              {
                $set: {
                  ...translationWriteFields(translation),
                  updatedBy: actorId,
                  updatedAt: input.occurredAt,
                },
                ...(translation.slug === undefined ||
                translation.summary === undefined
                  ? {
                      $unset: {
                        ...(translation.slug === undefined ? { slug: 1 } : {}),
                        ...(translation.summary === undefined
                          ? { summary: 1 }
                          : {}),
                      },
                    }
                  : {}),
                $inc: { revision: 1 },
              },
              { new: true, runValidators: true, session },
            )
            .lean<ContentTranslationRaw>()
            .exec();

          if (!updatedTranslation) {
            throw new ContentCommandStoreError(
              "STALE_REVISION",
              "A translation changed before the draft update was committed.",
            );
          }
        } else {
          if (translation.expectedRevision !== undefined) {
            throw new ContentCommandStoreError(
              "STALE_REVISION",
              "A new translation cannot have an existing revision.",
            );
          }

          await getContentTranslationModel().create(
            [
              {
                _id: new Types.ObjectId(),
                entryId,
                revisionId,
                ...translationWriteFields(translation),
                translationStatus: "draft",
                sourceRevision: updatedRevision.version,
                createdBy: actorId,
                updatedBy: actorId,
                createdAt: input.occurredAt,
                updatedAt: input.occurredAt,
              },
            ],
            { session },
          );
        }
      }

      return this.#requireAggregate(input.entryId, scope, session);
    });
  }

  async submitForReview(
    scope: ContentStoreAccessScope,
    input: SubmitForReviewStoreInput,
  ): Promise<ContentAdminAggregateDto> {
    return this.#transaction(async (session) => {
      const actorId = asObjectId(input.actorId, "actorId");
      const entryId = asObjectId(input.entryId, "entryId");
      const revisionId = asObjectId(input.revisionId, "revisionId");
      const entry = await getContentEntryModel()
        .findOne(
          {
            _id: entryId,
            ...scopeFilter(scope),
            revision: input.expectedEntryRevision,
            currentDraftRevisionId: revisionId,
            deletedAt: { $exists: false },
          },
          CONTENT_ENTRY_PROJECTION,
        )
        .session(session)
        .lean<ContentEntryRaw>()
        .exec();

      if (!entry) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The content entry changed before review submission.",
        );
      }

      const translations = await getContentTranslationModel()
        .find({ entryId, revisionId }, CONTENT_TRANSLATION_PROJECTION)
        .session(session)
        .lean<ContentTranslationRaw[]>()
        .exec();
      ensureExactExpectedTranslations(translations, input.expectedTranslations);

      const updatedRevision = await getContentRevisionModel()
        .findOneAndUpdate(
          {
            _id: revisionId,
            entryId,
            status: "draft",
            revision: input.expectedRevision,
          },
          {
            $set: {
              status: "inReview",
              submittedAt: input.occurredAt,
              updatedBy: actorId,
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<ContentRevisionRaw>()
        .exec();

      if (!updatedRevision) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The draft revision changed before review submission.",
        );
      }

      for (const translation of translations) {
        const updated = await getContentTranslationModel()
          .findOneAndUpdate(
            {
              _id: translation._id,
              revision: translation.revision,
              translationStatus: { $in: ["draft", "needsUpdate"] },
            },
            {
              $set: {
                translationStatus: "inReview",
                updatedBy: actorId,
                updatedAt: input.occurredAt,
              },
              $inc: { revision: 1 },
            },
            { new: true, runValidators: true, session },
          )
          .lean<ContentTranslationRaw>()
          .exec();

        if (!updated) {
          throw new ContentCommandStoreError(
            "STALE_REVISION",
            "A translation changed before review submission.",
          );
        }
      }

      const updatedEntry = await getContentEntryModel()
        .findOneAndUpdate(
          { _id: entryId, revision: input.expectedEntryRevision },
          {
            $set: {
              status: entry.currentPublishedRevisionId
                ? "published"
                : "inReview",
              updatedBy: actorId,
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<ContentEntryRaw>()
        .exec();

      if (!updatedEntry) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The content entry changed before review submission.",
        );
      }

      return this.#requireAggregate(input.entryId, scope, session);
    });
  }

  async returnToDraft(
    input: ReturnToDraftStoreInput,
  ): Promise<ContentAdminAggregateDto> {
    return this.#transaction(async (session) => {
      const actorId = asObjectId(input.actorId, "actorId");
      const entryId = asObjectId(input.entryId, "entryId");
      const revisionId = asObjectId(input.revisionId, "revisionId");
      const entry = await getContentEntryModel()
        .findOne(
          {
            _id: entryId,
            revision: input.expectedEntryRevision,
            currentDraftRevisionId: revisionId,
            deletedAt: { $exists: false },
          },
          CONTENT_ENTRY_PROJECTION,
        )
        .session(session)
        .lean<ContentEntryRaw>()
        .exec();

      if (!entry) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The content entry changed before review was returned.",
        );
      }

      const translations = await getContentTranslationModel()
        .find({ entryId, revisionId }, CONTENT_TRANSLATION_PROJECTION)
        .session(session)
        .lean<ContentTranslationRaw[]>()
        .exec();
      ensureExactExpectedTranslations(translations, input.expectedTranslations);

      const updatedRevision = await getContentRevisionModel()
        .findOneAndUpdate(
          {
            _id: revisionId,
            entryId,
            status: "inReview",
            revision: input.expectedRevision,
          },
          {
            $set: {
              status: "draft",
              reviewedAt: input.occurredAt,
              reviewedBy: actorId,
              updatedBy: actorId,
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<ContentRevisionRaw>()
        .exec();

      if (!updatedRevision) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The review state changed before it could be returned.",
        );
      }

      for (const translation of translations) {
        const updated = await getContentTranslationModel()
          .findOneAndUpdate(
            {
              _id: translation._id,
              revision: translation.revision,
              translationStatus: "inReview",
            },
            {
              $set: {
                translationStatus: "draft",
                reviewedBy: actorId,
                updatedBy: actorId,
                updatedAt: input.occurredAt,
              },
              $inc: { revision: 1 },
            },
            { new: true, runValidators: true, session },
          )
          .lean<ContentTranslationRaw>()
          .exec();

        if (!updated) {
          throw new ContentCommandStoreError(
            "STALE_REVISION",
            "A translation changed before review was returned.",
          );
        }
      }

      const updatedEntry = await getContentEntryModel()
        .findOneAndUpdate(
          { _id: entryId, revision: input.expectedEntryRevision },
          {
            $set: {
              status: entry.currentPublishedRevisionId ? "published" : "draft",
              updatedBy: actorId,
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<ContentEntryRaw>()
        .exec();

      if (!updatedEntry) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The content entry changed before review was returned.",
        );
      }

      return this.#requireAggregate(input.entryId, { kind: "all" }, session);
    });
  }

  async publish(
    input: PublishContentStoreInput,
  ): Promise<ContentAdminAggregateDto> {
    return this.#transaction(async (session) => {
      const actorId = asObjectId(input.actorId, "actorId");
      const entryId = asObjectId(input.entryId, "entryId");
      const revisionId = asObjectId(input.revisionId, "revisionId");
      const entry = await getContentEntryModel()
        .findOne(
          {
            _id: entryId,
            revision: input.expectedEntryRevision,
            currentDraftRevisionId: revisionId,
            deletedAt: { $exists: false },
          },
          CONTENT_ENTRY_PROJECTION,
        )
        .session(session)
        .lean<ContentEntryRaw>()
        .exec();

      if (!entry) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The content entry changed before publication.",
        );
      }

      const translations = await getContentTranslationModel()
        .find({ entryId, revisionId }, CONTENT_TRANSLATION_PROJECTION)
        .session(session)
        .lean<ContentTranslationRaw[]>()
        .exec();
      ensureExactExpectedTranslations(translations, input.expectedTranslations);

      const updatedRevision = await getContentRevisionModel()
        .findOneAndUpdate(
          {
            _id: revisionId,
            entryId,
            status: "inReview",
            revision: input.expectedRevision,
          },
          {
            $set: {
              status: "published",
              reviewedAt: input.occurredAt,
              reviewedBy: actorId,
              publishedAt: input.occurredAt,
              updatedBy: actorId,
              updatedAt: input.occurredAt,
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<ContentRevisionRaw>()
        .exec();

      if (!updatedRevision) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The review revision changed before publication.",
        );
      }

      for (const translation of translations) {
        const updated = await getContentTranslationModel()
          .findOneAndUpdate(
            {
              _id: translation._id,
              revision: translation.revision,
              translationStatus: "inReview",
            },
            {
              $set: {
                translationStatus: "published",
                reviewedBy: actorId,
                publishedAt: input.occurredAt,
                updatedBy: actorId,
                updatedAt: input.occurredAt,
              },
              $inc: { revision: 1 },
            },
            { new: true, runValidators: true, session },
          )
          .lean<ContentTranslationRaw>()
          .exec();

        if (!updated) {
          throw new ContentCommandStoreError(
            "STALE_REVISION",
            "A translation changed before publication.",
          );
        }
      }

      await this.#replaceLocalizedRoutes(
        entry,
        updatedRevision,
        input,
        actorId,
        session,
      );

      if (
        entry.currentPublishedRevisionId &&
        !entry.currentPublishedRevisionId.equals(revisionId)
      ) {
        const archived = await getContentRevisionModel()
          .findOneAndUpdate(
            {
              _id: entry.currentPublishedRevisionId,
              entryId,
              status: "published",
            },
            {
              $set: {
                status: "archived",
                updatedBy: actorId,
                updatedAt: input.occurredAt,
              },
              $inc: { revision: 1 },
            },
            { new: true, runValidators: true, session },
          )
          .lean<ContentRevisionRaw>()
          .exec();

        if (!archived) {
          throw new ContentCommandStoreError(
            "STALE_REVISION",
            "The previous published revision changed before replacement.",
          );
        }
      }

      const updatedEntry = await getContentEntryModel()
        .findOneAndUpdate(
          {
            _id: entryId,
            revision: input.expectedEntryRevision,
            currentDraftRevisionId: revisionId,
          },
          {
            $set: {
              status: "published",
              currentPublishedRevisionId: revisionId,
              updatedBy: actorId,
              updatedAt: input.occurredAt,
            },
            $unset: { currentDraftRevisionId: 1 },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true, session },
        )
        .lean<ContentEntryRaw>()
        .exec();

      if (!updatedEntry) {
        throw new ContentCommandStoreError(
          "STALE_REVISION",
          "The published pointer changed before publication committed.",
        );
      }

      await appendAuditEventWithSession(input.auditEvent, session);

      return this.#requireAggregate(input.entryId, { kind: "all" }, session);
    }, "ROUTE_UNAVAILABLE");
  }

  async #replaceLocalizedRoutes(
    entry: ContentEntryRaw,
    revision: ContentRevisionRaw,
    input: PublishContentStoreInput,
    actorId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    const entryId = entry._id;

    for (const route of input.routes) {
      const collision = await getLocalizedRouteModel()
        .findOne({
          locale: route.locale,
          path: route.path,
          active: true,
          $or: [
            { entityType: { $ne: "content" } },
            { entityId: { $ne: entryId } },
          ],
        })
        .session(session)
        .lean<{ _id: Types.ObjectId }>()
        .exec();

      if (collision) {
        throw new ContentCommandStoreError(
          "ROUTE_UNAVAILABLE",
          "A localized route is already assigned to another published entity.",
        );
      }

      const currentRoutes = await getLocalizedRouteModel()
        .find({
          entityType: "content",
          entityId: entryId,
          locale: route.locale,
          active: true,
        })
        .session(session)
        .lean<Array<{ _id: Types.ObjectId; path: string; revision: number }>>()
        .exec();

      for (const current of currentRoutes) {
        const routeUpdate: UpdateQuery<unknown> = {
          $set: {
            active: false,
            deactivatedAt: input.occurredAt,
            updatedBy: actorId,
            updatedAt: input.occurredAt,
            ...(current.path === route.path
              ? {}
              : { redirectToPath: route.path, redirectStatus: 308 }),
          },
          ...(current.path === route.path
            ? { $unset: { redirectToPath: 1, redirectStatus: 1 } }
            : {}),
          $inc: { revision: 1 },
        };
        const deactivated = await getLocalizedRouteModel()
          .findOneAndUpdate(
            { _id: current._id, active: true, revision: current.revision },
            routeUpdate,
            { new: true, runValidators: true, session },
          )
          .lean()
          .exec();

        if (!deactivated) {
          throw new ContentCommandStoreError(
            "STALE_REVISION",
            "The current localized route changed before replacement.",
          );
        }
      }

      await getLocalizedRouteModel().create(
        [
          {
            _id: new Types.ObjectId(),
            locale: route.locale,
            path: route.path,
            entityType: "content",
            entityId: entryId,
            versionId: revision._id,
            active: true,
            activatedAt: input.occurredAt,
            createdBy: actorId,
            updatedBy: actorId,
            createdAt: input.occurredAt,
            updatedAt: input.occurredAt,
          },
        ],
        { session },
      );
    }
  }

  async #readAggregate(
    entryId: string,
    scope: ContentStoreAccessScope,
    session?: ClientSession,
  ): Promise<ContentAdminAggregateDto | null> {
    const entry = await getContentEntryModel()
      .findOne(
        {
          _id: asObjectId(entryId, "entryId"),
          ...scopeFilter(scope),
          deletedAt: { $exists: false },
        },
        CONTENT_ENTRY_PROJECTION,
      )
      .session(session ?? null)
      .lean<ContentEntryRaw>()
      .exec();

    if (!entry) {
      return null;
    }

    const revisionIds = [
      ...(entry.currentDraftRevisionId ? [entry.currentDraftRevisionId] : []),
      ...(entry.currentPublishedRevisionId
        ? [entry.currentPublishedRevisionId]
        : []),
    ];
    const revisions =
      revisionIds.length === 0
        ? []
        : await getContentRevisionModel()
            .find({ _id: { $in: revisionIds } }, CONTENT_REVISION_PROJECTION)
            .session(session ?? null)
            .lean<ContentRevisionRaw[]>()
            .exec();
    const translations =
      revisionIds.length === 0
        ? []
        : await getContentTranslationModel()
            .find(
              { revisionId: { $in: revisionIds } },
              CONTENT_TRANSLATION_PROJECTION,
            )
            .sort({ locale: 1 })
            .session(session ?? null)
            .lean<ContentTranslationRaw[]>()
            .exec();
    const bundle = (
      revisionId: Types.ObjectId | undefined,
    ): ContentAdminAggregateDto["draft"] => {
      if (!revisionId) {
        return null;
      }

      const revision = revisions.find((candidate) =>
        candidate._id.equals(revisionId),
      );

      if (!revision) {
        throw new ContentCommandStoreError(
          "PERSISTENCE_FAILURE",
          "A content entry points to a missing revision.",
        );
      }

      return {
        revision: mapRevision(revision),
        translations: translations
          .filter((translation) => translation.revisionId.equals(revisionId))
          .map(mapTranslation),
      };
    };

    return {
      entry: mapEntry(entry),
      draft: bundle(entry.currentDraftRevisionId),
      published: bundle(entry.currentPublishedRevisionId),
    };
  }

  async #requireAggregate(
    entryId: string,
    scope: ContentStoreAccessScope,
    session: ClientSession,
  ): Promise<ContentAdminAggregateDto> {
    const aggregate = await this.#readAggregate(entryId, scope, session);

    if (!aggregate) {
      throw new ContentCommandStoreError(
        "PERSISTENCE_FAILURE",
        "The committed content aggregate could not be reloaded.",
      );
    }

    return aggregate;
  }

  async #transaction<T>(
    operation: (session: ClientSession) => Promise<T>,
    duplicateCode:
      | "CODE_CONFLICT"
      | "DRAFT_EXISTS"
      | "ROUTE_UNAVAILABLE"
      | "PERSISTENCE_FAILURE" = "PERSISTENCE_FAILURE",
  ): Promise<T> {
    const database = await connectToDatabase();

    try {
      return await database.connection.transaction(operation, {
        readPreference: "primary",
        writeConcern: { w: "majority" },
      });
    } catch (error) {
      if (error instanceof ContentCommandStoreError) {
        throw error;
      }

      if (isDuplicateKeyError(error)) {
        throw new ContentCommandStoreError(
          duplicateCode,
          "A unique content constraint changed before the command committed.",
        );
      }

      throw new ContentCommandStoreError(
        "PERSISTENCE_FAILURE",
        "The content command could not be persisted.",
      );
    }
  }
}

export const mongoContentCommandStore = new MongoContentCommandStore();
