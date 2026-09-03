import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import {
  categoryKind,
  createFinanceEntryInputSchema,
  FinanceCommandError,
  voidFinanceEntryInputSchema,
  type FinanceEntryKind,
  type FinanceEntryRecordDto,
  type FinanceEntryStore,
  type FinanceListFilter,
  type OrderAmountTotals,
} from "@/domains/finance/contracts";
import type { OrderStore } from "@/domains/orders/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";
import { money } from "@/lib/money";

export type FinanceCommandServiceDependencies = {
  store: FinanceEntryStore;
  orderStore: OrderStore;
  auditRepository: AuditRepository;
  now?: () => Date;
};

export const FINANCE_RESOURCE_TYPE = "financeEntry";

function recordPermission(kind: FinanceEntryKind): Permission {
  return kind === "receipt" ? "payments.record" : "expenses.create";
}

function voidPermission(kind: FinanceEntryKind): Permission {
  return kind === "receipt" ? "payments.reverse" : "expenses.reverse";
}

/**
 * The finance ledger command service. The caller's guard judges the
 * permission against the entry's business units (an order-linked entry
 * inherits the order's units); this service re-asserts the permission from
 * the guarded context, keeps receipt/expense categories apart, and pins a
 * receipt against an order to the order's selling-price currency so the
 * outstanding balance stays computable.
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

  /** The raw order for guard targeting before `createEntry`. */
  async findOrderForAuthorization(orderId: string) {
    return this.dependencies.orderStore.findById(orderId);
  }

  /** The raw entry for guard targeting before `voidEntry`. */
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

    this.assertHolds(context, recordPermission(input.kind));

    const amount = money(input.amount.amount, input.amount.currency);

    let orderCode: string | null = null;
    let businessUnitIds: readonly string[] = [];
    let counterparty = input.counterparty;

    if (input.orderId) {
      const order = await this.dependencies.orderStore.findById(input.orderId);
      if (!order) {
        throw new FinanceCommandError("ORDER_NOT_FOUND", "Order not found.");
      }
      // A payment against an order must arrive in the order's price currency,
      // otherwise the outstanding balance has no meaning. Costs may be paid in
      // any currency; the cost report totals per currency.
      if (
        input.kind === "receipt" &&
        order.sellingPrice &&
        order.sellingPrice.currency !== amount.currency
      ) {
        throw new FinanceCommandError(
          "CURRENCY_MISMATCH",
          `The order is priced in ${order.sellingPrice.currency}.`,
        );
      }
      orderCode = order.orderCode;
      businessUnitIds = order.businessUnitIds;
      counterparty = input.counterparty || order.customerName;
    } else if (!counterparty) {
      throw new FinanceCommandError(
        "INVALID_INPUT",
        "An entry without an order needs a counterparty.",
      );
    }

    const record = await this.dependencies.store.insert({
      kind: input.kind,
      category: input.category,
      orderId: input.orderId,
      orderCode,
      counterparty,
      amount,
      method: input.method,
      occurredAt: input.occurredAt,
      note: input.note,
      businessUnitIds,
      createdBy: context.userId,
    });

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action:
        input.kind === "receipt"
          ? "finance.receiptRecorded"
          : "finance.expenseRecorded",
      resourceType: FINANCE_RESOURCE_TYPE,
      resourceId: record.id,
      businessUnitIds: record.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        category: record.category,
        currency: record.amount.currency,
        ...(record.orderCode ? { orderCode: record.orderCode } : {}),
      },
      occurredAt: this.now(),
    });

    return record;
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

  async sumActiveByOrder(
    orderIds: readonly string[],
    kind: FinanceEntryKind,
  ): Promise<OrderAmountTotals> {
    return this.dependencies.store.sumActiveByOrder(orderIds, kind);
  }
}
