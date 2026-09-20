import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import type { ApprovalRepository } from "@/domains/approvals/contracts";
import { assertApproved } from "@/domains/approvals/policy";
import type { ApprovalService } from "@/domains/approvals/service";
import type { CustomerStore } from "@/domains/customers/contracts";
import {
  approvalSummaryForOrder,
  approveLabelProofInputSchema,
  createOrderInputSchema,
  exportProgressInputSchema,
  generateOrderCode,
  latestDocument,
  latestQcCheck,
  OrderCommandError,
  orderDetailsInputSchema,
  orderDocumentInputSchema,
  orderDocumentPermissions,
  orderReadiness,
  packingRecordInputSchema,
  paymentDocumentInputSchema,
  productionPlanInputSchema,
  productionStageInputSchema,
  qcCheckInputSchema,
  setLineItemsInputSchema,
  transitionOrderInputSchema,
  type OrderReadDto,
  type OrderRecordDto,
  type OrderListFilter,
  type OrderStore,
} from "@/domains/orders/contracts";
import {
  assertTransition,
  isTerminalStage,
  orderStages,
  qcCheckpointStage,
  stageDefinition,
  type OrderStage,
  type ProductionStage,
} from "@/domains/orders/workflow";
import {
  requiresGlobalGrant,
  type Permission,
} from "@/domains/identity/permissions";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";
import { money } from "@/lib/money";

export type OrderCommandServiceDependencies = {
  store: OrderStore;
  customerStore: CustomerStore;
  approvalRepository: ApprovalRepository;
  approvalService: ApprovalService;
  auditRepository: AuditRepository;
  now?: () => Date;
};

export const ORDER_RESOURCE_TYPE = "salesOrder";

function redact(
  record: OrderRecordDto,
  sellingPriceVisible: boolean,
): OrderReadDto {
  return {
    ...record,
    sellingPrice: sellingPriceVisible ? record.sellingPrice : null,
    sellingPriceVisible,
  };
}

/**
 * The sales-order command service. Permission is judged by the caller's guard
 * against the exact record and business units; the process is judged here by
 * `assertTransition`; a gated stage additionally demands an approved Director
 * decision that still matches the record's revision. All three must pass —
 * holding a permission never advances an order by itself.
 */
export class OrderCommandService {
  private readonly dependencies: OrderCommandServiceDependencies;

  constructor(dependencies: OrderCommandServiceDependencies) {
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

  /**
   * A Director decision is never held through a unit-narrowed grant, the
   * same rule the approvals service applies to `approvals.decide`.
   */
  private assertHoldsGlobally(
    context: AccessContext,
    permission: Permission,
  ): void {
    const effective = context.permissions.find(
      (candidate) => candidate.permission === permission,
    );
    if (
      !effective ||
      context.userStatus !== "active" ||
      (requiresGlobalGrant(permission) && effective.scope !== "all")
    ) {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
  }

  private async load(orderId: string): Promise<OrderRecordDto> {
    const order = await this.dependencies.store.findById(orderId);
    if (!order) {
      throw new OrderCommandError("NOT_FOUND", "Order not found.");
    }
    return order;
  }

  private assertOpen(order: OrderRecordDto): void {
    if (isTerminalStage(order.stage)) {
      throw new OrderCommandError(
        "STAGE_MISMATCH",
        "A closed or cancelled order file no longer changes.",
      );
    }
  }

  private moved(updated: OrderRecordDto | null): OrderRecordDto {
    if (!updated) {
      throw new OrderCommandError(
        "REVISION_CONFLICT",
        "The order changed while this action was on screen.",
      );
    }
    return updated;
  }

  private async audit(
    context: AccessContext,
    order: OrderRecordDto,
    action: string,
    extra: {
      metadata?: Record<string, unknown>;
      changes?: { before: unknown; after: unknown };
      reason?: string;
    } = {},
  ): Promise<void> {
    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action,
      resourceType: ORDER_RESOURCE_TYPE,
      resourceId: order.id,
      businessUnitIds: order.businessUnitIds,
      requestId: context.requestId,
      ...(extra.metadata ? { metadata: extra.metadata } : {}),
      ...(extra.changes ? { changes: extra.changes } : {}),
      ...(extra.reason ? { reason: extra.reason } : {}),
      occurredAt: this.now(),
    });
  }

  async create(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "orders.create");
    const input = createOrderInputSchema.parse(rawInput);

    const sellingPrice = input.sellingPrice
      ? money(input.sellingPrice.amount, input.sellingPrice.currency)
      : null;

    // Every order belongs to a customer record; the name is snapshotted so
    // the order book renders without a join and keeps the name the file was
    // opened under even if the customer is renamed later.
    const customer = await this.dependencies.customerStore.findById(
      input.customerId,
    );
    if (!customer) {
      throw new OrderCommandError("CUSTOMER_NOT_FOUND", "Customer not found.");
    }
    if (customer.status !== "active") {
      throw new OrderCommandError(
        "CUSTOMER_ARCHIVED",
        "An archived customer cannot receive new orders.",
      );
    }

    const manualCode = input.orderCode ?? null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const orderCode = manualCode ?? generateOrderCode(this.now());
      try {
        const record = await this.dependencies.store.insert({
          orderCode,
          customerId: customer.id,
          customerName: customer.name,
          businessUnitIds: input.businessUnitIds,
          sellingPrice,
          lineItems: input.lineItems,
          shippingMark: input.shippingMark,
          deliveryDueAt: input.deliveryDueAt,
          targets: input.targets,
          notes: input.notes,
          createdBy: context.userId,
        });

        await this.audit(context, record, "order.created", {
          metadata: {
            orderCode: record.orderCode,
            customerId: customer.id,
            lineCount: record.lineItems.length,
          },
        });

        return redact(record, true);
      } catch (error) {
        lastError = error;
        const retryable =
          manualCode === null &&
          error instanceof OrderCommandError &&
          error.code === "DUPLICATE_ORDER_CODE";
        if (!retryable) throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new OrderCommandError(
          "DUPLICATE_ORDER_CODE",
          "Could not allocate a unique order code.",
        );
  }

  async list(
    filter: OrderListFilter,
    sellingPriceVisible: boolean,
  ): Promise<OrderReadDto[]> {
    const records = await this.dependencies.store.list(filter);
    return records.map((record) => redact(record, sellingPriceVisible));
  }

  async findById(
    orderId: string,
    sellingPriceVisible: boolean,
  ): Promise<OrderReadDto | null> {
    const record = await this.dependencies.store.findById(orderId);
    return record ? redact(record, sellingPriceVisible) : null;
  }

  async listByCustomer(
    customerId: string,
    sellingPriceVisible: boolean,
  ): Promise<OrderReadDto[]> {
    const records = await this.dependencies.store.listByCustomer(customerId);
    return records.map((record) => redact(record, sellingPriceVisible));
  }

  /** The raw record for guard targeting; never returned to a renderer. */
  async findForAuthorization(orderId: string): Promise<OrderRecordDto | null> {
    return this.dependencies.store.findById(orderId);
  }

  /** The raw record by its code, for guard targeting; never returned to a renderer. */
  async findByCodeForAuthorization(
    orderCode: string,
  ): Promise<OrderRecordDto | null> {
    return this.dependencies.store.findByCode(orderCode);
  }

  async transition(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    const input = transitionOrderInputSchema.parse(rawInput);

    if (!(orderStages as readonly string[]).includes(input.to)) {
      throw new OrderCommandError("INVALID_INPUT", "Unknown target stage.");
    }
    const to = input.to as OrderStage;

    const order = await this.load(input.orderId);

    // The permission that leaves the CURRENT stage, re-asserted against the
    // context the caller guarded with.
    const definition = stageDefinition(order.stage);
    this.assertHolds(context, definition.advancePermission);

    if (order.revision !== input.expectedRevision) {
      throw new OrderCommandError(
        "REVISION_CONFLICT",
        "The order changed while this action was on screen.",
      );
    }

    // A gated stage demands an approved Director decision pinned to the
    // record's current revision. `assertApproved` throws APPROVAL_MISSING or
    // REVISION_CONFLICT from the approvals layer.
    let hasApproval = false;
    if (definition.approvalSubject) {
      const approved =
        await this.dependencies.approvalRepository.findApprovedForResource(
          ORDER_RESOURCE_TYPE,
          order.id,
          definition.approvalSubject,
        );
      assertApproved(approved, order.revision);
      hasApproval = true;
    }

    assertTransition({
      from: order.stage,
      to,
      hasApproval,
      qcPassed: order.qcPassed,
      reason: input.reason,
      readiness: orderReadiness(order),
    });

    // Entering production or quality control resets the finishing flag so a
    // pass never carries over from a previous cycle. Production starts at
    // woodwork the first time; rework keeps the workshop stage the Factory
    // Manager was at, so they choose where to resume.
    const nextQcPassed =
      to === "qualityControl" || to === "inProduction" ? false : order.qcPassed;
    const productionStage: ProductionStage | undefined =
      to === "inProduction" && order.productionStage === null
        ? "woodwork"
        : undefined;

    const occurredAt = this.now();
    const updated = this.moved(
      await this.dependencies.store.applyTransition({
        orderId: order.id,
        expectedRevision: order.revision,
        to,
        qcPassed: nextQcPassed,
        ...(productionStage !== undefined ? { productionStage } : {}),
        historyEntry: {
          from: order.stage,
          to,
          byUserId: context.userId,
          reason: input.reason,
          at: occurredAt,
        },
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.stageTransitioned", {
      changes: { before: order.stage, after: to },
      ...(input.reason ? { reason: input.reason } : {}),
    });

    return redact(updated, false);
  }

  /**
   * Records one of the three inspections. Each belongs to a stage; the
   * finishing inspection in quality control is the pass that unlocks packing.
   */
  async recordQcCheck(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "production.approveQc");
    const input = qcCheckInputSchema.parse(rawInput);

    const order = await this.load(input.orderId);
    if (order.stage !== qcCheckpointStage[input.checkpoint]) {
      throw new OrderCommandError(
        "STAGE_MISMATCH",
        "This inspection belongs to another stage of the order.",
      );
    }

    const qcPassed =
      input.checkpoint === "finishing"
        ? input.result === "pass"
        : order.qcPassed;

    const updated = this.moved(
      await this.dependencies.store.addQcCheck({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        check: {
          checkpoint: input.checkpoint,
          result: input.result,
          defectCount: input.defectCount,
          note: input.note,
          byUserId: context.userId,
          at: this.now(),
        },
        qcPassed,
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.qcChecked", {
      metadata: {
        checkpoint: input.checkpoint,
        result: input.result,
        defectCount: input.defectCount,
      },
    });

    return redact(updated, false);
  }

  /**
   * Moves the order between the workshop stages of step 05. Lacquer and
   * finishing wait for the raw-body inspection to pass.
   */
  async setProductionStage(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "production.updateProgress");
    const input = productionStageInputSchema.parse(rawInput);

    const order = await this.load(input.orderId);
    if (order.stage !== "inProduction") {
      throw new OrderCommandError(
        "STAGE_MISMATCH",
        "The workshop stage changes only while the order is in production.",
      );
    }
    if (
      input.productionStage !== "woodwork" &&
      latestQcCheck(order.qcChecks, "woodwork")?.result !== "pass"
    ) {
      throw new OrderCommandError(
        "WOODWORK_NOT_PASSED",
        "Lacquer starts only after the raw-body inspection passes.",
      );
    }

    const updated = this.moved(
      await this.dependencies.store.setProductionStage({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        productionStage: input.productionStage,
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.productionStageSet", {
      changes: { before: order.productionStage, after: input.productionStage },
    });

    return redact(updated, false);
  }

  /** Step 03 output. Held by the same permission that leaves the stage. */
  async setProductionPlan(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "production.createPlan");
    const input = productionPlanInputSchema.parse(rawInput);

    const order = await this.load(input.orderId);
    this.assertOpen(order);

    const updated = this.moved(
      await this.dependencies.store.setProductionPlan({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        plan: {
          woodworkDue: input.woodworkDue,
          lacquerDue: input.lacquerDue,
          finishingDue: input.finishingDue,
          packingDue: input.packingDue,
          shipDue: input.shipDue,
          assignment: input.assignment,
          note: input.note,
          savedBy: context.userId,
          savedAt: this.now(),
        },
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.productionPlanSaved");

    return redact(updated, false);
  }

  /** Step 07 output: the Storekeeper's packing slip. */
  async setPackingRecord(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "packing.update");
    const input = packingRecordInputSchema.parse(rawInput);

    const order = await this.load(input.orderId);
    if (order.stage !== "packing") {
      throw new OrderCommandError(
        "STAGE_MISMATCH",
        "The packing slip is recorded while the order is being packed.",
      );
    }

    const updated = this.moved(
      await this.dependencies.store.setPackingRecord({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        record: {
          packedAt: input.packedAt,
          cartons: input.cartons,
          pallets: input.pallets,
          containerNumber: input.containerNumber,
          note: input.note,
          byUserId: context.userId,
          at: this.now(),
        },
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.packingRecorded", {
      metadata: {
        cartons: input.cartons,
        pallets: input.pallets,
        containerNumber: input.containerNumber,
      },
    });

    return redact(updated, false);
  }

  /** The product lines; editable until the file closes. */
  async setLineItems(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "orders.updateDraft");
    const input = setLineItemsInputSchema.parse(rawInput);

    const order = await this.load(input.orderId);
    this.assertOpen(order);

    const updated = this.moved(
      await this.dependencies.store.setLineItems({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        lineItems: input.lineItems,
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.lineItemsSet", {
      changes: {
        before: order.lineItems.length,
        after: updated.lineItems.length,
      },
    });

    return redact(updated, false);
  }

  /** Shipping mark, promised delivery date and the order's own targets. */
  async setDetails(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "orders.updateDraft");
    const input = orderDetailsInputSchema.parse(rawInput);

    const order = await this.load(input.orderId);
    this.assertOpen(order);

    const updated = this.moved(
      await this.dependencies.store.setDetails({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        shippingMark: input.shippingMark,
        deliveryDueAt: input.deliveryDueAt,
        targets: input.targets,
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.detailsSet", {
      changes: {
        before: {
          shippingMark: order.shippingMark,
          deliveryDueAt: order.deliveryDueAt?.toISOString() ?? null,
        },
        after: {
          shippingMark: updated.shippingMark,
          deliveryDueAt: updated.deliveryDueAt?.toISOString() ?? null,
        },
      },
    });

    return redact(updated, false);
  }

  async setSellingPrice(
    context: AccessContext,
    input: {
      orderId: string;
      expectedRevision: number;
      amount: string;
      currency: string;
    },
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "orders.updateDraft");

    const normalized = money(input.amount, input.currency);
    const order = await this.load(input.orderId);
    if (
      order.stage !== "received" &&
      order.stage !== "awaitingDirectorApproval"
    ) {
      throw new OrderCommandError(
        "STAGE_MISMATCH",
        "The selling price can only change until the Director confirms the order.",
      );
    }

    const updated = this.moved(
      await this.dependencies.store.setSellingPrice({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        sellingPrice: normalized,
        updatedBy: context.userId,
      }),
    );

    // The amount itself stays out of the audit metadata: audit readers are not
    // guaranteed to hold `orders.readSellingPrice`.
    await this.audit(context, order, "order.sellingPriceSet", {
      metadata: { currency: normalized.currency },
    });

    return redact(updated, true);
  }

  /**
   * Export progress the Company Accountant keeps on the order file: expected
   * ready date and the carrier booking. Held by `orders.updateExportProgress`
   * and independent of the operational workflow, so it may change at any
   * stage until the order is closed or cancelled.
   */
  async setExportProgress(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "orders.updateExportProgress");
    const input = exportProgressInputSchema.parse(rawInput);

    const order = await this.load(input.orderId);
    this.assertOpen(order);

    const updated = this.moved(
      await this.dependencies.store.setExportProgress({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        expectedReadyAt: input.expectedReadyAt,
        bookingNumber: input.bookingNumber,
        bookingDate: input.bookingDate,
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.exportProgressSet", {
      changes: {
        before: {
          expectedReadyAt: order.expectedReadyAt?.toISOString() ?? null,
          bookingNumber: order.bookingNumber,
          bookingDate: order.bookingDate?.toISOString() ?? null,
        },
        after: {
          expectedReadyAt: updated.expectedReadyAt?.toISOString() ?? null,
          bookingNumber: updated.bookingNumber,
          bookingDate: updated.bookingDate?.toISOString() ?? null,
        },
      },
    });

    return redact(updated, false);
  }

  /**
   * Records a file produced by one of the SOP steps. The bytes already sit at
   * the storage provider; this only attaches the descriptor. The permission
   * follows the kind, so the position the SOP names for that step is the one
   * that files it.
   */
  async attachDocument(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    const input = orderDocumentInputSchema.parse(rawInput);
    this.assertHolds(context, orderDocumentPermissions[input.kind]);

    const order = await this.load(input.orderId);
    this.assertOpen(order);

    const updated = this.moved(
      await this.dependencies.store.addDocument({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        document: {
          kind: input.kind,
          publicId: input.publicId,
          assetVersion: input.assetVersion,
          format: input.format,
          bytes: input.bytes,
          label: input.label,
          uploadedBy: context.userId,
          uploadedAt: this.now(),
        },
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.documentAttached", {
      metadata: { kind: input.kind, label: input.label, format: input.format },
    });

    return redact(updated, false);
  }

  async removeDocument(
    context: AccessContext,
    input: { orderId: string; expectedRevision: number; documentId: string },
  ): Promise<OrderReadDto> {
    const order = await this.load(input.orderId);
    const existing = order.documents.find(
      (document) => document.id === input.documentId,
    );
    if (!existing) {
      throw new OrderCommandError("NOT_FOUND", "Document not found.");
    }
    this.assertHolds(context, orderDocumentPermissions[existing.kind]);

    const updated = this.moved(
      await this.dependencies.store.removeDocument({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        documentId: input.documentId,
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.documentRemoved", {
      metadata: {
        kind: existing.kind,
        label: existing.label,
        publicId: existing.publicId,
      },
    });

    return redact(updated, false);
  }

  /**
   * The Director approves the company's own label and shipping-mark proof
   * when the customer gave no template (2026-09-14). The approval names the
   * exact file, so a newer proof needs its own approval and removing the file
   * clears it. The person who uploaded the proof never approves it.
   */
  async approveLabelProof(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHoldsGlobally(context, "approvals.decide");
    const input = approveLabelProofInputSchema.parse(rawInput);

    const order = await this.load(input.orderId);
    this.assertOpen(order);

    const proof = order.documents.find(
      (document) => document.id === input.documentId,
    );
    if (!proof) {
      throw new OrderCommandError("NOT_FOUND", "Document not found.");
    }
    if (proof.kind !== "labelProof") {
      throw new OrderCommandError(
        "INVALID_INPUT",
        "Only a company label proof is approved here.",
      );
    }
    if (latestDocument(order.documents, "labelProof")?.id !== proof.id) {
      throw new OrderCommandError(
        "INVALID_INPUT",
        "Only the newest company label proof can be approved.",
      );
    }
    if (proof.uploadedBy === context.userId) {
      throw new OrderCommandError(
        "SELF_APPROVAL",
        "The person who uploaded the proof cannot approve it.",
      );
    }

    const approvedAt = this.now();
    const updated = this.moved(
      await this.dependencies.store.setLabelApproval({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        approval: {
          documentId: proof.id,
          approvedBy: context.userId,
          approvedAt,
        },
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.labelApproved", {
      metadata: { documentId: proof.id, label: proof.label },
    });

    return redact(updated, false);
  }

  /**
   * Records a payment document the accountant uploaded for the order. Held by
   * `payments.record`, the same permission that records the money the
   * document evidences.
   */
  async attachPaymentDocument(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "payments.record");
    const input = paymentDocumentInputSchema.parse(rawInput);

    const order = await this.load(input.orderId);

    const updated = this.moved(
      await this.dependencies.store.addPaymentDocument({
        orderId: order.id,
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
      }),
    );

    await this.audit(context, order, "order.paymentDocumentAttached", {
      metadata: { label: input.label, format: input.format },
    });

    return redact(updated, false);
  }

  async removePaymentDocument(
    context: AccessContext,
    input: { orderId: string; expectedRevision: number; documentId: string },
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "payments.record");

    const order = await this.load(input.orderId);
    const existing = order.paymentDocuments.find(
      (document) => document.id === input.documentId,
    );
    if (!existing) {
      throw new OrderCommandError("NOT_FOUND", "Document not found.");
    }

    const updated = this.moved(
      await this.dependencies.store.removePaymentDocument({
        orderId: order.id,
        expectedRevision: input.expectedRevision,
        documentId: input.documentId,
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, order, "order.paymentDocumentRemoved", {
      metadata: { label: existing.label, publicId: existing.publicId },
    });

    return redact(updated, false);
  }

  /**
   * Raises the Director approval request that the CURRENT stage's exit is
   * gated on. The summary is built here so it can never include a price.
   */
  async requestStageApproval(
    context: AccessContext,
    input: { orderId: string },
  ): Promise<void> {
    const order = await this.load(input.orderId);
    if (isTerminalStage(order.stage)) {
      throw new OrderCommandError(
        "STAGE_MISMATCH",
        "A closed or cancelled order has nothing to approve.",
      );
    }

    const subject = stageDefinition(order.stage).approvalSubject;
    if (!subject) {
      throw new OrderCommandError(
        "STAGE_MISMATCH",
        "The current stage does not require a Director decision.",
      );
    }

    await this.dependencies.approvalService.request(context, {
      subject,
      resourceType: ORDER_RESOURCE_TYPE,
      resourceId: order.id,
      businessUnitIds: order.businessUnitIds,
      summary: approvalSummaryForOrder(order),
      expectedRevision: order.revision,
    });
  }
}
