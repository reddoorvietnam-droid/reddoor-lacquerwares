import { describe, expect, it, vi } from "vitest";

import type {
  AuditEventInput,
  AuditRepository,
} from "@/domains/audit/contracts";
import {
  ApprovalError,
  type ApprovalRepository,
  type ApprovalRequest,
  type ApprovalSubject,
} from "@/domains/approvals/contracts";
import { ApprovalService } from "@/domains/approvals/service";
import {
  approvalSummaryForOrder,
  generateOrderCode,
  OrderCommandError,
  type NewOrderRecord,
  type OrderListFilter,
  type OrderRecordDto,
  type OrderStore,
  type OrderTransitionWrite,
} from "@/domains/orders/contracts";
import { OrderCommandService } from "@/domains/orders/service";
import {
  OrderTransitionError,
  transitionNeedsReason,
} from "@/domains/orders/workflow";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import type {
  AccessContext,
  EffectivePermission,
} from "@/lib/auth/authorization";
import type { Permission } from "@/domains/identity/permissions";

const actorId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const otherActorId = "abababababababababababab";
const unitId = "111111111111111111111111";
const occurredAt = new Date("2026-08-27T09:30:00.000Z");

function accessContext(
  permissions: readonly Permission[],
  scope: EffectivePermission["scope"] = "assignedBusinessUnits",
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

class FakeOrderStore implements OrderStore {
  orders = new Map<string, OrderRecordDto>();
  private sequence = 0;

  seed(partial: Partial<OrderRecordDto>): OrderRecordDto {
    const id = partial.id ?? `${++this.sequence}`.padStart(24, "0");
    const record: OrderRecordDto = {
      id,
      orderCode: partial.orderCode ?? `RD-TEST-${this.sequence}`,
      customerName: partial.customerName ?? "Khách A",
      businessUnitIds: partial.businessUnitIds ?? [unitId],
      stage: partial.stage ?? "received",
      qcPassed: partial.qcPassed ?? false,
      sellingPrice: partial.sellingPrice ?? null,
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

  async insert(record: NewOrderRecord): Promise<OrderRecordDto> {
    for (const existing of this.orders.values()) {
      if (existing.orderCode === record.orderCode) {
        throw new OrderCommandError("DUPLICATE_ORDER_CODE", "duplicate");
      }
    }
    return this.seed({
      orderCode: record.orderCode,
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

  async applyTransition(
    input: OrderTransitionWrite,
  ): Promise<OrderRecordDto | null> {
    const order = this.orders.get(input.orderId);
    if (!order || order.revision !== input.expectedRevision) return null;
    const updated: OrderRecordDto = {
      ...order,
      stage: input.to,
      qcPassed: input.qcPassed,
      stageHistory: [...order.stageHistory, input.historyEntry],
      updatedBy: input.updatedBy,
      revision: order.revision + 1,
    };
    this.orders.set(order.id, updated);
    return updated;
  }

  async setQcPassed(input: {
    orderId: string;
    expectedRevision: number;
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    const order = this.orders.get(input.orderId);
    if (
      !order ||
      order.revision !== input.expectedRevision ||
      order.stage !== "qualityControl"
    ) {
      return null;
    }
    const updated: OrderRecordDto = {
      ...order,
      qcPassed: true,
      updatedBy: input.updatedBy,
      revision: order.revision + 1,
    };
    this.orders.set(order.id, updated);
    return updated;
  }

  async setSellingPrice(input: {
    orderId: string;
    expectedRevision: number;
    sellingPrice: { amount: string; currency: "VND" | "USD" | "EUR" };
    updatedBy: string;
  }): Promise<OrderRecordDto | null> {
    const order = this.orders.get(input.orderId);
    if (
      !order ||
      order.revision !== input.expectedRevision ||
      (order.stage !== "received" && order.stage !== "fileOpened")
    ) {
      return null;
    }
    const updated: OrderRecordDto = {
      ...order,
      sellingPrice: input.sellingPrice,
      updatedBy: input.updatedBy,
      revision: order.revision + 1,
    };
    this.orders.set(order.id, updated);
    return updated;
  }
}

class FakeApprovalRepository implements ApprovalRepository {
  requests: ApprovalRequest[] = [];
  private sequence = 0;

  seed(partial: Partial<ApprovalRequest>): ApprovalRequest {
    const request: ApprovalRequest = {
      id: partial.id ?? `${++this.sequence}`.padStart(24, "f"),
      subject: partial.subject ?? "order.confirm",
      resourceType: partial.resourceType ?? "salesOrder",
      resourceId: partial.resourceId ?? "000000000000000000000001",
      businessUnitIds: partial.businessUnitIds ?? [unitId],
      status: partial.status ?? "pending",
      requestedByUserId: partial.requestedByUserId ?? actorId,
      requestedAt: partial.requestedAt ?? occurredAt,
      summary: partial.summary ?? "summary",
      decidedByUserId: partial.decidedByUserId ?? null,
      decidedAt: partial.decidedAt ?? null,
      decisionReason: partial.decisionReason ?? null,
      expectedRevision: partial.expectedRevision ?? 0,
    };
    this.requests.push(request);
    return request;
  }

  async create(
    input: Parameters<ApprovalRepository["create"]>[0],
  ): Promise<ApprovalRequest> {
    const pending = this.requests.find(
      (request) =>
        request.resourceType === input.resourceType &&
        request.resourceId === input.resourceId &&
        request.subject === input.subject &&
        request.status === "pending",
    );
    if (pending) throw new ApprovalError("ALREADY_PENDING", "pending");
    return this.seed({
      subject: input.subject,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      businessUnitIds: input.businessUnitIds,
      requestedByUserId: input.requestedByUserId,
      requestedAt: input.requestedAt,
      summary: input.summary,
      expectedRevision: input.expectedRevision,
      status: "pending",
    });
  }

  async findById(requestId: string): Promise<ApprovalRequest | null> {
    return this.requests.find((request) => request.id === requestId) ?? null;
  }

  async findPendingForResource(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ): Promise<ApprovalRequest | null> {
    return (
      this.requests.find(
        (request) =>
          request.resourceType === resourceType &&
          request.resourceId === resourceId &&
          request.subject === subject &&
          request.status === "pending",
      ) ?? null
    );
  }

  async findApprovedForResource(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ): Promise<ApprovalRequest | null> {
    return (
      this.requests.find(
        (request) =>
          request.resourceType === resourceType &&
          request.resourceId === resourceId &&
          request.subject === subject &&
          request.status === "approved",
      ) ?? null
    );
  }

  async listPending(): Promise<ApprovalRequest[]> {
    return this.requests.filter((request) => request.status === "pending");
  }

  async decide(
    input: Parameters<ApprovalRepository["decide"]>[0],
  ): Promise<ApprovalRequest> {
    const request = this.requests.find(
      (candidate) =>
        candidate.id === input.requestId && candidate.status === "pending",
    );
    if (!request) throw new ApprovalError("ALREADY_DECIDED", "decided");
    Object.assign(request, {
      status: input.decision,
      decidedByUserId: input.decidedByUserId,
      decidedAt: input.decidedAt,
      decisionReason: input.decisionReason,
    });
    return request;
  }
}

function auditRepository(): AuditRepository & { events: AuditEventInput[] } {
  const events: AuditEventInput[] = [];
  return {
    events,
    append: vi.fn(async (event: AuditEventInput) => {
      events.push(event);
      return { id: "audit", occurredAt: event.occurredAt };
    }),
  };
}

function build() {
  const store = new FakeOrderStore();
  const approvals = new FakeApprovalRepository();
  const audit = auditRepository();
  const approvalService = new ApprovalService({
    repository: approvals,
    auditRepository: audit,
    now: () => occurredAt,
  });
  const service = new OrderCommandService({
    store,
    approvalRepository: approvals,
    approvalService,
    auditRepository: audit,
    now: () => occurredAt,
  });
  return { store, approvals, audit, approvalService, service };
}

describe("generateOrderCode", () => {
  it("emits RD-YYYYMMDD-XXXX", () => {
    const code = generateOrderCode(new Date("2026-08-27T00:00:00Z"), () => 0);
    expect(code).toMatch(/^RD-2026082[67]-[A-Z2-9]{4}$/);
  });
});

describe("transitionNeedsReason", () => {
  it("requires a reason for cancellation and rework only", () => {
    expect(transitionNeedsReason("received", "cancelled")).toBe(true);
    expect(transitionNeedsReason("qualityControl", "inProduction")).toBe(true);
    expect(transitionNeedsReason("received", "fileOpened")).toBe(false);
    expect(transitionNeedsReason("qualityControl", "packing")).toBe(false);
  });
});

describe("OrderCommandService.create", () => {
  it("creates an order in the received stage with a normalized price", async () => {
    const { service, audit } = build();
    const context = accessContext(["orders.create"]);

    const order = await service.create(context, {
      customerName: "Khách A",
      businessUnitIds: [unitId],
      sellingPrice: { amount: "1250.5", currency: "USD" },
      notes: null,
    });

    expect(order.stage).toBe("received");
    expect(order.sellingPrice).toEqual({ amount: "1250.50", currency: "USD" });
    expect(audit.events.map((event) => event.action)).toContain(
      "order.created",
    );
  });

  it("refuses a context without orders.create", async () => {
    const { service } = build();
    await expect(
      service.create(accessContext(["orders.read"]), {
        customerName: "Khách A",
        businessUnitIds: [unitId],
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });

  it("retries an auto-generated code on collision but not a manual one", async () => {
    const { service, store } = build();
    const context = accessContext(["orders.create"]);
    store.seed({ orderCode: "RD-MANUAL" });

    await expect(
      service.create(context, {
        orderCode: "RD-MANUAL",
        customerName: "Khách A",
        businessUnitIds: [unitId],
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_ORDER_CODE" });
  });
});

describe("OrderCommandService.transition", () => {
  it("moves received to fileOpened for the stage owner's permission", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "received" });

    const moved = await service.transition(
      accessContext(["orders.updateDraft"]),
      {
        orderId: order.id,
        to: "fileOpened",
        expectedRevision: 0,
        reason: null,
      },
    );

    expect(moved.stage).toBe("fileOpened");
    expect(moved.stageHistory).toHaveLength(1);
  });

  it("re-asserts the current stage's advance permission", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "received" });

    await expect(
      service.transition(accessContext(["orders.read"]), {
        orderId: order.id,
        to: "fileOpened",
        expectedRevision: 0,
        reason: null,
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });

  it("refuses a gated stage without an approved Director decision", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "awaitingDirectorApproval" });

    await expect(
      service.transition(accessContext(["orders.confirm"]), {
        orderId: order.id,
        to: "productionPlanning",
        expectedRevision: 0,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_MISSING" });
  });

  it("refuses an approval pinned to an older revision", async () => {
    const { service, store, approvals } = build();
    const order = store.seed({
      stage: "awaitingDirectorApproval",
      revision: 3,
    });
    approvals.seed({
      resourceId: order.id,
      subject: "order.confirm",
      status: "approved",
      expectedRevision: 2,
    });

    await expect(
      service.transition(accessContext(["orders.confirm"]), {
        orderId: order.id,
        to: "productionPlanning",
        expectedRevision: 3,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("passes a gated stage with a matching approval and resets QC on entry", async () => {
    const { service, store, approvals } = build();
    const order = store.seed({ stage: "inProduction", qcPassed: true });
    approvals.seed({ resourceId: order.id, status: "approved" });

    const moved = await service.transition(
      accessContext(["production.completeWork"]),
      {
        orderId: order.id,
        to: "qualityControl",
        expectedRevision: 0,
        reason: null,
      },
    );

    expect(moved.stage).toBe("qualityControl");
    expect(moved.qcPassed).toBe(false);
  });

  it("blocks packing until QC passes and rework without a reason", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "qualityControl", qcPassed: false });
    const context = accessContext(["production.approveQc"]);

    await expect(
      service.transition(context, {
        orderId: order.id,
        to: "packing",
        expectedRevision: 0,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "QC_NOT_PASSED" });

    await expect(
      service.transition(context, {
        orderId: order.id,
        to: "inProduction",
        expectedRevision: 0,
        reason: "  ",
      }),
    ).rejects.toBeInstanceOf(OrderTransitionError);
  });

  it("rejects a stale on-screen revision", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "received", revision: 2 });

    await expect(
      service.transition(accessContext(["orders.updateDraft"]), {
        orderId: order.id,
        to: "fileOpened",
        expectedRevision: 1,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });
});

describe("OrderCommandService price redaction", () => {
  it("strips the selling price for unauthorized readers", async () => {
    const { service, store } = build();
    store.seed({ sellingPrice: { amount: "100.00", currency: "USD" } });

    const [hidden] = await service.list({ kind: "all" }, false);
    const [visible] = await service.list({ kind: "all" }, true);

    expect(hidden?.sellingPrice).toBeNull();
    expect(hidden?.sellingPriceVisible).toBe(false);
    expect(visible?.sellingPrice).toEqual({
      amount: "100.00",
      currency: "USD",
    });
  });
});

describe("OrderCommandService.requestStageApproval", () => {
  it("raises the current stage's subject with a price-free summary", async () => {
    const { service, store, approvals } = build();
    const order = store.seed({
      stage: "awaitingDirectorApproval",
      sellingPrice: { amount: "9999.00", currency: "USD" },
    });

    await service.requestStageApproval(accessContext(["approvals.request"]), {
      orderId: order.id,
    });

    const [request] = approvals.requests;
    expect(request?.subject).toBe("order.confirm");
    expect(request?.expectedRevision).toBe(order.revision);
    expect(request?.summary).not.toContain("9999");
    expect(request?.summary).toBe(approvalSummaryForOrder(order));
  });

  it("refuses a stage without an approval subject", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "received" });

    await expect(
      service.requestStageApproval(accessContext(["approvals.request"]), {
        orderId: order.id,
      }),
    ).rejects.toMatchObject({ code: "STAGE_MISMATCH" });
  });
});

describe("ApprovalService.decide", () => {
  it("enforces separation of duties through the policy", async () => {
    const { approvals, approvalService } = build();
    const request = approvals.seed({ requestedByUserId: actorId });

    await expect(
      approvalService.decide(
        accessContext(["orders.approve"], "all", actorId),
        {
          requestId: request.id,
          decision: "approved",
          decisionReason: null,
          expectedRevision: request.expectedRevision,
        },
      ),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL" });
  });

  it("approves for a distinct global decider and audits it", async () => {
    const { approvals, approvalService, audit } = build();
    const request = approvals.seed({ requestedByUserId: actorId });

    const decided = await approvalService.decide(
      accessContext(["orders.approve"], "all", otherActorId),
      {
        requestId: request.id,
        decision: "approved",
        decisionReason: null,
        expectedRevision: request.expectedRevision,
      },
    );

    expect(decided.status).toBe("approved");
    expect(audit.events.map((event) => event.action)).toContain(
      "approval.approved",
    );
  });

  it("refuses a unit-narrowed grant for a globally scoped decision", async () => {
    const { approvals, approvalService } = build();
    const request = approvals.seed({ requestedByUserId: actorId });

    await expect(
      approvalService.decide(
        accessContext(
          ["orders.approve"],
          "assignedBusinessUnits",
          otherActorId,
        ),
        {
          requestId: request.id,
          decision: "approved",
          decisionReason: null,
          expectedRevision: request.expectedRevision,
        },
      ),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});
