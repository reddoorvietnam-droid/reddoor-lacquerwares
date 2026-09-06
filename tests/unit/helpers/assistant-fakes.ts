import type {
  AssistantProposalDto,
  NewProposalRecord,
  ProposalStore,
} from "@/domains/assistant/contracts";
import type { ToolAuth } from "@/domains/assistant/tools/types";
import type {
  ApprovalRepository,
  ApprovalRequest,
  ApprovalSubject,
} from "@/domains/approvals/contracts";
import type { AuthorizationSnapshot } from "@/domains/identity/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  roleDefinitionSeeds,
  type SystemRoleKey,
} from "@/domains/identity/role-definitions";
import type {
  UserDirectory,
  UserSummary,
} from "@/domains/identity/user-directory";
import type {
  NewTaskRecord,
  TaskFieldsWrite,
  TaskListFilter,
  TaskRecordDto,
  TaskStatus,
  TaskStore,
} from "@/domains/tasks/contracts";
import {
  ContentAccessDeniedError,
  evaluatePermission,
  grantCoverageForPermission,
  type AccessContext,
  type PermissionTarget,
} from "@/lib/auth/authorization";

import { nextId, occurredAt, unitId } from "./finance-fakes";

/**
 * In-memory stores and a permission evaluator backed by the REAL role
 * seeds and the REAL evaluator, so the assistant tests prove what each of
 * the six roles can and cannot reach through the tools — not what a fake
 * guard was told to answer.
 */

export const roleUsers: Record<
  SystemRoleKey,
  { id: string; displayName: string }
> = {
  DIRECTOR: { id: "d1d1d1d1d1d1d1d1d1d1d1d1", displayName: "Giám đốc" },
  COMPANY_ACCOUNTANT: {
    id: "c1c1c1c1c1c1c1c1c1c1c1c1",
    displayName: "Kế toán công ty",
  },
  FACTORY_ACCOUNTANT: {
    id: "f1f1f1f1f1f1f1f1f1f1f1f1",
    displayName: "Kế toán nhà máy",
  },
  FACTORY_MANAGER: {
    id: "e1e1e1e1e1e1e1e1e1e1e1e1",
    displayName: "Quản lý nhà máy",
  },
  WAREHOUSE_MANAGER: { id: "a1a1a1a1a1a1a1a1a1a1a1a1", displayName: "Thủ kho" },
  CONTENT_CREATOR: { id: "b1b1b1b1b1b1b1b1b1b1b1b1", displayName: "Biên tập" },
};

/**
 * Grants mirror how the company provisions them: the roles whose seeds are
 * `all`-scoped (Director, Company Accountant, Content Creator) hold a
 * deliberately global grant; the three unit roles are bound to one unit
 * unless a test says otherwise.
 */
export function snapshotFor(
  roleKey: SystemRoleKey,
  options: { businessUnitId?: string | null; revoked?: boolean } = {},
): AuthorizationSnapshot {
  const seed = roleDefinitionSeeds.find((entry) => entry.key === roleKey)!;
  const unitBound = seed.permissions.some(
    (entry) => entry.scope === "assignedBusinessUnits",
  );
  return {
    user: { id: roleUsers[roleKey].id, status: "active", authzVersion: 1 },
    grants: options.revoked
      ? []
      : [
          {
            id: nextId("9"),
            roleKey,
            businessUnitId:
              options.businessUnitId === undefined
                ? unitBound
                  ? unitId
                  : null
                : options.businessUnitId,
            status: "active",
            expiresAt: null,
          },
        ],
    roles: [
      {
        key: roleKey,
        active: true,
        permissions: seed.permissions.map(({ permission, scope }) => ({
          permission,
          scope,
        })),
      },
    ],
  };
}

/** A ToolAuth that judges every call with the real evaluator against one snapshot. */
export function authFor(
  snapshot: AuthorizationSnapshot,
  now = occurredAt,
): ToolAuth {
  const session = {
    userId: snapshot.user.id,
    status: snapshot.user.status,
    authzVersion: snapshot.user.authzVersion,
  };
  const requirePermission = async (
    permission: Permission,
    options: PermissionTarget & { requestId?: string } = {},
  ): Promise<AccessContext> => {
    const decision = evaluatePermission({
      session,
      snapshot,
      permission,
      target: options,
      requestId: options.requestId ?? "req",
      now,
    });
    if (!decision.allowed) throw new ContentAccessDeniedError(decision.code);
    return decision.context;
  };
  return {
    requirePermission,
    async requireListAccess(permission) {
      const coverage = grantCoverageForPermission(snapshot, permission, now);
      const covered = coverage.global ? [] : coverage.businessUnitIds;
      const context = await requirePermission(
        permission,
        covered.length > 0 ? { businessUnitIds: covered } : {},
      );
      const effective = context.permissions[0];
      return {
        context,
        scope:
          effective?.scope === "all"
            ? { kind: "all" }
            : effective?.scope === "assignedBusinessUnits"
              ? {
                  kind: "businessUnits",
                  businessUnitIds: effective.businessUnitIds,
                }
              : { kind: "own", userId: context.userId },
      };
    },
    async coverages(permissions) {
      return Object.fromEntries(
        permissions.map((permission) => [
          permission,
          grantCoverageForPermission(snapshot, permission, now),
        ]),
      ) as never;
    },
  };
}

export class FakeUserDirectory implements UserDirectory {
  users: UserSummary[] = Object.entries(roleUsers).map(([roleKey, user]) => ({
    id: user.id,
    displayName: user.displayName,
    email: `${roleKey.toLowerCase()}@example.test`,
    roleKeys: [roleKey],
  }));

  async findActiveUsers(userIds: readonly string[]) {
    return new Map(
      this.users
        .filter((user) => userIds.includes(user.id))
        .map((user) => [user.id, user]),
    );
  }

  async listActiveUsersByRole(roleKey: SystemRoleKey) {
    return this.users.filter((user) => user.roleKeys.includes(roleKey));
  }

  async listActiveUsers() {
    return [...this.users];
  }
}

export class FakeTaskStore implements TaskStore {
  tasks = new Map<string, TaskRecordDto>();
  insertCalls = 0;

  async insert(record: NewTaskRecord) {
    this.insertCalls += 1;
    if (record.source.kind === "proposal") {
      const source = record.source;
      const existing = [...this.tasks.values()].find(
        (task) =>
          task.source.kind === "proposal" &&
          task.source.proposalId === source.proposalId &&
          task.source.itemIndex === source.itemIndex,
      );
      if (existing) return { task: existing, created: false };
    }
    const task: TaskRecordDto = {
      id: nextId("7"),
      title: record.title,
      note: record.note,
      status: "open",
      priority: record.priority,
      orderId: record.orderId,
      orderCode: record.orderCode,
      stage: record.stage,
      ownerRole: record.ownerRole,
      assigneeUserId: record.assigneeUserId,
      businessUnitIds: record.businessUnitIds,
      dueAt: record.dueAt,
      dependsOnTaskIds: record.dependsOnTaskIds,
      source: record.source,
      completedAt: null,
      completedBy: null,
      cancelledAt: null,
      cancelReason: null,
      createdBy: record.createdBy,
      updatedBy: record.createdBy,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: 0,
    };
    this.tasks.set(task.id, task);
    return { task, created: true };
  }

  async findById(taskId: string) {
    return this.tasks.get(taskId) ?? null;
  }

  async findByIds(taskIds: readonly string[]) {
    return taskIds.flatMap((id) => {
      const task = this.tasks.get(id);
      return task ? [task] : [];
    });
  }

  async list(filter: TaskListFilter) {
    return [...this.tasks.values()].filter((task) => {
      if (filter.scope.kind === "businessUnits") {
        const inUnit = task.businessUnitIds.some(
          (id) =>
            filter.scope.kind === "businessUnits" &&
            filter.scope.businessUnitIds.includes(id),
        );
        const participant =
          task.assigneeUserId === filter.scope.userId ||
          task.createdBy === filter.scope.userId;
        if (!inUnit && !participant) return false;
      } else if (filter.scope.kind === "own") {
        if (
          task.assigneeUserId !== filter.scope.userId &&
          task.createdBy !== filter.scope.userId
        ) {
          return false;
        }
      }
      if (filter.status && task.status !== filter.status) return false;
      if (filter.orderId && task.orderId !== filter.orderId) return false;
      if (
        filter.dueBefore &&
        (!task.dueAt || task.dueAt > filter.dueBefore || task.status !== "open")
      ) {
        return false;
      }
      return true;
    });
  }

  async listOpenDue(dueBefore: Date, limit: number) {
    return [...this.tasks.values()]
      .filter(
        (task) =>
          task.status === "open" &&
          task.dueAt !== null &&
          task.dueAt <= dueBefore,
      )
      .slice(0, limit);
  }

  async update(input: {
    taskId: string;
    expectedRevision: number;
    fields: TaskFieldsWrite;
    updatedBy: string;
  }) {
    const task = this.tasks.get(input.taskId);
    if (!task || task.revision !== input.expectedRevision) return null;
    const updated = {
      ...task,
      ...input.fields,
      updatedBy: input.updatedBy,
      revision: task.revision + 1,
    };
    this.tasks.set(task.id, updated);
    return updated;
  }

  async setStatus(input: {
    taskId: string;
    expectedRevision: number;
    status: TaskStatus;
    reason: string | null;
    actorId: string;
    at: Date;
  }) {
    const task = this.tasks.get(input.taskId);
    if (!task || task.revision !== input.expectedRevision) return null;
    const updated: TaskRecordDto = {
      ...task,
      status: input.status,
      completedAt: input.status === "done" ? input.at : null,
      completedBy: input.status === "done" ? input.actorId : null,
      cancelledAt: input.status === "cancelled" ? input.at : task.cancelledAt,
      cancelReason:
        input.status === "cancelled" ? input.reason : task.cancelReason,
      revision: task.revision + 1,
    };
    this.tasks.set(task.id, updated);
    return updated;
  }

  async setDependencies(input: {
    taskId: string;
    dependsOnTaskIds: readonly string[];
  }) {
    const task = this.tasks.get(input.taskId);
    if (task)
      this.tasks.set(task.id, {
        ...task,
        dependsOnTaskIds: input.dependsOnTaskIds,
      });
  }
}

export class FakeProposalStore implements ProposalStore {
  proposals = new Map<string, AssistantProposalDto>();

  async insert(record: NewProposalRecord) {
    const proposal: AssistantProposalDto = {
      ...record,
      id: nextId("8"),
      status: "proposed",
      decidedByUserId: null,
      decidedAt: null,
      decisionReason: null,
      appliedTaskIds: [],
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: 0,
    };
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  async findById(proposalId: string) {
    return this.proposals.get(proposalId) ?? null;
  }

  async listPending(filter: {
    businessUnitIds?: readonly string[] | null;
    proposedByUserId?: string;
  }) {
    return [...this.proposals.values()].filter(
      (proposal) =>
        proposal.status === "proposed" &&
        (!filter.proposedByUserId ||
          proposal.proposedByUserId === filter.proposedByUserId) &&
        (!filter.businessUnitIds ||
          proposal.businessUnitIds.some((id) =>
            filter.businessUnitIds!.includes(id),
          )),
    );
  }

  async decide(input: {
    proposalId: string;
    expectedRevision: number;
    status: "approved" | "rejected" | "expired";
    decidedByUserId: string;
    decidedAt: Date;
    decisionReason: string | null;
    appliedTaskIds: readonly string[];
  }) {
    const proposal = this.proposals.get(input.proposalId);
    if (
      !proposal ||
      proposal.status !== "proposed" ||
      proposal.revision !== input.expectedRevision
    ) {
      return null;
    }
    const decided: AssistantProposalDto = {
      ...proposal,
      status: input.status,
      decidedByUserId: input.decidedByUserId,
      decidedAt: input.decidedAt,
      decisionReason: input.decisionReason,
      appliedTaskIds: input.appliedTaskIds,
      revision: proposal.revision + 1,
    };
    this.proposals.set(proposal.id, decided);
    return decided;
  }
}

export class FakeApprovalRepository implements ApprovalRepository {
  requests: ApprovalRequest[] = [];

  seed(partial: Partial<ApprovalRequest>): ApprovalRequest {
    const request: ApprovalRequest = {
      id: partial.id ?? nextId("6"),
      subject: partial.subject ?? "order.confirm",
      resourceType: partial.resourceType ?? "salesOrder",
      resourceId: partial.resourceId ?? "000000000000000000000001",
      businessUnitIds: partial.businessUnitIds ?? [unitId],
      status: partial.status ?? "pending",
      requestedByUserId:
        partial.requestedByUserId ?? roleUsers.COMPANY_ACCOUNTANT.id,
      requestedAt: partial.requestedAt ?? occurredAt,
      summary: partial.summary ?? "summary",
      decidedByUserId: partial.decidedByUserId ?? null,
      decidedAt: partial.decidedAt ?? null,
      decisionReason: partial.decisionReason ?? null,
      expectedRevision: partial.expectedRevision ?? 0,
    };
    this.requests.push(request);
    return request;
  }

  async create(input: Parameters<ApprovalRepository["create"]>[0]) {
    return this.seed({ ...input, status: "pending" });
  }

  async findById(requestId: string) {
    return this.requests.find((request) => request.id === requestId) ?? null;
  }

  async findPendingForResource(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ) {
    return (
      this.requests.find(
        (r) =>
          r.resourceType === resourceType &&
          r.resourceId === resourceId &&
          r.subject === subject &&
          r.status === "pending",
      ) ?? null
    );
  }

  async findApprovedForResource(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ) {
    return (
      this.requests.find(
        (r) =>
          r.resourceType === resourceType &&
          r.resourceId === resourceId &&
          r.subject === subject &&
          r.status === "approved",
      ) ?? null
    );
  }

  async listPending(businessUnitIds: readonly string[] | null) {
    return this.requests.filter(
      (r) =>
        r.status === "pending" &&
        (businessUnitIds === null ||
          r.businessUnitIds.some((id) => businessUnitIds.includes(id))),
    );
  }

  async decide(input: Parameters<ApprovalRepository["decide"]>[0]) {
    const request = this.requests.find(
      (r) => r.id === input.requestId && r.status === "pending",
    );
    if (!request) throw new Error("decided");
    Object.assign(request, {
      status: input.decision,
      decidedByUserId: input.decidedByUserId,
      decidedAt: input.decidedAt,
      decisionReason: input.decisionReason,
    });
    return request;
  }
}
