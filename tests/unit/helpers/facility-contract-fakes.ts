import {
  ApprovalError,
  type ApprovalRepository,
  type ApprovalRequest,
  type ApprovalSubject,
} from "@/domains/approvals/contracts";
import { ApprovalService } from "@/domains/approvals/service";
import {
  FacilityContractError,
  type ApprovalHistoryReader,
  type FacilityContractFields,
  type FacilityContractListFilter,
  type FacilityContractRecordDto,
  type FacilityContractStore,
  type FacilityLookup,
  type FacilityLookupEntry,
  type FacilityPaymentListFilter,
  type FacilityPaymentRecordDto,
  type FacilityPaymentStatus,
  type FacilityPaymentStepFields,
  type FacilityPaymentStore,
  type NewFacilityContractDocument,
  type NewFacilityContractLine,
  type NewFacilityContractRecord,
  type NewFacilityPaymentRecord,
} from "@/domains/facility-contracts/contracts";
import { FacilityContractService } from "@/domains/facility-contracts/service";

import {
  actorId,
  auditRepository,
  FakeOrderStore,
  nextId,
  occurredAt,
} from "./finance-fakes";

/**
 * In-memory stores for the production-site contract service. They keep the
 * Mongo stores' contracts — revision checks, status conditions, unique codes —
 * so the service runs end to end without a database.
 */

export const managerId = actorId;
export const factoryAccountantId = "bcbcbcbcbcbcbcbcbcbcbcbc";
export const companyAccountantId = "cdcdcdcdcdcdcdcdcdcdcdcd";
export const directorId = "dededededededededededede";

function withLineIds(lines: readonly NewFacilityContractLine[]) {
  return lines.map((line) => ({ ...line, id: nextId("e") }));
}

export class FakeFacilityContractStore implements FacilityContractStore {
  contracts = new Map<string, FacilityContractRecordDto>();

  seed(
    partial: Partial<Omit<FacilityContractRecordDto, "lines">> & {
      lines?: readonly NewFacilityContractLine[];
    } = {},
  ): FacilityContractRecordDto {
    const id = partial.id ?? nextId("f");
    const record: FacilityContractRecordDto = {
      id,
      code: partial.code ?? `HDCS-TEST-${id.slice(-4)}`,
      facilityId: partial.facilityId ?? "site-thai",
      facilityCode: partial.facilityCode ?? "Thai",
      facilityName: partial.facilityName ?? "Anh Thái",
      orderId: partial.orderId ?? null,
      orderCode: partial.orderCode ?? null,
      lines: withLineIds(
        partial.lines ?? [
          {
            productCode: "BOWL-01",
            description: "Bát mộc",
            quantity: "100",
            unit: "cái",
            unitPrice: "50000",
            previousUnitPrice: null,
            previousContractCode: null,
          },
        ],
      ),
      startDate: partial.startDate ?? new Date("2026-09-15T00:00:00Z"),
      deliveryDate: partial.deliveryDate ?? new Date("2026-10-15T00:00:00Z"),
      note: partial.note ?? null,
      documents: partial.documents ?? [],
      status: partial.status ?? "draft",
      cancelReason: partial.cancelReason ?? null,
      activatedAt: partial.activatedAt ?? null,
      activatedBy: partial.activatedBy ?? null,
      createdBy: partial.createdBy ?? actorId,
      updatedBy: partial.updatedBy ?? actorId,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: partial.revision ?? 0,
    };
    this.contracts.set(id, record);
    return record;
  }

  private bump(
    contractId: string,
    expectedRevision: number,
    allowed: readonly FacilityContractRecordDto["status"][] | null,
    patch: Partial<FacilityContractRecordDto>,
  ): FacilityContractRecordDto | null {
    const existing = this.contracts.get(contractId);
    if (!existing || existing.revision !== expectedRevision) return null;
    if (allowed && !allowed.includes(existing.status)) return null;
    const updated = {
      ...existing,
      ...patch,
      revision: existing.revision + 1,
    };
    this.contracts.set(contractId, updated);
    return updated;
  }

  async insert(
    record: NewFacilityContractRecord,
  ): Promise<FacilityContractRecordDto> {
    for (const existing of this.contracts.values()) {
      if (existing.code === record.code) {
        throw new FacilityContractError("DUPLICATE_CODE", "duplicate");
      }
    }
    return this.seed({ ...record, createdBy: record.createdBy });
  }

  async findById(contractId: string) {
    return this.contracts.get(contractId) ?? null;
  }

  async list(filter: FacilityContractListFilter) {
    return [...this.contracts.values()].filter(
      (record) => !filter.status || record.status === filter.status,
    );
  }

  async updateDraft(input: {
    contractId: string;
    expectedRevision: number;
    fields: FacilityContractFields;
    updatedBy: string;
  }) {
    return this.bump(input.contractId, input.expectedRevision, ["draft"], {
      ...input.fields,
      lines: withLineIds(input.fields.lines),
      updatedBy: input.updatedBy,
    });
  }

  async activate(input: {
    contractId: string;
    expectedRevision: number;
    lines: readonly NewFacilityContractLine[];
    activatedAt: Date;
    activatedBy: string;
  }) {
    return this.bump(input.contractId, input.expectedRevision, ["draft"], {
      status: "active",
      lines: withLineIds(input.lines),
      activatedAt: input.activatedAt,
      activatedBy: input.activatedBy,
      updatedBy: input.activatedBy,
    });
  }

  async cancel(input: {
    contractId: string;
    expectedRevision: number;
    reason: string;
    updatedBy: string;
  }) {
    return this.bump(
      input.contractId,
      input.expectedRevision,
      ["draft", "active"],
      {
        status: "cancelled",
        cancelReason: input.reason,
        updatedBy: input.updatedBy,
      },
    );
  }

  async addDocument(input: {
    contractId: string;
    expectedRevision: number;
    document: NewFacilityContractDocument;
    updatedBy: string;
  }) {
    const existing = this.contracts.get(input.contractId);
    return this.bump(input.contractId, input.expectedRevision, null, {
      documents: [
        ...(existing?.documents ?? []),
        { ...input.document, id: nextId("d") },
      ],
      updatedBy: input.updatedBy,
    });
  }

  async removeDocument(input: {
    contractId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }) {
    const existing = this.contracts.get(input.contractId);
    if (!existing?.documents.some(({ id }) => id === input.documentId)) {
      return null;
    }
    return this.bump(input.contractId, input.expectedRevision, null, {
      documents: existing.documents.filter(({ id }) => id !== input.documentId),
      updatedBy: input.updatedBy,
    });
  }
}

export class FakeFacilityPaymentStore implements FacilityPaymentStore {
  payments = new Map<string, FacilityPaymentRecordDto>();
  private counter = 0;

  seed(
    partial: Partial<FacilityPaymentRecordDto> = {},
  ): FacilityPaymentRecordDto {
    const id = partial.id ?? nextId("9");
    const record: FacilityPaymentRecordDto = {
      id,
      code: partial.code ?? `DNTT-TEST-${++this.counter}`,
      contractId: partial.contractId ?? "f00000000000000000000001",
      contractCode: partial.contractCode ?? "HDCS-TEST",
      facilityId: partial.facilityId ?? "site-thai",
      facilityName: partial.facilityName ?? "Anh Thái",
      orderCode: partial.orderCode ?? null,
      amount: partial.amount ?? "1000000",
      note: partial.note ?? null,
      status: partial.status ?? "proposed",
      proposedBy: partial.proposedBy ?? managerId,
      proposedAt: partial.proposedAt ?? occurredAt,
      checkedBy: partial.checkedBy ?? null,
      checkedAt: partial.checkedAt ?? null,
      accountantApprovedBy: partial.accountantApprovedBy ?? null,
      accountantApprovedAt: partial.accountantApprovedAt ?? null,
      paidBy: partial.paidBy ?? null,
      paidAt: partial.paidAt ?? null,
      paidOn: partial.paidOn ?? null,
      paidNote: partial.paidNote ?? null,
      rejectedBy: partial.rejectedBy ?? null,
      rejectedAt: partial.rejectedAt ?? null,
      rejectReason: partial.rejectReason ?? null,
      rejectedAtStage: partial.rejectedAtStage ?? null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: partial.revision ?? 0,
    };
    this.payments.set(id, record);
    return record;
  }

  async insert(record: NewFacilityPaymentRecord) {
    for (const existing of this.payments.values()) {
      if (existing.code === record.code) {
        throw new FacilityContractError("DUPLICATE_CODE", "duplicate");
      }
    }
    return this.seed({ ...record, status: "proposed" });
  }

  async findById(paymentId: string) {
    return this.payments.get(paymentId) ?? null;
  }

  async list(filter: FacilityPaymentListFilter) {
    return [...this.payments.values()].filter(
      (record) =>
        (!filter.status || record.status === filter.status) &&
        (!filter.contractId || record.contractId === filter.contractId),
    );
  }

  async step(input: {
    paymentId: string;
    expectedRevision: number;
    from: FacilityPaymentStatus;
    to: FacilityPaymentStatus;
    fields: FacilityPaymentStepFields;
  }) {
    const existing = this.payments.get(input.paymentId);
    if (
      !existing ||
      existing.revision !== input.expectedRevision ||
      existing.status !== input.from
    ) {
      return null;
    }
    const updated = {
      ...existing,
      ...input.fields,
      status: input.to,
      revision: existing.revision + 1,
    };
    this.payments.set(existing.id, updated);
    return updated;
  }
}

export class FakeFacilityLookup implements FacilityLookup {
  facilities = new Map<string, FacilityLookupEntry>([
    [
      "site-thai",
      { id: "site-thai", code: "Thai", name: "Anh Thái", active: true },
    ],
    ["site-ha", { id: "site-ha", code: "Ha", name: "Chị Hà", active: true }],
    [
      "site-old",
      { id: "site-old", code: "Old", name: "Cơ sở cũ", active: false },
    ],
  ]);

  async findById(facilityId: string) {
    return this.facilities.get(facilityId) ?? null;
  }
}

export class FakeApprovalRepository
  implements ApprovalRepository, ApprovalHistoryReader
{
  requests: ApprovalRequest[] = [];
  private sequence = 0;

  seed(partial: Partial<ApprovalRequest>): ApprovalRequest {
    const request: ApprovalRequest = {
      id: partial.id ?? `${++this.sequence}`.padStart(24, "a"),
      subject: partial.subject ?? "facilityPayment.approval",
      resourceType: partial.resourceType ?? "facilityPayment",
      resourceId: partial.resourceId ?? "000000000000000000000001",
      businessUnitIds: partial.businessUnitIds ?? [],
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

  private match(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
    statuses: readonly ApprovalRequest["status"][],
  ) {
    return this.requests.filter(
      (request) =>
        request.resourceType === resourceType &&
        request.resourceId === resourceId &&
        request.subject === subject &&
        statuses.includes(request.status),
    );
  }

  async create(input: Parameters<ApprovalRepository["create"]>[0]) {
    if (
      this.match(input.resourceType, input.resourceId, input.subject, [
        "pending",
      ]).length > 0
    ) {
      throw new ApprovalError("ALREADY_PENDING", "pending");
    }
    return this.seed({ ...input, status: "pending" });
  }

  async findById(requestId: string) {
    return this.requests.find((request) => request.id === requestId) ?? null;
  }

  async findPendingForResource(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ) {
    return (
      this.match(resourceType, resourceId, subject, ["pending"])[0] ?? null
    );
  }

  async findApprovedForResource(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ) {
    return (
      this.match(resourceType, resourceId, subject, ["approved"]).at(-1) ?? null
    );
  }

  async findLatestDecided(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ) {
    return (
      this.match(resourceType, resourceId, subject, [
        "approved",
        "rejected",
      ]).at(-1) ?? null
    );
  }

  async listPending() {
    return this.requests.filter((request) => request.status === "pending");
  }

  async decide(input: Parameters<ApprovalRepository["decide"]>[0]) {
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

export function buildFacilityContractService() {
  const contracts = new FakeFacilityContractStore();
  const payments = new FakeFacilityPaymentStore();
  const facilities = new FakeFacilityLookup();
  const orders = new FakeOrderStore();
  const approvals = new FakeApprovalRepository();
  const audit = auditRepository();
  let clock = occurredAt.getTime();
  const now = () => new Date((clock += 1_000));
  const approvalService = new ApprovalService({
    repository: approvals,
    auditRepository: audit,
    now,
  });
  const service = new FacilityContractService({
    contractStore: contracts,
    paymentStore: payments,
    facilityLookup: facilities,
    orderStore: orders,
    approvalRepository: approvals,
    approvalService,
    approvalHistory: approvals,
    auditRepository: audit,
    now,
  });
  return {
    service,
    contracts,
    payments,
    facilities,
    orders,
    approvals,
    approvalService,
    audit,
  };
}
