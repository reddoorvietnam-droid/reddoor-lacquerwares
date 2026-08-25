import { describe, expect, it } from "vitest";

import {
  ApprovalError,
  approvalStatuses,
  approvalSubjects,
  type ApprovalRequest,
  type DecideApprovalInput,
} from "@/domains/approvals/contracts";
import {
  assertApproved,
  assertDecidable,
  assertRequestable,
  decisionPermissionFor,
} from "@/domains/approvals/policy";
import { isPermission } from "@/domains/identity/permissions";

const requesterId = "66c84b2d12ad6a75f9500001";
const deciderId = "66c84b2d12ad6a75f9500002";
const requestedAt = new Date("2026-08-25T02:00:00.000Z");
const decidedAt = new Date("2026-08-25T03:00:00.000Z");

function approvalRequest(
  overrides: Partial<ApprovalRequest> = {},
): ApprovalRequest {
  return {
    id: "66c84b2d12ad6a75f9500010",
    subject: "order.confirm",
    resourceType: "order",
    resourceId: "66c84b2d12ad6a75f9500011",
    businessUnitIds: ["66c84b2d12ad6a75f9500012"],
    status: "pending",
    requestedByUserId: requesterId,
    requestedAt,
    summary: "Confirm order RD-2026-0001",
    decidedByUserId: null,
    decidedAt: null,
    decisionReason: null,
    expectedRevision: 4,
    ...overrides,
  };
}

function decision(
  overrides: Partial<DecideApprovalInput> = {},
): DecideApprovalInput {
  return {
    requestId: "66c84b2d12ad6a75f9500010",
    decision: "approved",
    decidedByUserId: deciderId,
    decisionReason: null,
    decidedAt,
    expectedRevision: 4,
    ...overrides,
  };
}

function errorCode(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return error instanceof ApprovalError ? error.code : undefined;
  }
}

const undecidedStatuses = approvalStatuses.filter(
  (status) => status !== "pending",
);

describe("raising an approval request", () => {
  it("allows a request when nothing is pending", () => {
    expect(() => assertRequestable(null)).not.toThrow();
  });

  it("refuses to stack a second pending request", () => {
    expect(errorCode(() => assertRequestable(approvalRequest()))).toBe(
      "ALREADY_PENDING",
    );
  });
});

describe("deciding an approval request", () => {
  it("accepts an approval from a second identity at the expected revision", () => {
    expect(() => assertDecidable(approvalRequest(), decision())).not.toThrow();
  });

  it.each(undecidedStatuses)("refuses to decide a %s request", (status) => {
    expect(
      errorCode(() => assertDecidable(approvalRequest({ status }), decision())),
    ).toBe("ALREADY_DECIDED");
  });

  it("refuses self-approval even for the requester's own record", () => {
    expect(
      errorCode(() =>
        assertDecidable(
          approvalRequest(),
          decision({ decidedByUserId: requesterId }),
        ),
      ),
    ).toBe("SELF_APPROVAL");
  });

  it("requires a reason to reject but not to approve", () => {
    expect(
      errorCode(() =>
        assertDecidable(approvalRequest(), decision({ decision: "rejected" })),
      ),
    ).toBe("REASON_REQUIRED");
    expect(
      errorCode(() =>
        assertDecidable(
          approvalRequest(),
          decision({ decision: "rejected", decisionReason: "  " }),
        ),
      ),
    ).toBe("REASON_REQUIRED");
    expect(() =>
      assertDecidable(
        approvalRequest(),
        decision({
          decision: "rejected",
          decisionReason: "Margin below the agreed floor",
        }),
      ),
    ).not.toThrow();
    expect(() =>
      assertDecidable(approvalRequest(), decision({ decisionReason: null })),
    ).not.toThrow();
  });

  it("refuses a decision taken against a stale revision", () => {
    expect(
      errorCode(() =>
        assertDecidable(approvalRequest(), decision({ expectedRevision: 5 })),
      ),
    ).toBe("REVISION_CONFLICT");
  });
});

describe("guarding a gated transition", () => {
  it("refuses a missing or unapproved decision", () => {
    expect(errorCode(() => assertApproved(null, 4))).toBe("APPROVAL_MISSING");

    for (const status of undecidedStatuses.filter(
      (candidate) => candidate !== "approved",
    )) {
      expect(
        errorCode(() => assertApproved(approvalRequest({ status }), 4)),
      ).toBe("APPROVAL_MISSING");
    }

    expect(errorCode(() => assertApproved(approvalRequest(), 4))).toBe(
      "APPROVAL_MISSING",
    );
  });

  it("refuses an approval whose record has since moved on", () => {
    expect(
      errorCode(() =>
        assertApproved(approvalRequest({ status: "approved" }), 5),
      ),
    ).toBe("REVISION_CONFLICT");
  });

  it("narrows the request once the guard passes", () => {
    const request: ApprovalRequest | null = approvalRequest({
      status: "approved",
      decidedByUserId: deciderId,
      decidedAt,
    });

    assertApproved(request, 4);

    // Reading these fields without a null check only compiles because the
    // assertion narrowed the union.
    expect(request.status).toBe("approved");
    expect(request.decidedByUserId).toBe(deciderId);
  });
});

describe("decision permissions", () => {
  it.each(approvalSubjects)("maps %s to a catalogued permission", (subject) => {
    const permission = decisionPermissionFor(subject);

    expect(permission).toBeDefined();
    expect(isPermission(permission)).toBe(true);
  });
});
