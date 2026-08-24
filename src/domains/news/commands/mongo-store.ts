import "server-only";

import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import { getAuditEventModel } from "@/domains/audit/model";
import {
  type ArticleAdminAggregateDto,
  type ArticleCommandStore,
  ArticleCommandStoreError,
  type ArticleListDto,
  type ArticleRevisionBundleDto,
  type ArticleStoreAccessScope,
  type CreateArticleDraftStoreInput,
  type CreateArticleRevisionDraftStoreInput,
  type PublishArticleStoreInput,
  type ReturnArticleToDraftStoreInput,
  type SubmitArticleForReviewStoreInput,
  type UpdateArticleDraftStoreInput,
} from "@/domains/news/commands/contracts";
import type { ListArticlesInput } from "@/domains/news/commands/schemas";
import {
  getArticleModel,
  getArticleRevisionModel,
  getArticleTranslationModel,
} from "@/domains/news/persistence/models";
import {
  ARTICLE_PROJECTION,
  ARTICLE_REVISION_PROJECTION,
  ARTICLE_TRANSLATION_PROJECTION,
  mapArticle,
  mapArticleRevision,
  mapArticleTranslation,
  type ArticleRaw,
  type ArticleRevisionRaw,
  type ArticleTranslationRaw,
} from "@/domains/news/persistence/repository";
import { getLocalizedRouteModel } from "@/domains/content/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

function scopeFilter(scope: ArticleStoreAccessScope): Record<string, unknown> {
  if (scope.kind === "all") return {};
  if (scope.kind === "own") return { createdBy: scope.ownerUserId };
  return { _id: { $exists: false } };
}

function escapedRegex(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function commandError(error: unknown): never {
  if (error instanceof ArticleCommandStoreError) throw error;
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 11000
  ) {
    throw new ArticleCommandStoreError(
      "IDENTIFIER_CONFLICT",
      "The article identifier or localized route is already in use.",
    );
  }
  throw new ArticleCommandStoreError(
    "PERSISTENCE_FAILURE",
    "The article command could not be persisted.",
  );
}

async function loadBundle(
  revisionId: string | Types.ObjectId | null | undefined,
): Promise<ArticleRevisionBundleDto | null> {
  if (!revisionId) return null;
  const [revision, translations] = await Promise.all([
    getArticleRevisionModel()
      .findById(revisionId, ARTICLE_REVISION_PROJECTION)
      .lean()
      .exec(),
    getArticleTranslationModel()
      .find({ revisionId }, ARTICLE_TRANSLATION_PROJECTION)
      .sort({ locale: 1 })
      .lean()
      .exec(),
  ]);
  if (!revision) return null;
  return {
    revision: mapArticleRevision(revision as unknown as ArticleRevisionRaw),
    translations: translations.map((translation) =>
      mapArticleTranslation(translation as unknown as ArticleTranslationRaw),
    ),
  };
}

async function loadAggregate(
  scope: ArticleStoreAccessScope,
  articleId: string,
): Promise<ArticleAdminAggregateDto | null> {
  if (!Types.ObjectId.isValid(articleId)) return null;
  const raw = await getArticleModel()
    .findOne(
      {
        _id: articleId,
        deletedAt: { $exists: false },
        ...scopeFilter(scope),
      },
      ARTICLE_PROJECTION,
    )
    .lean()
    .exec();
  if (!raw) return null;
  const article = mapArticle(raw as unknown as ArticleRaw);
  const [draft, published] = await Promise.all([
    loadBundle(article.currentDraftRevisionId),
    article.currentPublishedRevisionId === article.currentDraftRevisionId
      ? Promise.resolve(null)
      : loadBundle(article.currentPublishedRevisionId),
  ]);
  return { article, draft, published };
}

function metadataFields(
  metadata: CreateArticleDraftStoreInput["metadata"],
): Record<string, unknown> {
  return {
    internalId: metadata.internalId,
    tagKeys: metadata.tagKeys,
    ...(metadata.categoryId
      ? { categoryId: new Types.ObjectId(metadata.categoryId) }
      : {}),
    ...(metadata.authorId
      ? { authorId: new Types.ObjectId(metadata.authorId) }
      : {}),
    ...(metadata.authorLabel ? { authorLabel: metadata.authorLabel } : {}),
  };
}

function revisionFields(
  revision: CreateArticleDraftStoreInput["revision"],
): Record<string, unknown> {
  return {
    sourceLocale: revision.sourceLocale,
    sourceBlocks: revision.sourceBlocks,
    ...(revision.coverMediaId
      ? { coverMediaId: new Types.ObjectId(revision.coverMediaId) }
      : {}),
  };
}

function translationFields(
  translation: CreateArticleDraftStoreInput["translations"][number],
): Record<string, unknown> {
  return {
    locale: translation.locale,
    slug: translation.slug,
    title: translation.title,
    summary: translation.summary,
    body: translation.body,
    seo: translation.seo,
  };
}

function assertOne(
  result: { modifiedCount: number },
  code: "STALE_REVISION" | "DRAFT_NOT_FOUND",
  message: string,
) {
  if (result.modifiedCount !== 1) {
    throw new ArticleCommandStoreError(code, message);
  }
}

async function reserveRoutes(
  input: PublishArticleStoreInput,
  session: ClientSession,
) {
  const Route = getLocalizedRouteModel();
  const ids = new Map(
    input.routes.map((route) => [route.locale, new Types.ObjectId()]),
  );
  for (const route of input.routes) {
    const collision = await Route.exists({
      locale: route.locale,
      path: route.path,
      active: true,
      $or: [
        { entityType: { $ne: "article" } },
        { entityId: { $ne: new Types.ObjectId(input.articleId) } },
      ],
    }).session(session);
    if (collision) {
      throw new ArticleCommandStoreError(
        "ROUTE_UNAVAILABLE",
        `The localized route ${route.path} is already reserved.`,
      );
    }
  }
  for (const route of input.routes) {
    const replacementId = ids.get(route.locale)!;
    await Route.updateMany(
      {
        entityType: "article",
        entityId: input.articleId,
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
      entityType: "article",
      entityId: input.articleId,
      versionId: input.revisionId,
      active: true,
      activatedAt: input.occurredAt,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    }).save({ session });
  }
}

async function appendPublishAudit(
  input: PublishArticleStoreInput,
  session: ClientSession,
) {
  await new (getAuditEventModel())({
    actorType: "user",
    actorId: input.actorId,
    action: "article.published",
    resourceType: "article",
    resourceId: input.articleId,
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
      expectedArticleRevision: input.expectedArticleRevision,
      draftRevisionId: input.revisionId,
    },
    after: {
      publishedRevisionId: input.revisionId,
      routes: input.routes,
    },
    occurredAt: input.occurredAt,
  }).save({ session });
}

export class MongoArticleCommandStore implements ArticleCommandStore {
  readonly publishesAuditAtomically = true;

  async listArticles(
    scope: ArticleStoreAccessScope,
    input: ListArticlesInput,
  ): Promise<ArticleListDto> {
    await connectToDatabase();
    const query: Record<string, unknown> = {
      deletedAt: { $exists: false },
      ...scopeFilter(scope),
      ...(input.status ? { status: input.status } : {}),
      ...(input.query
        ? {
            $or: [
              { internalId: escapedRegex(input.query) },
              { authorLabel: escapedRegex(input.query) },
              { tagKeys: escapedRegex(input.query) },
            ],
          }
        : {}),
    };
    const Article = getArticleModel();
    const [rows, total] = await Promise.all([
      Article.find(query, ARTICLE_PROJECTION)
        .sort({ updatedAt: -1, _id: -1 })
        .skip(input.offset)
        .limit(input.limit)
        .lean()
        .exec(),
      Article.countDocuments(query).exec(),
    ]);
    const aggregates = await Promise.all(
      rows.map((row) =>
        loadAggregate(scope, String((row as { _id: Types.ObjectId })._id)),
      ),
    );
    return {
      items: aggregates.flatMap((aggregate) =>
        aggregate
          ? [
              {
                article: aggregate.article,
                draftVersion: aggregate.draft?.revision.version ?? null,
                publishedVersion: aggregate.published?.revision.version ?? null,
                translations: (
                  aggregate.draft?.translations ??
                  aggregate.published?.translations ??
                  []
                ).map((translation) => ({
                  locale: translation.locale,
                  title: translation.title,
                  status: translation.translationStatus,
                })),
              },
            ]
          : [],
      ),
      offset: input.offset,
      limit: input.limit,
      total,
    };
  }

  async readArticle(scope: ArticleStoreAccessScope, articleId: string) {
    await connectToDatabase();
    return loadAggregate(scope, articleId);
  }

  async createDraft(input: CreateArticleDraftStoreInput) {
    const database = await connectToDatabase();
    let articleId: Types.ObjectId | undefined;
    try {
      await database.connection.transaction(async (session) => {
        const Article = getArticleModel();
        const Revision = getArticleRevisionModel();
        const Translation = getArticleTranslationModel();
        const [article] = await Article.create(
          [
            {
              ...metadataFields(input.metadata),
              status: "draft",
              createdBy: input.actorId,
              updatedBy: input.actorId,
            },
          ],
          { session },
        );
        if (!article) throw new Error("Article creation returned no document");
        articleId = article._id;
        const [revision] = await Revision.create(
          [
            {
              articleId: article._id,
              version: 1,
              ...revisionFields(input.revision),
              status: "draft",
              createdBy: input.actorId,
              updatedBy: input.actorId,
            },
          ],
          { session },
        );
        if (!revision)
          throw new Error("Revision creation returned no document");
        for (const translation of input.translations) {
          await new Translation({
            articleId: article._id,
            revisionId: revision._id,
            ...translationFields(translation),
            translationStatus: "draft",
            sourceRevision: 1,
            createdBy: input.actorId,
            updatedBy: input.actorId,
          }).save({ session });
        }
        const updated = await Article.updateOne(
          {
            _id: article._id,
            revision: (article as unknown as { revision: number }).revision,
          },
          {
            $set: {
              currentDraftRevisionId: revision._id,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        assertOne(
          updated,
          "STALE_REVISION",
          "The new article changed while its draft was attached.",
        );
      });
    } catch (error) {
      commandError(error);
    }
    const result = await loadAggregate({ kind: "all" }, String(articleId));
    if (!result) commandError(new Error("Created article was not found"));
    return result;
  }

  async createRevisionDraft(
    scope: ArticleStoreAccessScope,
    input: CreateArticleRevisionDraftStoreInput,
  ) {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Article = getArticleModel();
        const Revision = getArticleRevisionModel();
        const Translation = getArticleTranslationModel();
        const article = await Article.findOne({
          _id: input.articleId,
          revision: input.expectedArticleRevision,
          currentPublishedRevisionId: { $exists: true },
          currentDraftRevisionId: { $exists: false },
          deletedAt: { $exists: false },
          ...scopeFilter(scope),
        })
          .session(session)
          .exec();
        if (!article) {
          throw new ArticleCommandStoreError(
            "STALE_REVISION",
            "The article cannot accept a new draft at this revision.",
          );
        }
        const latest = await Revision.findOne({ articleId: input.articleId })
          .sort({ version: -1 })
          .select({ version: 1 })
          .session(session)
          .lean()
          .exec();
        const version = (latest?.version ?? 0) + 1;
        const [revision] = await Revision.create(
          [
            {
              articleId: input.articleId,
              version,
              ...revisionFields(input.revision),
              status: "draft",
              createdBy: input.actorId,
              updatedBy: input.actorId,
            },
          ],
          { session },
        );
        if (!revision)
          throw new Error("Revision creation returned no document");
        for (const translation of input.translations) {
          await new Translation({
            articleId: input.articleId,
            revisionId: revision._id,
            ...translationFields(translation),
            translationStatus: "draft",
            sourceRevision: version,
            createdBy: input.actorId,
            updatedBy: input.actorId,
          }).save({ session });
        }
        const updated = await Article.updateOne(
          {
            _id: input.articleId,
            revision: input.expectedArticleRevision,
            currentDraftRevisionId: { $exists: false },
          },
          {
            $set: {
              currentDraftRevisionId: revision._id,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        assertOne(
          updated,
          "STALE_REVISION",
          "The article changed while its new draft was attached.",
        );
      });
    } catch (error) {
      commandError(error);
    }
    const result = await loadAggregate({ kind: "all" }, input.articleId);
    if (!result) commandError(new Error("Updated article was not found"));
    return result;
  }

  async updateDraft(
    scope: ArticleStoreAccessScope,
    input: UpdateArticleDraftStoreInput,
  ) {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Article = getArticleModel();
        const Revision = getArticleRevisionModel();
        const Translation = getArticleTranslationModel();
        const articleOperation: Record<string, unknown> = {
          $set: {
            ...metadataFields(input.metadata),
            updatedBy: input.actorId,
          },
          $inc: { revision: 1 },
        };
        const unsetMetadata: Record<string, string> = {};
        if (!input.metadata.categoryId) unsetMetadata.categoryId = "";
        if (!input.metadata.authorId) unsetMetadata.authorId = "";
        if (!input.metadata.authorLabel) unsetMetadata.authorLabel = "";
        if (Object.keys(unsetMetadata).length) {
          articleOperation.$unset = unsetMetadata;
        }
        const article = await Article.updateOne(
          {
            _id: input.articleId,
            revision: input.expectedArticleRevision,
            currentDraftRevisionId: input.revisionId,
            deletedAt: { $exists: false },
            ...scopeFilter(scope),
          },
          articleOperation,
          { session },
        ).exec();
        assertOne(
          article,
          "STALE_REVISION",
          "The article metadata changed before the draft was saved.",
        );
        const revisionOperation: Record<string, unknown> = {
          $set: {
            ...revisionFields(input.revision),
            updatedBy: input.actorId,
          },
          $inc: { revision: 1 },
        };
        if (!input.revision.coverMediaId) {
          revisionOperation.$unset = { coverMediaId: "" };
        }
        const revision = await Revision.updateOne(
          {
            _id: input.revisionId,
            articleId: input.articleId,
            status: "draft",
            revision: input.expectedRevision,
          },
          revisionOperation,
          { session },
        ).exec();
        assertOne(
          revision,
          "DRAFT_NOT_FOUND",
          "The article draft changed before it was saved.",
        );
        for (const translation of input.translations) {
          if (translation.expectedRevision === undefined) {
            await new Translation({
              articleId: input.articleId,
              revisionId: input.revisionId,
              ...translationFields(translation),
              translationStatus: "draft",
              sourceRevision: input.expectedRevision + 1,
              createdBy: input.actorId,
              updatedBy: input.actorId,
            }).save({ session });
            continue;
          }
          const updated = await Translation.updateOne(
            {
              articleId: input.articleId,
              revisionId: input.revisionId,
              locale: translation.locale,
              translationStatus: "draft",
              revision: translation.expectedRevision,
            },
            {
              $set: {
                ...translationFields(translation),
                sourceRevision: input.expectedRevision + 1,
                updatedBy: input.actorId,
              },
              $inc: { revision: 1 },
            },
            { session },
          ).exec();
          assertOne(
            updated,
            "STALE_REVISION",
            `The ${translation.locale} translation changed before it was saved.`,
          );
        }
      });
    } catch (error) {
      commandError(error);
    }
    const result = await loadAggregate({ kind: "all" }, input.articleId);
    if (!result) commandError(new Error("Updated article was not found"));
    return result;
  }

  async submitForReview(
    scope: ArticleStoreAccessScope,
    input: SubmitArticleForReviewStoreInput,
  ) {
    return this.#transition(scope, input, "draft", "inReview");
  }

  async returnToDraft(input: ReturnArticleToDraftStoreInput) {
    return this.#transition({ kind: "all" }, input, "inReview", "draft");
  }

  async publish(input: PublishArticleStoreInput) {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Article = getArticleModel();
        const Revision = getArticleRevisionModel();
        const Translation = getArticleTranslationModel();
        await reserveRoutes(input, session);
        const revision = await Revision.updateOne(
          {
            _id: input.revisionId,
            articleId: input.articleId,
            status: "inReview",
            revision: input.expectedRevision,
          },
          {
            $set: {
              status: "published",
              reviewedAt: input.occurredAt,
              reviewedBy: input.actorId,
              publishedAt: input.occurredAt,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        assertOne(
          revision,
          "STALE_REVISION",
          "The article review changed before publication.",
        );
        for (const expected of input.expectedTranslations) {
          const translation = await Translation.updateOne(
            {
              revisionId: input.revisionId,
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
        const article = await Article.updateOne(
          {
            _id: input.articleId,
            revision: input.expectedArticleRevision,
            currentDraftRevisionId: input.revisionId,
            deletedAt: { $exists: false },
          },
          {
            $set: {
              status: "published",
              currentPublishedRevisionId: input.revisionId,
              publishedAt: input.occurredAt,
              updatedBy: input.actorId,
            },
            $unset: { currentDraftRevisionId: "" },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        assertOne(
          article,
          "STALE_REVISION",
          "The article pointer changed before publication.",
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
        throw new ArticleCommandStoreError(
          "ROUTE_UNAVAILABLE",
          "A localized article route was reserved concurrently.",
        );
      }
      commandError(error);
    }
    const result = await loadAggregate({ kind: "all" }, input.articleId);
    if (!result) commandError(new Error("Published article was not found"));
    return result;
  }

  async #transition(
    scope: ArticleStoreAccessScope,
    input: SubmitArticleForReviewStoreInput | ReturnArticleToDraftStoreInput,
    from: "draft" | "inReview",
    to: "inReview" | "draft",
  ) {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Article = getArticleModel();
        const Revision = getArticleRevisionModel();
        const Translation = getArticleTranslationModel();
        const revision = await Revision.updateOne(
          {
            _id: input.revisionId,
            articleId: input.articleId,
            status: from,
            revision: input.expectedRevision,
          },
          {
            $set: {
              status: to,
              submittedAt: to === "inReview" ? input.occurredAt : null,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        assertOne(
          revision,
          "STALE_REVISION",
          "The article draft changed during review.",
        );
        for (const expected of input.expectedTranslations) {
          const translation = await Translation.updateOne(
            {
              revisionId: input.revisionId,
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
        const hasPublished = await Article.exists({
          _id: input.articleId,
          currentPublishedRevisionId: { $exists: true },
        }).session(session);
        const article = await Article.updateOne(
          {
            _id: input.articleId,
            revision: input.expectedArticleRevision,
            currentDraftRevisionId: input.revisionId,
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
          article,
          "STALE_REVISION",
          "The article pointer changed during review.",
        );
      });
    } catch (error) {
      commandError(error);
    }
    const result = await loadAggregate({ kind: "all" }, input.articleId);
    if (!result) commandError(new Error("Transitioned article was not found"));
    return result;
  }
}
