import "server-only";

import { Types } from "mongoose";

import {
  OrderCommandError,
  type NewOrderDocument,
  type NewOrderLineItem,
  type NewOrderPaymentDocument,
  type NewOrderQcCheck,
  type NewOrderRecord,
  type OrderDetailsWrite,
  type OrderDocumentKind,
  type OrderExportProgressWrite,
  type OrderLabelApproval,
  type OrderListFilter,
  type OrderPackingRecord,
  type OrderProductionPlan,
  type OrderRecordDto,
  type OrderSellingPrice,
  type OrderStageHistoryEntry,
  type OrderStore,
  type OrderTransitionWrite,
  type QcResult,
} from "@/domains/orders/contracts";
import { getSalesOrderModel } from "@/domains/orders/persistence/models";
import {
  normalizeOrderStage,
  type ProductionStage,
  type QcCheckpoint,
} from "@/domains/orders/workflow";
import { connectToDatabase } from "@/lib/db/mongoose";

type StoredFile = {
  _id: Types.ObjectId;
  publicId: string;
  assetVersion: number;
  format: string;
  bytes: number;
  label: string;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
};

type SalesOrderDocument = {
  _id: Types.ObjectId;
  orderCode: string;
  customerId?: Types.ObjectId | null;
  customerName: string;
  businessUnitIds: Types.ObjectId[];
  /** May still hold a retired stage key; read forward in `toDto`. */
  stage: string;
  qcPassed: boolean;
  sellingPrice: OrderSellingPrice | null;
  lineItems?: {
    _id: Types.ObjectId;
    productCode: string;
    description?: string;
    quantity: string;
    unit?: string;
    facilityName?: string | null;
    note?: string | null;
  }[];
  shippingMark?: string | null;
  deliveryDueAt?: Date | null;
  targets?: string | null;
  productionPlan?: {
    woodworkDue?: Date | null;
    lacquerDue?: Date | null;
    finishingDue?: Date | null;
    packingDue?: Date | null;
    shipDue?: Date | null;
    assignment?: string | null;
    note?: string | null;
    savedBy: Types.ObjectId;
    savedAt: Date;
  } | null;
  productionStage?: ProductionStage | null;
  qcChecks?: {
    _id: Types.ObjectId;
    checkpoint: QcCheckpoint;
    result: QcResult;
    defectCount?: number | null;
    note?: string | null;
    byUserId: Types.ObjectId;
    at: Date;
  }[];
  packingRecord?: {
    packedAt?: Date | null;
    cartons?: number | null;
    pallets?: number | null;
    containerNumber?: string | null;
    note?: string | null;
    byUserId: Types.ObjectId;
    at: Date;
  } | null;
  documents?: (StoredFile & { kind: OrderDocumentKind })[];
  labelApproval?: {
    documentId: Types.ObjectId;
    approvedBy: Types.ObjectId;
    approvedAt: Date;
  } | null;
  expectedReadyAt?: Date | null;
  bookingNumber?: string | null;
  bookingDate?: Date | null;
  paymentDocuments?: StoredFile[];
  notes: string | null;
  stageHistory: {
    from: string;
    to: string;
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

function fileDto(item: StoredFile) {
  return {
    id: item._id.toHexString(),
    publicId: item.publicId,
    assetVersion: item.assetVersion,
    format: item.format,
    bytes: item.bytes,
    label: item.label,
    uploadedBy: item.uploadedBy.toHexString(),
    uploadedAt: item.uploadedAt,
  };
}

function toDto(document: SalesOrderDocument): OrderRecordDto {
  const plan = document.productionPlan ?? null;
  const packing = document.packingRecord ?? null;
  return {
    id: document._id.toHexString(),
    orderCode: document.orderCode,
    customerId: document.customerId ? document.customerId.toHexString() : null,
    customerName: document.customerName,
    businessUnitIds: document.businessUnitIds.map((id) => id.toHexString()),
    stage: normalizeOrderStage(document.stage),
    qcPassed: document.qcPassed,
    sellingPrice: document.sellingPrice
      ? {
          amount: document.sellingPrice.amount,
          currency: document.sellingPrice.currency,
        }
      : null,
    lineItems: (document.lineItems ?? []).map((line) => ({
      id: line._id.toHexString(),
      productCode: line.productCode,
      description: line.description ?? "",
      quantity: line.quantity,
      unit: line.unit ?? "cái",
      facilityName: line.facilityName ?? null,
      note: line.note ?? null,
    })),
    shippingMark: document.shippingMark ?? null,
    deliveryDueAt: document.deliveryDueAt ?? null,
    targets: document.targets ?? null,
    productionPlan: plan
      ? {
          woodworkDue: plan.woodworkDue ?? null,
          lacquerDue: plan.lacquerDue ?? null,
          finishingDue: plan.finishingDue ?? null,
          packingDue: plan.packingDue ?? null,
          shipDue: plan.shipDue ?? null,
          assignment: plan.assignment ?? null,
          note: plan.note ?? null,
          savedBy: plan.savedBy.toHexString(),
          savedAt: plan.savedAt,
        }
      : null,
    productionStage: document.productionStage ?? null,
    qcChecks: (document.qcChecks ?? []).map((check) => ({
      id: check._id.toHexString(),
      checkpoint: check.checkpoint,
      result: check.result,
      defectCount: check.defectCount ?? null,
      note: check.note ?? null,
      byUserId: check.byUserId.toHexString(),
      at: check.at,
    })),
    packingRecord: packing
      ? {
          packedAt: packing.packedAt ?? null,
          cartons: packing.cartons ?? null,
          pallets: packing.pallets ?? null,
          containerNumber: packing.containerNumber ?? null,
          note: packing.note ?? null,
          byUserId: packing.byUserId.toHexString(),
          at: packing.at,
        }
      : null,
    documents: (document.documents ?? []).map((item) => ({
      kind: item.kind,
      ...fileDto(item),
    })),
    labelApproval: document.labelApproval
      ? {
          documentId: document.labelApproval.documentId.toHexString(),
          approvedBy: document.labelApproval.approvedBy.toHexString(),
          approvedAt: document.labelApproval.approvedAt,
        }
      : null,
    expectedReadyAt: document.expectedReadyAt ?? null,
    bookingNumber: document.bookingNumber ?? null,
    bookingDate: document.bookingDate ?? null,
    paymentDocuments: (document.paymentDocuments ?? []).map(fileDto),
    notes: document.notes ?? null,
    stageHistory: document.stageHistory.map((entry) => ({
      from: normalizeOrderStage(entry.from),
      to: normalizeOrderStage(entry.to),
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

function lineItemDocuments(lineItems: readonly NewOrderLineItem[]) {
  return lineItems.map((line) => ({
    _id: new Types.ObjectId(),
    productCode: line.productCode,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    facilityName: line.facilityName,
    note: line.note,
  }));
}

function fileDocument(document: NewOrderPaymentDocument) {
  return {
    _id: new Types.ObjectId(),
    publicId: document.publicId,
    assetVersion: document.assetVersion,
    format: document.format,
    bytes: document.bytes,
    label: document.label,
    uploadedBy: new Types.ObjectId(document.uploadedBy),
    uploadedAt: document.uploadedAt,
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
  /**
   * Every write is conditional on the revision the caller judged: a
   * concurrent change makes it a miss, never a silent overwrite.
   */
  private async update(
    orderId: string,
    expectedRevision: number,
    update: Record<string, unknown>,
    extraFilter: Record<string, unknown> = {},
  ): Promise<OrderRecordDto | null> {
    await connectToDatabase();
    const document = await getSalesOrderModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          revision: expectedRevision,
          ...extraFilter,
        },
        { ...update, $inc: { revision: 1 } },
        { new: true },
      )
      .lean<SalesOrderDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

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
        lineItems: lineItemDocuments(record.lineItems),
        shippingMark: record.shippingMark,
        deliveryDueAt: record.deliveryDueAt,
        targets: record.targets,
        productionPlan: null,
        productionStage: null,
        qcChecks: [],
        packingRecord: null,
        documents: [],
        labelApproval: null,
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

  async findByCode(orderCode: string): Promise<OrderRecordDto | null> {
    const normalized = orderCode.trim().toUpperCase();
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(normalized)) return null;
    await connectToDatabase();

    const document = await getSalesOrderModel()
      .findOne({ orderCode: normalized })
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
    return this.update(input.orderId, input.expectedRevision, {
      $set: {
        stage: input.to,
        qcPassed: input.qcPassed,
        ...(input.productionStage !== undefined
          ? { productionStage: input.productionStage }
          : {}),
        updatedBy: new Types.ObjectId(input.updatedBy),
      },
      $push: { stageHistory: historyDocument(input.historyEntry) },
    });
  }

  async setSellingPrice(input: {
    orderId: string;
    expectedRevision: number;
    sellingPrice: OrderSellingPrice;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    return this.update(
      input.orderId,
      input.expectedRevision,
      {
        $set: {
          sellingPrice: input.sellingPrice,
          updatedBy: new Types.ObjectId(input.updatedBy),
        },
      },
      // Price is editable only until the Director has confirmed the order.
      {
        stage: { $in: ["received", "fileOpened", "awaitingDirectorApproval"] },
      },
    );
  }

  async setLineItems(input: {
    orderId: string;
    expectedRevision: number;
    lineItems: readonly NewOrderLineItem[];
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    return this.update(input.orderId, input.expectedRevision, {
      $set: {
        lineItems: lineItemDocuments(input.lineItems),
        updatedBy: new Types.ObjectId(input.updatedBy),
      },
    });
  }

  async setDetails(input: OrderDetailsWrite): Promise<OrderRecordDto | null> {
    return this.update(input.orderId, input.expectedRevision, {
      $set: {
        shippingMark: input.shippingMark,
        deliveryDueAt: input.deliveryDueAt,
        targets: input.targets,
        updatedBy: new Types.ObjectId(input.updatedBy),
      },
    });
  }

  async setProductionPlan(input: {
    orderId: string;
    expectedRevision: number;
    plan: OrderProductionPlan;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    return this.update(input.orderId, input.expectedRevision, {
      $set: {
        productionPlan: {
          ...input.plan,
          savedBy: new Types.ObjectId(input.plan.savedBy),
        },
        updatedBy: new Types.ObjectId(input.updatedBy),
      },
    });
  }

  async setProductionStage(input: {
    orderId: string;
    expectedRevision: number;
    productionStage: ProductionStage;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    return this.update(
      input.orderId,
      input.expectedRevision,
      {
        $set: {
          productionStage: input.productionStage,
          updatedBy: new Types.ObjectId(input.updatedBy),
        },
      },
      { stage: "inProduction" },
    );
  }

  async addQcCheck(input: {
    orderId: string;
    expectedRevision: number;
    check: NewOrderQcCheck;
    qcPassed: boolean;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    return this.update(input.orderId, input.expectedRevision, {
      $set: {
        qcPassed: input.qcPassed,
        updatedBy: new Types.ObjectId(input.updatedBy),
      },
      $push: {
        qcChecks: {
          _id: new Types.ObjectId(),
          checkpoint: input.check.checkpoint,
          result: input.check.result,
          defectCount: input.check.defectCount,
          note: input.check.note,
          byUserId: new Types.ObjectId(input.check.byUserId),
          at: input.check.at,
        },
      },
    });
  }

  async setPackingRecord(input: {
    orderId: string;
    expectedRevision: number;
    record: OrderPackingRecord;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    return this.update(input.orderId, input.expectedRevision, {
      $set: {
        packingRecord: {
          ...input.record,
          byUserId: new Types.ObjectId(input.record.byUserId),
        },
        updatedBy: new Types.ObjectId(input.updatedBy),
      },
    });
  }

  async setExportProgress(
    input: OrderExportProgressWrite,
  ): Promise<OrderRecordDto | null> {
    return this.update(input.orderId, input.expectedRevision, {
      $set: {
        expectedReadyAt: input.expectedReadyAt,
        bookingNumber: input.bookingNumber,
        bookingDate: input.bookingDate,
        updatedBy: new Types.ObjectId(input.updatedBy),
      },
    });
  }

  async addDocument(input: {
    orderId: string;
    expectedRevision: number;
    document: NewOrderDocument;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    return this.update(input.orderId, input.expectedRevision, {
      $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
      $push: {
        documents: {
          kind: input.document.kind,
          ...fileDocument(input.document),
        },
      },
    });
  }

  async removeDocument(input: {
    orderId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    if (!Types.ObjectId.isValid(input.documentId)) return null;
    if (!Types.ObjectId.isValid(input.orderId)) return null;
    const documentId = new Types.ObjectId(input.documentId);

    // Whether the file is the approved label proof, read at the revision the
    // caller judged; the write below is pinned to that same revision, so the
    // answer cannot go stale between the two.
    await connectToDatabase();
    const current = await getSalesOrderModel()
      .findOne({
        _id: new Types.ObjectId(input.orderId),
        revision: input.expectedRevision,
      })
      .select("labelApproval")
      .lean<Pick<SalesOrderDocument, "labelApproval">>()
      .exec();
    if (!current) return null;
    const clearsApproval =
      current.labelApproval?.documentId.equals(documentId) ?? false;

    return this.update(
      input.orderId,
      input.expectedRevision,
      {
        $set: {
          updatedBy: new Types.ObjectId(input.updatedBy),
          ...(clearsApproval ? { labelApproval: null } : {}),
        },
        $pull: { documents: { _id: documentId } },
      },
      { "documents._id": documentId },
    );
  }

  async setLabelApproval(input: {
    orderId: string;
    expectedRevision: number;
    approval: OrderLabelApproval;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    if (!Types.ObjectId.isValid(input.approval.documentId)) return null;
    const documentId = new Types.ObjectId(input.approval.documentId);
    return this.update(
      input.orderId,
      input.expectedRevision,
      {
        $set: {
          labelApproval: {
            documentId,
            approvedBy: new Types.ObjectId(input.approval.approvedBy),
            approvedAt: input.approval.approvedAt,
          },
          updatedBy: new Types.ObjectId(input.updatedBy),
        },
      },
      // Only a proof still on file can be approved.
      { documents: { $elemMatch: { _id: documentId, kind: "labelProof" } } },
    );
  }

  async addPaymentDocument(input: {
    orderId: string;
    expectedRevision: number;
    document: NewOrderPaymentDocument;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    return this.update(input.orderId, input.expectedRevision, {
      $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
      $push: { paymentDocuments: fileDocument(input.document) },
    });
  }

  async removePaymentDocument(input: {
    orderId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    if (!Types.ObjectId.isValid(input.documentId)) return null;
    return this.update(
      input.orderId,
      input.expectedRevision,
      {
        $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
        $pull: {
          paymentDocuments: { _id: new Types.ObjectId(input.documentId) },
        },
      },
      { "paymentDocuments._id": new Types.ObjectId(input.documentId) },
    );
  }
}

export const mongoOrderStore = new MongoOrderStore();
