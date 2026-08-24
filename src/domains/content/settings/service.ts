import "server-only";

import type {
  AuditChangeSet,
  AuditEventInput,
} from "@/domains/audit/contracts";
import {
  type SiteSettingsAdminAggregateDto,
  type SiteSettingsCommandServiceDependencies,
  SiteSettingsCommandStoreError,
  type SiteSettingsMutationKind,
  type SiteSettingsPostCommitEvent,
  SiteSettingsPostCommitError,
  type SiteSettingsVersionDto,
} from "@/domains/content/settings/contracts";
import {
  createSiteSettingsDraftInputSchema,
  publishSiteSettingsInputSchema,
  returnSiteSettingsToDraftInputSchema,
  submitSiteSettingsForReviewInputSchema,
  updateSiteSettingsDraftInputSchema,
  type PublishedSettingsExpectation,
} from "@/domains/content/settings/schemas";
import {
  transitionContentRevision,
  transitionTranslation,
} from "@/domains/content/workflow";
import type { ContentPermission } from "@/domains/identity/contracts";
import {
  ContentAccessDeniedError,
  type AccessContext,
  type EffectivePermission,
} from "@/lib/auth/authorization";
import { locales, type Locale } from "@/lib/i18n/config";

type MutationAudit = {
  action: string;
  reason?: string;
  changes: AuditChangeSet;
};

function requireGlobalPermission(
  context: AccessContext,
  requiredPermission: ContentPermission,
): EffectivePermission {
  const permission = context.permissions.find(
    (candidate) => candidate.permission === requiredPermission,
  );

  // Site settings are a global singleton and have no owner or business-unit
  // boundary. A narrower grant must never silently expand to the whole site.
  if (
    context.userStatus !== "active" ||
    !permission ||
    permission.scope !== "all"
  ) {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }

  return permission;
}

function assertExpectedRevision(expected: number, actual: number): void {
  if (expected !== actual) {
    throw new SiteSettingsCommandStoreError(
      "STALE_REVISION",
      "Site settings changed before this command was applied.",
    );
  }
}

function assertPublishedExpectation(
  expectation: PublishedSettingsExpectation,
  published: SiteSettingsVersionDto | null,
): void {
  if (!expectation.exists) {
    if (published) {
      throw new SiteSettingsCommandStoreError(
        "STALE_REVISION",
        "Published site settings appeared before this draft was created.",
      );
    }
    return;
  }

  if (
    !published ||
    published.id !== expectation.settingsId ||
    published.revision !== expectation.expectedRevision
  ) {
    throw new SiteSettingsCommandStoreError(
      "STALE_REVISION",
      "Published site settings changed before this draft was created.",
    );
  }
}

function requireDraft(
  aggregate: SiteSettingsAdminAggregateDto,
  settingsId: string,
): SiteSettingsVersionDto {
  if (aggregate.published?.id === settingsId) {
    throw new SiteSettingsCommandStoreError(
      "PUBLISHED_VERSION_IMMUTABLE",
      "Published settings cannot be edited; create a new draft version.",
    );
  }

  if (!aggregate.draft || aggregate.draft.id !== settingsId) {
    throw new SiteSettingsCommandStoreError(
      "DRAFT_NOT_FOUND",
      "The requested site-settings draft does not exist.",
    );
  }

  return aggregate.draft;
}

function assertAllTranslationsReady(settings: SiteSettingsVersionDto): void {
  const presentLocales = new Set(
    settings.translations.map((translation) => translation.locale),
  );
  const complete =
    presentLocales.size === locales.length &&
    locales.every((locale) => presentLocales.has(locale)) &&
    settings.translationQuality.every(
      (translation) => translation.quality === "ready",
    );

  if (!complete) {
    throw new SiteSettingsCommandStoreError(
      "INCOMPLETE_TRANSLATIONS",
      "All six locale translations must be complete before review or publication.",
    );
  }
}

function validateTranslationTransition(
  settings: SiteSettingsVersionDto,
  targetStatus: "draft" | "inReview" | "published",
  input: {
    actorId: string;
    occurredAt: Date;
    reason?: string;
  },
): void {
  settings.translations.forEach((translation) => {
    transitionTranslation({
      currentStatus: translation.status,
      targetStatus,
      actualRevision: settings.revision,
      expectedRevision: settings.revision,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(targetStatus === "published"
        ? {
            hasContent: translation.companyName.trim().length > 0,
            requiresRoute: false,
          }
        : {}),
    });
  });
}

function mutationTags(
  kind: SiteSettingsMutationKind,
  settingsId: string,
  version: number,
  publishedLocales: readonly Locale[],
): string[] {
  const tags = [
    "site-settings:admin",
    `site-settings:id:${settingsId}`,
    `site-settings:version:${version}`,
  ];

  if (kind === "published") {
    tags.push(
      "site-settings:public",
      ...publishedLocales.map((locale) => `site-settings:locale:${locale}`),
    );
  }

  return tags;
}

export class SiteSettingsCommandService {
  readonly #dependencies: SiteSettingsCommandServiceDependencies;

  constructor(dependencies: SiteSettingsCommandServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async readCurrent(
    context: AccessContext,
  ): Promise<SiteSettingsAdminAggregateDto> {
    requireGlobalPermission(context, "content.read");
    return this.#dependencies.store.readCurrent({ kind: "all" });
  }

  async createDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<SiteSettingsAdminAggregateDto> {
    const permission = requireGlobalPermission(context, "content.create");
    const parsed = createSiteSettingsDraftInputSchema.parse(input);
    const before = await this.#dependencies.store.readCurrent({ kind: "all" });

    if (before.draft) {
      throw new SiteSettingsCommandStoreError(
        "DRAFT_EXISTS",
        "Finish the current site-settings draft before creating another.",
      );
    }
    assertPublishedExpectation(parsed.basePublished, before.published);

    const occurredAt = this.#now();
    const aggregate = await this.#dependencies.store.createDraft({
      ...parsed,
      actorId: context.userId,
      occurredAt,
    });
    const draft = aggregate.draft;
    if (!draft) {
      throw new SiteSettingsCommandStoreError(
        "PERSISTENCE_FAILURE",
        "The created site-settings draft could not be reloaded.",
      );
    }

    await this.#afterCommit(context, permission, draft, {
      kind: "draftCreated",
      locales: draft.translations.map(({ locale }) => locale),
      occurredAt,
      audit: {
        action: "site-settings.draft.created",
        changes: {
          before: { publishedVersion: before.published?.version ?? null },
          after: {
            draftVersion: draft.version,
            locales: draft.translations.map(({ locale }) => locale),
            socialPlatforms: draft.socialLinks.map(({ platform }) => platform),
          },
        },
      },
    });

    return aggregate;
  }

  async updateDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<SiteSettingsAdminAggregateDto> {
    const permission = requireGlobalPermission(context, "content.update");
    const parsed = updateSiteSettingsDraftInputSchema.parse(input);
    const before = await this.#dependencies.store.readCurrent({ kind: "all" });
    const draft = requireDraft(before, parsed.settingsId);

    assertExpectedRevision(parsed.expectedRevision, draft.revision);
    if (draft.status !== "draft") {
      throw new SiteSettingsCommandStoreError(
        "DRAFT_NOT_FOUND",
        "Only a draft can be updated; return the review first.",
      );
    }

    const occurredAt = this.#now();
    const aggregate = await this.#dependencies.store.updateDraft(
      { kind: "all" },
      { ...parsed, actorId: context.userId, occurredAt },
    );
    const updated = requireDraft(aggregate, parsed.settingsId);

    await this.#afterCommit(context, permission, updated, {
      kind: "draftUpdated",
      locales: updated.translations.map(({ locale }) => locale),
      occurredAt,
      audit: {
        action: "site-settings.draft.updated",
        changes: {
          before: {
            optimisticRevision: draft.revision,
            locales: draft.translations.map(({ locale }) => locale),
            socialPlatforms: draft.socialLinks.map(({ platform }) => platform),
          },
          after: {
            optimisticRevision: updated.revision,
            locales: updated.translations.map(({ locale }) => locale),
            socialPlatforms: updated.socialLinks.map(
              ({ platform }) => platform,
            ),
          },
        },
      },
    });

    return aggregate;
  }

  async submitForReview(
    context: AccessContext,
    input: unknown,
  ): Promise<SiteSettingsAdminAggregateDto> {
    const permission = requireGlobalPermission(context, "content.update");
    const parsed = submitSiteSettingsForReviewInputSchema.parse(input);
    const before = await this.#dependencies.store.readCurrent({ kind: "all" });
    const draft = requireDraft(before, parsed.settingsId);
    const occurredAt = this.#now();

    assertAllTranslationsReady(draft);
    transitionContentRevision({
      currentStatus: draft.status,
      targetStatus: "inReview",
      actualRevision: draft.revision,
      expectedRevision: parsed.expectedRevision,
      actorId: context.userId,
      occurredAt,
    });
    validateTranslationTransition(draft, "inReview", {
      actorId: context.userId,
      occurredAt,
    });

    const aggregate = await this.#dependencies.store.submitForReview(
      { kind: "all" },
      { ...parsed, actorId: context.userId, occurredAt },
    );
    const inReview = requireDraft(aggregate, parsed.settingsId);

    await this.#afterCommit(context, permission, inReview, {
      kind: "reviewSubmitted",
      locales: inReview.translations.map(({ locale }) => locale),
      occurredAt,
      audit: {
        action: "site-settings.review.submitted",
        changes: {
          before: { status: draft.status },
          after: { status: inReview.status },
        },
      },
    });

    return aggregate;
  }

  async returnToDraft(
    context: AccessContext,
    input: unknown,
  ): Promise<SiteSettingsAdminAggregateDto> {
    const permission = requireGlobalPermission(context, "content.review");
    const parsed = returnSiteSettingsToDraftInputSchema.parse(input);
    const before = await this.#dependencies.store.readCurrent({ kind: "all" });
    const inReview = requireDraft(before, parsed.settingsId);
    const occurredAt = this.#now();

    transitionContentRevision({
      currentStatus: inReview.status,
      targetStatus: "draft",
      actualRevision: inReview.revision,
      expectedRevision: parsed.expectedRevision,
      actorId: context.userId,
      occurredAt,
      reason: parsed.reason,
    });
    validateTranslationTransition(inReview, "draft", {
      actorId: context.userId,
      occurredAt,
      reason: parsed.reason,
    });

    const aggregate = await this.#dependencies.store.returnToDraft({
      ...parsed,
      actorId: context.userId,
      occurredAt,
    });
    const draft = requireDraft(aggregate, parsed.settingsId);

    await this.#afterCommit(context, permission, draft, {
      kind: "reviewReturned",
      locales: draft.translations.map(({ locale }) => locale),
      occurredAt,
      audit: {
        action: "site-settings.review.returned",
        reason: parsed.reason,
        changes: {
          before: { status: inReview.status },
          after: { status: draft.status },
        },
      },
    });

    return aggregate;
  }

  async publish(
    context: AccessContext,
    input: unknown,
  ): Promise<SiteSettingsAdminAggregateDto> {
    const permission = requireGlobalPermission(context, "content.publish");
    const parsed = publishSiteSettingsInputSchema.parse(input);
    const before = await this.#dependencies.store.readCurrent({ kind: "all" });
    const inReview = requireDraft(before, parsed.settingsId);
    const occurredAt = this.#now();

    assertAllTranslationsReady(inReview);
    transitionContentRevision({
      currentStatus: inReview.status,
      targetStatus: "published",
      actualRevision: inReview.revision,
      expectedRevision: parsed.expectedRevision,
      actorId: context.userId,
      occurredAt,
    });
    validateTranslationTransition(inReview, "published", {
      actorId: context.userId,
      occurredAt,
    });

    const publishAudit: MutationAudit = {
      action: "site-settings.published",
      changes: {
        before: {
          publishedVersion: before.published?.version ?? null,
          reviewVersion: inReview.version,
        },
        after: {
          publishedVersion: inReview.version,
          locales: inReview.translations.map(({ locale }) => locale),
        },
      },
    };
    const atomicAuditEvent = this.#createAuditEvent(
      context,
      permission,
      inReview,
      occurredAt,
      publishAudit,
    );

    const aggregate = await this.#dependencies.store.publish({
      ...parsed,
      actorId: context.userId,
      occurredAt,
      auditEvent: atomicAuditEvent,
    });
    const published = aggregate.published;
    if (!published || published.id !== parsed.settingsId) {
      throw new SiteSettingsCommandStoreError(
        "PERSISTENCE_FAILURE",
        "The published site-settings version could not be reloaded.",
      );
    }
    const publishedLocales = published.translations.map(({ locale }) => locale);

    await this.#afterCommit(context, permission, published, {
      kind: "published",
      locales: publishedLocales,
      occurredAt,
      audit: publishAudit,
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
    settings: SiteSettingsVersionDto,
    input: {
      kind: SiteSettingsMutationKind;
      locales: readonly Locale[];
      occurredAt: Date;
      audit: MutationAudit;
      auditCommitted?: boolean;
    },
  ): Promise<void> {
    const postCommitEvent: SiteSettingsPostCommitEvent = {
      kind: input.kind,
      settingsId: settings.id,
      version: settings.version,
      locales: input.locales,
      tags: mutationTags(
        input.kind,
        settings.id,
        settings.version,
        input.locales,
      ),
      requestId: context.requestId,
      occurredAt: input.occurredAt,
    };
    const auditEvent = this.#createAuditEvent(
      context,
      permission,
      settings,
      input.occurredAt,
      input.audit,
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
        await this.#dependencies.postCommit(postCommitEvent);
      } catch {
        failures.push("postCommit");
      }
    }

    if (failures.length > 0) {
      throw new SiteSettingsPostCommitError(failures);
    }
  }

  #createAuditEvent(
    context: AccessContext,
    permission: EffectivePermission,
    settings: SiteSettingsVersionDto,
    occurredAt: Date,
    audit: MutationAudit,
  ): AuditEventInput {
    return {
      actor: { type: "user", userId: context.userId },
      action: audit.action,
      resourceType: "siteSettings",
      resourceId: settings.id,
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
      occurredAt,
    };
  }
}
