import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import type { UserDirectory } from "@/domains/identity/user-directory";
import type { Permission } from "@/domains/identity/permissions";
import type { OrderStore } from "@/domains/orders/contracts";
import { isTerminalStage } from "@/domains/orders/workflow";
import {
  createTaskInputSchema,
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

export type TaskCommandServiceDependencies = {
  store: TaskStore;
  orderStore: OrderStore;
  userDirectory: UserDirectory;
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

  async list(filter: TaskListFilter): Promise<TaskRecordDto[]> {
    return this.dependencies.store.list(filter);
  }

  async findById(taskId: string): Promise<TaskRecordDto | null> {
    return this.dependencies.store.findById(taskId);
  }
}
