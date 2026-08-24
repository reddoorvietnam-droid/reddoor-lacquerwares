import type {
  RevisionWorkflowStatus,
  TranslationStatus,
} from "@/lib/content/contracts";

export type ContentWorkflowErrorCode =
  | "INVALID_TRANSITION"
  | "STALE_REVISION"
  | "MISSING_REASON"
  | "EMPTY_CONTENT"
  | "ROUTE_UNAVAILABLE"
  | "SOURCE_NOT_CHANGED";

export class ContentWorkflowError extends Error {
  readonly code: ContentWorkflowErrorCode;

  constructor(code: ContentWorkflowErrorCode, message: string) {
    super(message);
    this.name = "ContentWorkflowError";
    this.code = code;
  }
}

export interface WorkflowCommand<TStatus extends string> {
  readonly currentStatus: TStatus;
  readonly targetStatus: TStatus;
  readonly actualRevision: number;
  readonly expectedRevision: number;
  readonly actorId: string;
  readonly occurredAt: Date;
  readonly reason?: string;
}

export interface WorkflowTransition<TStatus extends string> {
  readonly previousStatus: TStatus;
  readonly status: TStatus;
  readonly previousRevision: number;
  readonly revision: number;
  readonly actorId: string;
  readonly occurredAt: Date;
  readonly reason: string | null;
}

export interface TranslationWorkflowCommand extends WorkflowCommand<TranslationStatus> {
  /** Whether the localized title/body or structured blocks contain publishable content. */
  readonly hasContent?: boolean;
  /** Whether the localized canonical path can be atomically reserved on publish. */
  readonly routeAvailable?: boolean;
  /** False for reusable sections/global content that do not own a public route. */
  readonly requiresRoute?: boolean;
  /** Required when a published translation is marked stale after its source changes. */
  readonly sourceChanged?: boolean;
}

const revisionTransitions = {
  draft: ["inReview"],
  inReview: ["draft", "published"],
  published: ["archived"],
  archived: [],
} as const satisfies Record<
  RevisionWorkflowStatus,
  readonly RevisionWorkflowStatus[]
>;

const translationTransitions = {
  draft: ["inReview"],
  inReview: ["draft", "published"],
  published: ["needsUpdate"],
  needsUpdate: ["inReview"],
} as const satisfies Record<TranslationStatus, readonly TranslationStatus[]>;

function normalizedReason(reason: string | undefined): string | null {
  const value = reason?.trim();
  return value ? value : null;
}

function assertExpectedRevision(
  expectedRevision: number,
  actualRevision: number,
): void {
  if (
    !Number.isSafeInteger(expectedRevision) ||
    !Number.isSafeInteger(actualRevision) ||
    expectedRevision < 0 ||
    actualRevision < 0 ||
    expectedRevision !== actualRevision
  ) {
    throw new ContentWorkflowError(
      "STALE_REVISION",
      "The record changed before this workflow command was applied.",
    );
  }
}

function assertReason(reason: string | null, message: string): void {
  if (!reason) {
    throw new ContentWorkflowError("MISSING_REASON", message);
  }
}

function createTransition<TStatus extends string>(
  command: WorkflowCommand<TStatus>,
): WorkflowTransition<TStatus> {
  const reason = normalizedReason(command.reason);

  return {
    previousStatus: command.currentStatus,
    status: command.targetStatus,
    previousRevision: command.actualRevision,
    revision: command.actualRevision + 1,
    actorId: command.actorId,
    occurredAt: new Date(command.occurredAt),
    reason,
  };
}

function isAllowedTransition<TStatus extends string>(
  transitions: Record<TStatus, readonly TStatus[]>,
  currentStatus: TStatus,
  targetStatus: TStatus,
): boolean {
  return transitions[currentStatus].includes(targetStatus);
}

/**
 * Applies the content-revision workflow without touching persistence. A service
 * must still authorize the actor and save with an expected-revision predicate.
 */
export function transitionContentRevision(
  command: WorkflowCommand<RevisionWorkflowStatus>,
): WorkflowTransition<RevisionWorkflowStatus> {
  assertExpectedRevision(command.expectedRevision, command.actualRevision);

  if (
    !isAllowedTransition(
      revisionTransitions,
      command.currentStatus,
      command.targetStatus,
    )
  ) {
    throw new ContentWorkflowError(
      "INVALID_TRANSITION",
      `Content revisions cannot move from ${command.currentStatus} to ${command.targetStatus}.`,
    );
  }

  const reason = normalizedReason(command.reason);
  if (
    command.currentStatus === "inReview" &&
    command.targetStatus === "draft"
  ) {
    assertReason(reason, "Returning a revision to draft requires a reason.");
  }

  if (command.targetStatus === "archived") {
    assertReason(reason, "Archiving a published revision requires a reason.");
  }

  return createTransition(command);
}

/**
 * Applies translation status rules. Route reservation and pointer replacement
 * remain one persistence transaction; these booleans are preconditions checked
 * again by that transaction.
 */
export function transitionTranslation(
  command: TranslationWorkflowCommand,
): WorkflowTransition<TranslationStatus> {
  assertExpectedRevision(command.expectedRevision, command.actualRevision);

  if (
    !isAllowedTransition(
      translationTransitions,
      command.currentStatus,
      command.targetStatus,
    )
  ) {
    throw new ContentWorkflowError(
      "INVALID_TRANSITION",
      `Translations cannot move from ${command.currentStatus} to ${command.targetStatus}.`,
    );
  }

  const reason = normalizedReason(command.reason);

  if (
    command.currentStatus === "inReview" &&
    command.targetStatus === "draft"
  ) {
    assertReason(reason, "Returning a translation to draft requires a reason.");
  }

  if (command.targetStatus === "published") {
    if (!command.hasContent) {
      throw new ContentWorkflowError(
        "EMPTY_CONTENT",
        "An empty translation cannot be published.",
      );
    }

    if (command.requiresRoute !== false && !command.routeAvailable) {
      throw new ContentWorkflowError(
        "ROUTE_UNAVAILABLE",
        "The localized canonical route is not available.",
      );
    }
  }

  if (
    command.currentStatus === "published" &&
    command.targetStatus === "needsUpdate"
  ) {
    if (!command.sourceChanged) {
      throw new ContentWorkflowError(
        "SOURCE_NOT_CHANGED",
        "A published translation is marked stale only after its source changes.",
      );
    }

    assertReason(reason, "Marking a translation stale requires a reason.");
  }

  return createTransition(command);
}

export function canTransitionContentRevision(
  currentStatus: RevisionWorkflowStatus,
  targetStatus: RevisionWorkflowStatus,
): boolean {
  return isAllowedTransition(revisionTransitions, currentStatus, targetStatus);
}

export function canTransitionTranslation(
  currentStatus: TranslationStatus,
  targetStatus: TranslationStatus,
): boolean {
  return isAllowedTransition(
    translationTransitions,
    currentStatus,
    targetStatus,
  );
}
