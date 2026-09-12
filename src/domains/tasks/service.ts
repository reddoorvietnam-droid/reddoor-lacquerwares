import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import type { UserDirectory } from "@/domains/identity/user-directory";
import type { Permission } from "@/domains/identity/permissions";
import type { OrderStore } from "@/domains/orders/contracts";
import { isTerminalStage } from "@/domains/orders/workflow";
import {
  createTaskInputSchema,
  decideTaskExtensionInputSchema,
  requestTaskExtensionInputSchema,
  setTaskStatusInputSchema,
  TaskCommandError,
  updateTaskInputSchema,
  type NewTaskRecord,
  type TaskListFilter,
  type TaskRecordDto,
  type TaskStore,
} from "@/domains/tasks/contracts";
import { assertStatusTransition, businessDayEnd } from "@/domains/tasks/policy";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";

/**
 * The business units a person's live grants attach them to. A task without
 * an order has no units of its own, so it is stamped with the units of the
 * person expected to do it: a unit-bound grant reaches a record only inside
 * its units, and work handed to someone must be reachable by them.
 */
export interface UserBusinessUnits {
  unitsFor(userId: string): Promise<readonly string[]>;
}

export type TaskCommandServiceDependencies = {
  store: TaskStore;
  orderStore: OrderStore;
  userDirectory: UserDirectory;
  userUnits: UserBusinessUnits;
  auditRepository: AuditRepository;
  timeZone: string;
  now?: () => Date;
};

export const TASK_RESOURCE_TYPE = "task";

/**
 * The work-item command service. The caller's guard judges the permission
 * against the task's business units and participants; this service
 * re-asserts it from the guarded context, resolves the order and assignee a
 * task points at, converts a calendar day into the business-day deadline,
 * and audits every change. Task titles and notes are free text written by
 * staff and are stored as given; nothing in them is interpreted.
 */
export class TaskCommandService {
  private readonly dependencies: TaskCommandServiceDependencies;

  constructor(dependencies: TaskCommandServiceDependencies) {
    this.dependencies = dependencies;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private assertHolds(context: AccessContext, permission: Permission): void {
    const holds = context.permissions.some(
      (candidate) => candidate.permission === permission,
    );
    if (!holds || context.userStatus !== "active") {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
  }

  private async resolveAssignee(
    assigneeUserId: string | null,
  ): Promise<string | null> {
    if (!assigneeUserId) return null;
    const users = await this.dependencies.userDirectory.findActiveUsers([
      assigneeUserId,
    ]);
    if (!users.has(assigneeUserId)) {
      throw new TaskCommandError(
        "ASSIGNEE_NOT_FOUND",
        "The assignee is not an active staff account.",
      );
    }
    return assigneeUserId;
  }

  /** The raw task for guard targeting; never returned to a renderer. */
  async findForAuthorization(taskId: string): Promise<TaskRecordDto | null> {
    return this.dependencies.store.findById(taskId);
  }

  /** The raw order for guard targeting before `create`. */
  async findOrderForAuthorization(orderId: string) {
    return this.dependencies.orderStore.findById(orderId);
  }

  /**
   * `options.fallbackBusinessUnitIds` are the caller's own granted units,
   * resolved on the server from the actor's grants (never from the form):
   * a personal task without an order is stamped with them so a unit-bound
   * grant reaches it later, exactly as it reaches the unit's orders.
   */
  async create(
    context: AccessContext,
    rawInput: unknown,
    options: { fallbackBusinessUnitIds?: readonly string[] } = {},
  ): Promise<TaskRecordDto> {
    this.assertHolds(context, "tasks.create");
    const input = createTaskInputSchema.parse(rawInput);

    let orderId: string | null = null;
    let orderCode: string | null = null;
    let businessUnitIds: readonly string[] =
      options.fallbackBusinessUnitIds ?? [];
    if (input.orderId) {
      const order = await this.dependencies.orderStore.findById(input.orderId);
      if (!order) {
        throw new TaskCommandError("ORDER_NOT_FOUND", "Order not found.");
      }
      if (isTerminalStage(order.stage)) {
        throw new TaskCommandError(
          "ORDER_CLOSED",
          "A closed or cancelled order takes no new work.",
        );
      }
      orderId = order.id;
      orderCode = order.orderCode;
      businessUnitIds = order.businessUnitIds;
    }

    // Assigning to someone else is a separate grant; assigning to oneself
    // (or leaving it open) is part of creating.
    if (input.assigneeUserId && input.assigneeUserId !== context.userId) {
      this.assertHolds(context, "tasks.assign");
    }
    const assigneeUserId = await this.resolveAssignee(
      input.assigneeUserId ?? context.userId,
    );

    // Work handed to someone else without an order takes that person's
    // units, so their own grant reaches it; work kept for oneself keeps the
    // creator's, as before.
    if (!orderId && assigneeUserId && assigneeUserId !== context.userId) {
      businessUnitIds =
        await this.dependencies.userUnits.unitsFor(assigneeUserId);
    }

    const record: NewTaskRecord = {
      title: input.title,
      note: input.note,
      priority: input.priority,
      orderId,
      orderCode,
      stage: null,
      ownerRole: null,
      assigneeUserId,
      businessUnitIds,
      dueAt: input.dueDate
        ? businessDayEnd(input.dueDate, this.dependencies.timeZone)
        : null,
      dependsOnTaskIds: [],
      source: { kind: "manual" },
      createdBy: context.userId,
    };
    const { task } = await this.dependencies.store.insert(record);

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "task.created",
      resourceType: TASK_RESOURCE_TYPE,
      resourceId: task.id,
      businessUnitIds: task.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        orderCode: task.orderCode,
        assigneeUserId: task.assigneeUserId,
        dueAt: task.dueAt?.toISOString() ?? null,
      },
      occurredAt: this.now(),
    });

    return task;
  }

  /**
   * Creates the tasks of an approved plan. Each item lands in its own slot
   * (proposalId, itemIndex), so a repeat call returns the same tasks instead
   * of doubling them; dependencies are wired once every slot exists.
   */
  async applyPlanItems(
    context: AccessContext,
    input: {
      proposalId: string;
      order: {
        id: string;
        orderCode: string;
        businessUnitIds: readonly string[];
      } | null;
      /** Units stamped on tasks without an order (the proposal's own units). */
      fallbackBusinessUnitIds?: readonly string[];
      items: readonly {
        index: number;
        title: string;
        note: string | null;
        stage: NewTaskRecord["stage"];
        ownerRole: NewTaskRecord["ownerRole"];
        assigneeUserId: string | null;
        dueDate: string | null;
        dependsOn: readonly number[];
        priority: NewTaskRecord["priority"];
      }[];
    },
  ): Promise<{ tasks: TaskRecordDto[]; createdCount: number }> {
    this.assertHolds(context, "tasks.create");

    const assigneeIds = [
      ...new Set(
        input.items.flatMap((item) =>
          item.assigneeUserId ? [item.assigneeUserId] : [],
        ),
      ),
    ];
    const activeUsers =
      await this.dependencies.userDirectory.findActiveUsers(assigneeIds);

    const created: TaskRecordDto[] = [];
    let createdCount = 0;
    for (const item of input.items) {
      const { task, created: isNew } = await this.dependencies.store.insert({
        title: item.title,
        note: item.note,
        priority: item.priority,
        orderId: input.order?.id ?? null,
        orderCode: input.order?.orderCode ?? null,
        stage: item.stage,
        ownerRole: item.ownerRole,
        // An assignee that stopped being active between proposal and
        // approval is dropped rather than failing the whole plan.
        assigneeUserId:
          item.assigneeUserId && activeUsers.has(item.assigneeUserId)
            ? item.assigneeUserId
            : null,
        businessUnitIds:
          input.order?.businessUnitIds ?? input.fallbackBusinessUnitIds ?? [],
        dueAt: item.dueDate
          ? businessDayEnd(item.dueDate, this.dependencies.timeZone)
          : null,
        dependsOnTaskIds: [],
        source: {
          kind: "proposal",
          proposalId: input.proposalId,
          itemIndex: item.index,
        },
        createdBy: context.userId,
      });
      created.push(task);
      if (isNew) createdCount += 1;
    }

    const idByIndex = new Map(
      input.items.map((item, position) => [item.index, created[position]!.id]),
    );
    for (const [position, item] of input.items.entries()) {
      const dependsOnTaskIds = item.dependsOn
        .map((index) => idByIndex.get(index))
        .filter((id): id is string => Boolean(id));
      const task = created[position]!;
      if (
        dependsOnTaskIds.length > 0 &&
        dependsOnTaskIds.join(",") !== task.dependsOnTaskIds.join(",")
      ) {
        await this.dependencies.store.setDependencies({
          taskId: task.id,
          dependsOnTaskIds,
        });
      }
    }

    if (createdCount > 0) {
      await this.dependencies.auditRepository.append({
        actor: { type: "user", userId: context.userId },
        action: "task.planApplied",
        resourceType: TASK_RESOURCE_TYPE,
        resourceId: input.proposalId,
        businessUnitIds: input.order?.businessUnitIds ?? [],
        requestId: context.requestId,
        metadata: {
          proposalId: input.proposalId,
          orderCode: input.order?.orderCode ?? null,
          createdCount,
          taskIds: created.map((task) => task.id),
        },
        occurredAt: this.now(),
      });
    }

    return {
      tasks: await this.dependencies.store.findByIds(created.map((t) => t.id)),
      createdCount,
    };
  }

  async update(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<TaskRecordDto> {
    this.assertHolds(context, "tasks.update");
    const input = updateTaskInputSchema.parse(rawInput);

    const existing = await this.dependencies.store.findById(input.taskId);
    if (!existing) {
      throw new TaskCommandError("NOT_FOUND", "Task not found.");
    }
    if (
      input.assigneeUserId !== existing.assigneeUserId &&
      input.assigneeUserId !== context.userId
    ) {
      this.assertHolds(context, "tasks.assign");
    }
    const assigneeUserId = await this.resolveAssignee(input.assigneeUserId);

    // Moving unit-less work to another person moves its units with it, for
    // the same reason `create` stamps them.
    const businessUnitIds =
      !existing.orderId &&
      assigneeUserId &&
      assigneeUserId !== existing.assigneeUserId &&
      assigneeUserId !== context.userId
        ? await this.dependencies.userUnits.unitsFor(assigneeUserId)
        : null;

    const updated = await this.dependencies.store.update({
      taskId: existing.id,
      expectedRevision: input.expectedRevision,
      fields: {
        title: input.title,
        note: input.note,
        priority: input.priority,
        assigneeUserId,
        dueAt: input.dueDate
          ? businessDayEnd(input.dueDate, this.dependencies.timeZone)
          : null,
        ...(businessUnitIds ? { businessUnitIds } : {}),
      },
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new TaskCommandError(
        "REVISION_CONFLICT",
        "The task changed while this form was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "task.updated",
      resourceType: TASK_RESOURCE_TYPE,
      resourceId: existing.id,
      businessUnitIds: existing.businessUnitIds,
      requestId: context.requestId,
      changes: {
        before: {
          title: existing.title,
          dueAt: existing.dueAt?.toISOString() ?? null,
          assigneeUserId: existing.assigneeUserId,
        },
        after: {
          title: updated.title,
          dueAt: updated.dueAt?.toISOString() ?? null,
          assigneeUserId: updated.assigneeUserId,
        },
      },
      occurredAt: this.now(),
    });

    return updated;
  }

  async setStatus(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<TaskRecordDto> {
    this.assertHolds(context, "tasks.update");
    const input = setTaskStatusInputSchema.parse(rawInput);

    const existing = await this.dependencies.store.findById(input.taskId);
    if (!existing) {
      throw new TaskCommandError("NOT_FOUND", "Task not found.");
    }
    assertStatusTransition(existing.status, input.status, input.reason);

    const at = this.now();
    const updated = await this.dependencies.store.setStatus({
      taskId: existing.id,
      expectedRevision: input.expectedRevision,
      status: input.status,
      reason: input.reason,
      actorId: context.userId,
      at,
    });
    if (!updated) {
      throw new TaskCommandError(
        "REVISION_CONFLICT",
        "The task changed while this action was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action:
        input.status === "done"
          ? "task.completed"
          : input.status === "cancelled"
            ? "task.cancelled"
            : "task.reopened",
      resourceType: TASK_RESOURCE_TYPE,
      resourceId: existing.id,
      businessUnitIds: existing.businessUnitIds,
      requestId: context.requestId,
      ...(input.reason ? { reason: input.reason } : {}),
      changes: { before: existing.status, after: updated.status },
      occurredAt: at,
    });

    return updated;
  }

  /**
   * The assignee asks for more time. Only the person doing the work may ask,
   * only while it is open, and only for a day that is still ahead — a plea
   * for a deadline already gone would leave the task overdue on approval.
   */
  async requestExtension(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<TaskRecordDto> {
    this.assertHolds(context, "tasks.update");
    const input = requestTaskExtensionInputSchema.parse(rawInput);

    const existing = await this.dependencies.store.findById(input.taskId);
    if (!existing) {
      throw new TaskCommandError("NOT_FOUND", "Task not found.");
    }
    if (existing.assigneeUserId !== context.userId) {
      throw new TaskCommandError(
        "NOT_ASSIGNEE",
        "Only the assignee may ask for more time.",
      );
    }
    if (existing.status !== "open") {
      throw new TaskCommandError(
        "INVALID_TRANSITION",
        "The task is no longer open.",
      );
    }
    if (existing.extensionRequest) {
      throw new TaskCommandError(
        "EXTENSION_PENDING",
        "A request is already waiting for an answer.",
      );
    }

    const at = this.now();
    const requestedDueAt = businessDayEnd(
      input.requestedDueDate,
      this.dependencies.timeZone,
    );
    if (
      requestedDueAt.getTime() <= at.getTime() ||
      requestedDueAt.getTime() === (existing.dueAt?.getTime() ?? 0)
    ) {
      throw new TaskCommandError(
        "INVALID_DUE_DATE",
        "The new deadline must be a future day other than the current one.",
      );
    }

    const updated = await this.dependencies.store.requestExtension({
      taskId: existing.id,
      expectedRevision: input.expectedRevision,
      request: {
        requestedDueAt,
        reason: input.reason,
        requestedBy: context.userId,
        requestedAt: at,
      },
    });
    if (!updated) {
      throw new TaskCommandError(
        "REVISION_CONFLICT",
        "The task changed while this form was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "task.extensionRequested",
      resourceType: TASK_RESOURCE_TYPE,
      resourceId: existing.id,
      businessUnitIds: existing.businessUnitIds,
      requestId: context.requestId,
      reason: input.reason,
      metadata: {
        currentDueAt: existing.dueAt?.toISOString() ?? null,
        requestedDueAt: requestedDueAt.toISOString(),
      },
      occurredAt: at,
    });

    return updated;
  }

  /**
   * The person who hands out work answers the plea. An approval moves the
   * deadline to the day that was asked for; a rejection leaves it where it
   * was and the reminder schedule with it.
   */
  async decideExtension(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<{
    task: TaskRecordDto;
    requestedDueAt: Date;
    requestedBy: string;
  }> {
    this.assertHolds(context, "tasks.assign");
    const input = decideTaskExtensionInputSchema.parse(rawInput);

    const existing = await this.dependencies.store.findById(input.taskId);
    if (!existing) {
      throw new TaskCommandError("NOT_FOUND", "Task not found.");
    }
    const request = existing.extensionRequest;
    if (!request) {
      throw new TaskCommandError(
        "EXTENSION_NOT_FOUND",
        "No extension request is waiting on this task.",
      );
    }

    const at = this.now();
    const updated = await this.dependencies.store.decideExtension({
      taskId: existing.id,
      expectedRevision: input.expectedRevision,
      decision: {
        outcome: input.outcome,
        requestedDueAt: request.requestedDueAt,
        note: input.note,
        decidedBy: context.userId,
        decidedAt: at,
      },
      dueAt: input.outcome === "approved" ? request.requestedDueAt : null,
      decidedBy: context.userId,
    });
    if (!updated) {
      throw new TaskCommandError(
        "REVISION_CONFLICT",
        "The task changed while this action was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action:
        input.outcome === "approved"
          ? "task.extensionApproved"
          : "task.extensionRejected",
      resourceType: TASK_RESOURCE_TYPE,
      resourceId: existing.id,
      businessUnitIds: existing.businessUnitIds,
      requestId: context.requestId,
      ...(input.note ? { reason: input.note } : {}),
      changes: {
        before: { dueAt: existing.dueAt?.toISOString() ?? null },
        after: { dueAt: updated.dueAt?.toISOString() ?? null },
      },
      metadata: { requestedBy: request.requestedBy },
      occurredAt: at,
    });

    return {
      task: updated,
      requestedDueAt: request.requestedDueAt,
      requestedBy: request.requestedBy,
    };
  }

  async list(filter: TaskListFilter): Promise<TaskRecordDto[]> {
    return this.dependencies.store.list(filter);
  }

  /** The assigner's queue: tasks whose assignee is waiting for an answer. */
  async listPendingExtensions(limit = 50): Promise<TaskRecordDto[]> {
    return this.dependencies.store.listPendingExtensions(limit);
  }

  async findById(taskId: string): Promise<TaskRecordDto | null> {
    return this.dependencies.store.findById(taskId);
  }
}
