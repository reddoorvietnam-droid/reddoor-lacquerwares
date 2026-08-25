import {
  ApprovalError,
  approvalDecisionPermission,
  type ApprovalRequest,
  type ApprovalSubject,
  type DecideApprovalInput,
} from "@/domains/approvals/contracts";
import type { Permission } from "@/domains/identity/permissions";

/**
 * Pure approval rules. No database and no session access, so every branch is
 * directly testable and the same rules apply to a server action, a route
 * handler, and a background job.
 */

/**
 * Whether a request may be raised at all.
 *
 * Only one pending request may exist per (resource, subject). Without this a
 * requester could stack duplicates and have one of them approved by accident.
 */
export function assertRequestable(
  existingPending: ApprovalRequest | null,
): void {
  if (existingPending) {
    throw new ApprovalError(
      "ALREADY_PENDING",
      "This record already has a pending approval request.",
    );
  }
}

export function decisionPermissionFor(subject: ApprovalSubject): Permission {
  return approvalDecisionPermission[subject];
}

/**
 * Separation of duties: the person who asked can never be the person who
 * releases. This holds even for a Director raising their own request, so the
 * audit trail always shows two identities.
 */
export function assertDecidable(
  request: ApprovalRequest,
  input: DecideApprovalInput,
): void {
  if (request.status !== "pending") {
    throw new ApprovalError(
      "ALREADY_DECIDED",
      "This approval request has already been decided.",
    );
  }

  if (request.requestedByUserId === input.decidedByUserId) {
    throw new ApprovalError(
      "SELF_APPROVAL",
      "An approval request cannot be decided by the person who raised it.",
    );
  }

  if (input.decision === "rejected" && !input.decisionReason?.trim()) {
    throw new ApprovalError(
      "REASON_REQUIRED",
      "A rejection must record a reason.",
    );
  }

  if (request.expectedRevision !== input.expectedRevision) {
    throw new ApprovalError(
      "REVISION_CONFLICT",
      "The underlying record changed after this approval was requested.",
    );
  }
}

/**
 * Guard used by the business state machines before a gated transition commits.
 * The approval must exist, be approved, and still match the record's revision.
 */
export function assertApproved(
  request: ApprovalRequest | null,
  currentRevision: number,
): asserts request is ApprovalRequest {
  if (!request || request.status !== "approved") {
    throw new ApprovalError(
      "APPROVAL_MISSING",
      "This action requires an approved Director decision.",
    );
  }

  if (request.expectedRevision !== currentRevision) {
    throw new ApprovalError(
      "REVISION_CONFLICT",
      "The record changed after it was approved; request approval again.",
    );
  }
}
