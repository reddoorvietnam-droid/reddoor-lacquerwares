import "server-only";

import {
  AssistantError,
  decideProposalInputSchema,
  type AssistantProposalDto,
  type PlanItemDraft,
  type ProposalStore,
} from "@/domains/assistant/contracts";
import {
  buildOrderPlan,
  remainingStages,
  validatePlanItems,
  type RoleHolder,
} from "@/domains/assistant/planning";
import type { AuditRepository } from "@/domains/audit/contracts";
import type { Permission } from "@/domains/identity/permissions";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import type { UserDirectory } from "@/domains/identity/user-directory";
import type { OrderRecordDto, OrderStore } from "@/domains/orders/contracts";
import {
  isTerminalStage,
  orderStageDefinitions,
} from "@/domains/orders/workflow";
import type { TaskRecordDto } from "@/domains/tasks/contracts";
import { daysBetween, formatBusinessDay } from "@/domains/tasks/policy";
import type { TaskCommandService } from "@/domains/tasks/service";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";

export type AssistantProposalServiceDependencies = {
  store: ProposalStore;
  orderStore: OrderStore;
  taskService: TaskCommandService;
  userDirectory: UserDirectory;
  auditRepository: AuditRepository;
  timeZone: string;
  now?: () => Date;
};

export const PROPOSAL_RESOURCE_TYPE = "assistantProposal";

/**
 * Proposals: what the assistant may write, and how a person turns one into
 * work. Creating a proposal needs `tasks.create`; releasing an order plan
 * needs `tasks.approvePlan` on the order's units; releasing ad-hoc tasks
 * needs `tasks.create`. Approval re-reads the order, refuses a plan whose
 * order moved on (SOURCE_CHANGED) or whose dates have passed
 * (INVALID_PLAN), and applies the items through the task service, which is
 * idempotent per slot — so two approvers, a retry, or a double click never
 * double the work.
 */
export class AssistantProposalService {
  private readonly dependencies: AssistantProposalServiceDependencies;

  constructor(dependencies: AssistantProposalServiceDependencies) {
    this.dependencies = dependencies;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private today(): string {
    return formatBusinessDay(this.now(), this.dependencies.timeZone);
  }

  private assertHolds(context: AccessContext, permission: Permission): void {
    const holds = context.permissions.some(
      (candidate) => candidate.permission === permission,
    );
    if (!holds || context.userStatus !== "active") {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
  }

  async findById(proposalId: string): Promise<AssistantProposalDto | null> {
    return this.dependencies.store.findById(proposalId);
  }

  /** The raw proposal for guard targeting; never returned to a renderer. */
  async findForAuthorization(
    proposalId: string,
  ): Promise<AssistantProposalDto | null> {
    return this.dependencies.store.findById(proposalId);
  }

  async listPending(filter: {
    businessUnitIds?: readonly string[] | null;
    proposedByUserId?: string;
    limit?: number;
  }): Promise<AssistantProposalDto[]> {
    return this.dependencies.store.listPending(filter);
  }

  async proposeOrderPlan(
    context: AccessContext,
    input: {
      order: OrderRecordDto;
      locale: "vi" | "en";
      overrides: {
        targetReadyDate: string | null;
        stageDurations: Partial<Record<OrderRecordDto["stage"], number>>;
        stageNotes: Partial<Record<OrderRecordDto["stage"], string>>;
      };
    },
  ): Promise<AssistantProposalDto> {
    this.assertHolds(context, "tasks.create");
    const order = input.order;
    if (isTerminalStage(order.stage)) {
      throw new AssistantError(
        "ORDER_CLOSED",
        "A closed or cancelled order has nothing left to plan.",
      );
    }
    if (
      input.overrides.targetReadyDate &&
      daysBetween(this.today(), input.overrides.targetReadyDate) < 0
    ) {
      throw new AssistantError(
        "INVALID_PLAN",
        "The target ready date is in the past.",
        ["targetReadyDate is before today"],
      );
    }

    const roles = new Set(
      remainingStages(order.stage).map(
        (stage) => orderStageDefinitions[stage].ownerRole,
      ),
    );
    const roleHolders = new Map<SystemRoleKey, RoleHolder[]>();
    for (const role of roles) {
      const holders =
        await this.dependencies.userDirectory.listActiveUsersByRole(role);
      roleHolders.set(
        role,
        holders.map((user) => ({ id: user.id, displayName: user.displayName })),
      );
    }

    const built = buildOrderPlan({
      order: {
        id: order.id,
        orderCode: order.orderCode,
        stage: order.stage,
        expectedReadyAt: order.expectedReadyAt,
        revision: order.revision,
      },
      today: this.today(),
      timeZone: this.dependencies.timeZone,
      roleHolders,
      overrides: input.overrides,
      locale: input.locale,
    });
    const validation = validatePlanItems(built.items, {
      today: this.today(),
      orderStage: order.stage,
    });
    if (!validation.ok) {
      throw new AssistantError(
        "INVALID_PLAN",
        "The plan is not valid.",
        validation.errors,
      );
    }

    const proposal = await this.dependencies.store.insert({
      kind: "orderPlan",
      orderId: order.id,
      orderCode: order.orderCode,
      orderRevision: order.revision,
      orderStage: order.stage,
      businessUnitIds: order.businessUnitIds,
      items: built.items,
      assumptions: built.assumptions,
      summary: `${order.orderCode} · ${order.customerName} · ${built.items.length} ${input.locale === "vi" ? "việc" : "tasks"}`,
      proposedByUserId: context.userId,
      proposedAt: this.now(),
    });

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "assistant.proposalCreated",
      resourceType: PROPOSAL_RESOURCE_TYPE,
      resourceId: proposal.id,
      businessUnitIds: order.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        kind: "orderPlan",
        orderCode: order.orderCode,
        orderRevision: order.revision,
        itemCount: built.items.length,
      },
      occurredAt: this.now(),
    });

    return proposal;
  }

  async proposeTasks(
    context: AccessContext,
    input: {
      locale: "vi" | "en";
      /** The proposer's granted units, for drafts without an order. */
      fallbackBusinessUnitIds?: readonly string[];
      drafts: readonly {
        title: string;
        note: string | null;
        dueDate: string | null;
        order: OrderRecordDto | null;
        assigneeUserId: string | null;
        priority: PlanItemDraft["priority"];
      }[];
    },
  ): Promise<AssistantProposalDto> {
    this.assertHolds(context, "tasks.create");
    const assumptions: string[] = [];
    const assigneeIds = [
      ...new Set(
        input.drafts.flatMap((draft) =>
          draft.assigneeUserId ? [draft.assigneeUserId] : [],
        ),
      ),
    ];
    const activeUsers =
      await this.dependencies.userDirectory.findActiveUsers(assigneeIds);
    for (const id of assigneeIds) {
      if (!activeUsers.has(id)) {
        throw new AssistantError(
          "INVALID_PLAN",
          "An assignee is not an active staff account.",
          [`assignee ${id} is not active`],
        );
      }
    }

    const orders = input.drafts.flatMap((draft) =>
      draft.order ? [draft.order] : [],
    );
    const distinctOrders = [
      ...new Map(orders.map((order) => [order.id, order])).values(),
    ];
    for (const order of distinctOrders) {
      if (isTerminalStage(order.stage)) {
        throw new AssistantError(
          "ORDER_CLOSED",
          `Order ${order.orderCode} is closed or cancelled.`,
        );
      }
    }
    // One order per proposal keeps the approval guard exact; mixed drafts
    // are split by the caller.
    if (distinctOrders.length > 1) {
      throw new AssistantError(
        "INVALID_PLAN",
        "One proposal may reference one order.",
        ["drafts point at more than one order"],
      );
    }
    const order = distinctOrders[0] ?? null;

    const items: PlanItemDraft[] = input.drafts.map((draft, index) => ({
      index,
      title: draft.title,
      note: draft.note,
      stage: null,
      ownerRole: null,
      assigneeUserId: draft.assigneeUserId,
      dueDate: draft.dueDate,
      dependsOn: [],
      priority: draft.priority,
    }));
    for (const item of items) {
      if (!item.dueDate) {
        assumptions.push(
          input.locale === "vi"
            ? `"${item.title}" chưa có hạn; sẽ không được nhắc tự động.`
            : `"${item.title}" has no deadline; it will not be reminded automatically.`,
        );
      }
    }
    const validation = validatePlanItems(items, {
      today: this.today(),
      orderStage: null,
    });
    if (!validation.ok) {
      throw new AssistantError(
        "INVALID_PLAN",
        "The tasks are not valid.",
        validation.errors,
      );
    }

    const proposal = await this.dependencies.store.insert({
      kind: "tasks",
      orderId: order?.id ?? null,
      orderCode: order?.orderCode ?? null,
      orderRevision: order?.revision ?? null,
      orderStage: order?.stage ?? null,
      businessUnitIds:
        order?.businessUnitIds ?? input.fallbackBusinessUnitIds ?? [],
      items,
      assumptions,
      summary:
        items.length === 1
          ? items[0]!.title
          : `${items.length} ${input.locale === "vi" ? "việc" : "tasks"}: ${items[0]!.title}…`,
      proposedByUserId: context.userId,
      proposedAt: this.now(),
    });

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "assistant.proposalCreated",
      resourceType: PROPOSAL_RESOURCE_TYPE,
      resourceId: proposal.id,
      businessUnitIds: proposal.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        kind: "tasks",
        itemCount: items.length,
        orderCode: order?.orderCode ?? null,
      },
      occurredAt: this.now(),
    });

    return proposal;
  }

  /**
   * Approves or rejects. The caller's guard already judged the permission
   * against the proposal's order and units; this re-asserts it, re-reads
   * the order for staleness, and applies the items idempotently.
   */
  async decide(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<{ proposal: AssistantProposalDto; tasks: TaskRecordDto[] }> {
    const input = decideProposalInputSchema.parse(rawInput);
    const proposal = await this.dependencies.store.findById(input.proposalId);
    if (!proposal) {
      throw new AssistantError("NOT_FOUND", "Proposal not found.");
    }
    if (proposal.status !== "proposed") {
      throw new AssistantError(
        "ALREADY_DECIDED",
        "This proposal was already decided.",
      );
    }
    if (proposal.revision !== input.expectedRevision) {
      throw new AssistantError(
        "REVISION_CONFLICT",
        "The proposal changed on screen.",
      );
    }
    this.assertHolds(
      context,
      proposal.kind === "orderPlan" ? "tasks.approvePlan" : "tasks.create",
    );

    const decidedAt = this.now();

    if (input.decision === "rejected") {
      if (!input.reason) {
        throw new AssistantError(
          "INVALID_INPUT",
          "A rejection must record a reason.",
        );
      }
      const rejected = await this.dependencies.store.decide({
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        status: "rejected",
        decidedByUserId: context.userId,
        decidedAt,
        decisionReason: input.reason,
        appliedTaskIds: [],
      });
      if (!rejected) {
        throw new AssistantError(
          "ALREADY_DECIDED",
          "This proposal was already decided.",
        );
      }
      await this.dependencies.auditRepository.append({
        actor: { type: "user", userId: context.userId },
        action: "assistant.proposalRejected",
        resourceType: PROPOSAL_RESOURCE_TYPE,
        resourceId: proposal.id,
        businessUnitIds: proposal.businessUnitIds,
        requestId: context.requestId,
        reason: input.reason,
        occurredAt: decidedAt,
      });
      return { proposal: rejected, tasks: [] };
    }

    // Approval: the source must still be what the approver saw.
    let order: OrderRecordDto | null = null;
    if (proposal.orderId) {
      order = await this.dependencies.orderStore.findById(proposal.orderId);
      if (!order) {
        throw new AssistantError(
          "ORDER_NOT_FOUND",
          "The order no longer exists.",
        );
      }
      if (isTerminalStage(order.stage)) {
        await this.expire(
          context,
          proposal,
          "order closed or cancelled",
          decidedAt,
        );
        throw new AssistantError(
          "ORDER_CLOSED",
          "The order is closed or cancelled.",
        );
      }
      if (
        proposal.orderRevision !== null &&
        order.revision !== proposal.orderRevision
      ) {
        await this.expire(
          context,
          proposal,
          "order changed after the proposal",
          decidedAt,
        );
        throw new AssistantError(
          "SOURCE_CHANGED",
          "The order changed after this proposal was drafted; ask for a new plan.",
        );
      }
    }
    const validation = validatePlanItems(proposal.items, {
      today: this.today(),
      orderStage: order?.stage ?? null,
    });
    if (!validation.ok) {
      throw new AssistantError(
        "INVALID_PLAN",
        "The plan is no longer valid.",
        validation.errors,
      );
    }

    const applied = await this.dependencies.taskService.applyPlanItems(
      context,
      {
        proposalId: proposal.id,
        order: order
          ? {
              id: order.id,
              orderCode: order.orderCode,
              businessUnitIds: order.businessUnitIds,
            }
          : null,
        fallbackBusinessUnitIds: proposal.businessUnitIds,
        items: proposal.items,
      },
    );

    const approved = await this.dependencies.store.decide({
      proposalId: proposal.id,
      expectedRevision: proposal.revision,
      status: "approved",
      decidedByUserId: context.userId,
      decidedAt,
      decisionReason: input.reason,
      appliedTaskIds: applied.tasks.map((task) => task.id),
    });
    if (!approved) {
      // A concurrent approver won the decision; the tasks are the same
      // slots either way, so report the stored outcome instead of failing.
      const current = await this.dependencies.store.findById(proposal.id);
      if (current?.status === "approved") {
        return { proposal: current, tasks: applied.tasks };
      }
      throw new AssistantError(
        "ALREADY_DECIDED",
        "This proposal was already decided.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "assistant.proposalApproved",
      resourceType: PROPOSAL_RESOURCE_TYPE,
      resourceId: proposal.id,
      businessUnitIds: proposal.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        kind: proposal.kind,
        orderCode: proposal.orderCode,
        createdCount: applied.createdCount,
        taskIds: applied.tasks.map((task) => task.id),
      },
      occurredAt: decidedAt,
    });

    return { proposal: approved, tasks: applied.tasks };
  }

  private async expire(
    context: AccessContext,
    proposal: AssistantProposalDto,
    reason: string,
    at: Date,
  ): Promise<void> {
    const expired = await this.dependencies.store.decide({
      proposalId: proposal.id,
      expectedRevision: proposal.revision,
      status: "expired",
      decidedByUserId: context.userId,
      decidedAt: at,
      decisionReason: reason,
      appliedTaskIds: [],
    });
    if (expired) {
      await this.dependencies.auditRepository.append({
        actor: { type: "user", userId: context.userId },
        action: "assistant.proposalExpired",
        resourceType: PROPOSAL_RESOURCE_TYPE,
        resourceId: proposal.id,
        businessUnitIds: proposal.businessUnitIds,
        requestId: context.requestId,
        reason,
        occurredAt: at,
      });
    }
  }
}
