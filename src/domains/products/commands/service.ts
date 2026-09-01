import "server-only";

import type {
  AuditChangeSet,
  AuditEventInput,
} from "@/domains/audit/contracts";
import {
  type ProductAdminAggregateDto,
  type ProductCommandServiceDependencies,
  ProductCommandStoreError,
  type ProductListDto,
  type ProductMutationKind,
  type ProductPostCommitEvent,
  ProductPostCommitError,
  type ProductStoreAccessScope,
  type ProductVersionBundleDto,
} from "@/domains/products/commands/contracts";
import {
  createProductDraftInputSchema,
  createProductRevisionDraftInputSchema,
  listProductsInputSchema,
  publishProductInputSchema,
  readProductInputSchema,
  returnProductToDraftInputSchema,
  submitProductForReviewInputSchema,
  updateProductDraftInputSchema,
  type CreateProductDraftInput,
  type CreateProductRevisionDraftInput,
  type ProductDraftTranslationInput,
  type ProductMetadataInput,
  type ProductVersionDraftInput,
  type UpdateProductDraftInput,
} from "@/domains/products/commands/schemas";
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

type AuthorizedScope = {
  permission: EffectivePermission;
  storeScope: ProductStoreAccessScope;
};

type MutationAudit = {
  action: string;
  reason?: string;
  changes: AuditChangeSet;
};

function resolveAuthorizedScope(
  context: AccessContext,
  requiredPermission: ContentPermission,
): AuthorizedScope {
  const permission = context.permissions.find(
    (candidate) => candidate.permission === requiredPermission,
  );

  if (!permission || context.userStatus !== "active") {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }

  if (
    (requiredPermission === "content.review" ||
      requiredPermission === "content.publish") &&
    permission.scope !== "all"
  ) {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }

  return {
    permission,
    storeScope:
      permission.scope === "all"
        ? { kind: "all" }
        : permission.scope === "own"
          ? { kind: "own", ownerUserId: context.userId }
          : { kind: "none" },
  };
}

function assertMutationScope(scope: ProductStoreAccessScope): void {
  if (scope.kind === "none") {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }
}

function sanitizeTranslation(
  translation: ProductDraftTranslationInput,
): ProductDraftTranslationInput {
  return {
    ...translation,
    description: sanitizeStructuredBlocksForPersistence(
      translation.description,
    ),
    story: sanitizeStructuredBlocksForPersistence(translation.story),
    careInstructions: sanitizeStructuredBlocksForPersistence(
      translation.careInstructions,
    ),
  };
}

function sanitizeCreateDraft(input: unknown): CreateProductDraftInput {
  const parsed = createProductDraftInputSchema.parse(input);
  return {
    ...parsed,
    translations: parsed.translations.map(sanitizeTranslation),
  };
}

function sanitizeCreateRevisionDraft(
  input: unknown,
): CreateProductRevisionDraftInput {
  const parsed = createProductRevisionDraftInputSchema.parse(input);
  return {
    ...parsed,
    translations: parsed.translations.map(sanitizeTranslation),
  };
}

function sanitizeUpdateDraft(input: unknown): UpdateProductDraftInput {
  const parsed = updateProductDraftInputSchema.parse(input);
  return {
    ...parsed,
    translations: parsed.translations.map((translation) => ({
      ...sanitizeTranslation(translation),
      ...(translation.expectedRevision === undefined
        ? {}
        : { expectedRevision: translation.expectedRevision }),
    })),
  };
}

function assertExpectedRevision(expected: number, actual: number): void {
  if (expected !== actual) {
    throw new ContentWorkflowError(
      "STALE_REVISION",
      "The product changed before this command was applied.",
    );
  }
}

function requireAggregate(
  aggregate: ProductAdminAggregateDto | null,
): ProductAdminAggregateDto {
  if (!aggregate) {
    throw new ProductCommandStoreError(
      "NOT_FOUND",
      "The requested product was not found.",
    );
  }
  return aggregate;
}

function requireDraft(
  aggregate: ProductAdminAggregateDto,
  versionId: string,
): ProductVersionBundleDto {
  if (!aggregate.draft || aggregate.draft.version.id !== versionId) {
    throw new ProductCommandStoreError(
      "DRAFT_NOT_FOUND",
      "The requested product draft does not exist.",
    );
  }
  return aggregate.draft;
}

function assertExpectedTranslations(
  actual: readonly { locale: Locale; revision: number }[],
  expected: readonly { locale: Locale; expectedRevision: number }[],
): void {
  const byLocale = new Map(
    expected.map(({ locale, expectedRevision }) => [locale, expectedRevision]),
  );
  if (actual.length !== byLocale.size) {
    throw new ContentWorkflowError(
      "STALE_REVISION",
      "The product translation set changed before this command was applied.",
    );
  }
  for (const translation of actual) {
    if (byLocale.get(translation.locale) !== translation.revision) {
      throw new ContentWorkflowError(
        "STALE_REVISION",
        "A product translation changed before this command was applied.",
      );
    }
  }
}

function assertUpdateTranslations(
  draft: ProductVersionBundleDto,
  input: UpdateProductDraftInput,
): void {
  const updates = new Map(
    input.translations.map((translation) => [translation.locale, translation]),
  );
  for (const existing of draft.translations) {
    if (updates.get(existing.locale)?.expectedRevision !== existing.revision) {
      throw new ContentWorkflowError(
        "STALE_REVISION",
        "A draft update must include the current revision of every translation.",
      );
    }
  }
  for (const update of input.translations) {
    const existing = draft.translations.find(
      ({ locale }) => locale === update.locale,
    );
    if (!existing && update.expectedRevision !== undefined) {
      throw new ContentWorkflowError(
        "STALE_REVISION",
        "A newly added translation cannot have an existing revision.",
      );
    }
  }
}

/**
 * The shape compared by `assertPublishedMetadataImmutable`, and nothing else.
 *
 * `group`, `isAvailable` and `categoryKey` are deliberately absent: they are
 * shelf placement an editor changes as stock moves or a mis-filing is noticed,
 * not part of the versioned identity the immutability rule protects. Including
 * them would freeze "in stock" at the value it held on publication day and make
 * a wrongly-filed live product uncorrectable without a version bump.
 */
function normalizeMetadata(metadata: ProductMetadataInput): unknown {
  return {
    internalId: metadata.internalId,
    sku: metadata.sku,
    categoryId: metadata.categoryId ?? null,
    collectionIds: [...metadata.collectionIds],
    materialKeys: [...metadata.materialKeys],
    finishKeys: [...metadata.finishKeys],
    searchTokens: [...metadata.searchTokens],
  };
}

function persistedMetadata(
  aggregate: ProductAdminAggregateDto,
): ProductMetadataInput {
  return {
    internalId: aggregate.product.internalId,
    sku: aggregate.product.sku,
    group: aggregate.product.group,
    isAvailable: aggregate.product.isAvailable,
    categoryKey: aggregate.product.categoryKey,
    categoryId: aggregate.product.categoryId,
    collectionIds: [...aggregate.product.collectionIds],
    materialKeys: [...aggregate.product.materialKeys],
    finishKeys: [...aggregate.product.finishKeys],
    searchTokens: [...aggregate.product.searchTokens],
  };
}

function assertPublishedMetadataImmutable(
  aggregate: ProductAdminAggregateDto,
  proposed: ProductMetadataInput,
): void {
  if (
    aggregate.published &&
    JSON.stringify(normalizeMetadata(persistedMetadata(aggregate))) !==
      JSON.stringify(normalizeMetadata(proposed))
  ) {
    throw new ProductCommandStoreError(
      "PUBLISHED_IMMUTABLE",
      "Published product metadata is immutable in this versioned model.",
    );
  }
}

function assertRoutes(
  translations: readonly { locale: Locale; slug: string }[],
  routes: readonly { locale: Locale; path: string }[],
): void {
  const byLocale = new Map(routes.map(({ locale, path }) => [locale, path]));
  if (translations.length !== byLocale.size) {
    throw new ContentWorkflowError(
      "ROUTE_UNAVAILABLE",
      "Every published product translation must reserve one localized route.",
    );
  }
  for (const translation of translations) {
    if (
      byLocale.get(translation.locale) !==
      `/${translation.locale}/products/${translation.slug}`
    ) {
      throw new ContentWorkflowError(
        "ROUTE_UNAVAILABLE",
        "A product route must match its locale and translation slug.",
      );
    }
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function tags(
  kind: ProductMutationKind,
  aggregate: ProductAdminAggregateDto,
  localeValues: readonly Locale[],
): string[] {
  const admin = [
    "products:admin",
    `product:${aggregate.product.id}`,
    `product:sku:${aggregate.product.sku}`,
  ];
  return kind === "published"
    ? unique([
        ...admin,
        "products:public",
        ...localeValues.map((locale) => `products:locale:${locale}`),
      ])
    : admin;
}

export class ProductCommandService {
  readonly #dependencies: ProductCommandServiceDependencies;

  constructor(dependencies: ProductCommandServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async list(
    context: AccessContext,
    input: unknown = undefined,
  ): Promise<ProductListDto> {
    const { storeScope } = resolveAuthorizedScope(context, "content.read");
    return this.#dependencies.store.listProducts(
      storeScope,
      listProductsInputSchema.parse(input),
    );
  }

  async read(
    context: AccessContext,
    input: unknown,
  ): Promise<ProductAdminAggregateDto | null> {
    const { storeScope } = resolveAuthorizedScope(context, "content.read");
    const parsed = readProductInputSchema.parse(input);
    return this.#dependencies.store.readProduct(storeScope, parsed.productId);
  }

  async createDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<ProductAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.create");
    assertMutationScope(authorization.storeScope);
    const parsed = sanitizeCreateDraft(input);
    const occurredAt = this.#now();
    const aggregate = await this.#dependencies.store.createDraft({
      ...parsed,
      actorId: context.userId,
      occurredAt,
    });
    await this.#afterCommit(context, authorization.permission, aggregate, {
      kind: "draftCreated",
      locales: parsed.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      audit: {
        action: "product.draft.created",
        changes: {
          after: {
            internalId: aggregate.product.internalId,
            sku: aggregate.product.sku,
            draftVersion: aggregate.draft?.version.version ?? null,
          },
        },
      },
    });
    return aggregate;
  }

  async createRevisionDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<ProductAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.update");
    assertMutationScope(authorization.storeScope);
    const parsed = sanitizeCreateRevisionDraft(input);
    const before = requireAggregate(
      await this.#dependencies.store.readProduct(
        authorization.storeScope,
        parsed.productId,
      ),
    );
    assertExpectedRevision(
      parsed.expectedProductRevision,
      before.product.revision,
    );
    if (before.draft) {
      throw new ProductCommandStoreError(
        "DRAFT_EXISTS",
        "This product already has an editable draft.",
      );
    }
    if (!before.published) {
      throw new ProductCommandStoreError(
        "NOT_FOUND",
        "A follow-up draft requires a published product version.",
      );
    }
    const occurredAt = this.#now();
    const aggregate = await this.#dependencies.store.createRevisionDraft(
      authorization.storeScope,
      { ...parsed, actorId: context.userId, occurredAt },
    );
    await this.#afterCommit(context, authorization.permission, aggregate, {
      kind: "revisionDraftCreated",
      locales: parsed.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      audit: {
        action: "product.revision-draft.created",
        changes: {
          before: { draftVersion: null },
          after: { draftVersion: aggregate.draft?.version.version ?? null },
        },
      },
    });
    return aggregate;
  }

  async updateDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<ProductAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.update");
    assertMutationScope(authorization.storeScope);
    const parsed = sanitizeUpdateDraft(input);
    const before = requireAggregate(
      await this.#dependencies.store.readProduct(
        authorization.storeScope,
        parsed.productId,
      ),
    );
    const draft = requireDraft(before, parsed.versionId);
    assertExpectedRevision(
      parsed.expectedProductRevision,
      before.product.revision,
    );
    assertExpectedRevision(
      parsed.expectedVersionRevision,
      draft.version.revision,
    );
    if (draft.version.status !== "draft") {
      throw new ProductCommandStoreError(
        "PUBLISHED_IMMUTABLE",
        "Only a draft product version can be edited.",
      );
    }
    assertPublishedMetadataImmutable(before, parsed.metadata);
    assertUpdateTranslations(draft, parsed);
    const occurredAt = this.#now();
    const aggregate = await this.#dependencies.store.updateDraft(
      authorization.storeScope,
      { ...parsed, actorId: context.userId, occurredAt },
    );
    await this.#afterCommit(context, authorization.permission, aggregate, {
      kind: "draftUpdated",
      locales: parsed.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      audit: {
        action: "product.draft.updated",
        changes: {
          before: { optimisticRevision: draft.version.revision },
          after: {
            optimisticRevision: aggregate.draft?.version.revision ?? null,
          },
        },
      },
    });
    return aggregate;
  }

  async submitForReview(
    context: AccessContext,
    input: unknown,
  ): Promise<ProductAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.update");
    assertMutationScope(authorization.storeScope);
    const parsed = submitProductForReviewInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readProduct(
        authorization.storeScope,
        parsed.productId,
      ),
    );
    const draft = requireDraft(before, parsed.versionId);
    const occurredAt = this.#now();
    assertExpectedRevision(
      parsed.expectedProductRevision,
      before.product.revision,
    );
    transitionContentRevision({
      currentStatus: draft.version.status,
      targetStatus: "inReview",
      actualRevision: draft.version.revision,
      expectedRevision: parsed.expectedVersionRevision,
      actorId: context.userId,
      occurredAt,
    });
    assertExpectedTranslations(draft.translations, parsed.expectedTranslations);
    draft.translations.forEach((translation) =>
      transitionTranslation({
        currentStatus: translation.translationStatus,
        targetStatus: "inReview",
        actualRevision: translation.revision,
        expectedRevision: translation.revision,
        actorId: context.userId,
        occurredAt,
      }),
    );
    const aggregate = await this.#dependencies.store.submitForReview(
      authorization.storeScope,
      { ...parsed, actorId: context.userId, occurredAt },
    );
    const localeValues = draft.translations.map(({ locale }) => locale);
    await this.#afterCommit(context, authorization.permission, aggregate, {
      kind: "reviewSubmitted",
      locales: localeValues,
      paths: [],
      occurredAt,
      audit: {
        action: "product.review.submitted",
        changes: {
          before: { status: draft.version.status },
          after: { status: "inReview", locales: localeValues },
        },
      },
    });
    return aggregate;
  }

  async returnToDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<ProductAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.review");
    const parsed = returnProductToDraftInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readProduct(
        { kind: "all" },
        parsed.productId,
      ),
    );
    const draft = requireDraft(before, parsed.versionId);
    const occurredAt = this.#now();
    assertExpectedRevision(
      parsed.expectedProductRevision,
      before.product.revision,
    );
    transitionContentRevision({
      currentStatus: draft.version.status,
      targetStatus: "draft",
      actualRevision: draft.version.revision,
      expectedRevision: parsed.expectedVersionRevision,
      actorId: context.userId,
      occurredAt,
      reason: parsed.reason,
    });
    assertExpectedTranslations(draft.translations, parsed.expectedTranslations);
    draft.translations.forEach((translation) =>
      transitionTranslation({
        currentStatus: translation.translationStatus,
        targetStatus: "draft",
        actualRevision: translation.revision,
        expectedRevision: translation.revision,
        actorId: context.userId,
        occurredAt,
        reason: parsed.reason,
      }),
    );
    const aggregate = await this.#dependencies.store.returnToDraft({
      ...parsed,
      actorId: context.userId,
      occurredAt,
    });
    const localeValues = draft.translations.map(({ locale }) => locale);
    await this.#afterCommit(context, authorization.permission, aggregate, {
      kind: "reviewReturned",
      locales: localeValues,
      paths: [],
      occurredAt,
      audit: {
        action: "product.review.returned",
        reason: parsed.reason,
        changes: {
          before: { status: draft.version.status },
          after: { status: "draft", locales: localeValues },
        },
      },
    });
    return aggregate;
  }

  async publish(
    context: AccessContext,
    input: unknown,
  ): Promise<ProductAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.publish");
    const parsed = publishProductInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readProduct(
        { kind: "all" },
        parsed.productId,
      ),
    );
    const draft = requireDraft(before, parsed.versionId);
    const occurredAt = this.#now();
    assertExpectedRevision(
      parsed.expectedProductRevision,
      before.product.revision,
    );
    transitionContentRevision({
      currentStatus: draft.version.status,
      targetStatus: "published",
      actualRevision: draft.version.revision,
      expectedRevision: parsed.expectedVersionRevision,
      actorId: context.userId,
      occurredAt,
    });
    assertExpectedTranslations(draft.translations, parsed.expectedTranslations);
    assertRoutes(draft.translations, parsed.routes);
    draft.translations.forEach((translation) =>
      transitionTranslation({
        currentStatus: translation.translationStatus,
        targetStatus: "published",
        actualRevision: translation.revision,
        expectedRevision: translation.revision,
        actorId: context.userId,
        occurredAt,
        hasContent:
          translation.title.trim().length > 0 ||
          translation.description.length > 0,
        routeAvailable: true,
      }),
    );
    const aggregate = await this.#dependencies.store.publish({
      ...parsed,
      actorId: context.userId,
      occurredAt,
      requestId: context.requestId,
      permissionScope: authorization.permission.scope,
      businessUnitIds: authorization.permission.businessUnitIds,
    });
    const localeValues = draft.translations.map(({ locale }) => locale);
    const paths = parsed.routes.map(({ path }) => path);
    await this.#afterCommit(context, authorization.permission, aggregate, {
      kind: "published",
      locales: localeValues,
      paths,
      occurredAt,
      audit: {
        action: "product.published",
        changes: {
          before: {
            publishedVersion: before.published?.version.version ?? null,
            draftVersion: draft.version.version,
          },
          after: {
            publishedVersion: aggregate.published?.version.version ?? null,
            routes: parsed.routes,
          },
        },
      },
    });
    return aggregate;
  }

  #now(): Date {
    return new Date(this.#dependencies.now?.() ?? new Date());
  }

  async #afterCommit(
    context: AccessContext,
    permission: EffectivePermission,
    aggregate: ProductAdminAggregateDto,
    input: {
      kind: ProductMutationKind;
      locales: readonly Locale[];
      paths: readonly string[];
      occurredAt: Date;
      audit: MutationAudit;
    },
  ): Promise<void> {
    const event: ProductPostCommitEvent = {
      entityType: "product",
      kind: input.kind,
      productId: aggregate.product.id,
      sku: aggregate.product.sku,
      locales: input.locales,
      paths: input.paths,
      tags: tags(input.kind, aggregate, input.locales),
      requestId: context.requestId,
      occurredAt: input.occurredAt,
    };
    const auditEvent: AuditEventInput = {
      actor: { type: "user", userId: context.userId },
      action: input.audit.action,
      resourceType: "product",
      resourceId: aggregate.product.id,
      businessUnitIds: permission.businessUnitIds,
      requestId: context.requestId,
      permissionDecision: {
        permission: permission.permission,
        outcome: "allowed",
        reasonCode: "COMMAND_AUTHORIZED",
        scope: permission.scope,
      },
      changes: input.audit.changes,
      ...(input.audit.reason ? { reason: input.audit.reason } : {}),
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
        await this.#dependencies.postCommit(event);
      } catch {
        failures.push("postCommit");
      }
    }
    if (failures.length > 0) {
      throw new ProductPostCommitError(failures);
    }
  }
}

export type { ProductVersionDraftInput };
