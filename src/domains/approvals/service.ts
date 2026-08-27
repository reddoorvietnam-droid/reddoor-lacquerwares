import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import {
  ApprovalError,
  type ApprovalRepository,
  type ApprovalRequest,
  type ApprovalSubject,
} from "@/domains/approvals/contracts";
import {
  assertDecidable,
  assertRequestable,
  decisionPermissionFor,
} from "@/domains/approvals/policy";
import { requiresGlobalGrant } from "@/domains/identity/permissions";
import type { Permission } from "@/domains/identity/permissions";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";

export type ApprovalServiceDependencies = {
  repository: ApprovalRepository;
  auditRepository: AuditRepository;
  now?: () => Date;
};

export type RequestApprovalInput = {
  subject: ApprovalSubject;
  resourceType: string;
  resourceId: string;
  businessUnitIds: readonly string[];
  /** Already-redacted description; the queue shows it to every reader. */
  summary: string;
  expectedRevision: number;
};

export type DecideApprovalServiceInput = {
  requestId: string;
  decision: "approved" | "rejected";
  decisionReason: string | null;
  expectedRevision: number;
};

/**
 * The Director approval gate as a service: pure policy from `policy.ts`
 * decides, the repository persists, and every request and decision lands in
 * the audit trail. Permission checks happen in the caller's guard; the
 * service re-asserts them against the access context it was handed, the same
 * defense-in-depth the content services use.
 */
export class ApprovalService {
  private readonly dependencies: ApprovalServiceDependencies;

  constructor(dependencies: ApprovalServiceDependencies) {
    this.dependencies = dependencies;
  }

  private assertHolds(context: AccessContext, permission: Permission): void {
    const effective = context.permissions.find(
      (candidate) => candidate.permission === permission,
    );
    if (!effective || context.userStatus !== "active") {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
    if (requiresGlobalGrant(permission) && effective.scope !== "all") {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
  }

  async request(
    context: AccessContext,
    input: RequestApprovalInput,
  ): Promise<ApprovalRequest> {
    this.assertHolds(context, "approvals.request");

    const existing = await this.dependencies.repository.findPendingForResource(
      input.resourceType,
      input.resourceId,
      input.subject,
    );
    assertRequestable(existing);

    const requestedAt = this.dependencies.now?.() ?? new Date();
    const request = await this.dependencies.repository.create({
      subject: input.subject,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      businessUnitIds: input.businessUnitIds,
      requestedByUserId: context.userId,
      summary: input.summary,
      expectedRevision: input.expectedRevision,
      requestedAt,
    });

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "approval.requested",
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      businessUnitIds: input.businessUnitIds,
      requestId: context.requestId,
      metadata: { subject: input.subject, approvalRequestId: request.id },
      occurredAt: requestedAt,
    });

    return request;
  }

  async decide(
    context: AccessContext,
    input: DecideApprovalServiceInput,
  ): Promise<ApprovalRequest> {
    const request = await this.dependencies.repository.findById(
      input.requestId,
    );
    if (!request) {
      throw new ApprovalError("NOT_FOUND", "Approval request not found.");
    }

    this.assertHolds(context, decisionPermissionFor(request.subject));

    const decidedAt = this.dependencies.now?.() ?? new Date();
    const decision = {
      requestId: input.requestId,
      decision: input.decision,
      decidedByUserId: context.userId,
      decisionReason: input.decisionReason,
      decidedAt,
      expectedRevision: input.expectedRevision,
    };
    assertDecidable(request, decision);

    const decided = await this.dependencies.repository.decide(decision);

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action:
        input.decision === "approved"
          ? "approval.approved"
          : "approval.rejected",
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      businessUnitIds: request.businessUnitIds,
      requestId: context.requestId,
      ...(input.decisionReason ? { reason: input.decisionReason } : {}),
      metadata: { subject: request.subject, approvalRequestId: request.id },
      occurredAt: decidedAt,
    });

    return decided;
  }

  async listPending(
    context: AccessContext,
    businessUnitIds: readonly string[] | null,
  ): Promise<ApprovalRequest[]> {
    this.assertHolds(context, "approvals.read");
    return this.dependencies.repository.listPending(businessUnitIds);
  }

  async findForResource(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ): Promise<{
    pending: ApprovalRequest | null;
    approved: ApprovalRequest | null;
  }> {
    const [pending, approved] = await Promise.all([
      this.dependencies.repository.findPendingForResource(
        resourceType,
        resourceId,
        subject,
      ),
      this.dependencies.repository.findApprovedForResource(
        resourceType,
        resourceId,
        subject,
      ),
    ]);
    return { pending, approved };
  }
}
