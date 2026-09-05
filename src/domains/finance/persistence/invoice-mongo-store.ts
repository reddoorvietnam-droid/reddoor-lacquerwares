import "server-only";

import { Types } from "mongoose";

import {
  FinanceCommandError,
  type FinanceEntryAmount,
  type FinanceListScope,
  type InvoiceListFilter,
  type InvoiceRecordDto,
  type InvoiceStore,
  type NewInvoiceRecord,
  type NewStoredDocument,
} from "@/domains/finance/contracts";
import { getSalesInvoiceModel } from "@/domains/finance/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

type StoredDocumentRecord = {
  _id: Types.ObjectId;
  publicId: string;
  assetVersion: number;
  format: string;
  bytes: number;
  label: string;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
};

type SalesInvoiceDocument = {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  orderCode: string;
  customerId?: Types.ObjectId | null;
  customerName: string;
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date;
  amount: FinanceEntryAmount;
  fxRateToVnd?: string | null;
  note: string | null;
  documents?: StoredDocumentRecord[];
  status: "active" | "voided";
  voidReason: string | null;
  businessUnitIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

function toDto(document: SalesInvoiceDocument): InvoiceRecordDto {
  return {
    id: document._id.toHexString(),
    orderId: document.orderId.toHexString(),
    orderCode: document.orderCode,
    customerId: document.customerId ? document.customerId.toHexString() : null,
    customerName: document.customerName,
    invoiceNumber: document.invoiceNumber,
    issuedAt: document.issuedAt,
    dueAt: document.dueAt,
    amount: {
      amount: document.amount.amount,
      currency: document.amount.currency,
    },
    fxRateToVnd: document.fxRateToVnd ?? null,
    note: document.note ?? null,
    documents: (document.documents ?? []).map((item) => ({
      id: item._id.toHexString(),
      publicId: item.publicId,
      assetVersion: item.assetVersion,
      format: item.format,
      bytes: item.bytes,
      label: item.label,
      uploadedBy: item.uploadedBy.toHexString(),
      uploadedAt: item.uploadedAt,
    })),
    status: document.status,
    voidReason: document.voidReason ?? null,
    businessUnitIds: document.businessUnitIds.map((id) => id.toHexString()),
    createdBy: document.createdBy.toHexString(),
    updatedBy: document.updatedBy.toHexString(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    revision: document.revision,
  };
}

function scopeQuery(scope: FinanceListScope | undefined) {
  if (!scope || scope.kind === "all") return {};
  if (scope.kind === "businessUnits") {
    return {
      businessUnitIds: {
        $in: scope.businessUnitIds
          .filter(Types.ObjectId.isValid)
          .map((id) => new Types.ObjectId(id)),
      },
    };
  }
  return { createdBy: new Types.ObjectId(scope.userId) };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export class MongoInvoiceStore implements InvoiceStore {
  async insert(record: NewInvoiceRecord): Promise<InvoiceRecordDto> {
    await connectToDatabase();

    const actorId = new Types.ObjectId(record.createdBy);
    try {
      const document = await getSalesInvoiceModel().create({
        orderId: new Types.ObjectId(record.orderId),
        orderCode: record.orderCode,
        customerId: record.customerId
          ? new Types.ObjectId(record.customerId)
          : null,
        customerName: record.customerName,
        invoiceNumber: record.invoiceNumber,
        issuedAt: record.issuedAt,
        dueAt: record.dueAt,
        amount: record.amount,
        fxRateToVnd: record.fxRateToVnd,
        note: record.note,
        documents: [],
        status: "active",
        voidReason: null,
        businessUnitIds: record.businessUnitIds.map(
          (id) => new Types.ObjectId(id),
        ),
        createdBy: actorId,
        updatedBy: actorId,
      });
      return toDto(document.toObject() as SalesInvoiceDocument);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new FinanceCommandError(
          "DUPLICATE_INVOICE_NUMBER",
          "An active invoice with this number already exists.",
        );
      }
      throw error;
    }
  }

  async findById(invoiceId: string): Promise<InvoiceRecordDto | null> {
    if (!Types.ObjectId.isValid(invoiceId)) return null;
    await connectToDatabase();

    const document = await getSalesInvoiceModel()
      .findById(invoiceId)
      .lean<SalesInvoiceDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async list(filter: InvoiceListFilter): Promise<InvoiceRecordDto[]> {
    await connectToDatabase();

    const documents = await getSalesInvoiceModel()
      .find({
        ...scopeQuery(filter.scope),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.orderId && Types.ObjectId.isValid(filter.orderId)
          ? { orderId: new Types.ObjectId(filter.orderId) }
          : {}),
        ...(filter.customerId && Types.ObjectId.isValid(filter.customerId)
          ? { customerId: new Types.ObjectId(filter.customerId) }
          : {}),
      })
      .sort({ dueAt: 1, issuedAt: 1, _id: 1 })
      .lean<SalesInvoiceDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async void(input: {
    invoiceId: string;
    expectedRevision: number;
    reason: string;
    updatedBy: string;
  }): Promise<InvoiceRecordDto | null> {
    await connectToDatabase();

    const document = await getSalesInvoiceModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.invoiceId),
          revision: input.expectedRevision,
          status: "active",
        },
        {
          $set: {
            status: "voided",
            voidReason: input.reason,
            updatedBy: new Types.ObjectId(input.updatedBy),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<SalesInvoiceDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async addDocument(input: {
    invoiceId: string;
    expectedRevision: number;
    document: NewStoredDocument;
    updatedBy: string;
  }): Promise<InvoiceRecordDto | null> {
    await connectToDatabase();

    const document = await getSalesInvoiceModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.invoiceId),
          revision: input.expectedRevision,
        },
        {
          $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
          $push: {
            documents: {
              _id: new Types.ObjectId(),
              publicId: input.document.publicId,
              assetVersion: input.document.assetVersion,
              format: input.document.format,
              bytes: input.document.bytes,
              label: input.document.label,
              uploadedBy: new Types.ObjectId(input.document.uploadedBy),
              uploadedAt: input.document.uploadedAt,
            },
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<SalesInvoiceDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async removeDocument(input: {
    invoiceId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<InvoiceRecordDto | null> {
    if (!Types.ObjectId.isValid(input.documentId)) return null;
    await connectToDatabase();

    const document = await getSalesInvoiceModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.invoiceId),
          revision: input.expectedRevision,
          "documents._id": new Types.ObjectId(input.documentId),
        },
        {
          $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
          $pull: { documents: { _id: new Types.ObjectId(input.documentId) } },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<SalesInvoiceDocument>()
      .exec();
    return document ? toDto(document) : null;
  }
}

export const mongoInvoiceStore = new MongoInvoiceStore();
