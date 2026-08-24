import "server-only";

import type {
  AuditChangeSet,
  AuditEventInput,
} from "@/domains/audit/contracts";
import {
  type ContentAdminAggregateDto,
  type ContentCommandServiceDependencies,
  ContentCommandStoreError,
  type ContentEntryListDto,
  type ContentMutationKind,
  type ContentPostCommitEvent,
  ContentPostCommitError,
  type ContentStoreAccessScope,
} from "@/domains/content/commands/contracts";
import {
  createEntryDraftInputSchema,
  createRevisionDraftInputSchema,
  listContentEntriesInputSchema,
  publishContentInputSchema,
  readContentEntryInputSchema,
  returnToDraftInputSchema,
  submitForReviewInputSchema,
  updateDraftInputSchema,
  type CreateEntryDraftInput,
  type CreateRevisionDraftInput,
  type UpdateDraftInput,
} from "@/domains/content/commands/schemas";
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
import { structuredBlocksSchema } from "@/lib/content/contracts";
import { sanitizeStructuredBlocksForPersistence } from "@/lib/content/sanitize";
import type { Locale } from "@/lib/i18n/config";

type AuthorizedScope = {
  permission: EffectivePermission;
  storeScope: ContentStoreAccessScope;
};

type MutationAudit = {
  action: string;
  reason?: string;
  changes: AuditChangeSet;
  metadata?: unknown;
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

  const storeScope: ContentStoreAccessScope =
    permission.scope === "all"
      ? { kind: "all" }
      : permission.scope === "own"
        ? { kind: "own", ownerUserId: context.userId }
        : { kind: "none" };

  return { permission, storeScope };
}

function assertMutationScope(scope: ContentStoreAccessScope): void {
  if (scope.kind === "none") {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }
}

function sanitizeBlocks(value: unknown) {
  return structuredBlocksSchema.parse(
    sanitizeStructuredBlocksForPersistence(value),
  );
}

function sanitizeCreateEntryDraft(input: unknown): CreateEntryDraftInput {
  const parsed = createEntryDraftInputSchema.parse(input);

  return {
    ...parsed,
    blocks: sanitizeBlocks(parsed.blocks),
    translations: parsed.translations.map((translation) => ({
      ...translation,
      blocks: sanitizeBlocks(translation.blocks),
    })),
  };
}

function sanitizeCreateRevisionDraft(input: unknown): CreateRevisionDraftInput {
  const parsed = createRevisionDraftInputSchema.parse(input);

  return {
    ...parsed,
    blocks: sanitizeBlocks(parsed.blocks),
    translations: parsed.translations.map((translation) => ({
      ...translation,
      blocks: sanitizeBlocks(translation.blocks),
    })),
  };
}

function sanitizeUpdateDraft(input: unknown): UpdateDraftInput {
  const parsed = updateDraftInputSchema.parse(input);

  return {
    ...parsed,
    blocks: sanitizeBlocks(parsed.blocks),
    translations: parsed.translations.map((translation) => ({
      ...translation,
      blocks: sanitizeBlocks(translation.blocks),
    })),
  };
}

function assertExpectedRevision(expected: number, actual: number): void {
  if (expected !== actual) {
    throw new ContentWorkflowError(
      "STALE_REVISION",
      "The content changed before this command was applied.",
    );
  }
}

function requireDraft(aggregate: ContentAdminAggregateDto, revisionId: string) {
  const draft = aggregate.draft;

  if (!draft || draft.revision.id !== revisionId) {
    throw new ContentCommandStoreError(
      "DRAFT_NOT_FOUND",
      "The requested draft revision does not exist.",
    );
  }

  return draft;
}

function assertExpectedTranslations(
  actual: ReadonlyArray<{ locale: Locale; revision: number }>,
  expected: ReadonlyArray<{ locale: Locale; expectedRevision: number }>,
): void {
  const expectedByLocale = new Map(
    expected.map((translation) => [
      translation.locale,
      translation.expectedRevision,
    ]),
  );

  if (actual.length !== expectedByLocale.size) {
    throw new ContentWorkflowError(
      "STALE_REVISION",
      "The translation set changed before this command was applied.",
    );
  }

  for (const translation of actual) {
    if (expectedByLocale.get(translation.locale) !== translation.revision) {
      throw new ContentWorkflowError(
        "STALE_REVISION",
        "A translation changed before this command was applied.",
      );
    }
  }
}

function assertUpdateTranslations(
  aggregate: ContentAdminAggregateDto,
  input: UpdateDraftInput,
): void {
  const draft = requireDraft(aggregate, input.revisionId);
  const updatesByLocale = new Map(
    input.translations.map((translation) => [translation.locale, translation]),
  );

  for (const existing of draft.translations) {
    const update = updatesByLocale.get(existing.locale);
    if (!update || update.expectedRevision !== existing.revision) {
      throw new ContentWorkflowError(
        "STALE_REVISION",
        "A draft update must include the current revision of every translation.",
      );
    }
  }

  for (const update of input.translations) {
    const existing = draft.translations.find(
      (translation) => translation.locale === update.locale,
    );

    if (!existing && update.expectedRevision !== undefined) {
      throw new ContentWorkflowError(
        "STALE_REVISION",
        "A newly added translation cannot have an existing revision.",
      );
    }
  }
}

function requireAggregate(
  aggregate: ContentAdminAggregateDto | null,
): ContentAdminAggregateDto {
  if (!aggregate) {
    throw new ContentCommandStoreError(
      "NOT_FOUND",
      "The requested content entry was not found.",
    );
  }

  return aggregate;
}

function requiresLocalizedRoute(aggregate: ContentAdminAggregateDto): boolean {
  return (
    aggregate.entry.type !== "section" && aggregate.entry.type !== "global"
  );
}

function assertPublishRoutes(
  aggregate: ContentAdminAggregateDto,
  localesToPublish: readonly Locale[],
  routes: ReadonlyArray<{ locale: Locale; path: string }>,
): void {
  if (!requiresLocalizedRoute(aggregate)) {
    if (routes.length > 0) {
      throw new ContentWorkflowError(
        "ROUTE_UNAVAILABLE",
        "Reusable content cannot reserve a public route.",
      );
    }

    return;
  }

  const routeByLocale = new Map(routes.map((route) => [route.locale, route]));

  if (
    routes.length !== localesToPublish.length ||
    localesToPublish.some((locale) => !routeByLocale.has(locale))
  ) {
    throw new ContentWorkflowError(
      "ROUTE_UNAVAILABLE",
      "Every published translation must reserve one localized route.",
    );
  }

  for (const locale of localesToPublish) {
    const path = routeByLocale.get(locale)?.path;
    if (!path || (path !== `/${locale}` && !path.startsWith(`/${locale}/`))) {
      throw new ContentWorkflowError(
        "ROUTE_UNAVAILABLE",
        "A localized route must remain inside its locale URL namespace.",
      );
    }
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function mutationTags(
  kind: ContentMutationKind,
  aggregate: ContentAdminAggregateDto,
  locales: readonly Locale[],
): string[] {
  const adminTags = [
    "content:admin",
    `content:entry:${aggregate.entry.id}`,
    `content:code:${aggregate.entry.code}`,
  ];

  if (kind !== "published") {
    return adminTags;
  }

  return unique([
    ...adminTags,
    "content:public",
    ...locales.map((locale) => `content:locale:${locale}`),
  ]);
}

export class ContentCommandService {
  readonly #dependencies: ContentCommandServiceDependencies;

  constructor(dependencies: ContentCommandServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async listEntries(
    context: AccessContext,
    input: unknown = undefined,
  ): Promise<ContentEntryListDto> {
    const { storeScope } = resolveAuthorizedScope(context, "content.read");
    return this.#dependencies.store.listEntries(
      storeScope,
      listContentEntriesInputSchema.parse(input),
    );
  }

  async readEntry(
    context: AccessContext,
    input: unknown,
  ): Promise<ContentAdminAggregateDto | null> {
    const { storeScope } = resolveAuthorizedScope(context, "content.read");
    const parsed = readContentEntryInputSchema.parse(input);
    return this.#dependencies.store.readEntry(storeScope, parsed.entryId);
  }

  async createEntryDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<ContentAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.create");
    assertMutationScope(authorization.storeScope);
    const parsed = sanitizeCreateEntryDraft(input);
    const occurredAt = this.#now();
    const aggregate = await this.#dependencies.store.createEntryDraft({
      ...parsed,
      actorId: context.userId,
      occurredAt,
    });

    await this.#afterCommit(context, authorization.permission, aggregate, {
      kind: "entryDraftCreated",
      locales: parsed.translations.map(({ locale }) => locale),
      paths: [],
      occurredAt,
      audit: {
        action: "content.entry-draft.created",
        changes: {
          after: {
            code: aggregate.entry.code,
            type: aggregate.entry.type,
            placement: aggregate.entry.placement,
            status: aggregate.entry.status,
            draftVersion: aggregate.draft?.revision.version ?? null,
            locales: parsed.translations.map(({ locale }) => locale),
          },
        },
      },
    });

    return aggregate;
  }

  async createRevisionDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<ContentAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.update");
    assertMutationScope(authorization.storeScope);
    const parsed = sanitizeCreateRevisionDraft(input);
    const before = requireAggregate(
      await this.#dependencies.store.readEntry(
        authorization.storeScope,
        parsed.entryId,
      ),
    );

    assertExpectedRevision(parsed.expectedEntryRevision, before.entry.revision);
    if (before.draft) {
      throw new ContentCommandStoreError(
        "DRAFT_EXISTS",
        "This content entry already has an editable draft.",
      );
    }

    if (!before.published) {
      throw new ContentCommandStoreError(
        "NOT_FOUND",
        "A follow-up draft requires a published source revision.",
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
        action: "content.revision-draft.created",
        changes: {
          before: { draftVersion: null },
          after: {
            draftVersion: aggregate.draft?.revision.version ?? null,
            sourcePublishedVersion: before.published.revision.version,
            locales: parsed.translations.map(({ locale }) => locale),
          },
        },
      },
    });

    return aggregate;
  }

  async updateDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<ContentAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.update");
    assertMutationScope(authorization.storeScope);
    const parsed = sanitizeUpdateDraft(input);
    const before = requireAggregate(
      await this.#dependencies.store.readEntry(
        authorization.storeScope,
        parsed.entryId,
      ),
    );
    const draft = requireDraft(before, parsed.revisionId);

    assertExpectedRevision(parsed.expectedEntryRevision, before.entry.revision);
    assertExpectedRevision(parsed.expectedRevision, draft.revision.revision);

    if (draft.revision.status !== "draft") {
      throw new ContentCommandStoreError(
        "PUBLISHED_REVISION_IMMUTABLE",
        "Only draft revisions can be edited; create a new draft after publication.",
      );
    }

    assertUpdateTranslations(before, parsed);
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
        action: "content.draft.updated",
        changes: {
          before: {
            draftVersion: draft.revision.version,
            optimisticRevision: draft.revision.revision,
            placement: before.entry.placement,
          },
          after: {
            draftVersion: aggregate.draft?.revision.version ?? null,
            optimisticRevision: aggregate.draft?.revision.revision ?? null,
            placement: aggregate.entry.placement,
            locales: parsed.translations.map(({ locale }) => locale),
          },
        },
      },
    });

    return aggregate;
  }

  async submitForReview(
    context: AccessContext,
    input: unknown,
  ): Promise<ContentAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.update");
    assertMutationScope(authorization.storeScope);
    const parsed = submitForReviewInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readEntry(
        authorization.storeScope,
        parsed.entryId,
      ),
    );
    const draft = requireDraft(before, parsed.revisionId);
    const occurredAt = this.#now();

    assertExpectedRevision(parsed.expectedEntryRevision, before.entry.revision);
    transitionContentRevision({
      currentStatus: draft.revision.status,
      targetStatus: "inReview",
      actualRevision: draft.revision.revision,
      expectedRevision: parsed.expectedRevision,
      actorId: context.userId,
      occurredAt,
    });
    assertExpectedTranslations(draft.translations, parsed.expectedTranslations);
    draft.translations.forEach((translation) => {
      transitionTranslation({
        currentStatus: translation.translationStatus,
        targetStatus: "inReview",
        actualRevision: translation.revision,
        expectedRevision: translation.revision,
        actorId: context.userId,
        occurredAt,
      });
    });

    const aggregate = await this.#dependencies.store.submitForReview(
      authorization.storeScope,
      { ...parsed, actorId: context.userId, occurredAt },
    );
    const locales = draft.translations.map(({ locale }) => locale);

    await this.#afterCommit(context, authorization.permission, aggregate, {
      kind: "reviewSubmitted",
      locales,
      paths: [],
      occurredAt,
      audit: {
        action: "content.review.submitted",
        changes: {
          before: { revisionStatus: draft.revision.status },
          after: { revisionStatus: "inReview", locales },
        },
      },
    });

    return aggregate;
  }

  async returnToDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<ContentAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.review");
    const parsed = returnToDraftInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readEntry({ kind: "all" }, parsed.entryId),
    );
    const draft = requireDraft(before, parsed.revisionId);
    const occurredAt = this.#now();

    assertExpectedRevision(parsed.expectedEntryRevision, before.entry.revision);
    transitionContentRevision({
      currentStatus: draft.revision.status,
      targetStatus: "draft",
      actualRevision: draft.revision.revision,
      expectedRevision: parsed.expectedRevision,
      actorId: context.userId,
      occurredAt,
      reason: parsed.reason,
    });
    assertExpectedTranslations(draft.translations, parsed.expectedTranslations);
    draft.translations.forEach((translation) => {
      transitionTranslation({
        currentStatus: translation.translationStatus,
        targetStatus: "draft",
        actualRevision: translation.revision,
        expectedRevision: translation.revision,
        actorId: context.userId,
        occurredAt,
        reason: parsed.reason,
      });
    });

    const aggregate = await this.#dependencies.store.returnToDraft({
      ...parsed,
      actorId: context.userId,
      occurredAt,
    });
    const locales = draft.translations.map(({ locale }) => locale);

    await this.#afterCommit(context, authorization.permission, aggregate, {
      kind: "reviewReturned",
      locales,
      paths: [],
      occurredAt,
      audit: {
        action: "content.review.returned",
        reason: parsed.reason,
        changes: {
          before: { revisionStatus: draft.revision.status },
          after: { revisionStatus: "draft", locales },
        },
      },
    });

    return aggregate;
  }

  async publish(
    context: AccessContext,
    input: unknown,
  ): Promise<ContentAdminAggregateDto> {
    const authorization = resolveAuthorizedScope(context, "content.publish");
    const parsed = publishContentInputSchema.parse(input);
    const before = requireAggregate(
      await this.#dependencies.store.readEntry({ kind: "all" }, parsed.entryId),
    );
    const draft = requireDraft(before, parsed.revisionId);
    const occurredAt = this.#now();

    assertExpectedRevision(parsed.expectedEntryRevision, before.entry.revision);
    transitionContentRevision({
      currentStatus: draft.revision.status,
      targetStatus: "published",
      actualRevision: draft.revision.revision,
      expectedRevision: parsed.expectedRevision,
      actorId: context.userId,
      occurredAt,
    });
    assertExpectedTranslations(draft.translations, parsed.expectedTranslations);

    const locales = draft.translations.map(({ locale }) => locale);
    assertPublishRoutes(before, locales, parsed.routes);
    const routeByLocale = new Map(
      parsed.routes.map((route) => [route.locale, route.path]),
    );
    const routeRequired = requiresLocalizedRoute(before);

    draft.translations.forEach((translation) => {
      transitionTranslation({
        currentStatus: translation.translationStatus,
        targetStatus: "published",
        actualRevision: translation.revision,
        expectedRevision: translation.revision,
        actorId: context.userId,
        occurredAt,
        hasContent:
          translation.title.trim().length > 0 || translation.blocks.length > 0,
        ...(routeRequired
          ? { routeAvailable: routeByLocale.has(translation.locale) }
          : {}),
        requiresRoute: routeRequired,
      });
    });

    const paths = parsed.routes.map(({ path }) => path);
    const audit: MutationAudit = {
      action: "content.published",
      changes: {
        before: {
          publishedVersion: before.published?.revision.version ?? null,
          draftVersion: draft.revision.version,
        },
        after: {
          publishedVersion: draft.revision.version,
          routes: parsed.routes,
          locales,
        },
      },
    };
    const aggregate = await this.#dependencies.store.publish({
      ...parsed,
      actorId: context.userId,
      occurredAt,
      auditEvent: this.#createAuditEvent(
        context,
        authorization.permission,
        before,
        audit,
        occurredAt,
      ),
    });

    await this.#afterCommit(context, authorization.permission, aggregate, {
      kind: "published",
      locales,
      paths,
      occurredAt,
      audit,
      auditCommitted: true,
    });

    return aggregate;
  }

  #now(): Date {
    return new Date(this.#dependencies.now?.() ?? new Date());
  }

  async #afterCommit(
    context: AccessContext,
    permission: EffectivePermission,
    aggregate: ContentAdminAggregateDto,
    input: {
      kind: ContentMutationKind;
      locales: readonly Locale[];
      paths: readonly string[];
      occurredAt: Date;
      audit: MutationAudit;
      auditCommitted?: boolean;
    },
  ): Promise<void> {
    const event: ContentPostCommitEvent = {
      kind: input.kind,
      entryId: aggregate.entry.id,
      code: aggregate.entry.code,
      locales: input.locales,
      paths: input.paths,
      tags: mutationTags(input.kind, aggregate, input.locales),
      requestId: context.requestId,
      occurredAt: input.occurredAt,
    };
    const auditEvent = this.#createAuditEvent(
      context,
      permission,
      aggregate,
      input.audit,
      input.occurredAt,
    );
    const failures: Array<"audit" | "postCommit"> = [];

    if (!input.auditCommitted) {
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
      throw new ContentPostCommitError(failures);
    }
  }

  #createAuditEvent(
    context: AccessContext,
    permission: EffectivePermission,
    aggregate: ContentAdminAggregateDto,
    audit: MutationAudit,
    occurredAt: Date,
  ): AuditEventInput {
    return {
      actor: { type: "user", userId: context.userId },
      action: audit.action,
      resourceType: "contentEntry",
      resourceId: aggregate.entry.id,
      businessUnitIds: permission.businessUnitIds,
      requestId: context.requestId,
      permissionDecision: {
        permission: permission.permission,
        outcome: "allowed",
        reasonCode: "COMMAND_AUTHORIZED",
        scope: permission.scope,
      },
      changes: audit.changes,
      ...(audit.reason ? { reason: audit.reason } : {}),
      ...(audit.metadata === undefined ? {} : { metadata: audit.metadata }),
      occurredAt,
    };
  }
}
