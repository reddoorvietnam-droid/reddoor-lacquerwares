import { ZodError } from "zod";
import { describe, expect, it, vi } from "vitest";

import type {
  AuditEventInput,
  AuditRepository,
} from "@/domains/audit/contracts";
import {
  type ContentAdminAggregateDto,
  type ContentCommandStore,
  ContentCommandStoreError,
} from "@/domains/content/commands/contracts";
import { ContentCommandService } from "@/domains/content/commands/service";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import type {
  AccessContext,
  EffectivePermission,
} from "@/lib/auth/authorization";
import type {
  RevisionWorkflowStatus,
  TranslationStatus,
} from "@/lib/content/contracts";

const actorId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const entryId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const draftRevisionId = "cccccccccccccccccccccccc";
const publishedRevisionId = "999999999999999999999999";
const viTranslationId = "dddddddddddddddddddddddd";
const enTranslationId = "eeeeeeeeeeeeeeeeeeeeeeee";
const occurredAt = new Date("2026-08-24T09:30:00.000Z");
const isoDate = occurredAt.toISOString();

function accessContext(
  permissionName:
    | "content.read"
    | "content.create"
    | "content.update"
    | "content.review"
    | "content.publish",
  scope: EffectivePermission["scope"] = "all",
): AccessContext {
  return {
    actorType: "user",
    userId: actorId,
    userStatus: "active",
    authzVersion: 1,
    requestId: "request-123",
    permissions: [
      {
        permission: permissionName,
        scope,
        businessUnitIds:
          scope === "assignedBusinessUnits" ? ["111111111111111111111111"] : [],
        roleKeys: ["editor"],
      },
    ],
  };
}

function aggregate(options?: {
  type?: "page" | "section" | "processStage" | "global";
  draftStatus?: RevisionWorkflowStatus;
  translationStatus?: TranslationStatus;
  withDraft?: boolean;
  withPublished?: boolean;
}): ContentAdminAggregateDto {
  const withDraft = options?.withDraft ?? true;
  const withPublished = options?.withPublished ?? false;
  const draftStatus = options?.draftStatus ?? "draft";
  const translationStatus = options?.translationStatus ?? "draft";
  const translation = (locale: "vi" | "en", id: string, title: string) => ({
    id,
    revision: 2,
    createdAt: isoDate,
    updatedAt: isoDate,
    createdBy: actorId,
    updatedBy: actorId,
    entryId,
    revisionId: draftRevisionId,
    locale,
    slug: locale === "vi" ? "cau-chuyen" : "story",
    title,
    summary: null,
    blocks: [
      {
        blockId: `${locale}-paragraph`,
        type: "paragraph" as const,
        text: title,
      },
    ],
    translationStatus,
    sourceRevision: 1,
    reviewedBy: null,
    publishedAt: null,
    seo: { noIndex: false },
  });

  return {
    entry: {
      id: entryId,
      revision: 3,
      createdAt: isoDate,
      updatedAt: isoDate,
      createdBy: actorId,
      updatedBy: actorId,
      code: "about-story",
      type: options?.type ?? "page",
      placement: "about.story",
      status: withPublished ? "published" : draftStatus,
      currentDraftRevisionId: withDraft ? draftRevisionId : null,
      currentPublishedRevisionId: withPublished ? publishedRevisionId : null,
      deletedAt: null,
    },
    draft: withDraft
      ? {
          revision: {
            id: draftRevisionId,
            revision: 4,
            createdAt: isoDate,
            updatedAt: isoDate,
            createdBy: actorId,
            updatedBy: actorId,
            entryId,
            version: withPublished ? 2 : 1,
            blocks: [],
            status: draftStatus,
            sourceLocale: "vi",
            submittedAt: null,
            reviewedAt: null,
            reviewedBy: null,
            publishedAt: null,
          },
          translations: [
            translation("vi", viTranslationId, "Câu chuyện"),
            translation("en", enTranslationId, "Story"),
          ],
        }
      : null,
    published: withPublished
      ? {
          revision: {
            id: publishedRevisionId,
            revision: 1,
            createdAt: isoDate,
            updatedAt: isoDate,
            createdBy: actorId,
            updatedBy: actorId,
            entryId,
            version: 1,
            blocks: [],
            status: "published",
            sourceLocale: "vi",
            submittedAt: isoDate,
            reviewedAt: isoDate,
            reviewedBy: actorId,
            publishedAt: isoDate,
          },
          translations: [],
        }
      : null,
  };
}

function workflowInput(value: ContentAdminAggregateDto) {
  if (!value.draft) {
    throw new Error("The test aggregate needs a draft.");
  }

  return {
    entryId,
    expectedEntryRevision: value.entry.revision,
    revisionId: value.draft.revision.id,
    expectedRevision: value.draft.revision.revision,
    expectedTranslations: value.draft.translations.map((translation) => ({
      locale: translation.locale,
      expectedRevision: translation.revision,
    })),
  };
}

function createHarness(initial = aggregate()) {
  const current = structuredClone(initial);
  const timeline: string[] = [];
  const audits: AuditEventInput[] = [];
  const postCommitEvents: unknown[] = [];

  const setDraftStatus = (
    revisionStatus: RevisionWorkflowStatus,
    translationStatus: TranslationStatus,
  ) => {
    if (!current.draft) {
      throw new Error("The test aggregate needs a draft.");
    }

    current.draft.revision.status = revisionStatus;
    current.draft.revision.revision += 1;
    current.draft.translations = current.draft.translations.map(
      (translation) => ({
        ...translation,
        translationStatus,
        revision: translation.revision + 1,
      }),
    );
    current.entry.revision += 1;
  };

  const store = {
    listEntries: vi.fn<ContentCommandStore["listEntries"]>(
      async (scope, input) => {
        timeline.push(`list:${scope.kind}`);
        return {
          items: [],
          offset: input.offset,
          limit: input.limit,
          total: 0,
        };
      },
    ),
    readEntry: vi.fn<ContentCommandStore["readEntry"]>(async (scope) => {
      timeline.push(`read:${scope.kind}`);
      if (
        scope.kind === "none" ||
        (scope.kind === "own" && scope.ownerUserId !== current.entry.createdBy)
      ) {
        return null;
      }

      return structuredClone(current);
    }),
    createEntryDraft: vi.fn<ContentCommandStore["createEntryDraft"]>(
      async () => {
        timeline.push("commit:create");
        return structuredClone(current);
      },
    ),
    createRevisionDraft: vi.fn<ContentCommandStore["createRevisionDraft"]>(
      async () => {
        timeline.push("commit:create-revision");
        return structuredClone(current);
      },
    ),
    updateDraft: vi.fn<ContentCommandStore["updateDraft"]>(
      async (_scope, input) => {
        timeline.push("commit:update");
        current.entry.placement = input.placement;
        current.entry.revision += 1;
        if (current.draft) {
          current.draft.revision.revision += 1;
        }
        return structuredClone(current);
      },
    ),
    submitForReview: vi.fn<ContentCommandStore["submitForReview"]>(async () => {
      timeline.push("commit:submit");
      setDraftStatus("inReview", "inReview");
      return structuredClone(current);
    }),
    returnToDraft: vi.fn<ContentCommandStore["returnToDraft"]>(async () => {
      timeline.push("commit:return");
      setDraftStatus("draft", "draft");
      return structuredClone(current);
    }),
    publish: vi.fn<ContentCommandStore["publish"]>(async (input) => {
      setDraftStatus("published", "published");
      current.published = current.draft;
      current.draft = null;
      current.entry.status = "published";
      current.entry.currentPublishedRevisionId = draftRevisionId;
      current.entry.currentDraftRevisionId = null;
      timeline.push("transaction:audit");
      audits.push(input.auditEvent);
      timeline.push("commit:publish");
      return structuredClone(current);
    }),
  } satisfies ContentCommandStore;
  const auditRepository: AuditRepository = {
    append: vi.fn(async (event) => {
      timeline.push("audit");
      audits.push(event);
      return { id: "audit-1", occurredAt: event.occurredAt };
    }),
  };
  const postCommit = vi.fn(async (event) => {
    timeline.push("postCommit");
    postCommitEvents.push(event);
  });
  const service = new ContentCommandService({
    store,
    auditRepository,
    now: () => occurredAt,
    postCommit,
  });

  return {
    service,
    store,
    auditRepository,
    audits,
    postCommitEvents,
    postCommit,
    timeline,
    current: () => structuredClone(current),
  };
}

const createInput = {
  code: "about-story",
  type: "page",
  placement: "about.story",
  sourceLocale: "vi",
  blocks: [],
  translations: [
    {
      locale: "vi",
      slug: "cau-chuyen",
      title: "Câu chuyện",
      blocks: [
        {
          blockId: "body",
          type: "richText",
          html: '<p>An toàn</p><script>alert(1)</script><a href="javascript:x">x</a>',
        },
      ],
      seo: { noIndex: false },
    },
  ],
} as const;

describe("ContentCommandService validation and access boundaries", () => {
  it("strictly rejects mass-assigned workflow state before persistence", async () => {
    const harness = createHarness();

    await expect(
      harness.service.createEntryDraft(accessContext("content.create"), {
        ...createInput,
        status: "published",
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(harness.store.createEntryDraft).not.toHaveBeenCalled();
    expect(harness.audits).toHaveLength(0);
  });

  it("sanitizes rich text before commit and runs audit/callback after commit", async () => {
    const harness = createHarness();

    await harness.service.createEntryDraft(
      accessContext("content.create", "own"),
      createInput,
    );

    const persisted = harness.store.createEntryDraft.mock.calls[0]?.[0];
    const richText = persisted?.translations[0]?.blocks[0];
    expect(richText).toEqual({
      blockId: "body",
      type: "richText",
      html: "<p>An toàn</p><a>x</a>",
    });
    expect(harness.timeline).toEqual(["commit:create", "audit", "postCommit"]);
    expect(harness.audits[0]).toMatchObject({
      action: "content.entry-draft.created",
      resourceId: entryId,
      permissionDecision: {
        permission: "content.create",
        outcome: "allowed",
        scope: "own",
      },
    });
  });

  it("passes a non-leaking owner scope to list/read and rejects missing permission", async () => {
    const harness = createHarness();

    await harness.service.listEntries(
      accessContext("content.read", "own"),
      undefined,
    );
    await harness.service.readEntry(accessContext("content.read", "own"), {
      entryId,
    });

    expect(harness.store.listEntries.mock.calls[0]?.[0]).toEqual({
      kind: "own",
      ownerUserId: actorId,
    });
    expect(harness.store.readEntry.mock.calls[0]?.[0]).toEqual({
      kind: "own",
      ownerUserId: actorId,
    });
    await expect(
      harness.service.readEntry(accessContext("content.create"), { entryId }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });

  it("denies review and publish unless the context has global scope", async () => {
    const reviewHarness = createHarness(
      aggregate({ draftStatus: "inReview", translationStatus: "inReview" }),
    );
    const publishHarness = createHarness(
      aggregate({ draftStatus: "inReview", translationStatus: "inReview" }),
    );

    await expect(
      reviewHarness.service.returnToDraft(
        accessContext("content.review", "own"),
        {
          ...workflowInput(reviewHarness.current()),
          reason: "Changes requested",
        },
      ),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      publishHarness.service.publish(
        accessContext("content.publish", "assignedBusinessUnits"),
        {
          ...workflowInput(publishHarness.current()),
          routes: [
            { locale: "vi", path: "/vi/cau-chuyen" },
            { locale: "en", path: "/en/story" },
          ],
        },
      ),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});

describe("ContentCommandService draft and review workflow", () => {
  it("rejects stale optimistic revisions without calling the write adapter", async () => {
    const harness = createHarness();
    const value = harness.current();

    await expect(
      harness.service.submitForReview(accessContext("content.update"), {
        ...workflowInput(value),
        expectedEntryRevision: value.entry.revision - 1,
      }),
    ).rejects.toMatchObject({
      code: "STALE_REVISION",
    });
    expect(harness.store.submitForReview).not.toHaveBeenCalled();
    expect(harness.audits).toHaveLength(0);
  });

  it("updates placement and a complete translation snapshot under own scope", async () => {
    const harness = createHarness();
    const value = harness.current();
    const draft = value.draft;

    if (!draft) {
      throw new Error("The test aggregate needs a draft.");
    }

    await harness.service.updateDraft(accessContext("content.update", "own"), {
      entryId,
      expectedEntryRevision: value.entry.revision,
      revisionId: draft.revision.id,
      expectedRevision: draft.revision.revision,
      placement: "about.history",
      sourceLocale: "vi",
      blocks: [],
      translations: draft.translations.map((translation) => ({
        locale: translation.locale,
        slug: translation.slug,
        title: translation.title,
        blocks: translation.blocks,
        seo: translation.seo,
        expectedRevision: translation.revision,
      })),
    });

    expect(harness.store.updateDraft.mock.calls[0]?.[0]).toEqual({
      kind: "own",
      ownerUserId: actorId,
    });
    expect(harness.current().entry.placement).toBe("about.history");
    expect(harness.audits[0]?.changes).toEqual({
      before: {
        draftVersion: 1,
        optimisticRevision: 4,
        placement: "about.story",
      },
      after: {
        draftVersion: 1,
        optimisticRevision: 5,
        placement: "about.history",
        locales: ["vi", "en"],
      },
    });
  });

  it("keeps non-draft revisions immutable", async () => {
    const harness = createHarness({
      ...aggregate({ draftStatus: "published" }),
    });
    const value = harness.current();
    const draft = value.draft;

    if (!draft) {
      throw new Error("The test aggregate needs a draft.");
    }

    await expect(
      harness.service.updateDraft(accessContext("content.update"), {
        entryId,
        expectedEntryRevision: value.entry.revision,
        revisionId: draft.revision.id,
        expectedRevision: draft.revision.revision,
        placement: value.entry.placement,
        sourceLocale: "vi",
        blocks: [],
        translations: draft.translations.map((translation) => ({
          locale: translation.locale,
          title: translation.title,
          blocks: translation.blocks,
          seo: translation.seo,
          expectedRevision: translation.revision,
        })),
      }),
    ).rejects.toMatchObject({
      code: "PUBLISHED_REVISION_IMMUTABLE",
    });
    expect(harness.store.updateDraft).not.toHaveBeenCalled();
  });

  it("submits and returns every translation as one reviewed aggregate", async () => {
    const harness = createHarness();
    const initial = harness.current();

    await harness.service.submitForReview(
      accessContext("content.update"),
      workflowInput(initial),
    );
    const inReview = harness.current();
    expect(inReview.draft?.revision.status).toBe("inReview");
    expect(
      inReview.draft?.translations.every(
        ({ translationStatus }) => translationStatus === "inReview",
      ),
    ).toBe(true);

    await harness.service.returnToDraft(accessContext("content.review"), {
      ...workflowInput(inReview),
      reason: "Clarify the provenance paragraph.",
    });

    expect(harness.current().draft?.revision.status).toBe("draft");
    expect(harness.audits.map(({ action }) => action)).toEqual([
      "content.review.submitted",
      "content.review.returned",
    ]);
    expect(harness.audits[1]?.reason).toBe("Clarify the provenance paragraph.");
  });
});

describe("ContentCommandService publication boundary", () => {
  it("requires one route in each published locale namespace", async () => {
    const harness = createHarness(
      aggregate({ draftStatus: "inReview", translationStatus: "inReview" }),
    );
    const value = harness.current();

    await expect(
      harness.service.publish(accessContext("content.publish"), {
        ...workflowInput(value),
        routes: [
          { locale: "vi", path: "/en/wrong-namespace" },
          { locale: "en", path: "/en/story" },
        ],
      }),
    ).rejects.toMatchObject({
      code: "ROUTE_UNAVAILABLE",
    });
    expect(harness.store.publish).not.toHaveBeenCalled();
  });

  it("publishes reusable sections without inventing a canonical route", async () => {
    const harness = createHarness(
      aggregate({
        type: "section",
        draftStatus: "inReview",
        translationStatus: "inReview",
      }),
    );

    await harness.service.publish(accessContext("content.publish"), {
      ...workflowInput(harness.current()),
      routes: [],
    });

    expect(harness.store.publish).toHaveBeenCalledOnce();
    expect(harness.postCommitEvents[0]).toMatchObject({
      kind: "published",
      paths: [],
      tags: expect.arrayContaining(["content:public", "content:locale:vi"]),
    });
  });

  it("invalidates only after the publish adapter resolves and audit appends", async () => {
    const harness = createHarness(
      aggregate({ draftStatus: "inReview", translationStatus: "inReview" }),
    );

    await harness.service.publish(accessContext("content.publish"), {
      ...workflowInput(harness.current()),
      routes: [
        { locale: "vi", path: "/vi/cau-chuyen" },
        { locale: "en", path: "/en/story" },
      ],
    });

    expect(harness.timeline.slice(-3)).toEqual([
      "transaction:audit",
      "commit:publish",
      "postCommit",
    ]);
    expect(harness.auditRepository.append).not.toHaveBeenCalled();
    expect(harness.audits[0]).toMatchObject({
      action: "content.published",
      permissionDecision: {
        permission: "content.publish",
        outcome: "allowed",
        scope: "all",
      },
    });
  });

  it("does not audit or invalidate when the transactional adapter rejects", async () => {
    const harness = createHarness(
      aggregate({ draftStatus: "inReview", translationStatus: "inReview" }),
    );
    harness.store.publish.mockRejectedValueOnce(
      new ContentCommandStoreError(
        "ROUTE_UNAVAILABLE",
        "Route collision in transaction.",
      ),
    );

    await expect(
      harness.service.publish(accessContext("content.publish"), {
        ...workflowInput(harness.current()),
        routes: [
          { locale: "vi", path: "/vi/cau-chuyen" },
          { locale: "en", path: "/en/story" },
        ],
      }),
    ).rejects.toMatchObject({
      code: "ROUTE_UNAVAILABLE",
    });
    expect(harness.audits).toHaveLength(0);
    expect(harness.postCommitEvents).toHaveLength(0);
  });

  it("reports a committed invalidation failure after the atomic audit", async () => {
    const value = aggregate({
      draftStatus: "inReview",
      translationStatus: "inReview",
    });
    const harness = createHarness(value);
    harness.postCommit.mockRejectedValueOnce(new Error("Cache unavailable"));

    await expect(
      harness.service.publish(accessContext("content.publish"), {
        ...workflowInput(value),
        routes: [
          { locale: "vi", path: "/vi/cau-chuyen" },
          { locale: "en", path: "/en/story" },
        ],
      }),
    ).rejects.toMatchObject({
      committed: true,
      failures: ["postCommit"],
    });
    expect(harness.audits).toHaveLength(1);
    expect(harness.auditRepository.append).not.toHaveBeenCalled();
  });
});
