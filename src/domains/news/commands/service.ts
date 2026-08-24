import "server-only";

import type { AuditEventInput } from "@/domains/audit/contracts";
import {
  type ArticleAdminAggregateDto,
  type ArticleCommandServiceDependencies,
  ArticleCommandStoreError,
  type ArticleListDto,
  type ArticleMutationKind,
  type ArticlePostCommitEvent,
  ArticlePostCommitError,
  type ArticleRevisionBundleDto,
  type ArticleStoreAccessScope,
} from "@/domains/news/commands/contracts";
import {
  createArticleDraftInputSchema,
  createArticleRevisionDraftInputSchema,
  listArticlesInputSchema,
  publishArticleInputSchema,
  readArticleInputSchema,
  returnArticleToDraftInputSchema,
  submitArticleForReviewInputSchema,
  updateArticleDraftInputSchema,
  type ArticleDraftTranslationInput,
  type ArticleMetadataInput,
  type CreateArticleDraftInput,
  type CreateArticleRevisionDraftInput,
  type UpdateArticleDraftInput,
} from "@/domains/news/commands/schemas";
import {
  ContentWorkflowError,
  transitionContentRevision,
  transitionTranslation,
} from "@/domains/content/workflow";
import type { ContentPermission } from "@/domains/identity/contracts";
import {
  ContentAccessDeniedError,
  type AccessContext,
  type EffectivePermission,
} from "@/lib/auth/authorization";
import { sanitizeStructuredBlocksForPersistence } from "@/lib/content/sanitize";
import type { Locale } from "@/lib/i18n/config";

function authorize(
  context: AccessContext,
  required: ContentPermission,
): { permission: EffectivePermission; scope: ArticleStoreAccessScope } {
  const permission = context.permissions.find(
    (candidate) => candidate.permission === required,
  );
  if (!permission || context.userStatus !== "active") {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }
  if (
    (required === "content.review" || required === "content.publish") &&
    permission.scope !== "all"
  ) {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }
  return {
    permission,
    scope:
      permission.scope === "all"
        ? { kind: "all" }
        : permission.scope === "own"
          ? { kind: "own", ownerUserId: context.userId }
          : { kind: "none" },
  };
}

function assertMutableScope(scope: ArticleStoreAccessScope) {
  if (scope.kind === "none") {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }
}

function sanitizeTranslation(
  translation: ArticleDraftTranslationInput,
): ArticleDraftTranslationInput {
  return {
    ...translation,
    body: sanitizeStructuredBlocksForPersistence(translation.body),
  };
}

function sanitizeCreate(input: unknown): CreateArticleDraftInput {
  const parsed = createArticleDraftInputSchema.parse(input);
  return {
    ...parsed,
    revision: {
      ...parsed.revision,
      sourceBlocks: sanitizeStructuredBlocksForPersistence(
        parsed.revision.sourceBlocks,
      ),
    },
    translations: parsed.translations.map(sanitizeTranslation),
  };
}

function sanitizeCreateRevision(
  input: unknown,
): CreateArticleRevisionDraftInput {
  const parsed = createArticleRevisionDraftInputSchema.parse(input);
  return {
    ...parsed,
    revision: {
      ...parsed.revision,
      sourceBlocks: sanitizeStructuredBlocksForPersistence(
        parsed.revision.sourceBlocks,
      ),
    },
    translations: parsed.translations.map(sanitizeTranslation),
  };
}

function sanitizeUpdate(input: unknown): UpdateArticleDraftInput {
  const parsed = updateArticleDraftInputSchema.parse(input);
  return {
    ...parsed,
    revision: {
      ...parsed.revision,
      sourceBlocks: sanitizeStructuredBlocksForPersistence(
        parsed.revision.sourceBlocks,
      ),
    },
    translations: parsed.translations.map((translation) => ({
      ...sanitizeTranslation(translation),
      ...(translation.expectedRevision === undefined
        ? {}
        : { expectedRevision: translation.expectedRevision }),
    })),
  };
}

function stale(expected: number, actual: number) {
  if (expected !== actual) {
    throw new ContentWorkflowError(
      "STALE_REVISION",
      "The article changed before this command was applied.",
    );
  }
}

function requireAggregate(
  value: ArticleAdminAggregateDto | null,
): ArticleAdminAggregateDto {
  if (!value) {
    throw new ArticleCommandStoreError(
      "NOT_FOUND",
      "The requested article was not found.",
    );
  }
  return value;
}

function requireDraft(
  aggregate: ArticleAdminAggregateDto,
  revisionId: string,
): ArticleRevisionBundleDto {
  if (!aggregate.draft || aggregate.draft.revision.id !== revisionId) {
    throw new ArticleCommandStoreError(
      "DRAFT_NOT_FOUND",
      "The requested article draft does not exist.",
    );
  }
  return aggregate.draft;
}

function assertExpectedTranslations(
  actual: readonly { locale: Locale; revision: number }[],
  expected: readonly { locale: Locale; expectedRevision: number }[],
) {
  const byLocale = new Map(
    expected.map(({ locale, expectedRevision }) => [locale, expectedRevision]),
  );
  if (
    actual.length !== byLocale.size ||
    actual.some(
      (translation) =>
        byLocale.get(translation.locale) !== translation.revision,
    )
  ) {
    throw new ContentWorkflowError(
      "STALE_REVISION",
      "The article translation set changed before this command was applied.",
    );
  }
}

function assertUpdateTranslations(
  draft: ArticleRevisionBundleDto,
  input: UpdateArticleDraftInput,
) {
  const byLocale = new Map(
    input.translations.map((translation) => [translation.locale, translation]),
  );
  if (
    draft.translations.some(
      (translation) =>
        byLocale.get(translation.locale)?.expectedRevision !==
        translation.revision,
    ) ||
    input.translations.some(
      (translation) =>
        !draft.translations.some(
          ({ locale }) => locale === translation.locale,
        ) && translation.expectedRevision !== undefined,
    )
  ) {
    throw new ContentWorkflowError(
      "STALE_REVISION",
      "The article translation set changed before the draft was saved.",
    );
  }
}

function metadataOf(aggregate: ArticleAdminAggregateDto): ArticleMetadataInput {
  return {
    internalId: aggregate.article.internalId,
    categoryId: aggregate.article.categoryId,
    tagKeys: [...aggregate.article.tagKeys],
    authorId: aggregate.article.authorId,
    authorLabel: aggregate.article.authorLabel,
  };
}

function normalizedMetadata(value: ArticleMetadataInput) {
  return {
    internalId: value.internalId,
    categoryId: value.categoryId ?? null,
    tagKeys: [...value.tagKeys],
    authorId: value.authorId ?? null,
    authorLabel: value.authorLabel ?? null,
  };
}

function assertPublishedMetadataImmutable(
  aggregate: ArticleAdminAggregateDto,
  proposed: ArticleMetadataInput,
) {
  if (
    aggregate.published &&
    JSON.stringify(normalizedMetadata(metadataOf(aggregate))) !==
      JSON.stringify(normalizedMetadata(proposed))
  ) {
    throw new ArticleCommandStoreError(
      "PUBLISHED_IMMUTABLE",
      "Published article metadata is immutable in this versioned model.",
    );
  }
}

function assertRoutes(
  translations: readonly { locale: Locale; slug: string }[],
  routes: readonly { locale: Locale; path: string }[],
) {
  const byLocale = new Map(routes.map(({ locale, path }) => [locale, path]));
  if (
    translations.length !== byLocale.size ||
    translations.some(
      (translation) =>
        byLocale.get(translation.locale) !==
        `/${translation.locale}/news/${translation.slug}`,
    )
  ) {
    throw new ContentWorkflowError(
      "ROUTE_UNAVAILABLE",
      "Every article translation must reserve its exact localized news route.",
    );
  }
}

export class ArticleCommandService {
  readonly #dependencies: ArticleCommandServiceDependencies;
  constructor(dependencies: ArticleCommandServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async list(
    context: AccessContext,
    input: unknown = undefined,
  ): Promise<ArticleListDto> {
    const { scope } = authorize(context, "content.read");
    return this.#dependencies.store.listArticles(
      scope,
      listArticlesInputSchema.parse(input),
    );
  }

  async read(context: AccessContext, input: unknown) {
    const { scope } = authorize(context, "content.read");
    const parsed = readArticleInputSchema.parse(input);
    return this.#dependencies.store.readArticle(scope, parsed.articleId);
  }

  async createDraft(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.create");
    assertMutableScope(auth.scope);
    const parsed = sanitizeCreate(input);
    const occurredAt = this.#now();
    const result = await this.#dependencies.store.createDraft({
      ...parsed,
      actorId: context.userId,
      occurredAt,
    });
    await this.#after(context, auth.permission, result, {
      kind: "draftCreated",
      action: "article.draft.created",
      locales: parsed.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      changes: {
        after: {
          internalId: result.article.internalId,
          draftVersion: result.draft?.revision.version ?? null,
        },
      },
    });
    return result;
  }

  async createRevisionDraft(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.update");
    assertMutableScope(auth.scope);
    const parsed = sanitizeCreateRevision(input);
    const before = requireAggregate(
      await this.#dependencies.store.readArticle(auth.scope, parsed.articleId),
    );
    stale(parsed.expectedArticleRevision, before.article.revision);
    if (before.draft) {
      throw new ArticleCommandStoreError(
        "DRAFT_EXISTS",
        "This article already has an editable draft.",
      );
    }
    if (!before.published) {
      throw new ArticleCommandStoreError(
        "NOT_FOUND",
        "A follow-up draft requires a published article revision.",
      );
    }
    const occurredAt = this.#now();
    const result = await this.#dependencies.store.createRevisionDraft(
      auth.scope,
      { ...parsed, actorId: context.userId, occurredAt },
    );
    await this.#after(context, auth.permission, result, {
      kind: "revisionDraftCreated",
      action: "article.revision-draft.created",
      locales: parsed.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      changes: {
        before: { draftVersion: null },
        after: { draftVersion: result.draft?.revision.version ?? null },
      },
    });
    return result;
  }

  async updateDraft(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.update");
    assertMutableScope(auth.scope);
    const parsed = sanitizeUpdate(input);
    const before = requireAggregate(
      await this.#dependencies.store.readArticle(auth.scope, parsed.articleId),
    );
    const draft = requireDraft(before, parsed.revisionId);
    stale(parsed.expectedArticleRevision, before.article.revision);
    stale(parsed.expectedRevision, draft.revision.revision);
    if (draft.revision.status !== "draft") {
      throw new ArticleCommandStoreError(
        "PUBLISHED_IMMUTABLE",
        "Only a draft article revision can be edited.",
      );
    }
    assertPublishedMetadataImmutable(before, parsed.metadata);
    assertUpdateTranslations(draft, parsed);
    const occurredAt = this.#now();
    const result = await this.#dependencies.store.updateDraft(auth.scope, {
      ...parsed,
      actorId: context.userId,
      occurredAt,
    });
    await this.#after(context, auth.permission, result, {
      kind: "draftUpdated",
      action: "article.draft.updated",
      locales: parsed.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      changes: {
        before: { optimisticRevision: draft.revision.revision },
        after: { optimisticRevision: result.draft?.revision.revision ?? null },
      },
    });
    return result;
  }

  async submitForReview(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.update");
    assertMutableScope(auth.scope);
    const parsed = submitArticleForReviewInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readArticle(auth.scope, parsed.articleId),
    );
    const draft = requireDraft(before, parsed.revisionId);
    const occurredAt = this.#now();
    this.#validateTransition(
      context,
      before,
      draft,
      parsed,
      "inReview",
      occurredAt,
    );
    const result = await this.#dependencies.store.submitForReview(auth.scope, {
      ...parsed,
      actorId: context.userId,
      occurredAt,
    });
    await this.#afterWorkflow(
      context,
      auth.permission,
      result,
      draft,
      "reviewSubmitted",
      "article.review.submitted",
      "inReview",
      occurredAt,
    );
    return result;
  }

  async returnToDraft(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.review");
    const parsed = returnArticleToDraftInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readArticle(
        { kind: "all" },
        parsed.articleId,
      ),
    );
    const draft = requireDraft(before, parsed.revisionId);
    const occurredAt = this.#now();
    this.#validateTransition(
      context,
      before,
      draft,
      parsed,
      "draft",
      occurredAt,
      parsed.reason,
    );
    const result = await this.#dependencies.store.returnToDraft({
      ...parsed,
      actorId: context.userId,
      occurredAt,
    });
    await this.#afterWorkflow(
      context,
      auth.permission,
      result,
      draft,
      "reviewReturned",
      "article.review.returned",
      "draft",
      occurredAt,
      parsed.reason,
    );
    return result;
  }

  async publish(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.publish");
    const parsed = publishArticleInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readArticle(
        { kind: "all" },
        parsed.articleId,
      ),
    );
    const draft = requireDraft(before, parsed.revisionId);
    const occurredAt = this.#now();
    this.#validateTransition(
      context,
      before,
      draft,
      parsed,
      "published",
      occurredAt,
    );
    assertRoutes(draft.translations, parsed.routes);
    for (const translation of draft.translations) {
      if (!translation.title.trim() || !translation.summary.trim()) {
        throw new ContentWorkflowError(
          "EMPTY_CONTENT",
          "An article needs a localized title and summary before publication.",
        );
      }
    }
    const result = await this.#dependencies.store.publish({
      ...parsed,
      actorId: context.userId,
      occurredAt,
      requestId: context.requestId,
      permissionScope: auth.permission.scope,
      businessUnitIds: auth.permission.businessUnitIds,
    });
    await this.#after(context, auth.permission, result, {
      kind: "published",
      action: "article.published",
      locales: draft.translations.map(({ locale }) => locale),
      paths: parsed.routes.map(({ path }) => path),
      occurredAt,
      changes: {
        before: {
          publishedVersion: before.published?.revision.version ?? null,
        },
        after: {
          publishedVersion: result.published?.revision.version ?? null,
          routes: parsed.routes,
        },
      },
    });
    return result;
  }

  #validateTransition(
    context: AccessContext,
    aggregate: ArticleAdminAggregateDto,
    draft: ArticleRevisionBundleDto,
    input: {
      expectedArticleRevision: number;
      expectedRevision: number;
      expectedTranslations: readonly {
        locale: Locale;
        expectedRevision: number;
      }[];
    },
    target: "draft" | "inReview" | "published",
    occurredAt: Date,
    reason?: string,
  ) {
    stale(input.expectedArticleRevision, aggregate.article.revision);
    transitionContentRevision({
      currentStatus: draft.revision.status,
      targetStatus: target,
      actualRevision: draft.revision.revision,
      expectedRevision: input.expectedRevision,
      actorId: context.userId,
      occurredAt,
      ...(reason ? { reason } : {}),
    });
    assertExpectedTranslations(draft.translations, input.expectedTranslations);
    draft.translations.forEach((translation) =>
      transitionTranslation({
        currentStatus: translation.translationStatus,
        targetStatus: target,
        actualRevision: translation.revision,
        expectedRevision: translation.revision,
        actorId: context.userId,
        occurredAt,
        ...(reason ? { reason } : {}),
        ...(target === "published"
          ? { hasContent: true, routeAvailable: true }
          : {}),
      }),
    );
  }

  async #afterWorkflow(
    context: AccessContext,
    permission: EffectivePermission,
    result: ArticleAdminAggregateDto,
    before: ArticleRevisionBundleDto,
    kind: ArticleMutationKind,
    action: string,
    status: "draft" | "inReview",
    occurredAt: Date,
    reason?: string,
  ) {
    await this.#after(context, permission, result, {
      kind,
      action,
      locales: before.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      ...(reason ? { reason } : {}),
      changes: {
        before: { status: before.revision.status },
        after: { status },
      },
    });
  }

  #now() {
    return new Date(this.#dependencies.now?.() ?? new Date());
  }

  async #after(
    context: AccessContext,
    permission: EffectivePermission,
    aggregate: ArticleAdminAggregateDto,
    input: {
      kind: ArticleMutationKind;
      action: string;
      locales: readonly Locale[];
      paths: readonly string[];
      occurredAt: Date;
      changes: { before?: unknown; after?: unknown };
      reason?: string;
    },
  ) {
    const tags = [
      "articles:admin",
      `article:${aggregate.article.id}`,
      ...(input.kind === "published"
        ? [
            "articles:public",
            ...input.locales.map((locale) => `articles:locale:${locale}`),
          ]
        : []),
    ];
    const postEvent: ArticlePostCommitEvent = {
      entityType: "article",
      kind: input.kind,
      articleId: aggregate.article.id,
      internalId: aggregate.article.internalId,
      locales: input.locales,
      paths: input.paths,
      tags: [...new Set(tags)],
      requestId: context.requestId,
      occurredAt: input.occurredAt,
    };
    const auditEvent: AuditEventInput = {
      actor: { type: "user", userId: context.userId },
      action: input.action,
      resourceType: "article",
      resourceId: aggregate.article.id,
      businessUnitIds: permission.businessUnitIds,
      requestId: context.requestId,
      permissionDecision: {
        permission: permission.permission,
        outcome: "allowed",
        reasonCode: "COMMAND_AUTHORIZED",
        scope: permission.scope,
      },
      changes: input.changes,
      ...(input.reason ? { reason: input.reason } : {}),
      occurredAt: input.occurredAt,
    };
    const failures: Array<"audit" | "postCommit"> = [];
    if (!(
      input.kind === "published" &&
      this.#dependencies.store.publishesAuditAtomically
    )) {
      try {
        await this.#dependencies.auditRepository.append(auditEvent);
      } catch {
        failures.push("audit");
      }
    }
    if (this.#dependencies.postCommit) {
      try {
        await this.#dependencies.postCommit(postEvent);
      } catch {
        failures.push("postCommit");
      }
    }
    if (failures.length) throw new ArticlePostCommitError(failures);
  }
}
