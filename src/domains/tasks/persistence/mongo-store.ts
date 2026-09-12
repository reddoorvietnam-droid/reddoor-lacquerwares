import "server-only";

import { Types } from "mongoose";

import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import type { OrderStage } from "@/domains/orders/workflow";
import type {
  NewTaskRecord,
  TaskExtensionDecision,
  TaskExtensionRequest,
  TaskFieldsWrite,
  TaskListFilter,
  TaskListScope,
  TaskPriority,
  TaskRecordDto,
  TaskSource,
  TaskStatus,
  TaskStore,
} from "@/domains/tasks/contracts";
import { getTaskModel } from "@/domains/tasks/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

type TaskDocument = {
  _id: Types.ObjectId;
  title: string;
  note: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  orderId: Types.ObjectId | null;
  orderCode: string | null;
  stage: OrderStage | null;
  ownerRole: SystemRoleKey | null;
  assigneeUserId: Types.ObjectId | null;
  businessUnitIds: Types.ObjectId[];
  dueAt: Date | null;
  dependsOnTaskIds: Types.ObjectId[];
  source: {
    kind: "manual" | "proposal";
    proposalId?: Types.ObjectId | null;
    itemIndex?: number | null;
  };
  extensionRequest: {
    requestedDueAt: Date;
    reason: string;
    requestedBy: Types.ObjectId;
    requestedAt: Date;
  } | null;
  lastExtensionDecision: {
    outcome: "approved" | "rejected";
    requestedDueAt: Date;
    note: string | null;
    decidedBy: Types.ObjectId;
    decidedAt: Date;
  } | null;
  completedAt: Date | null;
  completedBy: Types.ObjectId | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

function sourceToDto(source: TaskDocument["source"]): TaskSource {
  if (source.kind === "proposal" && source.proposalId) {
    return {
      kind: "proposal",
      proposalId: source.proposalId.toHexString(),
      itemIndex: source.itemIndex ?? 0,
    };
  }
  return { kind: "manual" };
}

function toDto(document: TaskDocument): TaskRecordDto {
  return {
    id: document._id.toHexString(),
    title: document.title,
    note: document.note ?? null,
    status: document.status,
    priority: document.priority,
    orderId: document.orderId ? document.orderId.toHexString() : null,
    orderCode: document.orderCode ?? null,
    stage: document.stage ?? null,
    ownerRole: document.ownerRole ?? null,
    assigneeUserId: document.assigneeUserId
      ? document.assigneeUserId.toHexString()
      : null,
    businessUnitIds: document.businessUnitIds.map((id) => id.toHexString()),
    dueAt: document.dueAt ?? null,
    dependsOnTaskIds: (document.dependsOnTaskIds ?? []).map((id) =>
      id.toHexString(),
    ),
    source: sourceToDto(document.source),
    extensionRequest: document.extensionRequest
      ? {
          requestedDueAt: document.extensionRequest.requestedDueAt,
          reason: document.extensionRequest.reason,
          requestedBy: document.extensionRequest.requestedBy.toHexString(),
          requestedAt: document.extensionRequest.requestedAt,
        }
      : null,
    lastExtensionDecision: document.lastExtensionDecision
      ? {
          outcome: document.lastExtensionDecision.outcome,
          requestedDueAt: document.lastExtensionDecision.requestedDueAt,
          note: document.lastExtensionDecision.note ?? null,
          decidedBy: document.lastExtensionDecision.decidedBy.toHexString(),
          decidedAt: document.lastExtensionDecision.decidedAt,
        }
      : null,
    completedAt: document.completedAt ?? null,
    completedBy: document.completedBy
      ? document.completedBy.toHexString()
      : null,
    cancelledAt: document.cancelledAt ?? null,
    cancelReason: document.cancelReason ?? null,
    createdBy: document.createdBy.toHexString(),
    updatedBy: document.updatedBy.toHexString(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    revision: document.revision,
  };
}

function toObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
}

function scopeQuery(scope: TaskListScope) {
  if (scope.kind === "all") return {};
  if (scope.kind === "businessUnits") {
    const userId = new Types.ObjectId(scope.userId);
    return {
      $or: [
        { businessUnitIds: { $in: toObjectIds(scope.businessUnitIds) } },
        { assigneeUserId: userId },
        { createdBy: userId },
      ],
    };
  }
  const userId = new Types.ObjectId(scope.userId);
  return { $or: [{ assigneeUserId: userId }, { createdBy: userId }] };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export class MongoTaskStore implements TaskStore {
  async insert(
    record: NewTaskRecord,
  ): Promise<{ task: TaskRecordDto; created: boolean }> {
    await connectToDatabase();

    const actorId = new Types.ObjectId(record.createdBy);
    const source =
      record.source.kind === "proposal"
        ? {
            kind: "proposal" as const,
            proposalId: new Types.ObjectId(record.source.proposalId),
            itemIndex: record.source.itemIndex,
          }
        : { kind: "manual" as const, proposalId: null, itemIndex: null };

    try {
      const document = await getTaskModel().create({
        title: record.title,
        note: record.note,
        status: "open",
        priority: record.priority,
        orderId: record.orderId ? new Types.ObjectId(record.orderId) : null,
        orderCode: record.orderCode,
        stage: record.stage,
        ownerRole: record.ownerRole,
        assigneeUserId: record.assigneeUserId
          ? new Types.ObjectId(record.assigneeUserId)
          : null,
        businessUnitIds: toObjectIds(record.businessUnitIds),
        dueAt: record.dueAt,
        dependsOnTaskIds: toObjectIds(record.dependsOnTaskIds),
        source,
        extensionRequest: null,
        lastExtensionDecision: null,
        completedAt: null,
        completedBy: null,
        cancelledAt: null,
        cancelReason: null,
        createdBy: actorId,
        updatedBy: actorId,
      });
      return {
        task: toDto(document.toObject() as TaskDocument),
        created: true,
      };
    } catch (error) {
      if (isDuplicateKeyError(error) && record.source.kind === "proposal") {
        const existing = await getTaskModel()
          .findOne({
            "source.kind": "proposal",
            "source.proposalId": new Types.ObjectId(record.source.proposalId),
            "source.itemIndex": record.source.itemIndex,
          })
          .lean<TaskDocument>()
          .exec();
        if (existing) return { task: toDto(existing), created: false };
      }
      throw error;
    }
  }

  async findById(taskId: string): Promise<TaskRecordDto | null> {
    if (!Types.ObjectId.isValid(taskId)) return null;
    await connectToDatabase();
    const document = await getTaskModel()
      .findById(taskId)
      .lean<TaskDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async findByIds(taskIds: readonly string[]): Promise<TaskRecordDto[]> {
    const ids = toObjectIds(taskIds);
    if (ids.length === 0) return [];
    await connectToDatabase();
    const documents = await getTaskModel()
      .find({ _id: { $in: ids } })
      .lean<TaskDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async list(filter: TaskListFilter): Promise<TaskRecordDto[]> {
    await connectToDatabase();

    const conditions: Record<string, unknown>[] = [scopeQuery(filter.scope)];
    if (filter.status) conditions.push({ status: filter.status });
    if (filter.orderId && Types.ObjectId.isValid(filter.orderId)) {
      conditions.push({ orderId: new Types.ObjectId(filter.orderId) });
    }
    if (
      filter.assigneeUserId &&
      Types.ObjectId.isValid(filter.assigneeUserId)
    ) {
      conditions.push({
        assigneeUserId: new Types.ObjectId(filter.assigneeUserId),
      });
    }
    if (filter.dueBefore) {
      conditions.push({ status: "open", dueAt: { $lte: filter.dueBefore } });
    }

    const documents = await getTaskModel()
      .find({ $and: conditions })
      // Open work first, earliest deadline first, then in the order the
      // tasks were created so a plan reads top to bottom; no deadline last.
      .sort({ status: 1, dueAt: 1, createdAt: 1 })
      .limit(filter.limit ?? 300)
      .lean<TaskDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async listOpenDue(dueBefore: Date, limit: number): Promise<TaskRecordDto[]> {
    await connectToDatabase();
    const documents = await getTaskModel()
      .find({ status: "open", dueAt: { $ne: null, $lte: dueBefore } })
      .sort({ dueAt: 1 })
      .limit(limit)
      .lean<TaskDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async listPendingExtensions(limit: number): Promise<TaskRecordDto[]> {
    await connectToDatabase();
    const documents = await getTaskModel()
      .find({ status: "open", extensionRequest: { $ne: null } })
      .sort({ "extensionRequest.requestedAt": 1 })
      .limit(limit)
      .lean<TaskDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  /**
   * A request is recorded only while the task is open and nothing is already
   * waiting, so a second submit of the same form finds the condition unmet
   * and returns null instead of replacing the first plea.
   */
  async requestExtension(input: {
    taskId: string;
    expectedRevision: number;
    request: TaskExtensionRequest;
  }): Promise<TaskRecordDto | null> {
    await connectToDatabase();
    const document = await getTaskModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.taskId),
          revision: input.expectedRevision,
          status: "open",
          extensionRequest: null,
        },
        {
          $set: {
            extensionRequest: {
              requestedDueAt: input.request.requestedDueAt,
              reason: input.request.reason,
              requestedBy: new Types.ObjectId(input.request.requestedBy),
              requestedAt: input.request.requestedAt,
            },
            updatedBy: new Types.ObjectId(input.request.requestedBy),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<TaskDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async decideExtension(input: {
    taskId: string;
    expectedRevision: number;
    decision: TaskExtensionDecision;
    dueAt: Date | null;
    decidedBy: string;
  }): Promise<TaskRecordDto | null> {
    await connectToDatabase();
    const decidedBy = new Types.ObjectId(input.decidedBy);
    const document = await getTaskModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.taskId),
          revision: input.expectedRevision,
          extensionRequest: { $ne: null },
        },
        {
          $set: {
            extensionRequest: null,
            lastExtensionDecision: {
              outcome: input.decision.outcome,
              requestedDueAt: input.decision.requestedDueAt,
              note: input.decision.note,
              decidedBy,
              decidedAt: input.decision.decidedAt,
            },
            ...(input.dueAt ? { dueAt: input.dueAt } : {}),
            updatedBy: decidedBy,
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<TaskDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async update(input: {
    taskId: string;
    expectedRevision: number;
    fields: TaskFieldsWrite;
    updatedBy: string;
  }): Promise<TaskRecordDto | null> {
    await connectToDatabase();
    const document = await getTaskModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.taskId),
          revision: input.expectedRevision,
        },
        {
          $set: {
            title: input.fields.title,
            note: input.fields.note,
            priority: input.fields.priority,
            assigneeUserId: input.fields.assigneeUserId
              ? new Types.ObjectId(input.fields.assigneeUserId)
              : null,
            dueAt: input.fields.dueAt,
            ...(input.fields.businessUnitIds
              ? { businessUnitIds: toObjectIds(input.fields.businessUnitIds) }
              : {}),
            // Setting the deadline by hand answers whatever was being asked,
            // so a pending request never outlives the date it was about.
            extensionRequest: null,
            updatedBy: new Types.ObjectId(input.updatedBy),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<TaskDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async setStatus(input: {
    taskId: string;
    expectedRevision: number;
    status: TaskStatus;
    reason: string | null;
    actorId: string;
    at: Date;
  }): Promise<TaskRecordDto | null> {
    await connectToDatabase();
    const actorId = new Types.ObjectId(input.actorId);
    // Work that is finished or dropped carries no open question about its
    // deadline any more.
    const set =
      input.status === "done"
        ? {
            status: "done",
            completedAt: input.at,
            completedBy: actorId,
            extensionRequest: null,
            updatedBy: actorId,
          }
        : input.status === "cancelled"
          ? {
              status: "cancelled",
              cancelledAt: input.at,
              cancelReason: input.reason,
              extensionRequest: null,
              updatedBy: actorId,
            }
          : {
              status: "open",
              completedAt: null,
              completedBy: null,
              updatedBy: actorId,
            };
    const document = await getTaskModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.taskId),
          revision: input.expectedRevision,
        },
        { $set: set, $inc: { revision: 1 } },
        { new: true },
      )
      .lean<TaskDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async setDependencies(input: {
    taskId: string;
    dependsOnTaskIds: readonly string[];
  }): Promise<void> {
    await connectToDatabase();
    await getTaskModel()
      .updateOne(
        { _id: new Types.ObjectId(input.taskId) },
        { $set: { dependsOnTaskIds: toObjectIds(input.dependsOnTaskIds) } },
      )
      .exec();
  }
}

export const mongoTaskStore = new MongoTaskStore();
