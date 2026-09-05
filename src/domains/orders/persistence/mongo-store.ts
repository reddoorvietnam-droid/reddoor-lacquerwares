import "server-only";

import { Types } from "mongoose";

import {
  OrderCommandError,
  type NewOrderPaymentDocument,
  type NewOrderRecord,
  type OrderExportProgressWrite,
  type OrderListFilter,
  type OrderRecordDto,
  type OrderSellingPrice,
  type OrderStageHistoryEntry,
  type OrderStore,
  type OrderTransitionWrite,
} from "@/domains/orders/contracts";
import { getSalesOrderModel } from "@/domains/orders/persistence/models";
import type { OrderStage } from "@/domains/orders/workflow";
import { connectToDatabase } from "@/lib/db/mongoose";

type SalesOrderDocument = {
  _id: Types.ObjectId;
  orderCode: string;
  customerId?: Types.ObjectId | null;
  customerName: string;
  businessUnitIds: Types.ObjectId[];
  stage: OrderStage;
  qcPassed: boolean;
  sellingPrice: OrderSellingPrice | null;
  expectedReadyAt?: Date | null;
  bookingNumber?: string | null;
  bookingDate?: Date | null;
  paymentDocuments?: {
    _id: Types.ObjectId;
    publicId: string;
    assetVersion: number;
    format: string;
    bytes: number;
    label: string;
    uploadedBy: Types.ObjectId;
    uploadedAt: Date;
  }[];
  notes: string | null;
  stageHistory: {
    from: OrderStage;
    to: OrderStage;
    byUserId: Types.ObjectId;
    reason: string | null;
    at: Date;
  }[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

function toDto(document: SalesOrderDocument): OrderRecordDto {
  return {
    id: document._id.toHexString(),
    orderCode: document.orderCode,
    customerId: document.customerId ? document.customerId.toHexString() : null,
    customerName: document.customerName,
    businessUnitIds: document.businessUnitIds.map((id) => id.toHexString()),
    stage: document.stage,
    qcPassed: document.qcPassed,
    sellingPrice: document.sellingPrice
      ? {
          amount: document.sellingPrice.amount,
          currency: document.sellingPrice.currency,
        }
      : null,
    expectedReadyAt: document.expectedReadyAt ?? null,
    bookingNumber: document.bookingNumber ?? null,
    bookingDate: document.bookingDate ?? null,
    paymentDocuments: (document.paymentDocuments ?? []).map((item) => ({
      id: item._id.toHexString(),
      publicId: item.publicId,
      assetVersion: item.assetVersion,
      format: item.format,
      bytes: item.bytes,
      label: item.label,
      uploadedBy: item.uploadedBy.toHexString(),
      uploadedAt: item.uploadedAt,
    })),
    notes: document.notes ?? null,
    stageHistory: document.stageHistory.map((entry) => ({
      from: entry.from,
      to: entry.to,
      byUserId: entry.byUserId.toHexString(),
      reason: entry.reason ?? null,
      at: entry.at,
    })),
    createdBy: document.createdBy.toHexString(),
    updatedBy: document.updatedBy.toHexString(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    revision: document.revision,
  };
}

function historyDocument(entry: OrderStageHistoryEntry) {
  return {
    from: entry.from,
    to: entry.to,
    byUserId: new Types.ObjectId(entry.byUserId),
    reason: entry.reason,
    at: entry.at,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export class MongoOrderStore implements OrderStore {
  async insert(record: NewOrderRecord): Promise<OrderRecordDto> {
    await connectToDatabase();

    const actorId = new Types.ObjectId(record.createdBy);
    try {
      const document = await getSalesOrderModel().create({
        orderCode: record.orderCode,
        customerId: new Types.ObjectId(record.customerId),
        customerName: record.customerName,
        businessUnitIds: record.businessUnitIds.map(
          (id) => new Types.ObjectId(id),
        ),
        stage: "received",
        qcPassed: false,
        sellingPrice: record.sellingPrice,
        expectedReadyAt: null,
        bookingNumber: null,
        bookingDate: null,
        paymentDocuments: [],
        notes: record.notes,
        stageHistory: [],
        createdBy: actorId,
        updatedBy: actorId,
      });
      return toDto(document.toObject() as SalesOrderDocument);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new OrderCommandError(
          "DUPLICATE_ORDER_CODE",
          "An order with this code already exists.",
        );
      }
      throw error;
    }
  }

  async findById(orderId: string): Promise<OrderRecordDto | null> {
    if (!Types.ObjectId.isValid(orderId)) return null;
    await connectToDatabase();

    const document = await getSalesOrderModel()
      .findById(orderId)
      .lean<SalesOrderDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async list(filter: OrderListFilter): Promise<OrderRecordDto[]> {
    await connectToDatabase();

    const query =
      filter.kind === "all"
        ? {}
        : filter.kind === "businessUnits"
          ? {
              businessUnitIds: {
                $in: filter.businessUnitIds
                  .filter(Types.ObjectId.isValid)
                  .map((id) => new Types.ObjectId(id)),
              },
            }
          : { createdBy: new Types.ObjectId(filter.userId) };

    // The receivables computation reads every order in scope, so the ceiling
    // is generous for a workshop's order book.
    const documents = await getSalesOrderModel()
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(1_000)
      .lean<SalesOrderDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async listByCustomer(customerId: string): Promise<OrderRecordDto[]> {
    if (!Types.ObjectId.isValid(customerId)) return [];
    await connectToDatabase();

    const documents = await getSalesOrderModel()
      .find({ customerId: new Types.ObjectId(customerId) })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean<SalesOrderDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async applyTransition(
    input: OrderTransitionWrite,
  ): Promise<OrderRecordDto | null> {
    await connectToDatabase();

    // Conditional on the revision the caller judged: a concurrent change
    // makes this a miss, never a silent overwrite.
    const document = await getSalesOrderModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.orderId),
          revision: input.expectedRevision,
        },
        {
          $set: {
            stage: input.to,
            qcPassed: input.qcPassed,
            updatedBy: new Types.ObjectId(input.updatedBy),
          },
          $push: { stageHistory: historyDocument(input.historyEntry) },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<SalesOrderDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async setQcPassed(input: {
    orderId: string;
    expectedRevision: number;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    await connectToDatabase();

    const document = await getSalesOrderModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.orderId),
          revision: input.expectedRevision,
          stage: "qualityControl",
        },
        {
          $set: {
            qcPassed: true,
            updatedBy: new Types.ObjectId(input.updatedBy),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<SalesOrderDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async setSellingPrice(input: {
    orderId: string;
    expectedRevision: number;
    sellingPrice: OrderSellingPrice;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    await connectToDatabase();

    const document = await getSalesOrderModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.orderId),
          revision: input.expectedRevision,
          // Price is editable only while the commercial file is still open.
          stage: { $in: ["received", "fileOpened"] },
        },
        {
          $set: {
            sellingPrice: input.sellingPrice,
            updatedBy: new Types.ObjectId(input.updatedBy),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<SalesOrderDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async setExportProgress(
    input: OrderExportProgressWrite,
  ): Promise<OrderRecordDto | null> {
    await connectToDatabase();

    const document = await getSalesOrderModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.orderId),
          revision: input.expectedRevision,
        },
        {
          $set: {
            expectedReadyAt: input.expectedReadyAt,
            bookingNumber: input.bookingNumber,
            bookingDate: input.bookingDate,
            updatedBy: new Types.ObjectId(input.updatedBy),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<SalesOrderDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async addPaymentDocument(input: {
    orderId: string;
    expectedRevision: number;
    document: NewOrderPaymentDocument;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    await connectToDatabase();

    const document = await getSalesOrderModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.orderId),
          revision: input.expectedRevision,
        },
        {
          $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
          $push: {
            paymentDocuments: {
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
      .lean<SalesOrderDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async removePaymentDocument(input: {
    orderId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    if (!Types.ObjectId.isValid(input.documentId)) return null;
    await connectToDatabase();

    const document = await getSalesOrderModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.orderId),
          revision: input.expectedRevision,
          "paymentDocuments._id": new Types.ObjectId(input.documentId),
        },
        {
          $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
          $pull: {
            paymentDocuments: { _id: new Types.ObjectId(input.documentId) },
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<SalesOrderDocument>()
      .exec();
    return document ? toDto(document) : null;
  }
}

export const mongoOrderStore = new MongoOrderStore();
