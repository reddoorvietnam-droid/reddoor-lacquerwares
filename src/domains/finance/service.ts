import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import type { CustomerStore } from "@/domains/customers/contracts";
import {
  categoryKind,
  createFinanceEntryInputSchema,
  FinanceCommandError,
  setAllocationsInputSchema,
  voidFinanceEntryInputSchema,
  type FinanceActiveFilter,
  type FinanceEntryKind,
  type FinanceEntryRecordDto,
  type FinanceEntryStore,
  type FinanceListFilter,
  type FinanceListScope,
  type FxRateStore,
  type InvoiceRecordDto,
  type InvoiceStore,
  type OrderAmountTotals,
  type ReceiptAllocation,
} from "@/domains/finance/contracts";
import {
  computeReceivables,
  customerCredit,
  customerKeyOf,
  invoiceAllocationCapacity,
  type ReceivablesReport,
} from "@/domains/finance/receivables";
import type { OrderRecordDto, OrderStore } from "@/domains/orders/contracts";
import type { Permission } from "@/domains/identity/permissions";
import type { SupplierStore } from "@/domains/suppliers/contracts";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";
import {
  add,
  compare,
  money,
  zero,
  type Currency,
  type Money,
} from "@/lib/money";

export type FinanceCommandServiceDependencies = {
  store: FinanceEntryStore;
  invoiceStore: InvoiceStore;
  orderStore: OrderStore;
  customerStore: CustomerStore;
  supplierStore: SupplierStore;
  fxRateStore: FxRateStore;
  auditRepository: AuditRepository;
  now?: () => Date;
};

export const FINANCE_RESOURCE_TYPE = "financeEntry";

function recordPermission(
  kind: FinanceEntryKind,
  category: string,
): Permission {
  if (kind === "receipt") return "payments.record";
  return category === "refund" ? "payments.refund" : "expenses.create";
}

function voidPermission(kind: FinanceEntryKind): Permission {
  return kind === "receipt" ? "payments.reverse" : "expenses.reverse";
}

function isPositive(value: Money): boolean {
  return compare(value, zero(value.currency)) > 0;
}

function min(left: Money, right: Money): Money {
  return compare(left, right) <= 0 ? left : right;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * The finance ledger command service. The caller's guard judges the
 * permission against the entry's business units (an order-linked entry
 * inherits the order's units); this service re-asserts the permission from
 * the guarded context, keeps receipt/expense categories apart, ties every
 * customer receipt and refund to a customer, and pins money against an
 * order or invoice to that order's currency so the balance stays computable.
 *
 * Amounts never enter the audit trail: audit readers are not guaranteed to
 * hold the finance read permissions.
 */
export class FinanceCommandService {
  private readonly dependencies: FinanceCommandServiceDependencies;

  constructor(dependencies: FinanceCommandServiceDependencies) {
    this.dependencies = dependencies;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private assertHolds(context: AccessContext, permission: Permission): void {
    const holds = context.permissions.some(
      (candidate) => candidate.permission === permission,
    );
    if (!holds || context.userStatus !== "active") {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
  }

  /** A receipt may only settle invoices and orders of its own customer. */
  private assertSameCustomer(
    entry: { customerId: string | null; counterparty: string },
    target: { customerId: string | null; customerName: string },
  ): void {
    const same =
      entry.customerId && target.customerId
        ? entry.customerId === target.customerId
        : normalizeName(entry.counterparty) ===
          normalizeName(target.customerName);
    if (!same) {
      throw new FinanceCommandError(
        "CUSTOMER_MISMATCH",
        "The receipt belongs to a different customer.",
      );
    }
  }

  /** The raw order for guard targeting before `createEntry`. */
  async findOrderForAuthorization(orderId: string) {
    return this.dependencies.orderStore.findById(orderId);
  }

  /** The raw invoice for guard targeting before `createEntry`. */
  async findInvoiceForAuthorization(
    invoiceId: string,
  ): Promise<InvoiceRecordDto | null> {
    return this.dependencies.invoiceStore.findById(invoiceId);
  }

  /** The raw entry for guard targeting before `voidEntry` / `setAllocations`. */
  async findForAuthorization(
    entryId: string,
  ): Promise<FinanceEntryRecordDto | null> {
    return this.dependencies.store.findById(entryId);
  }

  async createEntry(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FinanceEntryRecordDto> {
    const input = createFinanceEntryInputSchema.parse(rawInput);

    if (categoryKind[input.category] !== input.kind) {
      throw new FinanceCommandError(
        "INVALID_INPUT",
        "The category does not belong to this entry kind.",
      );
    }

    this.assertHolds(context, recordPermission(input.kind, input.category));

    const amount = money(input.amount.amount, input.amount.currency);
    if (!isPositive(amount)) {
      throw new FinanceCommandError(
        "INVALID_INPUT",
        "An entry must move a positive amount.",
      );
    }

    // Resolve the order (and invoice) the entry is recorded against.
    let order: OrderRecordDto | null = null;
    let invoice: InvoiceRecordDto | null = null;

    if (input.allocateTo) {
      if (input.category !== "orderPayment") {
        throw new FinanceCommandError(
          "INVALID_INPUT",
          "Only a customer payment can be applied to an invoice or order.",
        );
      }
      if (input.allocateTo.target === "invoice") {
        invoice = await this.dependencies.invoiceStore.findById(
          input.allocateTo.invoiceId,
        );
        if (!invoice) {
          throw new FinanceCommandError(
            "INVOICE_NOT_FOUND",
            "Invoice not found.",
          );
        }
        if (invoice.status === "voided") {
          throw new FinanceCommandError(
            "INVOICE_VOIDED",
            "The invoice is voided.",
          );
        }
        order = await this.dependencies.orderStore.findById(invoice.orderId);
      } else {
        order = await this.dependencies.orderStore.findById(
          input.allocateTo.orderId,
        );
      }
      if (!order) {
        throw new FinanceCommandError("ORDER_NOT_FOUND", "Order not found.");
      }
      if (input.orderId && input.orderId !== order.id) {
        throw new FinanceCommandError(
          "INVALID_INPUT",
          "The linked order does not match the allocation target.",
        );
      }
    } else if (input.orderId) {
      order = await this.dependencies.orderStore.findById(input.orderId);
      if (!order) {
        throw new FinanceCommandError("ORDER_NOT_FOUND", "Order not found.");
      }
    }

    // Money keeps arriving for a cancelled order only as a refund; costs may
    // still be booked against it (material already bought, for instance).
    if (order && order.stage === "cancelled" && input.kind === "receipt") {
      throw new FinanceCommandError(
        "ORDER_CANCELLED",
        "A cancelled order cannot receive a payment.",
      );
    }

    // Resolve who the money came from or went to.
    let customerId: string | null = null;
    let supplierId: string | null = null;
    let counterparty = input.counterparty;

    if (input.category === "orderPayment" || input.category === "refund") {
      const linkedCustomerId = invoice?.customerId ?? order?.customerId ?? null;
      if (
        input.customerId &&
        linkedCustomerId &&
        input.customerId !== linkedCustomerId
      ) {
        throw new FinanceCommandError(
          "CUSTOMER_MISMATCH",
          "The order belongs to a different customer.",
        );
      }
      const resolvedCustomerId = input.customerId ?? linkedCustomerId;
      if (resolvedCustomerId) {
        const customer =
          await this.dependencies.customerStore.findById(resolvedCustomerId);
        if (!customer) {
          throw new FinanceCommandError(
            "CUSTOMER_NOT_FOUND",
            "Customer not found.",
          );
        }
        customerId = customer.id;
        counterparty = customer.name;
      } else if (order) {
        // An order recorded before the customer list existed.
        counterparty = order.customerName;
      } else {
        throw new FinanceCommandError(
          "CUSTOMER_REQUIRED",
          "A customer payment or refund needs a customer.",
        );
      }
    } else if (input.kind === "expense" && input.supplierId) {
      const supplier = await this.dependencies.supplierStore.findById(
        input.supplierId,
      );
      if (!supplier) {
        throw new FinanceCommandError(
          "SUPPLIER_NOT_FOUND",
          "Supplier not found.",
        );
      }
      supplierId = supplier.id;
      counterparty = supplier.name;
    } else if (!counterparty) {
      throw new FinanceCommandError(
        "INVALID_INPUT",
        "An entry needs a counterparty.",
      );
    }

    // A payment against an order must arrive in the order's currency,
    // otherwise the outstanding balance has no meaning. Costs may be paid in
    // any currency; the cost report totals per currency.
    if (
      input.kind === "receipt" &&
      order?.sellingPrice &&
      order.sellingPrice.currency !== amount.currency
    ) {
      throw new FinanceCommandError(
        "CURRENCY_MISMATCH",
        `The order is priced in ${order.sellingPrice.currency}.`,
      );
    }
    if (invoice && invoice.amount.currency !== amount.currency) {
      throw new FinanceCommandError(
        "CURRENCY_MISMATCH",
        `The invoice is issued in ${invoice.amount.currency}.`,
      );
    }

    // A refund never exceeds the credit the customer actually holds.
    if (input.category === "refund") {
      if (!customerId) {
        throw new FinanceCommandError(
          "CUSTOMER_REQUIRED",
          "A refund needs a customer record.",
        );
      }
      const report = await this.customerReceivables(customerId, this.now());
      const credit = customerCredit(
        report,
        customerKeyOf(customerId, counterparty),
        amount.currency,
      );
      if (compare(amount, credit) > 0) {
        throw new FinanceCommandError(
          "REFUND_EXCEEDS_CREDIT",
          "The refund is larger than the customer's credit.",
        );
      }
    }

    // Apply a customer payment on entry: to the chosen invoice up to what is
    // still open on it, or in full to the chosen order as a deposit.
    let allocations: ReceiptAllocation[] = [];
    if (input.category === "orderPayment" && order) {
      if (invoice) {
        const receipts = await this.dependencies.store.listActive({
          kind: "receipt",
          category: "orderPayment",
          ...(customerId ? { customerId } : {}),
        });
        const capacity = invoiceAllocationCapacity(invoice, receipts, null);
        const applied = min(amount, capacity);
        if (isPositive(applied)) {
          allocations = [
            {
              target: "invoice",
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              orderId: order.id,
              orderCode: order.orderCode,
              amount: applied.amount,
            },
          ];
        }
      } else {
        allocations = [
          {
            target: "order",
            orderId: order.id,
            orderCode: order.orderCode,
            amount: amount.amount,
          },
        ];
      }
    }

    const fxRateToVnd =
      amount.currency === "USD"
        ? ((
            await this.dependencies.fxRateStore.findLatestOnOrBefore(
              input.occurredAt,
            )
          )?.rate ?? null)
        : null;

    const record = await this.dependencies.store.insert({
      kind: input.kind,
      category: input.category,
      orderId: order?.id ?? null,
      orderCode: order?.orderCode ?? null,
      customerId,
      supplierId,
      counterparty,
      amount,
      method: input.method,
      occurredAt: input.occurredAt,
      note: input.note,
      allocations,
      fxRateToVnd,
      businessUnitIds: order?.businessUnitIds ?? [],
      createdBy: context.userId,
    });

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action:
        input.kind === "receipt"
          ? "finance.receiptRecorded"
          : input.category === "refund"
            ? "finance.refundRecorded"
            : "finance.expenseRecorded",
      resourceType: FINANCE_RESOURCE_TYPE,
      resourceId: record.id,
      businessUnitIds: record.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        category: record.category,
        currency: record.amount.currency,
        ...(record.orderCode ? { orderCode: record.orderCode } : {}),
        ...(record.customerId ? { customerId: record.customerId } : {}),
        ...(record.supplierId ? { supplierId: record.supplierId } : {}),
        allocations: record.allocations.length,
      },
      occurredAt: this.now(),
    });

    return record;
  }

  /**
   * Replaces how a customer receipt is applied. Allocation is bookkeeping,
   * not a movement of money, so unlike the amount it may be corrected in
   * place — every change is audited and conditional on the revision.
   */
  async setAllocations(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FinanceEntryRecordDto> {
    const input = setAllocationsInputSchema.parse(rawInput);
    this.assertHolds(context, "payments.allocate");

    const entry = await this.dependencies.store.findById(input.entryId);
    if (!entry) {
      throw new FinanceCommandError("NOT_FOUND", "Entry not found.");
    }
    if (entry.status === "voided") {
      throw new FinanceCommandError(
        "ALREADY_VOIDED",
        "A voided entry cannot be allocated.",
      );
    }
    if (entry.kind !== "receipt" || entry.category !== "orderPayment") {
      throw new FinanceCommandError(
        "NOT_A_RECEIPT",
        "Only a customer payment can be allocated.",
      );
    }

    const currency = entry.amount.currency;
    const entryAmount = money(entry.amount.amount, currency);
    const otherReceipts = await this.dependencies.store.listActive({
      kind: "receipt",
      category: "orderPayment",
      ...(entry.customerId ? { customerId: entry.customerId } : {}),
    });

    const seen = new Set<string>();
    let total = zero(currency);
    const resolved: ReceiptAllocation[] = [];

    for (const allocation of input.allocations) {
      const amount = money(allocation.amount, currency);
      if (!isPositive(amount)) {
        throw new FinanceCommandError(
          "INVALID_INPUT",
          "An allocation must be a positive amount.",
        );
      }
      const key =
        allocation.target === "invoice"
          ? `invoice:${allocation.invoiceId}`
          : `order:${allocation.orderId}`;
      if (seen.has(key)) {
        throw new FinanceCommandError(
          "INVALID_INPUT",
          "The same target appears twice.",
        );
      }
      seen.add(key);

      total = add(total, amount);
      if (compare(total, entryAmount) > 0) {
        throw new FinanceCommandError(
          "ALLOCATION_EXCEEDS_ENTRY",
          "The allocations add up to more than the receipt.",
        );
      }

      if (allocation.target === "invoice") {
        const invoice = await this.dependencies.invoiceStore.findById(
          allocation.invoiceId,
        );
        if (!invoice) {
          throw new FinanceCommandError(
            "INVOICE_NOT_FOUND",
            "Invoice not found.",
          );
        }
        if (invoice.status === "voided") {
          throw new FinanceCommandError(
            "INVOICE_VOIDED",
            "The invoice is voided.",
          );
        }
        const order = await this.dependencies.orderStore.findById(
          invoice.orderId,
        );
        if (!order) {
          throw new FinanceCommandError("ORDER_NOT_FOUND", "Order not found.");
        }
        if (order.stage === "cancelled") {
          throw new FinanceCommandError(
            "ORDER_CANCELLED",
            "The invoice belongs to a cancelled order.",
          );
        }
        if (invoice.amount.currency !== currency) {
          throw new FinanceCommandError(
            "CURRENCY_MISMATCH",
            `The invoice is issued in ${invoice.amount.currency}.`,
          );
        }
        this.assertSameCustomer(entry, {
          customerId: invoice.customerId ?? order.customerId,
          customerName: invoice.customerName || order.customerName,
        });
        const capacity = invoiceAllocationCapacity(
          invoice,
          otherReceipts,
          entry.id,
        );
        if (compare(amount, capacity) > 0) {
          throw new FinanceCommandError(
            "ALLOCATION_EXCEEDS_INVOICE",
            "More than what is still open on the invoice.",
          );
        }
        resolved.push({
          target: "invoice",
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          orderId: order.id,
          orderCode: order.orderCode,
          amount: amount.amount,
        });
      } else {
        const order = await this.dependencies.orderStore.findById(
          allocation.orderId,
        );
        if (!order) {
          throw new FinanceCommandError("ORDER_NOT_FOUND", "Order not found.");
        }
        if (order.stage === "cancelled") {
          throw new FinanceCommandError(
            "ORDER_CANCELLED",
            "A cancelled order cannot take a deposit.",
          );
        }
        if (order.sellingPrice && order.sellingPrice.currency !== currency) {
          throw new FinanceCommandError(
            "CURRENCY_MISMATCH",
            `The order is priced in ${order.sellingPrice.currency}.`,
          );
        }
        this.assertSameCustomer(entry, {
          customerId: order.customerId,
          customerName: order.customerName,
        });
        resolved.push({
          target: "order",
          orderId: order.id,
          orderCode: order.orderCode,
          amount: amount.amount,
        });
      }
    }

    const updated = await this.dependencies.store.setAllocations({
      entryId: entry.id,
      expectedRevision: input.expectedRevision,
      allocations: resolved,
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new FinanceCommandError(
        "REVISION_CONFLICT",
        "The entry changed while this action was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "finance.receiptAllocated",
      resourceType: FINANCE_RESOURCE_TYPE,
      resourceId: entry.id,
      businessUnitIds: entry.businessUnitIds,
      requestId: context.requestId,
      changes: {
        before: entry.allocations.map(allocationSummary),
        after: updated.allocations.map(allocationSummary),
      },
      occurredAt: this.now(),
    });

    return updated;
  }

  async voidEntry(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FinanceEntryRecordDto> {
    const input = voidFinanceEntryInputSchema.parse(rawInput);

    const entry = await this.dependencies.store.findById(input.entryId);
    if (!entry) {
      throw new FinanceCommandError("NOT_FOUND", "Entry not found.");
    }
    if (entry.status === "voided") {
      throw new FinanceCommandError(
        "ALREADY_VOIDED",
        "The entry is already voided.",
      );
    }

    this.assertHolds(context, voidPermission(entry.kind));

    const updated = await this.dependencies.store.void({
      entryId: entry.id,
      expectedRevision: input.expectedRevision,
      reason: input.reason,
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new FinanceCommandError(
        "REVISION_CONFLICT",
        "The entry changed while this action was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action:
        entry.kind === "receipt"
          ? "finance.receiptVoided"
          : "finance.expenseVoided",
      resourceType: FINANCE_RESOURCE_TYPE,
      resourceId: entry.id,
      businessUnitIds: entry.businessUnitIds,
      requestId: context.requestId,
      reason: input.reason,
      occurredAt: this.now(),
    });

    return updated;
  }

  async list(filter: FinanceListFilter): Promise<FinanceEntryRecordDto[]> {
    return this.dependencies.store.list(filter);
  }

  async listActive(
    filter: FinanceActiveFilter,
  ): Promise<FinanceEntryRecordDto[]> {
    return this.dependencies.store.listActive(filter);
  }

  async findById(entryId: string): Promise<FinanceEntryRecordDto | null> {
    return this.dependencies.store.findById(entryId);
  }

  async sumActiveByOrder(
    orderIds: readonly string[],
    kind: FinanceEntryKind,
  ): Promise<OrderAmountTotals> {
    return this.dependencies.store.sumActiveByOrder(orderIds, kind);
  }

  /** The receivables picture inside one list scope. */
  async receivables(
    scope: FinanceListScope,
    now: Date = this.now(),
  ): Promise<ReceivablesReport> {
    const [orders, invoices, receipts, refunds] = await Promise.all([
      this.dependencies.orderStore.list(scope),
      this.dependencies.invoiceStore.list({ scope, status: "active" }),
      this.dependencies.store.listActive({
        scope,
        kind: "receipt",
        category: "orderPayment",
      }),
      this.dependencies.store.listActive({ scope, category: "refund" }),
    ]);
    return computeReceivables({ orders, invoices, receipts, refunds, now });
  }

  /** The receivables picture of one customer, for the customer page and refunds. */
  async customerReceivables(
    customerId: string,
    now: Date = this.now(),
  ): Promise<ReceivablesReport> {
    const [orders, invoices, receipts, refunds] = await Promise.all([
      this.dependencies.orderStore.listByCustomer(customerId),
      this.dependencies.invoiceStore.list({ customerId, status: "active" }),
      this.dependencies.store.listActive({
        kind: "receipt",
        category: "orderPayment",
        customerId,
      }),
      this.dependencies.store.listActive({ category: "refund", customerId }),
    ]);
    return computeReceivables({ orders, invoices, receipts, refunds, now });
  }

  /** Per-currency credit a customer holds, for pre-filling a refund. */
  async creditFor(
    customerId: string,
    customerName: string,
  ): Promise<readonly Money[]> {
    const report = await this.customerReceivables(customerId);
    const key = customerKeyOf(customerId, customerName);
    return (["VND", "USD"] as const satisfies readonly Currency[])
      .map((currency) => customerCredit(report, key, currency))
      .filter((value) => isPositive(value));
  }
}

function allocationSummary(allocation: ReceiptAllocation): string {
  return allocation.target === "invoice"
    ? `invoice:${allocation.invoiceNumber}=${allocation.amount}`
    : `order:${allocation.orderCode}=${allocation.amount}`;
}
