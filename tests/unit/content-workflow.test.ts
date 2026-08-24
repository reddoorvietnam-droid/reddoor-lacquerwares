import { describe, expect, it } from "vitest";

import type {
  RevisionWorkflowStatus,
  TranslationStatus,
} from "@/lib/content/contracts";
import {
  canTransitionContentRevision,
  canTransitionTranslation,
  ContentWorkflowError,
  transitionContentRevision,
  transitionTranslation,
} from "@/domains/content/workflow";

const statuses: readonly RevisionWorkflowStatus[] = [
  "draft",
  "inReview",
  "published",
  "archived",
];

const translationStatuses: readonly TranslationStatus[] = [
  "draft",
  "inReview",
  "published",
  "needsUpdate",
];

const revisionAllowed = new Set([
  "draft:inReview",
  "inReview:draft",
  "inReview:published",
  "published:archived",
]);

const translationAllowed = new Set([
  "draft:inReview",
  "inReview:draft",
  "inReview:published",
  "published:needsUpdate",
  "needsUpdate:inReview",
]);

const baseCommand = {
  actualRevision: 3,
  expectedRevision: 3,
  actorId: "actor-1",
  occurredAt: new Date("2026-08-24T08:00:00.000Z"),
};

function errorCode(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return error instanceof ContentWorkflowError ? error.code : undefined;
  }
}

describe("content revision workflow", () => {
  it("exposes the complete allow/deny transition table", () => {
    for (const from of statuses) {
      for (const to of statuses) {
        expect(canTransitionContentRevision(from, to)).toBe(
          revisionAllowed.has(`${from}:${to}`),
        );
      }
    }
  });

  it("returns an auditable transition without mutating the command", () => {
    const command = {
      ...baseCommand,
      currentStatus: "draft" as const,
      targetStatus: "inReview" as const,
    };

    expect(transitionContentRevision(command)).toEqual({
      previousStatus: "draft",
      status: "inReview",
      previousRevision: 3,
      revision: 4,
      actorId: "actor-1",
      occurredAt: new Date("2026-08-24T08:00:00.000Z"),
      reason: null,
    });
    expect(command.actualRevision).toBe(3);
  });

  it("rejects a stale optimistic-concurrency revision", () => {
    expect(
      errorCode(() =>
        transitionContentRevision({
          ...baseCommand,
          expectedRevision: 2,
          currentStatus: "draft",
          targetStatus: "inReview",
        }),
      ),
    ).toBe("STALE_REVISION");
  });

  it("requires reasons when review is returned or a revision is archived", () => {
    expect(
      errorCode(() =>
        transitionContentRevision({
          ...baseCommand,
          currentStatus: "inReview",
          targetStatus: "draft",
        }),
      ),
    ).toBe("MISSING_REASON");

    expect(
      errorCode(() =>
        transitionContentRevision({
          ...baseCommand,
          currentStatus: "published",
          targetStatus: "archived",
        }),
      ),
    ).toBe("MISSING_REASON");
  });
});

describe("translation workflow", () => {
  it("exposes the complete allow/deny transition table", () => {
    for (const from of translationStatuses) {
      for (const to of translationStatuses) {
        expect(canTransitionTranslation(from, to)).toBe(
          translationAllowed.has(`${from}:${to}`),
        );
      }
    }
  });

  it("publishes only nonempty content with a reservable route", () => {
    const publish = (overrides: {
      hasContent?: boolean;
      routeAvailable?: boolean;
    }) =>
      transitionTranslation({
        ...baseCommand,
        currentStatus: "inReview",
        targetStatus: "published",
        ...overrides,
      });

    expect(errorCode(() => publish({ routeAvailable: true }))).toBe(
      "EMPTY_CONTENT",
    );
    expect(errorCode(() => publish({ hasContent: true }))).toBe(
      "ROUTE_UNAVAILABLE",
    );
    expect(publish({ hasContent: true, routeAvailable: true }).status).toBe(
      "published",
    );
    expect(
      transitionTranslation({
        ...baseCommand,
        currentStatus: "inReview",
        targetStatus: "published",
        hasContent: true,
        requiresRoute: false,
      }).status,
    ).toBe("published");
  });

  it("marks a published translation stale only for a real source change", () => {
    const markStale = (sourceChanged: boolean, reason?: string) =>
      transitionTranslation({
        ...baseCommand,
        currentStatus: "published",
        targetStatus: "needsUpdate",
        sourceChanged,
        ...(reason ? { reason } : {}),
      });

    expect(errorCode(() => markStale(false, "Source changed"))).toBe(
      "SOURCE_NOT_CHANGED",
    );
    expect(errorCode(() => markStale(true))).toBe("MISSING_REASON");
    expect(markStale(true, "Source revision 5 published").status).toBe(
      "needsUpdate",
    );
  });
});
