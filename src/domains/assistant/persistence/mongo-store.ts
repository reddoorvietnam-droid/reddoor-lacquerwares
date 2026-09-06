import "server-only";

import { Types } from "mongoose";

import type {
  AssistantProposalDto,
  NewProposalRecord,
  PlanItemDraft,
  ProposalKind,
  ProposalStatus,
  ProposalStore,
} from "@/domains/assistant/contracts";
import { getAssistantProposalModel } from "@/domains/assistant/persistence/models";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import type { OrderStage } from "@/domains/orders/workflow";
import type { TaskPriority } from "@/domains/tasks/contracts";
import { connectToDatabase } from "@/lib/db/mongoose";

type PlanItemDocument = {
  index: number;
  title: string;
  note: string | null;
  stage: OrderStage | null;
  ownerRole: SystemRoleKey | null;
  assigneeUserId: Types.ObjectId | null;
  dueDate: string | null;
  dependsOn: number[];
  priority: TaskPriority;
};

type ProposalDocument = {
  _id: Types.ObjectId;
  kind: ProposalKind;
  status: ProposalStatus;
  orderId: Types.ObjectId | null;
  orderCode: string | null;
  orderRevision: number | null;
  orderStage: OrderStage | null;
  businessUnitIds: Types.ObjectId[];
  items: PlanItemDocument[];
  assumptions: string[];
  summary: string;
  proposedByUserId: Types.ObjectId;
  proposedAt: Date;
  decidedByUserId: Types.ObjectId | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  appliedTaskIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

function itemToDto(item: PlanItemDocument): PlanItemDraft {
  return {
    index: item.index,
    title: item.title,
    note: item.note ?? null,
    stage: item.stage ?? null,
    ownerRole: item.ownerRole ?? null,
    assigneeUserId: item.assigneeUserId
      ? item.assigneeUserId.toHexString()
      : null,
    dueDate: item.dueDate ?? null,
    dependsOn: [...(item.dependsOn ?? [])],
    priority: item.priority,
  };
}

function toDto(document: ProposalDocument): AssistantProposalDto {
  return {
    id: document._id.toHexString(),
    kind: document.kind,
    status: document.status,
    orderId: document.orderId ? document.orderId.toHexString() : null,
    orderCode: document.orderCode ?? null,
    orderRevision: document.orderRevision ?? null,
    orderStage: document.orderStage ?? null,
    businessUnitIds: document.businessUnitIds.map((id) => id.toHexString()),
    items: document.items.map(itemToDto),
    assumptions: [...document.assumptions],
    summary: document.summary,
    proposedByUserId: document.proposedByUserId.toHexString(),
    proposedAt: document.proposedAt,
    decidedByUserId: document.decidedByUserId
      ? document.decidedByUserId.toHexString()
      : null,
    decidedAt: document.decidedAt ?? null,
    decisionReason: document.decisionReason ?? null,
    appliedTaskIds: (document.appliedTaskIds ?? []).map((id) =>
      id.toHexString(),
    ),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    revision: document.revision,
  };
}

function toObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
}

export class MongoProposalStore implements ProposalStore {
  async insert(record: NewProposalRecord): Promise<AssistantProposalDto> {
    await connectToDatabase();
    const document = await getAssistantProposalModel().create({
      kind: record.kind,
      status: "proposed",
      orderId: record.orderId ? new Types.ObjectId(record.orderId) : null,
      orderCode: record.orderCode,
      orderRevision: record.orderRevision,
      orderStage: record.orderStage,
      businessUnitIds: toObjectIds(record.businessUnitIds),
      items: record.items.map((item) => ({
        index: item.index,
        title: item.title,
        note: item.note,
        stage: item.stage,
        ownerRole: item.ownerRole,
        assigneeUserId: item.assigneeUserId
          ? new Types.ObjectId(item.assigneeUserId)
          : null,
        dueDate: item.dueDate,
        dependsOn: [...item.dependsOn],
        priority: item.priority,
      })),
      assumptions: [...record.assumptions],
      summary: record.summary,
      proposedByUserId: new Types.ObjectId(record.proposedByUserId),
      proposedAt: record.proposedAt,
      decidedByUserId: null,
      decidedAt: null,
      decisionReason: null,
      appliedTaskIds: [],
    });
    return toDto(document.toObject() as ProposalDocument);
  }

  async findById(proposalId: string): Promise<AssistantProposalDto | null> {
    if (!Types.ObjectId.isValid(proposalId)) return null;
    await connectToDatabase();
    const document = await getAssistantProposalModel()
      .findById(proposalId)
      .lean<ProposalDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async listPending(filter: {
    businessUnitIds?: readonly string[] | null;
    proposedByUserId?: string;
    limit?: number;
  }): Promise<AssistantProposalDto[]> {
    await connectToDatabase();
    const query: Record<string, unknown> = { status: "proposed" };
    if (filter.businessUnitIds) {
      query.businessUnitIds = { $in: toObjectIds(filter.businessUnitIds) };
    }
    if (
      filter.proposedByUserId &&
      Types.ObjectId.isValid(filter.proposedByUserId)
    ) {
      query.proposedByUserId = new Types.ObjectId(filter.proposedByUserId);
    }
    const documents = await getAssistantProposalModel()
      .find(query)
      .sort({ proposedAt: -1 })
      .limit(filter.limit ?? 50)
      .lean<ProposalDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async decide(input: {
    proposalId: string;
    expectedRevision: number;
    status: "approved" | "rejected" | "expired";
    decidedByUserId: string;
    decidedAt: Date;
    decisionReason: string | null;
    appliedTaskIds: readonly string[];
  }): Promise<AssistantProposalDto | null> {
    if (!Types.ObjectId.isValid(input.proposalId)) return null;
    await connectToDatabase();
    const document = await getAssistantProposalModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.proposalId),
          status: "proposed",
          revision: input.expectedRevision,
        },
        {
          $set: {
            status: input.status,
            decidedByUserId: new Types.ObjectId(input.decidedByUserId),
            decidedAt: input.decidedAt,
            decisionReason: input.decisionReason,
            appliedTaskIds: toObjectIds(input.appliedTaskIds),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<ProposalDocument>()
      .exec();
    return document ? toDto(document) : null;
  }
}

export const mongoProposalStore = new MongoProposalStore();
