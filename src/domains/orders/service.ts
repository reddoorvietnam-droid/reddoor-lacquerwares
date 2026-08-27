import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import type { ApprovalRepository } from "@/domains/approvals/contracts";
import { assertApproved } from "@/domains/approvals/policy";
import type { ApprovalService } from "@/domains/approvals/service";
import {
  approvalSummaryForOrder,
  createOrderInputSchema,
  generateOrderCode,
  OrderCommandError,
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
  stageDefinition,
  type OrderStage,
} from "@/domains/orders/workflow";
import type { Permission } from "@/domains/identity/permissions";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";
import { money } from "@/lib/money";

export type OrderCommandServiceDependencies = {
  store: OrderStore;
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

  async create(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "orders.create");
    const input = createOrderInputSchema.parse(rawInput);

    const sellingPrice = input.sellingPrice
      ? money(input.sellingPrice.amount, input.sellingPrice.currency)
      : null;

    const manualCode = input.orderCode ?? null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const orderCode = manualCode ?? generateOrderCode(this.now());
      try {
        const record = await this.dependencies.store.insert({
          orderCode,
          customerName: input.customerName,
          businessUnitIds: input.businessUnitIds,
          sellingPrice,
          notes: input.notes,
          createdBy: context.userId,
        });

        await this.dependencies.auditRepository.append({
          actor: { type: "user", userId: context.userId },
          action: "order.created",
          resourceType: ORDER_RESOURCE_TYPE,
          resourceId: record.id,
          businessUnitIds: record.businessUnitIds,
          requestId: context.requestId,
          metadata: { orderCode: record.orderCode },
          occurredAt: this.now(),
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

  /** The raw record for guard targeting; never returned to a renderer. */
  async findForAuthorization(orderId: string): Promise<OrderRecordDto | null> {
    return this.dependencies.store.findById(orderId);
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

    const order = await this.dependencies.store.findById(input.orderId);
    if (!order) {
      throw new OrderCommandError("NOT_FOUND", "Order not found.");
    }

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
    });

    // Entering production or quality control resets the inspection flag so a
    // pass never carries over from a previous cycle.
    const nextQcPassed =
      to === "qualityControl" || to === "inProduction" ? false : order.qcPassed;

    const occurredAt = this.now();
    const updated = await this.dependencies.store.applyTransition({
      orderId: order.id,
      expectedRevision: order.revision,
      to,
      qcPassed: nextQcPassed,
      historyEntry: {
        from: order.stage,
        to,
        byUserId: context.userId,
        reason: input.reason,
        at: occurredAt,
      },
      updatedBy: context.userId,
    });

    if (!updated) {
      throw new OrderCommandError(
        "REVISION_CONFLICT",
        "The order changed while this action was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "order.stageTransitioned",
      resourceType: ORDER_RESOURCE_TYPE,
      resourceId: order.id,
      businessUnitIds: order.businessUnitIds,
      requestId: context.requestId,
      ...(input.reason ? { reason: input.reason } : {}),
      changes: { before: order.stage, after: to },
      occurredAt,
    });

    return redact(updated, false);
  }

  async recordQcPass(
    context: AccessContext,
    input: { orderId: string; expectedRevision: number },
  ): Promise<OrderReadDto> {
    this.assertHolds(context, "production.approveQc");

    const order = await this.dependencies.store.findById(input.orderId);
    if (!order) {
      throw new OrderCommandError("NOT_FOUND", "Order not found.");
    }
    if (order.stage !== "qualityControl") {
      throw new OrderCommandError(
        "STAGE_MISMATCH",
        "Quality can only be recorded while the order is in quality control.",
      );
    }

    const updated = await this.dependencies.store.setQcPassed({
      orderId: order.id,
      expectedRevision: input.expectedRevision,
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new OrderCommandError(
        "REVISION_CONFLICT",
        "The order changed while this action was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "order.qcPassed",
      resourceType: ORDER_RESOURCE_TYPE,
      resourceId: order.id,
      businessUnitIds: order.businessUnitIds,
      requestId: context.requestId,
      occurredAt: this.now(),
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
    const order = await this.dependencies.store.findById(input.orderId);
    if (!order) {
      throw new OrderCommandError("NOT_FOUND", "Order not found.");
    }
    if (order.stage !== "received" && order.stage !== "fileOpened") {
      throw new OrderCommandError(
        "STAGE_MISMATCH",
        "The selling price can only change while the file is still open.",
      );
    }

    const updated = await this.dependencies.store.setSellingPrice({
      orderId: order.id,
      expectedRevision: input.expectedRevision,
      sellingPrice: normalized,
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new OrderCommandError(
        "REVISION_CONFLICT",
        "The order changed while this action was on screen.",
      );
    }

    // The amount itself stays out of the audit metadata: audit readers are not
    // guaranteed to hold `orders.readSellingPrice`.
    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "order.sellingPriceSet",
      resourceType: ORDER_RESOURCE_TYPE,
      resourceId: order.id,
      businessUnitIds: order.businessUnitIds,
      requestId: context.requestId,
      metadata: { currency: normalized.currency },
      occurredAt: this.now(),
    });

    return redact(updated, true);
  }

  /**
   * Raises the Director approval request that the CURRENT stage's exit is
   * gated on. The summary is built here so it can never include a price.
   */
  async requestStageApproval(
    context: AccessContext,
    input: { orderId: string },
  ): Promise<void> {
    const order = await this.dependencies.store.findById(input.orderId);
    if (!order) {
      throw new OrderCommandError("NOT_FOUND", "Order not found.");
    }
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
