import "server-only";

import { Types } from "mongoose";

import {
  OrderCommandError,
  type NewOrderRecord,
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
  customerName: string;
  businessUnitIds: Types.ObjectId[];
  stage: OrderStage;
  qcPassed: boolean;
  sellingPrice: OrderSellingPrice | null;
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
        customerName: record.customerName,
        businessUnitIds: record.businessUnitIds.map(
          (id) => new Types.ObjectId(id),
        ),
        stage: "received",
        qcPassed: false,
        sellingPrice: record.sellingPrice,
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

    const documents = await getSalesOrderModel()
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(200)
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
}

export const mongoOrderStore = new MongoOrderStore();
