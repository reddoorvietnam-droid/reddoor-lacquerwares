import "server-only";

import type { AuditEventInput } from "@/domains/audit/contracts";
import {
  type CollectionAdminAggregateDto,
  type CollectionCommandServiceDependencies,
  CollectionCommandStoreError,
  type CollectionListDto,
  type CollectionMutationKind,
  type CollectionPostCommitEvent,
  CollectionPostCommitError,
  type CollectionStoreAccessScope,
} from "@/domains/collections/commands/contracts";
import {
  createCollectionDraftInputSchema,
  createCollectionRevisionDraftInputSchema,
  listCollectionsInputSchema,
  publishCollectionInputSchema,
  readCollectionInputSchema,
  returnCollectionToDraftInputSchema,
  submitCollectionForReviewInputSchema,
  updateCollectionDraftInputSchema,
  type CollectionDraftTranslationInput,
  type CollectionMetadataInput,
} from "@/domains/collections/commands/schemas";
import { transitionTranslation } from "@/domains/content/workflow";
import type { ContentPermission } from "@/domains/identity/contracts";
import {
  ContentAccessDeniedError,
  type AccessContext,
  type EffectivePermission,
} from "@/lib/auth/authorization";
import { sanitizeRichTextHtml } from "@/lib/content/sanitize";
import type { Locale } from "@/lib/i18n/config";

function authorize(
  context: AccessContext,
  required: ContentPermission,
): { permission: EffectivePermission; scope: CollectionStoreAccessScope } {
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

function assertMutableScope(scope: CollectionStoreAccessScope) {
  if (scope.kind === "none") {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }
}

function sanitizeTranslation<T extends CollectionDraftTranslationInput>(
  translation: T,
): T {
  return {
    ...translation,
    landingHtml: sanitizeRichTextHtml(translation.landingHtml),
  };
}

function requireAggregate(
  value: CollectionAdminAggregateDto | null,
): CollectionAdminAggregateDto {
  if (!value) {
    throw new CollectionCommandStoreError(
      "NOT_FOUND",
      "The requested collection was not found.",
    );
  }
  return value;
}

function assertRevision(expected: number, actual: number) {
  if (expected !== actual) {
    throw new CollectionCommandStoreError(
      "STALE_REVISION",
      "The collection changed before this command was applied.",
    );
  }
}

function assertExpectedTranslations(
  aggregate: CollectionAdminAggregateDto,
  expected: readonly {
    translationId: string;
    locale: Locale;
    expectedRevision: number;
  }[],
) {
  const byLocale = new Map(expected.map((value) => [value.locale, value]));
  if (
    aggregate.draftTranslations.length !== byLocale.size ||
    aggregate.draftTranslations.some((translation) => {
      const candidate = byLocale.get(translation.locale);
      return (
        candidate?.translationId !== translation.id ||
        candidate.expectedRevision !== translation.revision
      );
    })
  ) {
    throw new CollectionCommandStoreError(
      "STALE_REVISION",
      "The collection translation set changed before this command was applied.",
    );
  }
}

function metadataOf(
  aggregate: CollectionAdminAggregateDto,
): CollectionMetadataInput {
  return {
    code: aggregate.collection.code,
    year: aggregate.collection.year,
    displayOrder: aggregate.collection.displayOrder,
  };
}

function normalizedMetadata(value: CollectionMetadataInput) {
  return {
    code: value.code,
    year: value.year ?? null,
    displayOrder: value.displayOrder,
  };
}

function assertPublishedMetadataImmutable(
  aggregate: CollectionAdminAggregateDto,
  proposed: CollectionMetadataInput,
) {
  if (
    aggregate.publishedTranslations.length > 0 &&
    JSON.stringify(normalizedMetadata(metadataOf(aggregate))) !==
      JSON.stringify(normalizedMetadata(proposed))
  ) {
    throw new CollectionCommandStoreError(
      "PUBLISHED_IMMUTABLE",
      "Published collection metadata is immutable in this versioned model.",
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
        `/${translation.locale}/collections/${translation.slug}`,
    )
  ) {
    throw new CollectionCommandStoreError(
      "ROUTE_UNAVAILABLE",
      "Every collection translation must reserve its exact localized route.",
    );
  }
}

export class CollectionCommandService {
  readonly #dependencies: CollectionCommandServiceDependencies;
  constructor(dependencies: CollectionCommandServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async list(
    context: AccessContext,
    input: unknown = undefined,
  ): Promise<CollectionListDto> {
    const { scope } = authorize(context, "content.read");
    return this.#dependencies.store.listCollections(
      scope,
      listCollectionsInputSchema.parse(input),
    );
  }

  async read(context: AccessContext, input: unknown) {
    const { scope } = authorize(context, "content.read");
    const parsed = readCollectionInputSchema.parse(input);
    return this.#dependencies.store.readCollection(scope, parsed.collectionId);
  }

  async createDraft(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.create");
    assertMutableScope(auth.scope);
    const parsed = createCollectionDraftInputSchema.parse(input);
    const sanitized = {
      ...parsed,
      translations: parsed.translations.map(sanitizeTranslation),
    };
    const occurredAt = this.#now();
    const result = await this.#dependencies.store.createDraft({
      ...sanitized,
      actorId: context.userId,
      occurredAt,
    });
    await this.#after(context, auth.permission, result, {
      kind: "draftCreated",
      action: "collection.draft.created",
      locales: sanitized.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      changes: { after: { code: result.collection.code } },
    });
    return result;
  }

  async createRevisionDraft(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.update");
    assertMutableScope(auth.scope);
    const parsed = createCollectionRevisionDraftInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readCollection(
        auth.scope,
        parsed.collectionId,
      ),
    );
    assertRevision(
      parsed.expectedCollectionRevision,
      before.collection.revision,
    );
    if (before.draftTranslations.length) {
      throw new CollectionCommandStoreError(
        "DRAFT_EXISTS",
        "This collection already has editable translations.",
      );
    }
    if (!before.publishedTranslations.length) {
      throw new CollectionCommandStoreError(
        "NOT_FOUND",
        "A follow-up draft requires a published collection translation.",
      );
    }
    const sanitized = {
      ...parsed,
      translations: parsed.translations.map(sanitizeTranslation),
    };
    const occurredAt = this.#now();
    const result = await this.#dependencies.store.createRevisionDraft(
      auth.scope,
      { ...sanitized, actorId: context.userId, occurredAt },
    );
    await this.#after(context, auth.permission, result, {
      kind: "revisionDraftCreated",
      action: "collection.revision-draft.created",
      locales: sanitized.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      changes: {
        before: { draftLocales: [] },
        after: {
          draftLocales: result.draftTranslations.map(({ locale }) => locale),
        },
      },
    });
    return result;
  }

  async updateDraft(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.update");
    assertMutableScope(auth.scope);
    const parsed = updateCollectionDraftInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readCollection(
        auth.scope,
        parsed.collectionId,
      ),
    );
    assertRevision(
      parsed.expectedCollectionRevision,
      before.collection.revision,
    );
    assertPublishedMetadataImmutable(before, parsed.metadata);
    assertExpectedTranslations(before, parsed.translations);
    if (
      before.draftTranslations.some(
        ({ translationStatus }) => translationStatus !== "draft",
      )
    ) {
      throw new CollectionCommandStoreError(
        "PUBLISHED_IMMUTABLE",
        "Only draft collection translations can be edited.",
      );
    }
    const sanitized = {
      ...parsed,
      translations: parsed.translations.map(sanitizeTranslation),
    };
    const occurredAt = this.#now();
    const result = await this.#dependencies.store.updateDraft(auth.scope, {
      ...sanitized,
      actorId: context.userId,
      occurredAt,
    });
    await this.#after(context, auth.permission, result, {
      kind: "draftUpdated",
      action: "collection.draft.updated",
      locales: sanitized.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      changes: {
        before: { revision: before.collection.revision },
        after: { revision: result.collection.revision },
      },
    });
    return result;
  }

  async submitForReview(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.update");
    assertMutableScope(auth.scope);
    const parsed = submitCollectionForReviewInputSchema.parse(input);
    return this.#workflow(
      context,
      auth.permission,
      auth.scope,
      parsed,
      "inReview",
      "reviewSubmitted",
      "collection.review.submitted",
    );
  }

  async returnToDraft(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.review");
    const parsed = returnCollectionToDraftInputSchema.parse(input);
    return this.#workflow(
      context,
      auth.permission,
      { kind: "all" },
      parsed,
      "draft",
      "reviewReturned",
      "collection.review.returned",
      parsed.reason,
    );
  }

  async publish(context: AccessContext, input: unknown) {
    const auth = authorize(context, "content.publish");
    const parsed = publishCollectionInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readCollection(
        { kind: "all" },
        parsed.collectionId,
      ),
    );
    assertRevision(
      parsed.expectedCollectionRevision,
      before.collection.revision,
    );
    assertExpectedTranslations(before, parsed.expectedTranslations);
    assertRoutes(before.draftTranslations, parsed.routes);
    const occurredAt = this.#now();
    before.draftTranslations.forEach((translation) =>
      transitionTranslation({
        currentStatus: translation.translationStatus,
        targetStatus: "published",
        actualRevision: translation.revision,
        expectedRevision: translation.revision,
        actorId: context.userId,
        occurredAt,
        hasContent:
          Boolean(translation.title.trim()) &&
          Boolean(translation.landingHtml.trim()),
        routeAvailable: true,
      }),
    );
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
      action: "collection.published",
      locales: before.draftTranslations.map(({ locale }) => locale),
      paths: parsed.routes.map(({ path }) => path),
      occurredAt,
      changes: {
        before: {
          publishedLocales: before.publishedTranslations.map(
            ({ locale }) => locale,
          ),
        },
        after: {
          publishedLocales: result.publishedTranslations.map(
            ({ locale }) => locale,
          ),
          routes: parsed.routes,
        },
      },
    });
    return result;
  }

  async #workflow(
    context: AccessContext,
    permission: EffectivePermission,
    scope: CollectionStoreAccessScope,
    input: {
      collectionId: string;
      expectedCollectionRevision: number;
      expectedTranslations: readonly {
        translationId: string;
        locale: Locale;
        expectedRevision: number;
      }[];
    },
    target: "draft" | "inReview",
    kind: CollectionMutationKind,
    action: string,
    reason?: string,
  ) {
    const before = requireAggregate(
      await this.#dependencies.store.readCollection(scope, input.collectionId),
    );
    assertRevision(
      input.expectedCollectionRevision,
      before.collection.revision,
    );
    assertExpectedTranslations(before, input.expectedTranslations);
    const occurredAt = this.#now();
    before.draftTranslations.forEach((translation) =>
      transitionTranslation({
        currentStatus: translation.translationStatus,
        targetStatus: target,
        actualRevision: translation.revision,
        expectedRevision: translation.revision,
        actorId: context.userId,
        occurredAt,
        ...(reason ? { reason } : {}),
      }),
    );
    const result =
      target === "inReview"
        ? await this.#dependencies.store.submitForReview(scope, {
            ...input,
            expectedTranslations: [...input.expectedTranslations],
            actorId: context.userId,
            occurredAt,
          })
        : await this.#dependencies.store.returnToDraft({
            ...input,
            expectedTranslations: [...input.expectedTranslations],
            reason: reason!,
            actorId: context.userId,
            occurredAt,
          });
    await this.#after(context, permission, result, {
      kind,
      action,
      locales: before.draftTranslations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      ...(reason ? { reason } : {}),
      changes: {
        before: {
          statuses: before.draftTranslations.map(
            ({ locale, translationStatus }) => ({
              locale,
              status: translationStatus,
            }),
          ),
        },
        after: { status: target },
      },
    });
    return result;
  }

  #now() {
    return new Date(this.#dependencies.now?.() ?? new Date());
  }

  async #after(
    context: AccessContext,
    permission: EffectivePermission,
    aggregate: CollectionAdminAggregateDto,
    input: {
      kind: CollectionMutationKind;
      action: string;
      locales: readonly Locale[];
      paths: readonly string[];
      occurredAt: Date;
      changes: { before?: unknown; after?: unknown };
      reason?: string;
    },
  ) {
    const postEvent: CollectionPostCommitEvent = {
      entityType: "collection",
      kind: input.kind,
      collectionId: aggregate.collection.id,
      code: aggregate.collection.code,
      locales: input.locales,
      paths: input.paths,
      tags: [
        "collections:admin",
        `collection:${aggregate.collection.id}`,
        ...(input.kind === "published"
          ? [
              "collections:public",
              ...input.locales.map((locale) => `collections:locale:${locale}`),
            ]
          : []),
      ],
      requestId: context.requestId,
      occurredAt: input.occurredAt,
    };
    const auditEvent: AuditEventInput = {
      actor: { type: "user", userId: context.userId },
      action: input.action,
      resourceType: "collection",
      resourceId: aggregate.collection.id,
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
    if (failures.length) throw new CollectionPostCommitError(failures);
  }
}
