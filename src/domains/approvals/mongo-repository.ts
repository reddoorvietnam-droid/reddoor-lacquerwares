import "server-only";

import { Types } from "mongoose";

import {
  ApprovalError,
  type ApprovalRepository,
  type ApprovalRequest,
  type ApprovalSubject,
  type CreateApprovalRequestInput,
  type DecideApprovalInput,
} from "@/domains/approvals/contracts";
import { getApprovalRequestModel } from "@/domains/approvals/model";
import { connectToDatabase } from "@/lib/db/mongoose";

type ApprovalRequestDocument = {
  _id: Types.ObjectId;
  subject: ApprovalSubject;
  resourceType: string;
  resourceId: string;
  businessUnitIds: Types.ObjectId[];
  status: ApprovalRequest["status"];
  requestedByUserId: Types.ObjectId;
  requestedAt: Date;
  summary: string;
  decidedByUserId: Types.ObjectId | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  expectedRevision: number;
};

function toDto(document: ApprovalRequestDocument): ApprovalRequest {
  return {
    id: document._id.toHexString(),
    subject: document.subject,
    resourceType: document.resourceType,
    resourceId: document.resourceId,
    businessUnitIds: document.businessUnitIds.map((id) => id.toHexString()),
    status: document.status,
    requestedByUserId: document.requestedByUserId.toHexString(),
    requestedAt: document.requestedAt,
    summary: document.summary,
    decidedByUserId: document.decidedByUserId?.toHexString() ?? null,
    decidedAt: document.decidedAt ?? null,
    decisionReason: document.decisionReason ?? null,
    expectedRevision: document.expectedRevision,
  };
}

function toObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
}

export class MongoApprovalRepository implements ApprovalRepository {
  async create(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
    await connectToDatabase();

    try {
      const document = await getApprovalRequestModel().create({
        subject: input.subject,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        businessUnitIds: toObjectIds(input.businessUnitIds),
        status: "pending",
        requestedByUserId: new Types.ObjectId(input.requestedByUserId),
        requestedAt: input.requestedAt,
        summary: input.summary,
        expectedRevision: input.expectedRevision,
      });
      return toDto(document.toObject() as ApprovalRequestDocument);
    } catch (error) {
      // The partial unique index closes the race `assertRequestable` cannot.
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code?: number }).code === 11_000
      ) {
        throw new ApprovalError(
          "ALREADY_PENDING",
          "This record already has a pending approval request.",
        );
      }
      throw error;
    }
  }

  async findById(requestId: string): Promise<ApprovalRequest | null> {
    if (!Types.ObjectId.isValid(requestId)) return null;
    await connectToDatabase();

    const document = await getApprovalRequestModel()
      .findById(requestId)
      .lean<ApprovalRequestDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async findPendingForResource(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ): Promise<ApprovalRequest | null> {
    await connectToDatabase();

    const document = await getApprovalRequestModel()
      .findOne({ resourceType, resourceId, subject, status: "pending" })
      .lean<ApprovalRequestDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async findApprovedForResource(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ): Promise<ApprovalRequest | null> {
    await connectToDatabase();

    const document = await getApprovalRequestModel()
      .findOne({ resourceType, resourceId, subject, status: "approved" })
      .sort({ decidedAt: -1 })
      .lean<ApprovalRequestDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async listPending(
    businessUnitIds: readonly string[] | null,
  ): Promise<ApprovalRequest[]> {
    await connectToDatabase();

    const filter =
      businessUnitIds === null
        ? { status: "pending" as const }
        : {
            status: "pending" as const,
            businessUnitIds: { $in: toObjectIds(businessUnitIds) },
          };

    const documents = await getApprovalRequestModel()
      .find(filter)
      .sort({ requestedAt: 1 })
      .limit(200)
      .lean<ApprovalRequestDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async decide(input: DecideApprovalInput): Promise<ApprovalRequest> {
    if (!Types.ObjectId.isValid(input.requestId)) {
      throw new ApprovalError("NOT_FOUND", "Approval request not found.");
    }
    await connectToDatabase();

    // Conditional update: only a still-pending request with the expected
    // revision can be decided, so two concurrent deciders cannot both win.
    const document = await getApprovalRequestModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.requestId),
          status: "pending",
          expectedRevision: input.expectedRevision,
        },
        {
          $set: {
            status: input.decision,
            decidedByUserId: new Types.ObjectId(input.decidedByUserId),
            decidedAt: input.decidedAt,
            decisionReason: input.decisionReason,
          },
        },
        { new: true },
      )
      .lean<ApprovalRequestDocument>()
      .exec();

    if (!document) {
      throw new ApprovalError(
        "ALREADY_DECIDED",
        "This approval request has already been decided.",
      );
    }
    return toDto(document);
  }
}

export const mongoApprovalRepository = new MongoApprovalRepository();
