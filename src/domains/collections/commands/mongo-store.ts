import "server-only";

import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import { getAuditEventModel } from "@/domains/audit/model";
import {
  type CollectionAdminAggregateDto,
  type CollectionCommandStore,
  CollectionCommandStoreError,
  type CollectionListDto,
  type CollectionStoreAccessScope,
  type CreateCollectionDraftStoreInput,
  type CreateCollectionRevisionDraftStoreInput,
  type PublishCollectionStoreInput,
  type ReturnCollectionToDraftStoreInput,
  type SubmitCollectionForReviewStoreInput,
  type UpdateCollectionDraftStoreInput,
} from "@/domains/collections/commands/contracts";
import type { ListCollectionsInput } from "@/domains/collections/commands/schemas";
import {
  getCollectionModel,
  getCollectionTranslationModel,
} from "@/domains/collections/persistence/models";
import {
  COLLECTION_PROJECTION,
  COLLECTION_TRANSLATION_PROJECTION,
  mapCollection,
  mapCollectionTranslation,
  type CollectionRaw,
  type CollectionTranslationRaw,
} from "@/domains/collections/persistence/repository";
import { getLocalizedRouteModel } from "@/domains/content/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { Locale } from "@/lib/i18n/config";

function scopeFilter(
  scope: CollectionStoreAccessScope,
): Record<string, unknown> {
  if (scope.kind === "all") return {};
  if (scope.kind === "own") return { createdBy: scope.ownerUserId };
  return { _id: { $exists: false } };
}

function escapedRegex(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function commandError(error: unknown): never {
  if (error instanceof CollectionCommandStoreError) throw error;
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 11000
  ) {
    throw new CollectionCommandStoreError(
      "IDENTIFIER_CONFLICT",
      "The collection code or localized route is already in use.",
    );
  }
  throw new CollectionCommandStoreError(
    "PERSISTENCE_FAILURE",
    "The collection command could not be persisted.",
  );
}

function assertOne(
  result: { modifiedCount: number },
  code: "STALE_REVISION" | "DRAFT_NOT_FOUND",
  message: string,
) {
  if (result.modifiedCount !== 1) {
    throw new CollectionCommandStoreError(code, message);
  }
}

async function loadTranslations(ids: readonly string[]) {
  if (!ids.length) return [];
  const rows = await getCollectionTranslationModel()
    .find({ _id: { $in: ids } }, COLLECTION_TRANSLATION_PROJECTION)
    .sort({ locale: 1 })
    .lean()
    .exec();
  return rows.map((row) =>
    mapCollectionTranslation(row as unknown as CollectionTranslationRaw),
  );
}

async function loadAggregate(
  scope: CollectionStoreAccessScope,
  collectionId: string,
): Promise<CollectionAdminAggregateDto | null> {
  if (!Types.ObjectId.isValid(collectionId)) return null;
  const raw = await getCollectionModel()
    .findOne(
      {
        _id: collectionId,
        deletedAt: { $exists: false },
        ...scopeFilter(scope),
      },
      COLLECTION_PROJECTION,
    )
    .lean()
    .exec();
  if (!raw) return null;
  const collection = mapCollection(raw as unknown as CollectionRaw);
  const [draftTranslations, publishedTranslations] = await Promise.all([
    loadTranslations(
      collection.currentDraftTranslations.map(({ translationId }) =>
        String(translationId),
      ),
    ),
    loadTranslations(
      collection.currentPublishedTranslations.map(({ translationId }) =>
        String(translationId),
      ),
    ),
  ]);
  return { collection, draftTranslations, publishedTranslations };
}

function metadataFields(metadata: CreateCollectionDraftStoreInput["metadata"]) {
  return {
    code: metadata.code,
    displayOrder: metadata.displayOrder,
    ...(metadata.year == null ? {} : { year: metadata.year }),
  };
}

function translationFields(
  translation: CreateCollectionDraftStoreInput["translations"][number],
) {
  return {
    locale: translation.locale,
    slug: translation.slug,
    title: translation.title,
    ...(translation.summary ? { summary: translation.summary } : {}),
    landingHtml: translation.landingHtml,
    seo: translation.seo,
  };
}

async function reserveRoutes(
  input: PublishCollectionStoreInput,
  session: ClientSession,
) {
  const Route = getLocalizedRouteModel();
  const routeIds = new Map(
    input.routes.map((route) => [route.locale, new Types.ObjectId()]),
  );
  const translationByLocale = new Map(
    input.expectedTranslations.map((translation) => [
      translation.locale,
      translation.translationId,
    ]),
  );
  for (const route of input.routes) {
    const collision = await Route.exists({
      locale: route.locale,
      path: route.path,
      active: true,
      $or: [
        { entityType: { $ne: "collection" } },
        { entityId: { $ne: new Types.ObjectId(input.collectionId) } },
      ],
    }).session(session);
    if (collision) {
      throw new CollectionCommandStoreError(
        "ROUTE_UNAVAILABLE",
        `The localized route ${route.path} is already reserved.`,
      );
    }
  }
  for (const route of input.routes) {
    const replacementId = routeIds.get(route.locale)!;
    await Route.updateMany(
      {
        entityType: "collection",
        entityId: input.collectionId,
        locale: route.locale,
        active: true,
      },
      {
        $set: {
          active: false,
          redirectToPath: route.path,
          redirectStatus: 308,
          replacedByRouteId: replacementId,
          deactivatedAt: input.occurredAt,
          updatedBy: input.actorId,
        },
        $inc: { revision: 1 },
      },
      { session },
    ).exec();
    await new Route({
      _id: replacementId,
      locale: route.locale,
      path: route.path,
      entityType: "collection",
      entityId: input.collectionId,
      versionId: translationByLocale.get(route.locale),
      active: true,
      activatedAt: input.occurredAt,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    }).save({ session });
  }
}

async function appendPublishAudit(
  input: PublishCollectionStoreInput,
  session: ClientSession,
) {
  await new (getAuditEventModel())({
    actorType: "user",
    actorId: input.actorId,
    action: "collection.published",
    resourceType: "collection",
    resourceId: input.collectionId,
    businessUnitIds: input.businessUnitIds
      .filter(Types.ObjectId.isValid)
      .map((id) => new Types.ObjectId(id)),
    requestId: input.requestId,
    permissionDecision: {
      permission: "content.publish",
      outcome: "allowed",
      reasonCode: "COMMAND_AUTHORIZED",
      scope: input.permissionScope,
    },
    before: {
      expectedCollectionRevision: input.expectedCollectionRevision,
      draftTranslationIds: input.expectedTranslations.map(
        ({ translationId }) => translationId,
      ),
    },
    after: {
      publishedTranslationIds: input.expectedTranslations.map(
        ({ translationId }) => translationId,
      ),
      routes: input.routes,
    },
    occurredAt: input.occurredAt,
  }).save({ session });
}

export class MongoCollectionCommandStore implements CollectionCommandStore {
  readonly publishesAuditAtomically = true;

  async listCollections(
    scope: CollectionStoreAccessScope,
    input: ListCollectionsInput,
  ): Promise<CollectionListDto> {
    await connectToDatabase();
    const query: Record<string, unknown> = {
      deletedAt: { $exists: false },
      ...scopeFilter(scope),
      ...(input.status ? { status: input.status } : {}),
      ...(input.query ? { code: escapedRegex(input.query) } : {}),
    };
    const Collection = getCollectionModel();
    const [rows, total] = await Promise.all([
      Collection.find(query, COLLECTION_PROJECTION)
        .sort({ displayOrder: 1, updatedAt: -1 })
        .skip(input.offset)
        .limit(input.limit)
        .lean()
        .exec(),
      Collection.countDocuments(query).exec(),
    ]);
    const values = await Promise.all(
      rows.map((row) =>
        loadAggregate(scope, String((row as { _id: Types.ObjectId })._id)),
      ),
    );
    return {
      items: values.flatMap((value) => (value ? [value] : [])),
      offset: input.offset,
      limit: input.limit,
      total,
    };
  }

  async readCollection(
    scope: CollectionStoreAccessScope,
    collectionId: string,
  ) {
    await connectToDatabase();
    return loadAggregate(scope, collectionId);
  }

  async createDraft(input: CreateCollectionDraftStoreInput) {
    const database = await connectToDatabase();
    let collectionId: Types.ObjectId | undefined;
    try {
      await database.connection.transaction(async (session) => {
        const Collection = getCollectionModel();
        const Translation = getCollectionTranslationModel();
        const [collection] = await Collection.create(
          [
            {
              ...metadataFields(input.metadata),
              status: "draft",
              currentDraftTranslations: [],
              currentPublishedTranslations: [],
              createdBy: input.actorId,
              updatedBy: input.actorId,
            },
          ],
          { session },
        );
        if (!collection) {
          throw new Error("Collection creation returned no document");
        }
        collectionId = collection._id;
        const pointers: Array<{
          locale: Locale;
          translationId: Types.ObjectId;
        }> = [];
        for (const translation of input.translations) {
          const created = await new Translation({
            collectionId: collection._id,
            version: 1,
            ...translationFields(translation),
            translationStatus: "draft",
            sourceRevision: 1,
            createdBy: input.actorId,
            updatedBy: input.actorId,
          }).save({ session });
          pointers.push({
            locale: translation.locale,
            translationId: created._id,
          });
        }
        const updated = await Collection.updateOne(
          {
            _id: collection._id,
            revision: (collection as unknown as { revision: number }).revision,
          },
          {
            $set: {
              currentDraftTranslations: pointers,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        assertOne(
          updated,
          "STALE_REVISION",
          "The new collection changed while its drafts were attached.",
        );
      });
    } catch (error) {
      commandError(error);
    }
    const result = await loadAggregate({ kind: "all" }, String(collectionId));
    if (!result) commandError(new Error("Created collection was not found"));
    return result;
  }

  async createRevisionDraft(
    scope: CollectionStoreAccessScope,
    input: CreateCollectionRevisionDraftStoreInput,
  ) {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Collection = getCollectionModel();
        const Translation = getCollectionTranslationModel();
        const collection = await Collection.findOne({
          _id: input.collectionId,
          revision: input.expectedCollectionRevision,
          currentDraftTranslations: { $size: 0 },
          "currentPublishedTranslations.0": { $exists: true },
          deletedAt: { $exists: false },
          ...scopeFilter(scope),
        })
          .session(session)
          .exec();
        if (!collection) {
          throw new CollectionCommandStoreError(
            "STALE_REVISION",
            "The collection cannot accept new translations at this revision.",
          );
        }
        const pointers: Array<{
          locale: Locale;
          translationId: Types.ObjectId;
        }> = [];
        for (const translation of input.translations) {
          const latest = await Translation.findOne({
            collectionId: input.collectionId,
            locale: translation.locale,
          })
            .sort({ version: -1 })
            .select({ version: 1 })
            .session(session)
            .lean()
            .exec();
          const version = (latest?.version ?? 0) + 1;
          const created = await new Translation({
            collectionId: input.collectionId,
            version,
            ...translationFields(translation),
            translationStatus: "draft",
            sourceRevision: version,
            createdBy: input.actorId,
            updatedBy: input.actorId,
          }).save({ session });
          pointers.push({
            locale: translation.locale,
            translationId: created._id,
          });
        }
        const updated = await Collection.updateOne(
          {
            _id: input.collectionId,
            revision: input.expectedCollectionRevision,
            currentDraftTranslations: { $size: 0 },
          },
          {
            $set: {
              currentDraftTranslations: pointers,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        assertOne(
          updated,
          "STALE_REVISION",
          "The collection changed while its new drafts were attached.",
        );
      });
    } catch (error) {
      commandError(error);
    }
    const result = await loadAggregate({ kind: "all" }, input.collectionId);
    if (!result) commandError(new Error("Updated collection was not found"));
    return result;
  }

  async updateDraft(
    scope: CollectionStoreAccessScope,
    input: UpdateCollectionDraftStoreInput,
  ) {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Collection = getCollectionModel();
        const Translation = getCollectionTranslationModel();
        const collectionOperation: Record<string, unknown> = {
          $set: {
            ...metadataFields(input.metadata),
            updatedBy: input.actorId,
          },
          $inc: { revision: 1 },
        };
        if (input.metadata.year == null) {
          collectionOperation.$unset = { year: "" };
        }
        const collection = await Collection.updateOne(
          {
            _id: input.collectionId,
            revision: input.expectedCollectionRevision,
            deletedAt: { $exists: false },
            ...scopeFilter(scope),
            currentDraftTranslations: {
              $all: input.translations.map((translation) => ({
                $elemMatch: {
                  locale: translation.locale,
                  translationId: translation.translationId,
                },
              })),
            },
          },
          collectionOperation,
          { session },
        ).exec();
        assertOne(
          collection,
          "STALE_REVISION",
          "The collection changed before its drafts were saved.",
        );
        for (const translation of input.translations) {
          const operation: Record<string, unknown> = {
            $set: {
              ...translationFields(translation),
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          };
          if (!translation.summary) operation.$unset = { summary: "" };
          const updated = await Translation.updateOne(
            {
              _id: translation.translationId,
              collectionId: input.collectionId,
              locale: translation.locale,
              translationStatus: "draft",
              revision: translation.expectedRevision,
            },
            operation,
            { session },
          ).exec();
          assertOne(
            updated,
            "STALE_REVISION",
            `The ${translation.locale} collection translation changed before it was saved.`,
          );
        }
      });
    } catch (error) {
      commandError(error);
    }
    const result = await loadAggregate({ kind: "all" }, input.collectionId);
    if (!result) commandError(new Error("Updated collection was not found"));
    return result;
  }

  async submitForReview(
    scope: CollectionStoreAccessScope,
    input: SubmitCollectionForReviewStoreInput,
  ) {
    return this.#transition(scope, input, "draft", "inReview");
  }

  async returnToDraft(input: ReturnCollectionToDraftStoreInput) {
    return this.#transition({ kind: "all" }, input, "inReview", "draft");
  }

  async publish(input: PublishCollectionStoreInput) {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Collection = getCollectionModel();
        const Translation = getCollectionTranslationModel();
        const collection = await Collection.findOne({
          _id: input.collectionId,
          revision: input.expectedCollectionRevision,
          deletedAt: { $exists: false },
        })
          .session(session)
          .lean()
          .exec();
        if (!collection) {
          throw new CollectionCommandStoreError(
            "STALE_REVISION",
            "The collection changed before publication.",
          );
        }
        await reserveRoutes(input, session);
        for (const expected of input.expectedTranslations) {
          const translation = await Translation.updateOne(
            {
              _id: expected.translationId,
              collectionId: input.collectionId,
              locale: expected.locale,
              translationStatus: "inReview",
              revision: expected.expectedRevision,
            },
            {
              $set: {
                translationStatus: "published",
                reviewedBy: input.actorId,
                publishedAt: input.occurredAt,
                updatedBy: input.actorId,
              },
              $inc: { revision: 1 },
            },
            { session },
          ).exec();
          assertOne(
            translation,
            "STALE_REVISION",
            `The ${expected.locale} translation changed before publication.`,
          );
        }
        const nextByLocale = new Map(
          (
            collection.currentPublishedTranslations as Array<{
              locale: Locale;
              translationId: Types.ObjectId;
            }>
          ).map((pointer) => [pointer.locale, pointer]),
        );
        input.expectedTranslations.forEach((expected) =>
          nextByLocale.set(expected.locale, {
            locale: expected.locale,
            translationId: new Types.ObjectId(expected.translationId),
          }),
        );
        const updated = await Collection.updateOne(
          {
            _id: input.collectionId,
            revision: input.expectedCollectionRevision,
          },
          {
            $set: {
              status: "published",
              currentDraftTranslations: [],
              currentPublishedTranslations: [...nextByLocale.values()],
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        assertOne(
          updated,
          "STALE_REVISION",
          "The collection pointer changed before publication.",
        );
        await appendPublishAudit(input, session);
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new CollectionCommandStoreError(
          "ROUTE_UNAVAILABLE",
          "A localized collection route was reserved concurrently.",
        );
      }
      commandError(error);
    }
    const result = await loadAggregate({ kind: "all" }, input.collectionId);
    if (!result) commandError(new Error("Published collection was not found"));
    return result;
  }

  async #transition(
    scope: CollectionStoreAccessScope,
    input:
      SubmitCollectionForReviewStoreInput | ReturnCollectionToDraftStoreInput,
    from: "draft" | "inReview",
    to: "inReview" | "draft",
  ) {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Collection = getCollectionModel();
        const Translation = getCollectionTranslationModel();
        for (const expected of input.expectedTranslations) {
          const translation = await Translation.updateOne(
            {
              _id: expected.translationId,
              collectionId: input.collectionId,
              locale: expected.locale,
              translationStatus: from,
              revision: expected.expectedRevision,
            },
            {
              $set: { translationStatus: to, updatedBy: input.actorId },
              $inc: { revision: 1 },
            },
            { session },
          ).exec();
          assertOne(
            translation,
            "STALE_REVISION",
            `The ${expected.locale} translation changed during review.`,
          );
        }
        const hasPublished = await Collection.exists({
          _id: input.collectionId,
          "currentPublishedTranslations.0": { $exists: true },
        }).session(session);
        const collection = await Collection.updateOne(
          {
            _id: input.collectionId,
            revision: input.expectedCollectionRevision,
            deletedAt: { $exists: false },
            ...scopeFilter(scope),
          },
          {
            $set: {
              status: hasPublished ? "published" : to,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        assertOne(
          collection,
          "STALE_REVISION",
          "The collection changed during review.",
        );
      });
    } catch (error) {
      commandError(error);
    }
    const result = await loadAggregate({ kind: "all" }, input.collectionId);
    if (!result)
      commandError(new Error("Transitioned collection was not found"));
    return result;
  }
}
