import "server-only";

import { Types } from "mongoose";

import type {
  FinanceActiveFilter,
  FinanceEntryAmount,
  FinanceEntryCategory,
  FinanceEntryKind,
  FinanceEntryRecordDto,
  FinanceEntryStore,
  FinanceListFilter,
  FinanceListScope,
  FinancePaymentMethod,
  NewFinanceEntryRecord,
  OrderAmountTotals,
  ReceiptAllocation,
} from "@/domains/finance/contracts";
import { getFinanceEntryModel } from "@/domains/finance/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";
import { money, sum, zero, type Currency, type Money } from "@/lib/money";

type AllocationDocument = {
  target: "invoice" | "order";
  invoiceId?: Types.ObjectId | null;
  invoiceNumber?: string | null;
  orderId: Types.ObjectId;
  orderCode: string;
  amount: string;
};

type FinanceEntryDocument = {
  _id: Types.ObjectId;
  kind: FinanceEntryKind;
  category: FinanceEntryCategory;
  orderId: Types.ObjectId | null;
  orderCode: string | null;
  customerId?: Types.ObjectId | null;
  supplierId?: Types.ObjectId | null;
  counterparty: string;
  amount: FinanceEntryAmount;
  method: FinancePaymentMethod;
  occurredAt: Date;
  note: string | null;
  allocations?: AllocationDocument[];
  fxRateToVnd?: string | null;
  status: "active" | "voided";
  voidReason: string | null;
  businessUnitIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

function allocationToDto(document: AllocationDocument): ReceiptAllocation {
  if (document.target === "invoice" && document.invoiceId) {
    return {
      target: "invoice",
      invoiceId: document.invoiceId.toHexString(),
      invoiceNumber: document.invoiceNumber ?? "",
      orderId: document.orderId.toHexString(),
      orderCode: document.orderCode,
      amount: document.amount,
    };
  }
  return {
    target: "order",
    orderId: document.orderId.toHexString(),
    orderCode: document.orderCode,
    amount: document.amount,
  };
}

function allocationToDocument(allocation: ReceiptAllocation) {
  return allocation.target === "invoice"
    ? {
        target: "invoice",
        invoiceId: new Types.ObjectId(allocation.invoiceId),
        invoiceNumber: allocation.invoiceNumber,
        orderId: new Types.ObjectId(allocation.orderId),
        orderCode: allocation.orderCode,
        amount: allocation.amount,
      }
    : {
        target: "order",
        invoiceId: null,
        invoiceNumber: null,
        orderId: new Types.ObjectId(allocation.orderId),
        orderCode: allocation.orderCode,
        amount: allocation.amount,
      };
}

function toDto(document: FinanceEntryDocument): FinanceEntryRecordDto {
  return {
    id: document._id.toHexString(),
    kind: document.kind,
    category: document.category,
    orderId: document.orderId ? document.orderId.toHexString() : null,
    orderCode: document.orderCode ?? null,
    customerId: document.customerId ? document.customerId.toHexString() : null,
    supplierId: document.supplierId ? document.supplierId.toHexString() : null,
    counterparty: document.counterparty,
    amount: {
      amount: document.amount.amount,
      currency: document.amount.currency,
    },
    method: document.method,
    occurredAt: document.occurredAt,
    note: document.note ?? null,
    allocations: (document.allocations ?? []).map(allocationToDto),
    fxRateToVnd: document.fxRateToVnd ?? null,
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

export class MongoFinanceEntryStore implements FinanceEntryStore {
  async insert(record: NewFinanceEntryRecord): Promise<FinanceEntryRecordDto> {
    await connectToDatabase();

    const actorId = new Types.ObjectId(record.createdBy);
    const document = await getFinanceEntryModel().create({
      kind: record.kind,
      category: record.category,
      orderId: record.orderId ? new Types.ObjectId(record.orderId) : null,
      orderCode: record.orderCode,
      customerId: record.customerId
        ? new Types.ObjectId(record.customerId)
        : null,
      supplierId: record.supplierId
        ? new Types.ObjectId(record.supplierId)
        : null,
      counterparty: record.counterparty,
      amount: record.amount,
      method: record.method,
      occurredAt: record.occurredAt,
      note: record.note,
      allocations: record.allocations.map(allocationToDocument),
      fxRateToVnd: record.fxRateToVnd,
      status: "active",
      voidReason: null,
      businessUnitIds: record.businessUnitIds.map(
        (id) => new Types.ObjectId(id),
      ),
      createdBy: actorId,
      updatedBy: actorId,
    });
    return toDto(document.toObject() as FinanceEntryDocument);
  }

  async findById(entryId: string): Promise<FinanceEntryRecordDto | null> {
    if (!Types.ObjectId.isValid(entryId)) return null;
    await connectToDatabase();

    const document = await getFinanceEntryModel()
      .findById(entryId)
      .lean<FinanceEntryDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async list(filter: FinanceListFilter): Promise<FinanceEntryRecordDto[]> {
    await connectToDatabase();

    const documents = await getFinanceEntryModel()
      .find({
        ...scopeQuery(filter.scope),
        ...(filter.entryKind ? { kind: filter.entryKind } : {}),
        ...(filter.orderId && Types.ObjectId.isValid(filter.orderId)
          ? { orderId: new Types.ObjectId(filter.orderId) }
          : {}),
        ...(filter.customerId && Types.ObjectId.isValid(filter.customerId)
          ? { customerId: new Types.ObjectId(filter.customerId) }
          : {}),
        ...(filter.supplierId && Types.ObjectId.isValid(filter.supplierId)
          ? { supplierId: new Types.ObjectId(filter.supplierId) }
          : {}),
      })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(filter.limit ?? 200)
      .lean<FinanceEntryDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async listActive(
    filter: FinanceActiveFilter,
  ): Promise<FinanceEntryRecordDto[]> {
    await connectToDatabase();

    const documents = await getFinanceEntryModel()
      .find({
        ...scopeQuery(filter.scope),
        status: "active",
        ...(filter.kind ? { kind: filter.kind } : {}),
        ...(filter.category ? { category: filter.category } : {}),
        ...(filter.orderId && Types.ObjectId.isValid(filter.orderId)
          ? { orderId: new Types.ObjectId(filter.orderId) }
          : {}),
        ...(filter.customerId && Types.ObjectId.isValid(filter.customerId)
          ? { customerId: new Types.ObjectId(filter.customerId) }
          : {}),
      })
      .sort({ occurredAt: -1, _id: -1 })
      .lean<FinanceEntryDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async void(input: {
    entryId: string;
    expectedRevision: number;
    reason: string;
    updatedBy: string;
  }): Promise<FinanceEntryRecordDto | null> {
    await connectToDatabase();

    const document = await getFinanceEntryModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.entryId),
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
      .lean<FinanceEntryDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async setAllocations(input: {
    entryId: string;
    expectedRevision: number;
    allocations: readonly ReceiptAllocation[];
    updatedBy: string;
  }): Promise<FinanceEntryRecordDto | null> {
    await connectToDatabase();

    const document = await getFinanceEntryModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.entryId),
          revision: input.expectedRevision,
          status: "active",
        },
        {
          $set: {
            allocations: input.allocations.map(allocationToDocument),
            updatedBy: new Types.ObjectId(input.updatedBy),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<FinanceEntryDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async sumActiveByOrder(
    orderIds: readonly string[],
    kind: FinanceEntryKind,
  ): Promise<OrderAmountTotals> {
    const validIds = orderIds.filter(Types.ObjectId.isValid);
    if (validIds.length === 0) return new Map();
    await connectToDatabase();

    // Amounts are decimal strings, so the arithmetic happens here through the
    // money module rather than in a Mongo $sum over floats.
    const documents = await getFinanceEntryModel()
      .find({
        orderId: { $in: validIds.map((id) => new Types.ObjectId(id)) },
        kind,
        status: "active",
      })
      .select({ orderId: 1, amount: 1 })
      .lean<Pick<FinanceEntryDocument, "_id" | "orderId" | "amount">[]>()
      .exec();

    const grouped = new Map<string, Map<Currency, Money[]>>();
    for (const document of documents) {
      if (!document.orderId) continue;
      const orderKey = document.orderId.toHexString();
      const byCurrency = grouped.get(orderKey) ?? new Map<Currency, Money[]>();
      const values = byCurrency.get(document.amount.currency) ?? [];
      values.push(money(document.amount.amount, document.amount.currency));
      byCurrency.set(document.amount.currency, values);
      grouped.set(orderKey, byCurrency);
    }

    const totals = new Map<string, FinanceEntryAmount[]>();
    for (const [orderKey, byCurrency] of grouped) {
      const orderTotals: Money[] = [];
      for (const [currency, values] of byCurrency) {
        orderTotals.push(sum(values, currency));
      }
      totals.set(
        orderKey,
        orderTotals.filter(
          (total) => total.amount !== zero(total.currency).amount,
        ),
      );
    }
    return totals;
  }
}

export const mongoFinanceEntryStore = new MongoFinanceEntryStore();
