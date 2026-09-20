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
  labelStatus,
  orderReadiness,
  tradeDocumentStatuses,
  type OrderDocument,
  type OrderDocumentKind,
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
  nextId,
  occurredAt,
  otherActorId,
  unitId,
} from "./helpers/finance-fakes";

function orderFile(
  kind: OrderDocumentKind,
  overrides: Partial<OrderDocument> = {},
): OrderDocument {
  return {
    id: nextId("d"),
    kind,
    publicId: `reddoor/orders/test/${kind}`,
    assetVersion: 1,
    format: "pdf",
    bytes: 1024,
    label: `${kind}.pdf`,
    uploadedBy: actorId,
    uploadedAt: occurredAt,
    ...overrides,
  };
}

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
    expect(transitionNeedsReason("received", "awaitingDirectorApproval")).toBe(
      false,
    );
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
      lineItems: [
        {
          productCode: "RD-BOWL-01",
          description: "Bát sơn mài đỏ",
          quantity: "120",
          unit: "cái",
          facilityName: "Cơ sở Mộc Hạ Thái",
          note: null,
        },
      ],
      shippingMark: "KISO / PO 88",
      deliveryDueAt: "2026-11-30",
      targets: "Lỗi ≤ 2%",
      notes: null,
    });

    expect(order.stage).toBe("received");
    expect(order.customerId).toBe(customer.id);
    expect(order.customerName).toBe("Công ty Kiso");
    expect(order.sellingPrice).toEqual({ amount: "1250.50", currency: "USD" });
    expect(order.lineItems).toHaveLength(1);
    expect(order.lineItems[0]?.productCode).toBe("RD-BOWL-01");
    expect(order.lineItems[0]?.facilityName).toBe("Cơ sở Mộc Hạ Thái");
    expect(order.shippingMark).toBe("KISO / PO 88");
    expect(order.deliveryDueAt?.toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(order.productionPlan).toBeNull();
    expect(order.productionStage).toBeNull();
    expect(order.qcChecks).toEqual([]);
    expect(order.documents).toEqual([]);
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
  it("submits a received order to the Director for the stage owner's permission", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "received" });

    const moved = await service.transition(
      accessContext(["orders.submitForApproval"]),
      {
        orderId: order.id,
        to: "awaitingDirectorApproval",
        expectedRevision: 0,
        reason: null,
      },
    );

    expect(moved.stage).toBe("awaitingDirectorApproval");
    expect(moved.stageHistory).toHaveLength(1);
  });

  it("re-asserts the current stage's advance permission", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "received" });

    await expect(
      service.transition(accessContext(["orders.read"]), {
        orderId: order.id,
        to: "awaitingDirectorApproval",
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
        to: "sampleConfirmation",
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
        to: "sampleConfirmation",
        expectedRevision: 3,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("starts production at woodwork and resets QC on entering quality control", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "inventoryCheck" });

    const started = await service.transition(
      accessContext(["inventory.issue"]),
      {
        orderId: order.id,
        to: "inProduction",
        expectedRevision: 0,
        reason: null,
      },
    );
    expect(started.productionStage).toBe("woodwork");

    const finishing = store.seed({
      stage: "inProduction",
      qcPassed: true,
      productionStage: "finishing",
    });
    const moved = await service.transition(
      accessContext(["production.completeWork"]),
      {
        orderId: finishing.id,
        to: "qualityControl",
        expectedRevision: 0,
        reason: null,
      },
    );

    expect(moved.stage).toBe("qualityControl");
    expect(moved.qcPassed).toBe(false);
    // Rework keeps the workshop stage so the Factory Manager chooses where
    // to resume.
    expect(moved.productionStage).toBe("finishing");
  });

  it("refuses to leave production before finishing, and planning before the plan", async () => {
    const { service, store } = build();
    const lacquer = store.seed({
      stage: "inProduction",
      productionStage: "lacquer",
    });
    await expect(
      service.transition(accessContext(["production.completeWork"]), {
        orderId: lacquer.id,
        to: "qualityControl",
        expectedRevision: 0,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "PRODUCTION_INCOMPLETE" });

    const planning = store.seed({ stage: "productionPlanning" });
    await expect(
      service.transition(accessContext(["production.createPlan"]), {
        orderId: planning.id,
        to: "inventoryCheck",
        expectedRevision: 0,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "PLAN_MISSING" });
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
      service.transition(accessContext(["orders.submitForApproval"]), {
        orderId: order.id,
        to: "awaitingDirectorApproval",
        expectedRevision: 1,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });
});

describe("OrderCommandService inspections and workshop stages", () => {
  const inspector = () => accessContext(["production.approveQc"]);

  it("records the finishing inspection in quality control and unlocks packing on a pass", async () => {
    const { service, store, audit } = build();
    const order = store.seed({ stage: "qualityControl" });

    const failed = await service.recordQcCheck(inspector(), {
      orderId: order.id,
      expectedRevision: 0,
      checkpoint: "finishing",
      result: "fail",
      defectCount: "3",
      note: "Bong sơn ở đáy",
    });
    expect(failed.qcPassed).toBe(false);
    expect(failed.qcChecks).toHaveLength(1);
    expect(failed.qcChecks[0]?.defectCount).toBe(3);

    const passed = await service.recordQcCheck(inspector(), {
      orderId: order.id,
      expectedRevision: failed.revision,
      checkpoint: "finishing",
      result: "pass",
      defectCount: "",
      note: "",
    });
    expect(passed.qcPassed).toBe(true);
    expect(passed.qcChecks).toHaveLength(2);

    const packed = await service.transition(inspector(), {
      orderId: order.id,
      to: "packing",
      expectedRevision: passed.revision,
      reason: null,
    });
    expect(packed.stage).toBe("packing");
    expect(audit.events.map((event) => event.action)).toContain(
      "order.qcChecked",
    );
  });

  it("records each inspection only in its own stage", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "qualityControl" });

    await expect(
      service.recordQcCheck(inspector(), {
        orderId: order.id,
        expectedRevision: 0,
        checkpoint: "woodwork",
        result: "pass",
      }),
    ).rejects.toMatchObject({ code: "STAGE_MISMATCH" });
    await expect(
      service.recordQcCheck(accessContext(["orders.read"]), {
        orderId: order.id,
        expectedRevision: 0,
        checkpoint: "finishing",
        result: "pass",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });

  it("starts lacquer only after the raw-body inspection passes", async () => {
    const { service, store } = build();
    const order = store.seed({
      stage: "inProduction",
      productionStage: "woodwork",
    });
    const progress = accessContext(["production.updateProgress"]);

    await expect(
      service.setProductionStage(progress, {
        orderId: order.id,
        expectedRevision: 0,
        productionStage: "lacquer",
      }),
    ).rejects.toMatchObject({ code: "WOODWORK_NOT_PASSED" });

    const checked = await service.recordQcCheck(inspector(), {
      orderId: order.id,
      expectedRevision: 0,
      checkpoint: "woodwork",
      result: "pass",
    });
    const lacquer = await service.setProductionStage(progress, {
      orderId: order.id,
      expectedRevision: checked.revision,
      productionStage: "lacquer",
    });
    expect(lacquer.productionStage).toBe("lacquer");
  });

  it("leaves packing only with the slip and a passed packing inspection", async () => {
    const { service, store } = build();
    const order = store.seed({
      stage: "packing",
      documents: [orderFile("customerLabelSpec")],
    });
    const storekeeper = accessContext(["packing.update", "packing.complete"]);

    await expect(
      service.transition(storekeeper, {
        orderId: order.id,
        to: "exportDocuments",
        expectedRevision: 0,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "PACKING_NOT_READY" });

    const slip = await service.setPackingRecord(storekeeper, {
      orderId: order.id,
      expectedRevision: 0,
      packedAt: "2026-10-01",
      cartons: "40",
      pallets: "2",
      containerNumber: "",
      note: "",
    });
    expect(slip.packingRecord?.cartons).toBe(40);
    expect(slip.packingRecord?.containerNumber).toBeNull();

    const inspected = await service.recordQcCheck(inspector(), {
      orderId: order.id,
      expectedRevision: slip.revision,
      checkpoint: "packing",
      result: "pass",
    });
    const moved = await service.transition(storekeeper, {
      orderId: order.id,
      to: "exportDocuments",
      expectedRevision: inspected.revision,
      reason: null,
    });
    expect(moved.stage).toBe("exportDocuments");
  });
});

describe("OrderCommandService documents by kind", () => {
  const file = {
    publicId: "reddoor/orders/abc/pkl",
    assetVersion: 1,
    format: "pdf",
    bytes: 2048,
    label: "PKL-001.pdf",
  };

  it("lets the trade-document holder file the INV and PKL, which then release step 8", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "exportDocuments" });
    const accountant = accessContext(["tradeDocuments.manage"]);

    await expect(
      service.transition(accountant, {
        orderId: order.id,
        to: "tradeDocumentation",
        expectedRevision: 0,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "EXPORT_DOCUMENTS_MISSING" });

    const withInvoice = await service.attachDocument(accountant, {
      orderId: order.id,
      expectedRevision: 0,
      kind: "invoice",
      ...file,
    });
    const withBoth = await service.attachDocument(accountant, {
      orderId: order.id,
      expectedRevision: withInvoice.revision,
      kind: "packingList",
      ...file,
    });
    expect(withBoth.documents.map((document) => document.kind)).toEqual([
      "invoice",
      "packingList",
    ]);

    const moved = await service.transition(accountant, {
      orderId: order.id,
      to: "tradeDocumentation",
      expectedRevision: withBoth.revision,
      reason: null,
    });
    expect(moved.stage).toBe("tradeDocumentation");
  });

  it("checks the permission of the file's kind on attach and remove", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "received" });

    await expect(
      service.attachDocument(accessContext(["orders.read"]), {
        orderId: order.id,
        expectedRevision: 0,
        kind: "contract",
        ...file,
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);

    const attached = await service.attachDocument(
      accessContext(["orders.updateDraft"]),
      { orderId: order.id, expectedRevision: 0, kind: "contract", ...file },
    );
    const documentId = attached.documents[0]!.id;

    await expect(
      service.removeDocument(accessContext(["tradeDocuments.manage"]), {
        orderId: order.id,
        expectedRevision: attached.revision,
        documentId,
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);

    const removed = await service.removeDocument(
      accessContext(["orders.updateDraft"]),
      { orderId: order.id, expectedRevision: attached.revision, documentId },
    );
    expect(removed.documents).toEqual([]);
  });
});

describe("export document deadlines", () => {
  it("wants the INV, PKL and labels 21 days before the booking date", () => {
    const bookingDate = new Date("2026-11-30T00:00:00.000Z");
    const statuses = tradeDocumentStatuses(
      { documents: [], bookingDate, stageHistory: [] },
      new Date("2026-11-10T00:00:00.000Z"),
    );
    for (const kind of ["invoice", "packingList", "label"] as const) {
      const row = statuses.find((status) => status.kind === kind);
      expect(row?.days, kind).toBe(21);
      expect(row?.dueAt?.toISOString(), kind).toBe("2026-11-09T00:00:00.000Z");
      expect(row?.overdue, kind).toBe(true);
    }
  });
});

describe("label templates and the Director's approval", () => {
  const packed = {
    stage: "packing" as const,
    packingRecord: {
      packedAt: null,
      cartons: 10,
      pallets: 1,
      containerNumber: null,
      note: null,
      byUserId: actorId,
      at: occurredAt,
    },
    qcChecks: [
      {
        id: "q00000000000000000000001",
        checkpoint: "packing" as const,
        result: "pass" as const,
        defectCount: null,
        note: null,
        byUserId: actorId,
        at: occurredAt,
      },
    ],
  };
  const director = () =>
    accessContext(["approvals.decide"], "all", otherActorId);

  it("reads the labels as ready with a customer spec or an approved company proof only", () => {
    const base = {
      productionPlan: null,
      productionStage: null,
      qcChecks: [],
      packingRecord: null,
    };
    const proof = orderFile("labelProof");

    expect(
      orderReadiness({ ...base, documents: [], labelApproval: null })
        .labelsReady,
    ).toBe(false);
    expect(
      orderReadiness({
        ...base,
        documents: [orderFile("customerLabelSpec")],
        labelApproval: null,
      }).labelsReady,
    ).toBe(true);
    expect(
      orderReadiness({ ...base, documents: [proof], labelApproval: null })
        .labelsReady,
    ).toBe(false);
    expect(
      orderReadiness({
        ...base,
        documents: [proof],
        labelApproval: {
          documentId: proof.id,
          approvedBy: otherActorId,
          approvedAt: occurredAt,
        },
      }).labelsReady,
    ).toBe(true);
    // An approval whose file is gone approves nothing.
    expect(
      orderReadiness({
        ...base,
        documents: [orderFile("labelProof")],
        labelApproval: {
          documentId: proof.id,
          approvedBy: otherActorId,
          approvedAt: occurredAt,
        },
      }).labelsReady,
    ).toBe(false);
  });

  it("refuses to leave packing until the labels are settled, then lets the Director's approval release it", async () => {
    const { service, store, audit } = build();
    const proof = orderFile("labelProof", { uploadedBy: actorId });
    const order = store.seed({ ...packed, documents: [proof] });
    const storekeeper = accessContext(["packing.complete"]);

    await expect(
      service.transition(storekeeper, {
        orderId: order.id,
        to: "exportDocuments",
        expectedRevision: 0,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "LABELS_NOT_APPROVED" });

    const approved = await service.approveLabelProof(director(), {
      orderId: order.id,
      expectedRevision: 0,
      documentId: proof.id,
    });
    expect(approved.labelApproval).toEqual({
      documentId: proof.id,
      approvedBy: otherActorId,
      approvedAt: occurredAt,
    });
    expect(labelStatus(approved).kind).toBe("proofApproved");
    expect(audit.events.map((event) => event.action)).toContain(
      "order.labelApproved",
    );

    const moved = await service.transition(storekeeper, {
      orderId: order.id,
      to: "exportDocuments",
      expectedRevision: approved.revision,
      reason: null,
    });
    expect(moved.stage).toBe("exportDocuments");
  });

  it("never lets the uploader approve their own proof", async () => {
    const { service, store } = build();
    const proof = orderFile("labelProof", { uploadedBy: otherActorId });
    const order = store.seed({ stage: "packing", documents: [proof] });

    await expect(
      service.approveLabelProof(director(), {
        orderId: order.id,
        expectedRevision: 0,
        documentId: proof.id,
      }),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL" });
    expect(store.orders.get(order.id)?.labelApproval).toBeNull();
  });

  it("refuses a unit-narrowed or missing decision grant", async () => {
    const { service, store } = build();
    const proof = orderFile("labelProof");
    const order = store.seed({ stage: "packing", documents: [proof] });
    const input = {
      orderId: order.id,
      expectedRevision: 0,
      documentId: proof.id,
    };

    await expect(
      service.approveLabelProof(
        accessContext(
          ["approvals.decide"],
          "assignedBusinessUnits",
          otherActorId,
        ),
        input,
      ),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      service.approveLabelProof(
        accessContext(["orders.updateDraft"], "all", otherActorId),
        input,
      ),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });

  it("approves only a company proof that is on file, on an open order, at the current revision", async () => {
    const { service, store } = build();
    const spec = orderFile("customerLabelSpec");
    const proof = orderFile("labelProof");
    const open = store.seed({
      stage: "inProduction",
      documents: [spec, proof],
      revision: 2,
    });
    const closed = store.seed({ stage: "cancelled", documents: [proof] });

    await expect(
      service.approveLabelProof(director(), {
        orderId: open.id,
        expectedRevision: 2,
        documentId: spec.id,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.approveLabelProof(director(), {
        orderId: open.id,
        expectedRevision: 2,
        documentId: "ffffffffffffffffffffffff",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.approveLabelProof(director(), {
        orderId: open.id,
        expectedRevision: 1,
        documentId: proof.id,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(
      service.approveLabelProof(director(), {
        orderId: closed.id,
        expectedRevision: 0,
        documentId: proof.id,
      }),
    ).rejects.toMatchObject({ code: "STAGE_MISMATCH" });
  });

  it("ties the approval to the file: a newer proof waits again, and removing the approved file clears it", async () => {
    const { service, store } = build();
    const editor = accessContext(["orders.updateDraft"]);
    const order = store.seed({ stage: "packing" });

    const withProof = await service.attachDocument(editor, {
      orderId: order.id,
      expectedRevision: 0,
      kind: "labelProof",
      publicId: "reddoor/orders/test/proof-1",
      assetVersion: 1,
      format: "pdf",
      bytes: 2048,
      label: "Mẫu tem v1.pdf",
    });
    const firstProof = withProof.documents[0]!;
    expect(labelStatus(withProof)).toMatchObject({
      kind: "proofPending",
      proof: { id: firstProof.id },
    });

    const approved = await service.approveLabelProof(director(), {
      orderId: order.id,
      expectedRevision: withProof.revision,
      documentId: firstProof.id,
    });
    expect(labelStatus(approved).kind).toBe("proofApproved");

    const removed = await service.removeDocument(editor, {
      orderId: order.id,
      expectedRevision: approved.revision,
      documentId: firstProof.id,
    });
    expect(removed.labelApproval).toBeNull();
    expect(labelStatus(removed).kind).toBe("missing");

    const secondProof = await service.attachDocument(editor, {
      orderId: order.id,
      expectedRevision: removed.revision,
      kind: "labelProof",
      publicId: "reddoor/orders/test/proof-2",
      assetVersion: 1,
      format: "pdf",
      bytes: 2048,
      label: "Mẫu tem v2.pdf",
    });
    expect(secondProof.labelApproval).toBeNull();
    expect(labelStatus(secondProof).kind).toBe("proofPending");
    expect(orderReadiness(secondProof).labelsReady).toBe(false);
  });

  it("does not let an approved older proof cover a newer one still waiting", async () => {
    const { service, store } = build();
    const editor = accessContext(["orders.updateDraft"]);
    const order = store.seed({ stage: "packing" });
    const proofInput = (version: number) => ({
      kind: "labelProof",
      publicId: `reddoor/orders/test/proof-${version}`,
      assetVersion: 1,
      format: "pdf",
      bytes: 2048,
      label: `Mẫu tem v${version}.pdf`,
    });

    const withFirst = await service.attachDocument(editor, {
      orderId: order.id,
      expectedRevision: 0,
      ...proofInput(1),
    });
    const firstProof = withFirst.documents[0]!;
    const approved = await service.approveLabelProof(director(), {
      orderId: order.id,
      expectedRevision: withFirst.revision,
      documentId: firstProof.id,
    });
    expect(orderReadiness(approved).labelsReady).toBe(true);

    const withSecond = await service.attachDocument(editor, {
      orderId: order.id,
      expectedRevision: approved.revision,
      ...proofInput(2),
    });
    const secondProof = withSecond.documents[1]!;
    expect(labelStatus(withSecond)).toMatchObject({
      kind: "proofPending",
      proof: { id: secondProof.id },
    });
    expect(orderReadiness(withSecond).labelsReady).toBe(false);

    await expect(
      service.approveLabelProof(director(), {
        orderId: order.id,
        expectedRevision: withSecond.revision,
        documentId: firstProof.id,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    const approvedSecond = await service.approveLabelProof(director(), {
      orderId: order.id,
      expectedRevision: withSecond.revision,
      documentId: secondProof.id,
    });
    expect(labelStatus(approvedSecond).kind).toBe("proofApproved");
    expect(orderReadiness(approvedSecond).labelsReady).toBe(true);
  });
});

describe("OrderCommandService line items and details", () => {
  it("replaces the lines and details under orders.updateDraft while the file is open", async () => {
    const { service, store } = build();
    const order = store.seed({ stage: "inProduction" });
    const editor = accessContext(["orders.updateDraft"]);

    const lines = await service.setLineItems(editor, {
      orderId: order.id,
      expectedRevision: 0,
      lineItems: [
        { productCode: "A1", quantity: "10" },
        { productCode: "A2", quantity: "5.5", unit: "bộ" },
      ],
    });
    expect(lines.lineItems.map((line) => line.productCode)).toEqual([
      "A1",
      "A2",
    ]);
    expect(lines.lineItems[1]?.unit).toBe("bộ");

    const details = await service.setDetails(editor, {
      orderId: order.id,
      expectedRevision: lines.revision,
      shippingMark: " KISO ",
      deliveryDueAt: "2026-12-01",
      targets: "",
    });
    expect(details.shippingMark).toBe("KISO");
    expect(details.targets).toBeNull();

    const closed = store.seed({ stage: "closed" });
    await expect(
      service.setLineItems(editor, {
        orderId: closed.id,
        expectedRevision: 0,
        lineItems: [],
      }),
    ).rejects.toMatchObject({ code: "STAGE_MISMATCH" });
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
