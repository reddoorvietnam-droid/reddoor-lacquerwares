import { vi } from "vitest";

import type {
  AuditEventInput,
  AuditRepository,
} from "@/domains/audit/contracts";
import {
  CustomerCommandError,
  type CustomerListFilter,
  type CustomerRecordDto,
  type CustomerStatus,
  type CustomerStore,
  type CustomerWriteFields,
} from "@/domains/customers/contracts";
import {
  FinanceCommandError,
  type FinanceActiveFilter,
  type FinanceEntryAmount,
  type FinanceEntryKind,
  type FinanceEntryRecordDto,
  type FinanceEntryStore,
  type FinanceListFilter,
  type FxRateRecordDto,
  type FxRateStore,
  type InvoiceListFilter,
  type InvoiceRecordDto,
  type InvoiceStore,
  type NewFinanceEntryRecord,
  type NewInvoiceRecord,
  type NewStoredDocument,
  type OrderAmountTotals,
  type ReceiptAllocation,
} from "@/domains/finance/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  OrderCommandError,
  type NewOrderPaymentDocument,
  type NewOrderRecord,
  type OrderExportProgressWrite,
  type OrderListFilter,
  type OrderRecordDto,
  type OrderSellingPrice,
  type OrderStore,
  type OrderTransitionWrite,
} from "@/domains/orders/contracts";
import {
  SupplierCommandError,
  type SupplierListFilter,
  type SupplierRecordDto,
  type SupplierStatus,
  type SupplierStore,
  type SupplierWriteFields,
} from "@/domains/suppliers/contracts";
import type {
  AccessContext,
  EffectivePermission,
} from "@/lib/auth/authorization";
import { add, money, sum, type Currency, type Money } from "@/lib/money";

/**
 * In-memory stores for the finance, order, customer and supplier services.
 * They mimic the Mongo stores' contracts closely enough — revision checks,
 * unique codes, active-only filters — that the services can be exercised
 * end to end without a database.
 */

export const actorId = "aaaaaaaaaaaaaaaaaaaaaaaa";
export const otherActorId = "abababababababababababab";
export const unitId = "111111111111111111111111";
export const occurredAt = new Date("2026-09-05T09:30:00.000Z");

let sequence = 0;
export function nextId(prefix = "0"): string {
  sequence += 1;
  return `${prefix}${String(sequence).padStart(24 - prefix.length, "0")}`;
}

export function accessContext(
  permissions: readonly Permission[],
  scope: EffectivePermission["scope"] = "all",
  userId: string = actorId,
): AccessContext {
  return {
    actorType: "user",
    userId,
    userStatus: "active",
    authzVersion: 1,
    requestId: "request-123",
    permissions: permissions.map((permission) => ({
      permission,
      scope,
      businessUnitIds: scope === "assignedBusinessUnits" ? [unitId] : [],
      roleKeys: ["TEST"],
    })),
  };
}

export function auditRepository(): AuditRepository & {
  events: AuditEventInput[];
} {
  const events: AuditEventInput[] = [];
  return {
    events,
    append: vi.fn(async (event: AuditEventInput) => {
      events.push(event);
      return { id: "audit", occurredAt: event.occurredAt };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Customers and suppliers                                             */
/* ------------------------------------------------------------------ */

export class FakeCustomerStore implements CustomerStore {
  customers = new Map<string, CustomerRecordDto>();

  seed(partial: Partial<CustomerRecordDto> = {}): CustomerRecordDto {
    const id = partial.id ?? nextId("c");
    const record: CustomerRecordDto = {
      id,
      code: partial.code ?? null,
      name: partial.name ?? "Khách A",
      taxCode: partial.taxCode ?? null,
      country: partial.country ?? null,
      email: partial.email ?? null,
      phone: partial.phone ?? null,
      address: partial.address ?? null,
      defaultCurrency: partial.defaultCurrency ?? null,
      notes: partial.notes ?? null,
      status: partial.status ?? "active",
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: partial.revision ?? 0,
    };
    this.customers.set(id, record);
    return record;
  }

  private assertUniqueCode(code: string | null, exceptId: string | null) {
    if (!code) return;
    for (const existing of this.customers.values()) {
      if (existing.id !== exceptId && existing.code === code) {
        throw new CustomerCommandError("DUPLICATE_CODE", "duplicate");
      }
    }
  }

  async insert(
    record: CustomerWriteFields & { createdBy: string },
  ): Promise<CustomerRecordDto> {
    this.assertUniqueCode(record.code, null);
    return this.seed({ ...record });
  }

  async findById(customerId: string): Promise<CustomerRecordDto | null> {
    return this.customers.get(customerId) ?? null;
  }

  async findByIds(
    customerIds: readonly string[],
  ): Promise<ReadonlyMap<string, CustomerRecordDto>> {
    return new Map(
      customerIds
        .map((id) => this.customers.get(id))
        .filter((record): record is CustomerRecordDto => record !== undefined)
        .map((record) => [record.id, record]),
    );
  }

  async list(filter: CustomerListFilter): Promise<CustomerRecordDto[]> {
    return [...this.customers.values()].filter(
      (record) => !filter.status || record.status === filter.status,
    );
  }

  async update(input: {
    customerId: string;
    expectedRevision: number;
    fields: CustomerWriteFields;
    updatedBy: string;
  }): Promise<CustomerRecordDto | null> {
    const existing = this.customers.get(input.customerId);
    if (!existing || existing.revision !== input.expectedRevision) return null;
    this.assertUniqueCode(input.fields.code, existing.id);
    const updated: CustomerRecordDto = {
      ...existing,
      ...input.fields,
      updatedBy: input.updatedBy,
      revision: existing.revision + 1,
    };
    this.customers.set(existing.id, updated);
    return updated;
  }

  async setStatus(input: {
    customerId: string;
    expectedRevision: number;
    status: CustomerStatus;
    updatedBy: string;
  }): Promise<CustomerRecordDto | null> {
    const existing = this.customers.get(input.customerId);
    if (!existing || existing.revision !== input.expectedRevision) return null;
    const updated: CustomerRecordDto = {
      ...existing,
      status: input.status,
      updatedBy: input.updatedBy,
      revision: existing.revision + 1,
    };
    this.customers.set(existing.id, updated);
    return updated;
  }
}

export class FakeSupplierStore implements SupplierStore {
  suppliers = new Map<string, SupplierRecordDto>();

  seed(partial: Partial<SupplierRecordDto> = {}): SupplierRecordDto {
    const id = partial.id ?? nextId("d");
    const record: SupplierRecordDto = {
      id,
      code: partial.code ?? null,
      name: partial.name ?? "Xưởng gỗ B",
      taxCode: partial.taxCode ?? null,
      category: partial.category ?? null,
      contactName: partial.contactName ?? null,
      email: partial.email ?? null,
      phone: partial.phone ?? null,
      address: partial.address ?? null,
      notes: partial.notes ?? null,
      status: partial.status ?? "active",
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: partial.revision ?? 0,
    };
    this.suppliers.set(id, record);
    return record;
  }

  private assertUniqueCode(code: string | null, exceptId: string | null) {
    if (!code) return;
    for (const existing of this.suppliers.values()) {
      if (existing.id !== exceptId && existing.code === code) {
        throw new SupplierCommandError("DUPLICATE_CODE", "duplicate");
      }
    }
  }

  async insert(
    record: SupplierWriteFields & { createdBy: string },
  ): Promise<SupplierRecordDto> {
    this.assertUniqueCode(record.code, null);
    return this.seed({ ...record });
  }

  async findById(supplierId: string): Promise<SupplierRecordDto | null> {
    return this.suppliers.get(supplierId) ?? null;
  }

  async list(filter: SupplierListFilter): Promise<SupplierRecordDto[]> {
    return [...this.suppliers.values()].filter(
      (record) => !filter.status || record.status === filter.status,
    );
  }

  async update(input: {
    supplierId: string;
    expectedRevision: number;
    fields: SupplierWriteFields;
    updatedBy: string;
  }): Promise<SupplierRecordDto | null> {
    const existing = this.suppliers.get(input.supplierId);
    if (!existing || existing.revision !== input.expectedRevision) return null;
    this.assertUniqueCode(input.fields.code, existing.id);
    const updated: SupplierRecordDto = {
      ...existing,
      ...input.fields,
      updatedBy: input.updatedBy,
      revision: existing.revision + 1,
    };
    this.suppliers.set(existing.id, updated);
    return updated;
  }

  async setStatus(input: {
    supplierId: string;
    expectedRevision: number;
    status: SupplierStatus;
    updatedBy: string;
  }): Promise<SupplierRecordDto | null> {
    const existing = this.suppliers.get(input.supplierId);
    if (!existing || existing.revision !== input.expectedRevision) return null;
    const updated: SupplierRecordDto = {
      ...existing,
      status: input.status,
      updatedBy: input.updatedBy,
      revision: existing.revision + 1,
    };
    this.suppliers.set(existing.id, updated);
    return updated;
  }
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export class FakeOrderStore implements OrderStore {
  orders = new Map<string, OrderRecordDto>();

  seed(partial: Partial<OrderRecordDto> = {}): OrderRecordDto {
    const id = partial.id ?? nextId("0");
    const record: OrderRecordDto = {
      id,
      orderCode: partial.orderCode ?? `RD-TEST-${sequence}`,
      customerId: partial.customerId === undefined ? null : partial.customerId,
      customerName: partial.customerName ?? "Khách A",
      businessUnitIds: partial.businessUnitIds ?? [unitId],
      stage: partial.stage ?? "received",
      qcPassed: partial.qcPassed ?? false,
      sellingPrice: partial.sellingPrice ?? null,
      expectedReadyAt: partial.expectedReadyAt ?? null,
      bookingNumber: partial.bookingNumber ?? null,
      bookingDate: partial.bookingDate ?? null,
      paymentDocuments: partial.paymentDocuments ?? [],
      notes: partial.notes ?? null,
      stageHistory: partial.stageHistory ?? [],
      createdBy: partial.createdBy ?? actorId,
      updatedBy: partial.updatedBy ?? actorId,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: partial.revision ?? 0,
    };
    this.orders.set(id, record);
    return record;
  }

  private bump(
    orderId: string,
    expectedRevision: number,
    patch: Partial<OrderRecordDto>,
  ): OrderRecordDto | null {
    const order = this.orders.get(orderId);
    if (!order || order.revision !== expectedRevision) return null;
    const updated: OrderRecordDto = {
      ...order,
      ...patch,
      revision: order.revision + 1,
    };
    this.orders.set(order.id, updated);
    return updated;
  }

  async insert(record: NewOrderRecord): Promise<OrderRecordDto> {
    for (const existing of this.orders.values()) {
      if (existing.orderCode === record.orderCode) {
        throw new OrderCommandError("DUPLICATE_ORDER_CODE", "duplicate");
      }
    }
    return this.seed({
      orderCode: record.orderCode,
      customerId: record.customerId,
      customerName: record.customerName,
      businessUnitIds: record.businessUnitIds,
      sellingPrice: record.sellingPrice,
      notes: record.notes,
      createdBy: record.createdBy,
      updatedBy: record.createdBy,
    });
  }

  async findById(orderId: string): Promise<OrderRecordDto | null> {
    return this.orders.get(orderId) ?? null;
  }

  async list(filter: OrderListFilter): Promise<OrderRecordDto[]> {
    const all = [...this.orders.values()];
    if (filter.kind === "all") return all;
    if (filter.kind === "businessUnits") {
      return all.filter((order) =>
        order.businessUnitIds.some((id) => filter.businessUnitIds.includes(id)),
      );
    }
    return all.filter((order) => order.createdBy === filter.userId);
  }

  async listByCustomer(customerId: string): Promise<OrderRecordDto[]> {
    return [...this.orders.values()].filter(
      (order) => order.customerId === customerId,
    );
  }

  async applyTransition(
    input: OrderTransitionWrite,
  ): Promise<OrderRecordDto | null> {
    const order = this.orders.get(input.orderId);
    if (!order) return null;
    return this.bump(input.orderId, input.expectedRevision, {
      stage: input.to,
      qcPassed: input.qcPassed,
      stageHistory: [...order.stageHistory, input.historyEntry],
      updatedBy: input.updatedBy,
    });
  }

  async setQcPassed(input: {
    orderId: string;
    expectedRevision: number;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    const order = this.orders.get(input.orderId);
    if (!order || order.stage !== "qualityControl") return null;
    return this.bump(input.orderId, input.expectedRevision, {
      qcPassed: true,
      updatedBy: input.updatedBy,
    });
  }

  async setSellingPrice(input: {
    orderId: string;
    expectedRevision: number;
    sellingPrice: OrderSellingPrice;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    const order = this.orders.get(input.orderId);
    if (!order || (order.stage !== "received" && order.stage !== "fileOpened")) {
      return null;
    }
    return this.bump(input.orderId, input.expectedRevision, {
      sellingPrice: input.sellingPrice,
      updatedBy: input.updatedBy,
    });
  }

  async setExportProgress(
    input: OrderExportProgressWrite,
  ): Promise<OrderRecordDto | null> {
    return this.bump(input.orderId, input.expectedRevision, {
      expectedReadyAt: input.expectedReadyAt,
      bookingNumber: input.bookingNumber,
      bookingDate: input.bookingDate,
      updatedBy: input.updatedBy,
    });
  }

  async addPaymentDocument(input: {
    orderId: string;
    expectedRevision: number;
    document: NewOrderPaymentDocument;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    const order = this.orders.get(input.orderId);
    if (!order) return null;
    return this.bump(input.orderId, input.expectedRevision, {
      paymentDocuments: [
        ...order.paymentDocuments,
        { id: nextId("f"), ...input.document },
      ],
      updatedBy: input.updatedBy,
    });
  }

  async removePaymentDocument(input: {
    orderId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    const order = this.orders.get(input.orderId);
    if (!order) return null;
    if (!order.paymentDocuments.some((item) => item.id === input.documentId)) {
      return null;
    }
    return this.bump(input.orderId, input.expectedRevision, {
      paymentDocuments: order.paymentDocuments.filter(
        (item) => item.id !== input.documentId,
      ),
      updatedBy: input.updatedBy,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Finance                                                             */
/* ------------------------------------------------------------------ */

export class FakeInvoiceStore implements InvoiceStore {
  invoices = new Map<string, InvoiceRecordDto>();

  seed(
    partial: Partial<InvoiceRecordDto> & { orderId: string },
  ): InvoiceRecordDto {
    const id = partial.id ?? nextId("1");
    const record: InvoiceRecordDto = {
      id,
      orderId: partial.orderId,
      orderCode: partial.orderCode ?? "RD-X",
      customerId: partial.customerId === undefined ? null : partial.customerId,
      customerName: partial.customerName ?? "Khách A",
      invoiceNumber: partial.invoiceNumber ?? `INV-${sequence}`,
      issuedAt: partial.issuedAt ?? occurredAt,
      dueAt: partial.dueAt ?? occurredAt,
      amount: partial.amount ?? { amount: "1000000", currency: "VND" },
      fxRateToVnd: partial.fxRateToVnd ?? null,
      note: partial.note ?? null,
      documents: partial.documents ?? [],
      status: partial.status ?? "active",
      voidReason: partial.voidReason ?? null,
      businessUnitIds: partial.businessUnitIds ?? [unitId],
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: partial.revision ?? 0,
    };
    this.invoices.set(id, record);
    return record;
  }

  private bump(
    invoiceId: string,
    expectedRevision: number,
    patch: Partial<InvoiceRecordDto>,
  ): InvoiceRecordDto | null {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice || invoice.revision !== expectedRevision) return null;
    const updated: InvoiceRecordDto = {
      ...invoice,
      ...patch,
      revision: invoice.revision + 1,
    };
    this.invoices.set(invoice.id, updated);
    return updated;
  }

  async insert(record: NewInvoiceRecord): Promise<InvoiceRecordDto> {
    for (const existing of this.invoices.values()) {
      if (
        existing.status === "active" &&
        existing.invoiceNumber === record.invoiceNumber
      ) {
        throw new FinanceCommandError("DUPLICATE_INVOICE_NUMBER", "duplicate");
      }
    }
    return this.seed({ ...record });
  }

  async findById(invoiceId: string): Promise<InvoiceRecordDto | null> {
    return this.invoices.get(invoiceId) ?? null;
  }

  async list(filter: InvoiceListFilter): Promise<InvoiceRecordDto[]> {
    return [...this.invoices.values()].filter(
      (invoice) =>
        (!filter.status || invoice.status === filter.status) &&
        (!filter.orderId || invoice.orderId === filter.orderId) &&
        (!filter.customerId || invoice.customerId === filter.customerId),
    );
  }

  async void(input: {
    invoiceId: string;
    expectedRevision: number;
    reason: string;
    updatedBy: string;
  }): Promise<InvoiceRecordDto | null> {
    const invoice = this.invoices.get(input.invoiceId);
    if (!invoice || invoice.status !== "active") return null;
    return this.bump(input.invoiceId, input.expectedRevision, {
      status: "voided",
      voidReason: input.reason,
      updatedBy: input.updatedBy,
    });
  }

  async addDocument(input: {
    invoiceId: string;
    expectedRevision: number;
    document: NewStoredDocument;
    updatedBy: string;
  }): Promise<InvoiceRecordDto | null> {
    const invoice = this.invoices.get(input.invoiceId);
    if (!invoice) return null;
    return this.bump(input.invoiceId, input.expectedRevision, {
      documents: [...invoice.documents, { id: nextId("f"), ...input.document }],
      updatedBy: input.updatedBy,
    });
  }

  async removeDocument(input: {
    invoiceId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<InvoiceRecordDto | null> {
    const invoice = this.invoices.get(input.invoiceId);
    if (!invoice) return null;
    if (!invoice.documents.some((item) => item.id === input.documentId)) {
      return null;
    }
    return this.bump(input.invoiceId, input.expectedRevision, {
      documents: invoice.documents.filter(
        (item) => item.id !== input.documentId,
      ),
      updatedBy: input.updatedBy,
    });
  }
}

export class FakeFinanceEntryStore implements FinanceEntryStore {
  entries = new Map<string, FinanceEntryRecordDto>();

  seed(
    partial: Partial<FinanceEntryRecordDto> & { amount: FinanceEntryAmount },
  ): FinanceEntryRecordDto {
    const id = partial.id ?? nextId("2");
    const record: FinanceEntryRecordDto = {
      id,
      kind: partial.kind ?? "receipt",
      category: partial.category ?? "orderPayment",
      orderId: partial.orderId ?? null,
      orderCode: partial.orderCode ?? null,
      customerId: partial.customerId === undefined ? null : partial.customerId,
      supplierId: partial.supplierId ?? null,
      counterparty: partial.counterparty ?? "Khách A",
      amount: partial.amount,
      method: partial.method ?? "bankTransfer",
      occurredAt: partial.occurredAt ?? occurredAt,
      note: partial.note ?? null,
      allocations: partial.allocations ?? [],
      fxRateToVnd: partial.fxRateToVnd ?? null,
      status: partial.status ?? "active",
      voidReason: partial.voidReason ?? null,
      businessUnitIds: partial.businessUnitIds ?? [],
      createdBy: partial.createdBy ?? actorId,
      updatedBy: partial.updatedBy ?? actorId,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: partial.revision ?? 0,
    };
    this.entries.set(id, record);
    return record;
  }

  async insert(record: NewFinanceEntryRecord): Promise<FinanceEntryRecordDto> {
    return this.seed({ ...record, updatedBy: record.createdBy });
  }

  async findById(entryId: string): Promise<FinanceEntryRecordDto | null> {
    return this.entries.get(entryId) ?? null;
  }

  async list(filter: FinanceListFilter): Promise<FinanceEntryRecordDto[]> {
    return [...this.entries.values()].filter(
      (entry) =>
        (!filter.entryKind || entry.kind === filter.entryKind) &&
        (!filter.orderId || entry.orderId === filter.orderId) &&
        (!filter.customerId || entry.customerId === filter.customerId) &&
        (!filter.supplierId || entry.supplierId === filter.supplierId),
    );
  }

  async listActive(
    filter: FinanceActiveFilter,
  ): Promise<FinanceEntryRecordDto[]> {
    return [...this.entries.values()].filter(
      (entry) =>
        entry.status === "active" &&
        (!filter.kind || entry.kind === filter.kind) &&
        (!filter.category || entry.category === filter.category) &&
        (!filter.orderId || entry.orderId === filter.orderId) &&
        (!filter.customerId || entry.customerId === filter.customerId),
    );
  }

  async void(input: {
    entryId: string;
    expectedRevision: number;
    reason: string;
    updatedBy: string;
  }): Promise<FinanceEntryRecordDto | null> {
    const entry = this.entries.get(input.entryId);
    if (
      !entry ||
      entry.revision !== input.expectedRevision ||
      entry.status !== "active"
    ) {
      return null;
    }
    const updated: FinanceEntryRecordDto = {
      ...entry,
      status: "voided",
      voidReason: input.reason,
      updatedBy: input.updatedBy,
      revision: entry.revision + 1,
    };
    this.entries.set(entry.id, updated);
    return updated;
  }

  async setAllocations(input: {
    entryId: string;
    expectedRevision: number;
    allocations: readonly ReceiptAllocation[];
    updatedBy: string;
  }): Promise<FinanceEntryRecordDto | null> {
    const entry = this.entries.get(input.entryId);
    if (
      !entry ||
      entry.revision !== input.expectedRevision ||
      entry.status !== "active"
    ) {
      return null;
    }
    const updated: FinanceEntryRecordDto = {
      ...entry,
      allocations: input.allocations,
      updatedBy: input.updatedBy,
      revision: entry.revision + 1,
    };
    this.entries.set(entry.id, updated);
    return updated;
  }

  async sumActiveByOrder(
    orderIds: readonly string[],
    kind: FinanceEntryKind,
  ): Promise<OrderAmountTotals> {
    const totals = new Map<string, FinanceEntryAmount[]>();
    for (const orderId of orderIds) {
      const byCurrency = new Map<Currency, Money[]>();
      for (const entry of this.entries.values()) {
        if (
          entry.status !== "active" ||
          entry.kind !== kind ||
          entry.orderId !== orderId
        ) {
          continue;
        }
        const list = byCurrency.get(entry.amount.currency) ?? [];
        list.push(money(entry.amount.amount, entry.amount.currency));
        byCurrency.set(entry.amount.currency, list);
      }
      const values = [...byCurrency.entries()].map(([currency, list]) =>
        sum(list, currency),
      );
      if (values.length > 0) totals.set(orderId, values);
    }
    return totals;
  }
}

export class FakeFxRateStore implements FxRateStore {
  rates: FxRateRecordDto[] = [];

  seed(date: string, rate: string, source: string | null = null): FxRateRecordDto {
    const record: FxRateRecordDto = {
      id: nextId("e"),
      date: new Date(`${date}T00:00:00.000Z`),
      from: "USD",
      to: "VND",
      rate,
      source,
      updatedBy: actorId,
      updatedAt: occurredAt,
    };
    this.rates = [
      ...this.rates.filter((item) => item.date.getTime() !== record.date.getTime()),
      record,
    ];
    return record;
  }

  async upsert(input: {
    date: Date;
    rate: string;
    source: string | null;
    actorId: string;
  }): Promise<FxRateRecordDto> {
    const existing = this.rates.find(
      (item) => item.date.getTime() === input.date.getTime(),
    );
    const record: FxRateRecordDto = {
      id: existing?.id ?? nextId("e"),
      date: input.date,
      from: "USD",
      to: "VND",
      rate: input.rate,
      source: input.source,
      updatedBy: input.actorId,
      updatedAt: occurredAt,
    };
    this.rates = [
      ...this.rates.filter((item) => item.id !== record.id),
      record,
    ];
    return record;
  }

  async findLatestOnOrBefore(date: Date): Promise<FxRateRecordDto | null> {
    return (
      [...this.rates]
        .filter((item) => item.date.getTime() <= date.getTime())
        .sort((left, right) => right.date.getTime() - left.date.getTime())[0] ??
      null
    );
  }

  async list(limit: number): Promise<FxRateRecordDto[]> {
    return [...this.rates]
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .slice(0, limit);
  }
}

/** Sums the active entries of one kind in one currency, for assertions. */
export function activeTotal(
  store: FakeFinanceEntryStore,
  kind: FinanceEntryKind,
  currency: Currency,
): Money {
  let total = money("0", currency);
  for (const entry of store.entries.values()) {
    if (
      entry.status === "active" &&
      entry.kind === kind &&
      entry.amount.currency === currency
    ) {
      total = add(total, money(entry.amount.amount, currency));
    }
  }
  return total;
}
