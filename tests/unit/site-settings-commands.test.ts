import { describe, expect, it, vi } from "vitest";

import type {
  AuditEventInput,
  AuditRepository,
} from "@/domains/audit/contracts";
import {
  type CreateSiteSettingsDraftStoreInput,
  type PublishSiteSettingsStoreInput,
  type ReturnSiteSettingsToDraftStoreInput,
  type SiteSettingsAdminAggregateDto,
  type SiteSettingsCommandStore,
  SiteSettingsCommandStoreError,
  type SiteSettingsPostCommitEvent,
  type SiteSettingsStoreAccessScope,
  type SiteSettingsVersionDto,
  type SubmitSiteSettingsForReviewStoreInput,
  type UpdateSiteSettingsDraftStoreInput,
} from "@/domains/content/settings/contracts";
import {
  createSiteSettingsDraftInputSchema,
  siteSettingsPayloadSchema,
  siteSettingsSocialLinkSchema,
  type SiteSettingsPayload,
} from "@/domains/content/settings/schemas";
import { SiteSettingsCommandService } from "@/domains/content/settings/service";
import type {
  AccessContext,
  EffectivePermission,
} from "@/lib/auth/authorization";
import { locales, type Locale } from "@/lib/i18n/config";

const actorId = "66c84b2d12ad6a75f9400101";
const occurredAt = new Date("2026-08-24T09:00:00.000Z");

function statusForVersion(
  status: SiteSettingsVersionDto["status"],
): "draft" | "inReview" | "published" {
  return status === "draft" || status === "inReview" ? status : "published";
}

function withPayload(
  base: Pick<
    SiteSettingsVersionDto,
    | "id"
    | "revision"
    | "version"
    | "status"
    | "createdAt"
    | "updatedAt"
    | "createdBy"
    | "updatedBy"
    | "publishedAt"
  >,
  payload: SiteSettingsPayload,
): SiteSettingsVersionDto {
  const translationStatus = statusForVersion(base.status);
  const translations = payload.translations.map((translation) => ({
    locale: translation.locale,
    companyName: translation.companyName,
    tagline: translation.tagline ?? null,
    description: translation.description ?? null,
    addressLabel: translation.addressLabel ?? null,
    status: translationStatus,
  }));
  const translatedLocales = new Set(
    translations.map((translation) => translation.locale),
  );

  return {
    ...base,
    translations,
    translationQuality: locales.map((locale) =>
      translatedLocales.has(locale)
        ? { locale, status: translationStatus, quality: "ready" as const }
        : { locale, status: "missing" as const, quality: "missing" as const },
    ),
    publicEmail: payload.publicEmail ?? null,
    publicPhone: payload.publicPhone ?? null,
    socialLinks: payload.socialLinks.map((link) => ({ ...link })),
  };
}

function changeStatus(
  settings: SiteSettingsVersionDto,
  status: SiteSettingsVersionDto["status"],
  input: { actorId: string; occurredAt: Date },
): SiteSettingsVersionDto {
  return withPayload(
    {
      ...settings,
      status,
      revision: settings.revision + 1,
      updatedAt: input.occurredAt.toISOString(),
      updatedBy: input.actorId,
      publishedAt:
        status === "published"
          ? input.occurredAt.toISOString()
          : settings.publishedAt,
    },
    {
      translations: settings.translations.map((translation) => ({
        locale: translation.locale,
        companyName: translation.companyName,
        ...(translation.tagline ? { tagline: translation.tagline } : {}),
        ...(translation.description
          ? { description: translation.description }
          : {}),
        ...(translation.addressLabel
          ? { addressLabel: translation.addressLabel }
          : {}),
      })),
      ...(settings.publicEmail ? { publicEmail: settings.publicEmail } : {}),
      ...(settings.publicPhone ? { publicPhone: settings.publicPhone } : {}),
      socialLinks: settings.socialLinks.map((link) => ({ ...link })),
    },
  );
}

function copyAggregate(
  value: SiteSettingsAdminAggregateDto,
): SiteSettingsAdminAggregateDto {
  return structuredClone(value);
}

class InMemorySiteSettingsCommandStore implements SiteSettingsCommandStore {
  draft: SiteSettingsVersionDto | null = null;
  published: SiteSettingsVersionDto | null = null;
  readonly archived: SiteSettingsVersionDto[] = [];
  readonly atomicPublishAudits: AuditEventInput[] = [];
  #nextVersion = 1;

  async readCurrent(
    scope: SiteSettingsStoreAccessScope,
  ): Promise<SiteSettingsAdminAggregateDto> {
    if (scope.kind === "none") {
      return { draft: null, published: null };
    }
    return copyAggregate({ draft: this.draft, published: this.published });
  }

  async createDraft(
    input: CreateSiteSettingsDraftStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto> {
    if (this.draft) {
      throw new SiteSettingsCommandStoreError(
        "DRAFT_EXISTS",
        "A draft already exists.",
      );
    }
    if (
      input.basePublished.exists !== Boolean(this.published) ||
      (input.basePublished.exists &&
        (!this.published ||
          input.basePublished.settingsId !== this.published.id ||
          input.basePublished.expectedRevision !== this.published.revision))
    ) {
      throw new SiteSettingsCommandStoreError(
        "STALE_REVISION",
        "The published base changed.",
      );
    }

    const version = this.#nextVersion++;
    this.draft = withPayload(
      {
        id: version.toString(16).padStart(24, "0"),
        revision: 0,
        version,
        status: "draft",
        createdAt: input.occurredAt.toISOString(),
        updatedAt: input.occurredAt.toISOString(),
        createdBy: input.actorId,
        updatedBy: input.actorId,
        publishedAt: null,
      },
      input,
    );

    return this.readCurrent({ kind: "all" });
  }

  async updateDraft(
    scope: SiteSettingsStoreAccessScope,
    input: UpdateSiteSettingsDraftStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto> {
    if (scope.kind === "none" || !this.draft) {
      throw new SiteSettingsCommandStoreError("NOT_FOUND", "Missing draft.");
    }
    this.#assertDraft(input.settingsId, input.expectedRevision, "draft");
    this.draft = withPayload(
      {
        ...this.draft,
        revision: this.draft.revision + 1,
        updatedAt: input.occurredAt.toISOString(),
        updatedBy: input.actorId,
      },
      input,
    );
    return this.readCurrent({ kind: "all" });
  }

  async submitForReview(
    scope: SiteSettingsStoreAccessScope,
    input: SubmitSiteSettingsForReviewStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto> {
    if (scope.kind === "none") {
      throw new SiteSettingsCommandStoreError("NOT_FOUND", "Missing draft.");
    }
    this.#assertDraft(input.settingsId, input.expectedRevision, "draft");
    this.draft = changeStatus(this.draft!, "inReview", input);
    return this.readCurrent({ kind: "all" });
  }

  async returnToDraft(
    input: ReturnSiteSettingsToDraftStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto> {
    this.#assertDraft(input.settingsId, input.expectedRevision, "inReview");
    this.draft = changeStatus(this.draft!, "draft", input);
    return this.readCurrent({ kind: "all" });
  }

  async publish(
    input: PublishSiteSettingsStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto> {
    this.#assertDraft(input.settingsId, input.expectedRevision, "inReview");
    if (
      input.auditEvent.action !== "site-settings.published" ||
      input.auditEvent.resourceId !== input.settingsId
    ) {
      throw new SiteSettingsCommandStoreError(
        "PERSISTENCE_FAILURE",
        "Invalid atomic audit event.",
      );
    }
    if (this.published) {
      this.archived.push(changeStatus(this.published, "archived", input));
    }
    this.published = changeStatus(this.draft!, "published", input);
    this.atomicPublishAudits.push(structuredClone(input.auditEvent));
    this.draft = null;
    return this.readCurrent({ kind: "all" });
  }

  #assertDraft(
    settingsId: string,
    expectedRevision: number,
    expectedStatus: "draft" | "inReview",
  ): void {
    if (this.published?.id === settingsId) {
      throw new SiteSettingsCommandStoreError(
        "PUBLISHED_VERSION_IMMUTABLE",
        "Published versions are immutable.",
      );
    }
    if (!this.draft || this.draft.id !== settingsId) {
      throw new SiteSettingsCommandStoreError(
        "DRAFT_NOT_FOUND",
        "Missing draft.",
      );
    }
    if (this.draft.status !== expectedStatus) {
      throw new SiteSettingsCommandStoreError(
        "DRAFT_NOT_FOUND",
        "Unexpected workflow status.",
      );
    }
    if (this.draft.revision !== expectedRevision) {
      throw new SiteSettingsCommandStoreError("STALE_REVISION", "Stale draft.");
    }
  }
}

function context(
  permission: EffectivePermission["permission"],
  scope: EffectivePermission["scope"] = "all",
): AccessContext {
  return {
    actorType: "user",
    userId: actorId,
    userStatus: "active",
    permissions: [
      {
        permission,
        scope,
        businessUnitIds: [],
        roleKeys: ["SITE_ADMIN"],
      },
    ],
    authzVersion: 4,
    requestId: `request-${permission.replace(".", "-")}`,
  };
}

function translations(selected: readonly Locale[] = locales) {
  return selected.map((locale) => ({
    locale,
    companyName: `Company ${locale}`,
    tagline: `Tagline ${locale}`,
  }));
}

function payload(selected: readonly Locale[] = locales): SiteSettingsPayload {
  return {
    translations: translations(selected),
    publicEmail: "hello@example.com",
    publicPhone: "+84 28 1234 5678",
    socialLinks: [
      {
        platform: "instagram",
        label: "Instagram",
        url: "https://www.instagram.com/example",
      },
      {
        platform: "linkedin",
        label: "LinkedIn",
        url: "https://www.linkedin.com/company/example",
      },
    ],
  };
}

function harness(input?: { auditFails?: boolean }) {
  const store = new InMemorySiteSettingsCommandStore();
  const auditEvents: AuditEventInput[] = [];
  const postCommitEvents: SiteSettingsPostCommitEvent[] = [];
  const auditRepository: AuditRepository = {
    append: vi.fn(async (event) => {
      if (input?.auditFails) {
        throw new Error("audit unavailable");
      }
      auditEvents.push(event);
      return { id: "audit-event-1", occurredAt };
    }),
  };
  const service = new SiteSettingsCommandService({
    store,
    auditRepository,
    now: () => occurredAt,
    postCommit: vi.fn(async (event) => {
      postCommitEvents.push(event);
    }),
  });

  return { store, service, auditEvents, postCommitEvents };
}

describe("site-settings allowlist validation", () => {
  it("rejects unknown fields, insecure links, and duplicate platforms/locales", () => {
    expect(() =>
      createSiteSettingsDraftInputSchema.parse({
        basePublished: { exists: false },
        ...payload(),
        secret: "must-not-pass",
      }),
    ).toThrow();
    expect(() =>
      siteSettingsSocialLinkSchema.parse({
        platform: "instagram",
        label: "Instagram",
        url: "http://instagram.com/example",
      }),
    ).toThrow();
    expect(() =>
      siteSettingsPayloadSchema.parse({
        ...payload(),
        socialLinks: [payload().socialLinks[0], payload().socialLinks[0]],
      }),
    ).toThrow();
    expect(() =>
      siteSettingsPayloadSchema.parse({
        ...payload(),
        translations: [translations()[0], translations()[0]],
      }),
    ).toThrow();
  });
});

describe("site-settings command workflow", () => {
  it("requires a global permission for the singleton", async () => {
    const { service } = harness();

    await expect(
      service.readCurrent(context("content.read", "own")),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(
      service.createDraft(context("content.create", "assignedBusinessUnits"), {
        basePublished: { exists: false },
        ...payload(),
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("keeps incomplete locale coverage in draft and blocks review", async () => {
    const { service, store } = harness();
    const created = await service.createDraft(context("content.create"), {
      basePublished: { exists: false },
      ...payload(["vi"]),
    });

    expect(created.draft?.translationQuality).toEqual(
      expect.arrayContaining([
        { locale: "vi", status: "draft", quality: "ready" },
        { locale: "en", status: "missing", quality: "missing" },
      ]),
    );
    await expect(
      service.submitForReview(context("content.update"), {
        settingsId: created.draft!.id,
        expectedRevision: created.draft!.revision,
      }),
    ).rejects.toMatchObject({ code: "INCOMPLETE_TRANSLATIONS" });
    expect(store.draft?.status).toBe("draft");
  });

  it("audits every transition, publishes all locales, and emits public tags", async () => {
    const { service, store, auditEvents, postCommitEvents } = harness();
    let aggregate = await service.createDraft(context("content.create"), {
      basePublished: { exists: false },
      ...payload(),
    });
    aggregate = await service.submitForReview(context("content.update"), {
      settingsId: aggregate.draft!.id,
      expectedRevision: aggregate.draft!.revision,
    });
    expect(aggregate.draft?.status).toBe("inReview");
    expect(
      aggregate.draft?.translations.every(
        (translation) => translation.status === "inReview",
      ),
    ).toBe(true);

    aggregate = await service.returnToDraft(context("content.review"), {
      settingsId: aggregate.draft!.id,
      expectedRevision: aggregate.draft!.revision,
      reason: "Update the contact wording.",
    });
    aggregate = await service.updateDraft(context("content.update"), {
      settingsId: aggregate.draft!.id,
      expectedRevision: aggregate.draft!.revision,
      ...payload(),
    });
    aggregate = await service.submitForReview(context("content.update"), {
      settingsId: aggregate.draft!.id,
      expectedRevision: aggregate.draft!.revision,
    });
    aggregate = await service.publish(context("content.publish"), {
      settingsId: aggregate.draft!.id,
      expectedRevision: aggregate.draft!.revision,
    });

    expect(aggregate.draft).toBeNull();
    expect(aggregate.published).toMatchObject({
      status: "published",
      version: 1,
      publishedAt: occurredAt.toISOString(),
    });
    expect(aggregate.published?.translations).toHaveLength(locales.length);
    expect(auditEvents.map(({ action }) => action)).toEqual([
      "site-settings.draft.created",
      "site-settings.review.submitted",
      "site-settings.review.returned",
      "site-settings.draft.updated",
      "site-settings.review.submitted",
    ]);
    expect(store.atomicPublishAudits).toHaveLength(1);
    expect(store.atomicPublishAudits[0]).toMatchObject({
      action: "site-settings.published",
      permissionDecision: {
        permission: "content.publish",
        outcome: "allowed",
        scope: "all",
      },
    });
    expect(postCommitEvents.at(-1)).toMatchObject({
      kind: "published",
      locales,
    });
    expect(postCommitEvents.at(-1)?.tags).toEqual(
      expect.arrayContaining([
        "site-settings:public",
        "site-settings:locale:vi",
        "site-settings:locale:zh-CN",
      ]),
    );
  });

  it("never edits a published payload and preserves it when a new version replaces it", async () => {
    const { service, store } = harness();
    let aggregate = await service.createDraft(context("content.create"), {
      basePublished: { exists: false },
      ...payload(),
    });
    aggregate = await service.submitForReview(context("content.update"), {
      settingsId: aggregate.draft!.id,
      expectedRevision: aggregate.draft!.revision,
    });
    aggregate = await service.publish(context("content.publish"), {
      settingsId: aggregate.draft!.id,
      expectedRevision: aggregate.draft!.revision,
    });
    const firstPublished = structuredClone(aggregate.published!);

    await expect(
      service.updateDraft(context("content.update"), {
        settingsId: firstPublished.id,
        expectedRevision: firstPublished.revision,
        ...payload(),
      }),
    ).rejects.toMatchObject({ code: "PUBLISHED_VERSION_IMMUTABLE" });

    aggregate = await service.createDraft(context("content.create"), {
      basePublished: {
        exists: true,
        settingsId: firstPublished.id,
        expectedRevision: firstPublished.revision,
      },
      ...payload(),
      translations: translations().map((translation) => ({
        ...translation,
        companyName: `${translation.companyName} Next`,
      })),
    });
    aggregate = await service.submitForReview(context("content.update"), {
      settingsId: aggregate.draft!.id,
      expectedRevision: aggregate.draft!.revision,
    });
    aggregate = await service.publish(context("content.publish"), {
      settingsId: aggregate.draft!.id,
      expectedRevision: aggregate.draft!.revision,
    });

    expect(aggregate.published?.version).toBe(2);
    expect(store.archived).toHaveLength(1);
    expect(store.archived[0]?.translations).toEqual(
      firstPublished.translations,
    );
    expect(store.archived[0]?.socialLinks).toEqual(firstPublished.socialLinks);
  });

  it("reports post-commit failures without pretending the write rolled back", async () => {
    const { service, store } = harness({ auditFails: true });

    await expect(
      service.createDraft(context("content.create"), {
        basePublished: { exists: false },
        ...payload(),
      }),
    ).rejects.toMatchObject({ committed: true, failures: ["audit"] });
    expect(store.draft).not.toBeNull();
  });
});
