import "server-only";

import { Types } from "mongoose";

import type {
  ApprovalRequest,
  ApprovalSubject,
} from "@/domains/approvals/contracts";
import { getApprovalRequestModel } from "@/domains/approvals/model";
import {
  FacilityContractError,
  type ApprovalHistoryReader,
  type FacilityContractDocumentKind,
  type FacilityContractFields,
  type FacilityContractListFilter,
  type FacilityContractRecordDto,
  type FacilityContractStatus,
  type FacilityContractStore,
  type FacilityLookup,
  type FacilityLookupEntry,
  type FacilityPaymentListFilter,
  type FacilityPaymentRecordDto,
  type FacilityPaymentStatus,
  type FacilityPaymentStepFields,
  type FacilityPaymentStore,
  type NewFacilityContractDocument,
  type NewFacilityContractLine,
  type NewFacilityContractRecord,
  type NewFacilityPaymentRecord,
} from "@/domains/facility-contracts/contracts";
import {
  getFacilityContractModel,
  getFacilityPaymentModel,
} from "@/domains/facility-contracts/persistence/models";
import { readLookups } from "@/domains/materials/service";
import { connectToDatabase } from "@/lib/db/mongoose";

type StoredContract = {
  _id: Types.ObjectId;
  code: string;
  facilityId: string;
  facilityCode?: string;
  facilityName: string;
  orderId?: Types.ObjectId | null;
  orderCode?: string | null;
  lines: {
    _id: Types.ObjectId;
    productCode: string;
    description: string;
    quantity?: string | null;
    unit?: string;
    unitPrice: string;
    previousUnitPrice?: string | null;
    previousContractCode?: string | null;
  }[];
  startDate: Date;
  deliveryDate: Date;
  note?: string | null;
  documents?: {
    _id: Types.ObjectId;
    kind: FacilityContractDocumentKind;
    publicId: string;
    assetVersion: number;
    format: string;
    bytes: number;
    label: string;
    uploadedBy: Types.ObjectId;
    uploadedAt: Date;
  }[];
  status: FacilityContractStatus;
  cancelReason?: string | null;
  activatedAt?: Date | null;
  activatedBy?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

type StoredPayment = {
  _id: Types.ObjectId;
  code: string;
  contractId: Types.ObjectId;
  contractCode: string;
  facilityId: string;
  facilityName: string;
  orderCode?: string | null;
  amount: string;
  note?: string | null;
  status: FacilityPaymentStatus;
  proposedBy: Types.ObjectId;
  proposedAt: Date;
  checkedBy?: Types.ObjectId | null;
  checkedAt?: Date | null;
  accountantApprovedBy?: Types.ObjectId | null;
  accountantApprovedAt?: Date | null;
  paidBy?: Types.ObjectId | null;
  paidAt?: Date | null;
  paidOn?: Date | null;
  paidNote?: string | null;
  rejectedBy?: Types.ObjectId | null;
  rejectedAt?: Date | null;
  rejectReason?: string | null;
  rejectedAtStage?: FacilityPaymentStatus | null;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

const hex = (value: Types.ObjectId | null | undefined): string | null =>
  value ? value.toHexString() : null;

function contractDto(document: StoredContract): FacilityContractRecordDto {
  return {
    id: document._id.toHexString(),
    code: document.code,
    facilityId: document.facilityId,
    facilityCode: document.facilityCode ?? "",
    facilityName: document.facilityName,
    orderId: hex(document.orderId),
    orderCode: document.orderCode ?? null,
    lines: document.lines.map((line) => ({
      id: line._id.toHexString(),
      productCode: line.productCode,
      description: line.description,
      quantity: line.quantity ?? null,
      unit: line.unit ?? "cái",
      unitPrice: line.unitPrice,
      previousUnitPrice: line.previousUnitPrice ?? null,
      previousContractCode: line.previousContractCode ?? null,
    })),
    startDate: document.startDate,
    deliveryDate: document.deliveryDate,
    note: document.note ?? null,
    documents: (document.documents ?? []).map((item) => ({
      id: item._id.toHexString(),
      kind: item.kind,
      publicId: item.publicId,
      assetVersion: item.assetVersion,
      format: item.format,
      bytes: item.bytes,
      label: item.label,
      uploadedBy: item.uploadedBy.toHexString(),
      uploadedAt: item.uploadedAt,
    })),
    status: document.status,
    cancelReason: document.cancelReason ?? null,
    activatedAt: document.activatedAt ?? null,
    activatedBy: hex(document.activatedBy),
    createdBy: document.createdBy.toHexString(),
    updatedBy: document.updatedBy.toHexString(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    revision: document.revision,
  };
}

function paymentDto(document: StoredPayment): FacilityPaymentRecordDto {
  return {
    id: document._id.toHexString(),
    code: document.code,
    contractId: document.contractId.toHexString(),
    contractCode: document.contractCode,
    facilityId: document.facilityId,
    facilityName: document.facilityName,
    orderCode: document.orderCode ?? null,
    amount: document.amount,
    note: document.note ?? null,
    status: document.status,
    proposedBy: document.proposedBy.toHexString(),
    proposedAt: document.proposedAt,
    checkedBy: hex(document.checkedBy),
    checkedAt: document.checkedAt ?? null,
    accountantApprovedBy: hex(document.accountantApprovedBy),
    accountantApprovedAt: document.accountantApprovedAt ?? null,
    paidBy: hex(document.paidBy),
    paidAt: document.paidAt ?? null,
    paidOn: document.paidOn ?? null,
    paidNote: document.paidNote ?? null,
    rejectedBy: hex(document.rejectedBy),
    rejectedAt: document.rejectedAt ?? null,
    rejectReason: document.rejectReason ?? null,
    rejectedAtStage: document.rejectedAtStage ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    revision: document.revision,
  };
}

function lineDocuments(lines: readonly NewFacilityContractLine[]) {
  return lines.map((line) => ({
    _id: new Types.ObjectId(),
    productCode: line.productCode,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    previousUnitPrice: line.previousUnitPrice,
    previousContractCode: line.previousContractCode,
  }));
}

function fieldsDocument(fields: FacilityContractFields) {
  return {
    facilityId: fields.facilityId,
    facilityCode: fields.facilityCode,
    facilityName: fields.facilityName,
    orderId: fields.orderId ? new Types.ObjectId(fields.orderId) : null,
    orderCode: fields.orderCode,
    lines: lineDocuments(fields.lines),
    startDate: fields.startDate,
    deliveryDate: fields.deliveryDate,
    note: fields.note,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

const userIdFields = new Set([
  "checkedBy",
  "accountantApprovedBy",
  "paidBy",
  "rejectedBy",
]);

export class MongoFacilityContractStore implements FacilityContractStore {
  private async update(
    contractId: string,
    expectedRevision: number,
    update: Record<string, unknown>,
    extraFilter: Record<string, unknown> = {},
  ): Promise<FacilityContractRecordDto | null> {
    if (!Types.ObjectId.isValid(contractId)) return null;
    await connectToDatabase();
    const document = await getFacilityContractModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(contractId),
          revision: expectedRevision,
          ...extraFilter,
        },
        { ...update, $inc: { revision: 1 } },
        { new: true, runValidators: true },
      )
      .lean<StoredContract>()
      .exec();
    return document ? contractDto(document) : null;
  }

  async insert(
    record: NewFacilityContractRecord,
  ): Promise<FacilityContractRecordDto> {
    await connectToDatabase();
    const actor = new Types.ObjectId(record.createdBy);
    try {
      const document = await getFacilityContractModel().create({
        code: record.code,
        ...fieldsDocument(record),
        documents: [],
        status: "draft",
        cancelReason: null,
        activatedAt: null,
        activatedBy: null,
        createdBy: actor,
        updatedBy: actor,
      });
      return contractDto(document.toObject() as unknown as StoredContract);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new FacilityContractError(
          "DUPLICATE_CODE",
          "A contract with this code already exists.",
        );
      }
      throw error;
    }
  }

  async findById(
    contractId: string,
  ): Promise<FacilityContractRecordDto | null> {
    if (!Types.ObjectId.isValid(contractId)) return null;
    await connectToDatabase();
    const document = await getFacilityContractModel()
      .findById(contractId)
      .lean<StoredContract>()
      .exec();
    return document ? contractDto(document) : null;
  }

  async list(
    filter: FacilityContractListFilter,
  ): Promise<FacilityContractRecordDto[]> {
    await connectToDatabase();
    const documents = await getFacilityContractModel()
      .find(filter.status ? { status: filter.status } : {})
      .sort({ updatedAt: -1 })
      .limit(2_000)
      .lean<StoredContract[]>()
      .exec();
    return documents.map(contractDto);
  }

  async updateDraft(input: {
    contractId: string;
    expectedRevision: number;
    fields: FacilityContractFields;
    updatedBy: string;
  }): Promise<FacilityContractRecordDto | null> {
    return this.update(
      input.contractId,
      input.expectedRevision,
      {
        $set: {
          ...fieldsDocument(input.fields),
          updatedBy: new Types.ObjectId(input.updatedBy),
        },
      },
      { status: "draft" },
    );
  }

  async activate(input: {
    contractId: string;
    expectedRevision: number;
    lines: readonly NewFacilityContractLine[];
    activatedAt: Date;
    activatedBy: string;
  }): Promise<FacilityContractRecordDto | null> {
    const actor = new Types.ObjectId(input.activatedBy);
    return this.update(
      input.contractId,
      input.expectedRevision,
      {
        $set: {
          status: "active",
          lines: lineDocuments(input.lines),
          activatedAt: input.activatedAt,
          activatedBy: actor,
          updatedBy: actor,
        },
      },
      { status: "draft" },
    );
  }

  async cancel(input: {
    contractId: string;
    expectedRevision: number;
    reason: string;
    updatedBy: string;
  }): Promise<FacilityContractRecordDto | null> {
    return this.update(
      input.contractId,
      input.expectedRevision,
      {
        $set: {
          status: "cancelled",
          cancelReason: input.reason,
          updatedBy: new Types.ObjectId(input.updatedBy),
        },
      },
      { status: { $in: ["draft", "active"] } },
    );
  }

  async addDocument(input: {
    contractId: string;
    expectedRevision: number;
    document: NewFacilityContractDocument;
    updatedBy: string;
  }): Promise<FacilityContractRecordDto | null> {
    return this.update(input.contractId, input.expectedRevision, {
      $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
      $push: {
        documents: {
          _id: new Types.ObjectId(),
          kind: input.document.kind,
          publicId: input.document.publicId,
          assetVersion: input.document.assetVersion,
          format: input.document.format,
          bytes: input.document.bytes,
          label: input.document.label,
          uploadedBy: new Types.ObjectId(input.document.uploadedBy),
          uploadedAt: input.document.uploadedAt,
        },
      },
    });
  }

  async removeDocument(input: {
    contractId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<FacilityContractRecordDto | null> {
    if (!Types.ObjectId.isValid(input.documentId)) return null;
    const documentId = new Types.ObjectId(input.documentId);
    return this.update(
      input.contractId,
      input.expectedRevision,
      {
        $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
        $pull: { documents: { _id: documentId } },
      },
      { "documents._id": documentId },
    );
  }
}

export class MongoFacilityPaymentStore implements FacilityPaymentStore {
  async insert(
    record: NewFacilityPaymentRecord,
  ): Promise<FacilityPaymentRecordDto> {
    await connectToDatabase();
    try {
      const document = await getFacilityPaymentModel().create({
        code: record.code,
        contractId: new Types.ObjectId(record.contractId),
        contractCode: record.contractCode,
        facilityId: record.facilityId,
        facilityName: record.facilityName,
        orderCode: record.orderCode,
        amount: record.amount,
        note: record.note,
        status: "proposed",
        proposedBy: new Types.ObjectId(record.proposedBy),
        proposedAt: record.proposedAt,
      });
      return paymentDto(document.toObject() as unknown as StoredPayment);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new FacilityContractError(
          "DUPLICATE_CODE",
          "A payment request with this code already exists.",
        );
      }
      throw error;
    }
  }

  async findById(paymentId: string): Promise<FacilityPaymentRecordDto | null> {
    if (!Types.ObjectId.isValid(paymentId)) return null;
    await connectToDatabase();
    const document = await getFacilityPaymentModel()
      .findById(paymentId)
      .lean<StoredPayment>()
      .exec();
    return document ? paymentDto(document) : null;
  }

  async list(
    filter: FacilityPaymentListFilter,
  ): Promise<FacilityPaymentRecordDto[]> {
    if (filter.contractId && !Types.ObjectId.isValid(filter.contractId)) {
      return [];
    }
    await connectToDatabase();
    const documents = await getFacilityPaymentModel()
      .find({
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.contractId
          ? { contractId: new Types.ObjectId(filter.contractId) }
          : {}),
      })
      .sort({ createdAt: -1 })
      .limit(5_000)
      .lean<StoredPayment[]>()
      .exec();
    return documents.map(paymentDto);
  }

  async step(input: {
    paymentId: string;
    expectedRevision: number;
    from: FacilityPaymentStatus;
    to: FacilityPaymentStatus;
    fields: FacilityPaymentStepFields;
  }): Promise<FacilityPaymentRecordDto | null> {
    if (!Types.ObjectId.isValid(input.paymentId)) return null;
    await connectToDatabase();
    const set: Record<string, unknown> = { status: input.to };
    for (const [key, value] of Object.entries(input.fields)) {
      set[key] =
        userIdFields.has(key) && typeof value === "string"
          ? new Types.ObjectId(value)
          : value;
    }
    const document = await getFacilityPaymentModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.paymentId),
          revision: input.expectedRevision,
          status: input.from,
        },
        { $set: set, $inc: { revision: 1 } },
        { new: true, runValidators: true },
      )
      .lean<StoredPayment>()
      .exec();
    return document ? paymentDto(document) : null;
  }
}

/** The production sites of the materials module, read on demand. */
export const materialsFacilityLookup: FacilityLookup = {
  async findById(facilityId: string): Promise<FacilityLookupEntry | null> {
    await connectToDatabase();
    const { facilities } = await readLookups();
    const facility = facilities.find((entry) => entry.id === facilityId);
    return facility
      ? {
          id: facility.id,
          code: facility.code,
          name: facility.name,
          active: facility.active,
        }
      : null;
  },
};

/** Active production sites for the site picker, by name. */
export async function listActiveFacilities(): Promise<FacilityLookupEntry[]> {
  await connectToDatabase();
  const { facilities } = await readLookups();
  return facilities
    .filter((facility) => facility.active)
    .map((facility) => ({
      id: facility.id,
      code: facility.code,
      name: facility.name,
      active: facility.active,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));
}

type StoredApproval = {
  _id: Types.ObjectId;
  subject: ApprovalSubject;
  resourceType: string;
  resourceId: string;
  businessUnitIds?: Types.ObjectId[];
  status: ApprovalRequest["status"];
  requestedByUserId: Types.ObjectId;
  requestedAt: Date;
  summary: string;
  decidedByUserId?: Types.ObjectId | null;
  decidedAt?: Date | null;
  decisionReason?: string | null;
  expectedRevision: number;
};

/** Reads the approvals collection for the latest decided request. */
export const mongoApprovalHistoryReader: ApprovalHistoryReader = {
  async findLatestDecided(resourceType, resourceId, subject) {
    await connectToDatabase();
    const document = await getApprovalRequestModel()
      .findOne({
        resourceType,
        resourceId,
        subject,
        status: { $in: ["approved", "rejected"] },
      })
      .sort({ decidedAt: -1 })
      .lean<StoredApproval>()
      .exec();
    if (!document) return null;
    return {
      id: document._id.toHexString(),
      subject: document.subject,
      resourceType: document.resourceType,
      resourceId: document.resourceId,
      businessUnitIds: (document.businessUnitIds ?? []).map((id) =>
        id.toHexString(),
      ),
      status: document.status,
      requestedByUserId: document.requestedByUserId.toHexString(),
      requestedAt: document.requestedAt,
      summary: document.summary,
      decidedByUserId: hex(document.decidedByUserId),
      decidedAt: document.decidedAt ?? null,
      decisionReason: document.decisionReason ?? null,
      expectedRevision: document.expectedRevision,
    };
  },
};

export const mongoFacilityContractStore = new MongoFacilityContractStore();
export const mongoFacilityPaymentStore = new MongoFacilityPaymentStore();
