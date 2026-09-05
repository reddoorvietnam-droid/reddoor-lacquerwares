import { describe, expect, it } from "vitest";

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
} from "@/domains/orders/contracts";
import { OrderCommandService } from "@/domains/orders/service";
import {
  OrderTransitionError,
  transitionNeedsReason,
} from "@/domains/orders/workflow";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";

import {
  accessContext as buildContext,
  actorId,
  auditRepository,
  FakeCustomerStore,
  FakeOrderStore,
  occurredAt,
  otherActorId,
  unitId,
} from "./helpers/finance-fakes";

const accessContext = (
  permissions: Parameters<typeof buildContext>[0],
  scope: Parameters<typeof buildContext>[1] = "assignedBusinessUnits",
  userId: string = actorId,
) => buildContext(permissions, scope, userId);

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

function build() {
  const store = new FakeOrderStore();
  const customers = new FakeCustomerStore();
  const approvals = new FakeApprovalRepository();
  const audit = auditRepository();
  const approvalService = new ApprovalService({
    repository: approvals,
    auditRepository: audit,
    now: () => occurredAt,
  });
  const service = new OrderCommandService({
    store,
    customerStore: customers,
    approvalRepository: approvals,
    approvalService,
    auditRepository: audit,
    now: () => occurredAt,
  });
  return { store, customers, approvals, audit, approvalService, service };
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
  it("creates an order in the received stage for a customer from the list, with a normalized price", async () => {
    const { service, customers, audit } = build();
    const customer = customers.seed({ name: "Công ty Kiso" });
    const context = accessContext(["orders.create"]);

    const order = await service.create(context, {
      customerId: customer.id,
      businessUnitIds: [unitId],
      sellingPrice: { amount: "1250.5", currency: "USD" },
      notes: null,
    });

    expect(order.stage).toBe("received");
    expect(order.customerId).toBe(customer.id);
    expect(order.customerName).toBe("Công ty Kiso");
    expect(order.sellingPrice).toEqual({ amount: "1250.50", currency: "USD" });
    expect(order.paymentDocuments).toEqual([]);
    expect(order.expectedReadyAt).toBeNull();
    expect(audit.events.map((event) => event.action)).toContain(
      "order.created",
    );
  });

  it("refuses an unknown or archived customer", async () => {
    const { service, customers } = build();
    const archived = customers.seed({ status: "archived" });
    const context = accessContext(["orders.create"]);

    await expect(
      service.create(context, {
        customerId: "ffffffffffffffffffffffff",
        businessUnitIds: [unitId],
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
    await expect(
      service.create(context, {
        customerId: archived.id,
        businessUnitIds: [unitId],
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_ARCHIVED" });
  });

  it("refuses a context without orders.create", async () => {
    const { service, customers } = build();
    const customer = customers.seed();
    await expect(
      service.create(accessContext(["orders.read"]), {
        customerId: customer.id,
        businessUnitIds: [unitId],
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });

  it("retries an auto-generated code on collision but not a manual one", async () => {
    const { service, store, customers } = build();
    const customer = customers.seed();
    const context = accessContext(["orders.create"]);
    store.seed({ orderCode: "RD-MANUAL" });

    await expect(
      service.create(context, {
        orderCode: "RD-MANUAL",
        customerId: customer.id,
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

describe("OrderCommandService export progress", () => {
  it("records the expected ready date and booking, treating blanks as unset", async () => {
    const { service, store, audit } = build();
    const order = store.seed({ stage: "inProduction" });
    const context = accessContext(["orders.updateExportProgress"]);

    const updated = await service.setExportProgress(context, {
      orderId: order.id,
      expectedRevision: 0,
      expectedReadyAt: "2026-10-15",
      bookingNumber: "  BK-778 ",
      bookingDate: "",
    });

    expect(updated.expectedReadyAt?.toISOString()).toBe(
      "2026-10-15T00:00:00.000Z",
    );
    expect(updated.bookingNumber).toBe("BK-778");
    expect(updated.bookingDate).toBeNull();
    expect(updated.revision).toBe(1);
    expect(audit.events.map((event) => event.action)).toContain(
      "order.exportProgressSet",
    );

    const cleared = await service.setExportProgress(context, {
      orderId: order.id,
      expectedRevision: 1,
      expectedReadyAt: "",
      bookingNumber: "",
      bookingDate: "2026-10-20",
    });
    expect(cleared.expectedReadyAt).toBeNull();
    expect(cleared.bookingNumber).toBeNull();
    expect(cleared.bookingDate?.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });

  it("refuses a closed or cancelled order, a stale revision, and a context without the permission", async () => {
    const { service, store } = build();
    const cancelled = store.seed({ stage: "cancelled" });
    const open = store.seed({ stage: "received", revision: 2 });
    const context = accessContext(["orders.updateExportProgress"]);

    await expect(
      service.setExportProgress(context, {
        orderId: cancelled.id,
        expectedRevision: 0,
        bookingNumber: "X",
      }),
    ).rejects.toMatchObject({ code: "STAGE_MISMATCH" });
    await expect(
      service.setExportProgress(context, {
        orderId: open.id,
        expectedRevision: 1,
        bookingNumber: "X",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(
      service.setExportProgress(accessContext(["orders.updateDraft"]), {
        orderId: open.id,
        expectedRevision: 2,
        bookingNumber: "X",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});

describe("OrderCommandService payment documents", () => {
  it("attaches and removes a payment document under payments.record", async () => {
    const { service, store, audit } = build();
    const order = store.seed({ stage: "invoiced" });
    const context = accessContext(["payments.record"]);

    const attached = await service.attachPaymentDocument(context, {
      orderId: order.id,
      expectedRevision: 0,
      publicId: "reddoor/orders/abc/def",
      assetVersion: 3,
      format: "pdf",
      bytes: 1024,
      label: "Ủy nhiệm chi 05/09",
    });
    expect(attached.paymentDocuments).toHaveLength(1);
    expect(attached.paymentDocuments[0]?.uploadedBy).toBe(actorId);
    expect(attached.paymentDocuments[0]?.uploadedAt).toEqual(occurredAt);

    const removed = await service.removePaymentDocument(context, {
      orderId: order.id,
      expectedRevision: attached.revision,
      documentId: attached.paymentDocuments[0]!.id,
    });
    expect(removed.paymentDocuments).toEqual([]);
    expect(audit.events.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "order.paymentDocumentAttached",
        "order.paymentDocumentRemoved",
      ]),
    );

    await expect(
      service.removePaymentDocument(context, {
        orderId: order.id,
        expectedRevision: removed.revision,
        documentId: "ffffffffffffffffffffffff",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.attachPaymentDocument(accessContext(["orders.read"]), {
        orderId: order.id,
        expectedRevision: removed.revision,
        publicId: "x",
        assetVersion: 1,
        format: "pdf",
        bytes: 1,
        label: "x",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
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
