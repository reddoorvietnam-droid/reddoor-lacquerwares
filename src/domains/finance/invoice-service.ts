import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import {
  createInvoiceInputSchema,
  FinanceCommandError,
  invoiceDocumentInputSchema,
  voidInvoiceInputSchema,
  type FxRateStore,
  type InvoiceListFilter,
  type InvoiceRecordDto,
  type InvoiceStore,
} from "@/domains/finance/contracts";
import type { OrderStore } from "@/domains/orders/contracts";
import { isTerminalStage } from "@/domains/orders/workflow";
import type { Permission } from "@/domains/identity/permissions";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";
import { compare, money, zero } from "@/lib/money";

export type InvoiceCommandServiceDependencies = {
  store: InvoiceStore;
  orderStore: OrderStore;
  fxRateStore: FxRateStore;
  auditRepository: AuditRepository;
  now?: () => Date;
};

export const INVOICE_RESOURCE_TYPE = "salesInvoice";

/**
 * Sales invoices (INV). Revenue is recognised per invoice, so issuing one is
 * held by `invoices.manage`, which only the Director and the Company
 * Accountant hold. A USD invoice always carries the VND rate it was issued
 * with; a VND invoice never does. Like ledger entries, invoices are voided
 * with a reason, never deleted.
 */
export class InvoiceCommandService {
  private readonly dependencies: InvoiceCommandServiceDependencies;

  constructor(dependencies: InvoiceCommandServiceDependencies) {
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

  /** The raw invoice for guard targeting; never returned to a renderer. */
  async findForAuthorization(
    invoiceId: string,
  ): Promise<InvoiceRecordDto | null> {
    return this.dependencies.store.findById(invoiceId);
  }

  async createInvoice(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<InvoiceRecordDto> {
    this.assertHolds(context, "invoices.manage");
    const input = createInvoiceInputSchema.parse(rawInput);

    const order = await this.dependencies.orderStore.findById(input.orderId);
    if (!order) {
      throw new FinanceCommandError("ORDER_NOT_FOUND", "Order not found.");
    }
    if (order.stage === "cancelled") {
      throw new FinanceCommandError(
        "ORDER_CANCELLED",
        "A cancelled order cannot be invoiced.",
      );
    }
    if (isTerminalStage(order.stage)) {
      throw new FinanceCommandError(
        "ORDER_CLOSED",
        "A closed order cannot be invoiced.",
      );
    }

    const amount = money(input.amount.amount, input.amount.currency);
    if (compare(amount, zero(amount.currency)) <= 0) {
      throw new FinanceCommandError(
        "INVALID_INPUT",
        "An invoice must carry a positive amount.",
      );
    }

    // One order, one currency: the price, every invoice, and every payment
    // agree, otherwise the balance has no meaning.
    if (order.sellingPrice && order.sellingPrice.currency !== amount.currency) {
      throw new FinanceCommandError(
        "CURRENCY_MISMATCH",
        `The order is priced in ${order.sellingPrice.currency}.`,
      );
    }
    const siblings = await this.dependencies.store.list({
      orderId: order.id,
      status: "active",
    });
    const other = siblings.find(
      (sibling) => sibling.amount.currency !== amount.currency,
    );
    if (other) {
      throw new FinanceCommandError(
        "CURRENCY_MISMATCH",
        `The order is already invoiced in ${other.amount.currency}.`,
      );
    }

    if (input.dueAt.getTime() < input.issuedAt.getTime()) {
      throw new FinanceCommandError(
        "INVALID_INPUT",
        "The due date cannot precede the issue date.",
      );
    }

    let fxRateToVnd: string | null = null;
    if (amount.currency === "USD") {
      fxRateToVnd =
        input.fxRateToVnd ??
        (
          await this.dependencies.fxRateStore.findLatestOnOrBefore(
            input.issuedAt,
          )
        )?.rate ??
        null;
      if (!fxRateToVnd || Number(fxRateToVnd) <= 0) {
        throw new FinanceCommandError(
          "FX_RATE_REQUIRED",
          "A USD invoice needs the VND rate it is issued with.",
        );
      }
    }

    const record = await this.dependencies.store.insert({
      orderId: order.id,
      orderCode: order.orderCode,
      customerId: order.customerId,
      customerName: order.customerName,
      invoiceNumber: input.invoiceNumber,
      issuedAt: input.issuedAt,
      dueAt: input.dueAt,
      amount,
      fxRateToVnd,
      note: input.note,
      businessUnitIds: order.businessUnitIds,
      createdBy: context.userId,
    });

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "finance.invoiceIssued",
      resourceType: INVOICE_RESOURCE_TYPE,
      resourceId: record.id,
      businessUnitIds: record.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        invoiceNumber: record.invoiceNumber,
        orderCode: record.orderCode,
        currency: record.amount.currency,
      },
      occurredAt: this.now(),
    });

    return record;
  }

  async voidInvoice(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<InvoiceRecordDto> {
    this.assertHolds(context, "invoices.manage");
    const input = voidInvoiceInputSchema.parse(rawInput);

    const invoice = await this.dependencies.store.findById(input.invoiceId);
    if (!invoice) {
      throw new FinanceCommandError("NOT_FOUND", "Invoice not found.");
    }
    if (invoice.status === "voided") {
      throw new FinanceCommandError(
        "ALREADY_VOIDED",
        "The invoice is already voided.",
      );
    }

    const updated = await this.dependencies.store.void({
      invoiceId: invoice.id,
      expectedRevision: input.expectedRevision,
      reason: input.reason,
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new FinanceCommandError(
        "REVISION_CONFLICT",
        "The invoice changed while this action was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "finance.invoiceVoided",
      resourceType: INVOICE_RESOURCE_TYPE,
      resourceId: invoice.id,
      businessUnitIds: invoice.businessUnitIds,
      requestId: context.requestId,
      reason: input.reason,
      metadata: { invoiceNumber: invoice.invoiceNumber },
      occurredAt: this.now(),
    });

    return updated;
  }

  /** Attaches the uploaded invoice file; the bytes already sit at the provider. */
  async attachDocument(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<InvoiceRecordDto> {
    this.assertHolds(context, "invoices.manage");
    const input = invoiceDocumentInputSchema.parse(rawInput);

    const invoice = await this.dependencies.store.findById(input.invoiceId);
    if (!invoice) {
      throw new FinanceCommandError("NOT_FOUND", "Invoice not found.");
    }
    if (invoice.status === "voided") {
      throw new FinanceCommandError(
        "INVOICE_VOIDED",
        "The invoice is voided.",
      );
    }

    const updated = await this.dependencies.store.addDocument({
      invoiceId: invoice.id,
      expectedRevision: input.expectedRevision,
      document: {
        publicId: input.publicId,
        assetVersion: input.assetVersion,
        format: input.format,
        bytes: input.bytes,
        label: input.label,
        uploadedBy: context.userId,
        uploadedAt: this.now(),
      },
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new FinanceCommandError(
        "REVISION_CONFLICT",
        "The invoice changed while this action was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "finance.invoiceDocumentAttached",
      resourceType: INVOICE_RESOURCE_TYPE,
      resourceId: invoice.id,
      businessUnitIds: invoice.businessUnitIds,
      requestId: context.requestId,
      metadata: { label: input.label, format: input.format },
      occurredAt: this.now(),
    });

    return updated;
  }

  async removeDocument(
    context: AccessContext,
    input: { invoiceId: string; expectedRevision: number; documentId: string },
  ): Promise<InvoiceRecordDto> {
    this.assertHolds(context, "invoices.manage");

    const invoice = await this.dependencies.store.findById(input.invoiceId);
    if (!invoice) {
      throw new FinanceCommandError("NOT_FOUND", "Invoice not found.");
    }
    const existing = invoice.documents.find(
      (document) => document.id === input.documentId,
    );
    if (!existing) {
      throw new FinanceCommandError("NOT_FOUND", "Document not found.");
    }

    const updated = await this.dependencies.store.removeDocument({
      invoiceId: invoice.id,
      expectedRevision: input.expectedRevision,
      documentId: input.documentId,
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new FinanceCommandError(
        "REVISION_CONFLICT",
        "The invoice changed while this action was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "finance.invoiceDocumentRemoved",
      resourceType: INVOICE_RESOURCE_TYPE,
      resourceId: invoice.id,
      businessUnitIds: invoice.businessUnitIds,
      requestId: context.requestId,
      metadata: { label: existing.label, publicId: existing.publicId },
      occurredAt: this.now(),
    });

    return updated;
  }

  async list(filter: InvoiceListFilter): Promise<InvoiceRecordDto[]> {
    return this.dependencies.store.list(filter);
  }

  async findById(invoiceId: string): Promise<InvoiceRecordDto | null> {
    return this.dependencies.store.findById(invoiceId);
  }
}
