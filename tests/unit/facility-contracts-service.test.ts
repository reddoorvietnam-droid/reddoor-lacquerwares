import { describe, expect, it } from "vitest";

import type { Permission } from "@/domains/identity/permissions";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";

import {
  buildFacilityContractService,
  companyAccountantId,
  directorId,
  factoryAccountantId,
  managerId,
} from "./helpers/facility-contract-fakes";
import { accessContext } from "./helpers/finance-fakes";

const manager = accessContext(
  [
    "facilityContracts.read",
    "facilityContracts.manage",
    "facilityPayments.propose",
    "approvals.request",
  ],
  "all",
  managerId,
);
const factoryAccountant = accessContext(
  [
    "facilityContracts.read",
    "facilityPayments.check",
    "facilityPayments.markPaid",
    "approvals.request",
  ],
  "all",
  factoryAccountantId,
);
const companyAccountant = accessContext(
  ["facilityContracts.read", "facilityPayments.approve", "approvals.request"],
  "all",
  companyAccountantId,
);
const director = accessContext(
  ["approvals.decide", "approvals.read"] satisfies Permission[],
  "all",
  directorId,
);

const draftInput = (overrides: Record<string, unknown> = {}) => ({
  facilityId: "site-thai",
  orderId: "",
  startDate: "2026-09-15",
  deliveryDate: "2026-10-15",
  note: "",
  lines: [
    {
      productCode: "BOWL-01",
      description: "Bát mộc",
      quantity: "100",
      unit: "cái",
      unitPrice: "60000",
    },
  ],
  ...overrides,
});

async function decideLatest(
  harness: ReturnType<typeof buildFacilityContractService>,
  decision: "approved" | "rejected",
  reason: string | null = null,
) {
  const pending = harness.approvals.requests.find(
    (request) => request.status === "pending",
  );
  if (!pending) throw new Error("no pending request");
  await harness.approvalService.decide(director, {
    requestId: pending.id,
    decision,
    decisionReason: reason,
    expectedRevision: pending.expectedRevision,
  });
  return pending;
}

describe("contracts", () => {
  it("creates a draft with site snapshots, an auto code and previous prices", async () => {
    const harness = buildFacilityContractService();
    harness.contracts.seed({
      code: "HDCS-OLD",
      status: "active",
      activatedAt: new Date("2026-01-01T00:00:00Z"),
      lines: [
        {
          productCode: "bowl-01",
          description: "Bát",
          quantity: "10",
          unit: "cái",
          unitPrice: "50000",
          previousUnitPrice: null,
          previousContractCode: null,
        },
      ],
    });

    const created = await harness.service.createContract(manager, draftInput());

    expect(created.status).toBe("draft");
    expect(created.code).toMatch(/^HDCS-\d{8}-[A-Z2-9]{4}$/);
    expect(created.facilityName).toBe("Anh Thái");
    expect(created.facilityCode).toBe("Thai");
    expect(created.lines[0]).toMatchObject({
      previousUnitPrice: "50000",
      previousContractCode: "HDCS-OLD",
    });
    expect(harness.audit.events.map(({ action }) => action)).toContain(
      "facilityContract.created",
    );
  });

  it("refuses an inactive site, a closed order and a context without manage", async () => {
    const harness = buildFacilityContractService();
    await expect(
      harness.service.createContract(
        manager,
        draftInput({ facilityId: "site-old" }),
      ),
    ).rejects.toMatchObject({ code: "FACILITY_INACTIVE" });
    await expect(
      harness.service.createContract(
        manager,
        draftInput({ facilityId: "nope" }),
      ),
    ).rejects.toMatchObject({ code: "FACILITY_NOT_FOUND" });

    const closed = harness.orders.seed({ stage: "cancelled" });
    await expect(
      harness.service.createContract(
        manager,
        draftInput({ orderId: closed.id }),
      ),
    ).rejects.toMatchObject({ code: "ORDER_CLOSED" });

    await expect(
      harness.service.createContract(factoryAccountant, draftInput()),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });

  it("links an open order and snapshots its code", async () => {
    const harness = buildFacilityContractService();
    const order = harness.orders.seed({
      orderCode: "RD-1",
      stage: "inProduction",
    });
    const created = await harness.service.createContract(
      manager,
      draftInput({ orderId: order.id }),
    );
    expect(created).toMatchObject({ orderId: order.id, orderCode: "RD-1" });
  });

  it("refuses a manual duplicate code", async () => {
    const harness = buildFacilityContractService();
    harness.contracts.seed({ code: "HDCS-MANUAL" });
    await expect(
      harness.service.createContract(
        manager,
        draftInput({ code: "hdcs-manual" }),
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_CODE" });
  });

  it("recomputes previous prices on every draft save and refuses a stale revision", async () => {
    const harness = buildFacilityContractService();
    const created = await harness.service.createContract(manager, draftInput());
    expect(created.lines[0]?.previousUnitPrice).toBeNull();

    harness.contracts.seed({
      code: "HDCS-NEWER",
      status: "active",
      activatedAt: new Date("2026-09-01T00:00:00Z"),
    });

    const updated = await harness.service.updateContract(manager, {
      ...draftInput({ note: "Sửa" }),
      contractId: created.id,
      expectedRevision: created.revision,
    });
    expect(updated.lines[0]).toMatchObject({
      previousUnitPrice: "50000",
      previousContractCode: "HDCS-NEWER",
    });
    expect(updated.note).toBe("Sửa");

    await expect(
      harness.service.updateContract(manager, {
        ...draftInput(),
        contractId: created.id,
        expectedRevision: created.revision,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("activates directly when no line is priced above before", async () => {
    const harness = buildFacilityContractService();
    const created = await harness.service.createContract(manager, draftInput());

    await expect(
      harness.service.requestPriceApproval(manager, {
        contractId: created.id,
        expectedRevision: created.revision,
      }),
    ).rejects.toMatchObject({ code: "NO_PRICE_INCREASE" });

    const active = await harness.service.activateContract(manager, {
      contractId: created.id,
      expectedRevision: created.revision,
    });
    expect(active.status).toBe("active");
    expect(active.activatedBy).toBe(managerId);
  });

  it("demands the Director's approval pinned to the revision when a price rose", async () => {
    const harness = buildFacilityContractService();
    const created = await harness.service.createContract(manager, draftInput());
    // Another contract activated after the draft was saved: the snapshot on
    // the draft is stale and activation must notice.
    harness.contracts.seed({
      code: "HDCS-PRIOR",
      status: "active",
      activatedAt: new Date("2026-09-01T00:00:00Z"),
    });

    await expect(
      harness.service.activateContract(manager, {
        contractId: created.id,
        expectedRevision: created.revision,
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_MISSING" });

    await harness.service.requestPriceApproval(manager, {
      contractId: created.id,
      expectedRevision: created.revision,
    });
    const pending = harness.approvals.requests[0];
    expect(pending).toMatchObject({
      subject: "facilityContract.priceIncrease",
      resourceType: "facilityContract",
      expectedRevision: created.revision,
      summary: `${created.code} · Anh Thái · 1 dòng cao hơn giá cũ`,
    });
    expect((await harness.service.contractDecision(created)).kind).toBe(
      "pending",
    );

    await decideLatest(harness, "approved");
    const active = await harness.service.activateContract(manager, {
      contractId: created.id,
      expectedRevision: created.revision,
    });
    expect(active.status).toBe("active");
    expect(active.lines[0]).toMatchObject({
      previousUnitPrice: "50000",
      previousContractCode: "HDCS-PRIOR",
    });
  });

  it("refuses an approval granted for an older revision", async () => {
    const harness = buildFacilityContractService();
    harness.contracts.seed({
      code: "HDCS-PRIOR",
      status: "active",
      activatedAt: new Date("2026-09-01T00:00:00Z"),
    });
    const created = await harness.service.createContract(manager, draftInput());
    await harness.service.requestPriceApproval(manager, {
      contractId: created.id,
      expectedRevision: created.revision,
    });
    await decideLatest(harness, "approved");

    const edited = await harness.service.updateContract(manager, {
      ...draftInput({ note: "đổi" }),
      contractId: created.id,
      expectedRevision: created.revision,
    });
    await expect(
      harness.service.activateContract(manager, {
        contractId: edited.id,
        expectedRevision: edited.revision,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect((await harness.service.contractDecision(edited)).kind).toBe("stale");
  });

  it("refuses to cancel while a payment request is not rejected, and requires a reason", async () => {
    const harness = buildFacilityContractService();
    const contract = harness.contracts.seed({ status: "active" });
    const payment = harness.payments.seed({ contractId: contract.id });

    await expect(
      harness.service.cancelContract(manager, {
        contractId: contract.id,
        expectedRevision: contract.revision,
        reason: "",
      }),
    ).rejects.toThrow();
    await expect(
      harness.service.cancelContract(manager, {
        contractId: contract.id,
        expectedRevision: contract.revision,
        reason: "Cơ sở ngừng làm",
      }),
    ).rejects.toMatchObject({ code: "HAS_OPEN_PAYMENTS" });

    harness.payments.payments.set(payment.id, {
      ...payment,
      status: "rejected",
    });
    const cancelled = await harness.service.cancelContract(manager, {
      contractId: contract.id,
      expectedRevision: contract.revision,
      reason: "Cơ sở ngừng làm",
    });
    expect(cancelled).toMatchObject({
      status: "cancelled",
      cancelReason: "Cơ sở ngừng làm",
    });
  });

  it("attaches and removes documents while the contract is open", async () => {
    const harness = buildFacilityContractService();
    const contract = harness.contracts.seed({ status: "active" });
    const attached = await harness.service.attachDocument(manager, {
      contractId: contract.id,
      expectedRevision: 0,
      kind: "signedContract",
      publicId: "red-door/facility-contracts/x/file",
      assetVersion: 1,
      format: "PDF",
      bytes: 1200,
      label: "hop-dong.pdf",
    });
    expect(attached.documents[0]).toMatchObject({
      kind: "signedContract",
      format: "pdf",
      uploadedBy: managerId,
    });

    const removed = await harness.service.removeDocument(manager, {
      contractId: contract.id,
      expectedRevision: attached.revision,
      documentId: attached.documents[0]!.id,
    });
    expect(removed.documents).toEqual([]);

    await expect(
      harness.service.attachDocument(factoryAccountant, {
        contractId: contract.id,
        expectedRevision: removed.revision,
        kind: "other",
        publicId: "a",
        assetVersion: 1,
        format: "pdf",
        bytes: 1,
        label: "a",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});

describe("payment requests", () => {
  it("refuses a proposal on a draft contract and above the contract value", async () => {
    const harness = buildFacilityContractService();
    const draft = harness.contracts.seed({ status: "draft" });
    await expect(
      harness.service.proposePayment(manager, {
        contractId: draft.id,
        amount: "1000",
      }),
    ).rejects.toMatchObject({ code: "STATUS_MISMATCH" });

    // Value 100 × 50 000 = 5 000 000.
    const active = harness.contracts.seed({ status: "active" });
    harness.payments.seed({
      contractId: active.id,
      amount: "3000000",
      status: "paid",
    });
    harness.payments.seed({
      contractId: active.id,
      amount: "4000000",
      status: "rejected",
    });

    await expect(
      harness.service.proposePayment(manager, {
        contractId: active.id,
        amount: "2.000.001",
      }),
    ).rejects.toMatchObject({ code: "AMOUNT_EXCEEDS_CONTRACT" });

    const proposed = await harness.service.proposePayment(manager, {
      contractId: active.id,
      amount: "2.000.000",
      note: "Đợt 2",
    });
    expect(proposed).toMatchObject({
      status: "proposed",
      amount: "2000000",
      contractCode: active.code,
      facilityName: "Anh Thái",
      proposedBy: managerId,
    });
    expect(proposed.code).toMatch(/^DNTT-\d{8}-[A-Z2-9]{4}$/);

    await expect(
      harness.service.proposePayment(factoryAccountant, {
        contractId: active.id,
        amount: "1",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });

  it("accepts any amount when the contract value is unknown", async () => {
    const harness = buildFacilityContractService();
    const active = harness.contracts.seed({
      status: "active",
      lines: [
        {
          productCode: "A",
          description: "Hàng",
          quantity: null,
          unit: "cái",
          unitPrice: "1000",
          previousUnitPrice: null,
          previousContractCode: null,
        },
      ],
    });
    const proposed = await harness.service.proposePayment(manager, {
      contractId: active.id,
      amount: "999999999",
    });
    expect(proposed.status).toBe("proposed");
  });

  it("runs propose → check → approve → Director → paid, with separation of duties", async () => {
    const harness = buildFacilityContractService();
    const contract = harness.contracts.seed({ status: "active" });
    const proposed = await harness.service.proposePayment(manager, {
      contractId: contract.id,
      amount: "1000000",
    });

    // The proposer cannot check their own request, even holding the permission.
    const proposerChecking = accessContext(
      ["facilityPayments.check"],
      "all",
      managerId,
    );
    await expect(
      harness.service.checkPayment(proposerChecking, {
        paymentId: proposed.id,
        expectedRevision: proposed.revision,
      }),
    ).rejects.toMatchObject({ code: "SELF_CHECK" });
    await expect(
      harness.service.checkPayment(manager, {
        paymentId: proposed.id,
        expectedRevision: proposed.revision,
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      harness.service.approvePayment(companyAccountant, {
        paymentId: proposed.id,
        expectedRevision: proposed.revision,
      }),
    ).rejects.toMatchObject({ code: "STATUS_MISMATCH" });

    const checked = await harness.service.checkPayment(factoryAccountant, {
      paymentId: proposed.id,
      expectedRevision: proposed.revision,
    });
    expect(checked).toMatchObject({
      status: "checked",
      checkedBy: factoryAccountantId,
    });

    const checkerApproving = accessContext(
      ["facilityPayments.approve", "approvals.request"],
      "all",
      factoryAccountantId,
    );
    await expect(
      harness.service.approvePayment(checkerApproving, {
        paymentId: checked.id,
        expectedRevision: checked.revision,
      }),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL" });
    await expect(
      harness.service.approvePayment(companyAccountant, {
        paymentId: checked.id,
        expectedRevision: checked.revision - 1,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });

    const approved = await harness.service.approvePayment(companyAccountant, {
      paymentId: checked.id,
      expectedRevision: checked.revision,
    });
    expect(approved.status).toBe("accountantApproved");
    expect(harness.approvals.requests.at(-1)).toMatchObject({
      subject: "facilityPayment.approval",
      resourceType: "facilityPayment",
      resourceId: approved.id,
      expectedRevision: approved.revision,
      requestedByUserId: companyAccountantId,
    });

    await expect(
      harness.service.markPaymentPaid(factoryAccountant, {
        paymentId: approved.id,
        expectedRevision: approved.revision,
        paidOn: "2026-09-20",
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_MISSING" });

    await decideLatest(harness, "approved");
    expect((await harness.service.paymentDecision(approved)).kind).toBe(
      "approved",
    );

    await expect(
      harness.service.markPaymentPaid(companyAccountant, {
        paymentId: approved.id,
        expectedRevision: approved.revision,
        paidOn: "2026-09-20",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      harness.service.markPaymentPaid(factoryAccountant, {
        paymentId: approved.id,
        expectedRevision: approved.revision,
        paidOn: "",
      }),
    ).rejects.toThrow();

    const paid = await harness.service.markPaymentPaid(factoryAccountant, {
      paymentId: approved.id,
      expectedRevision: approved.revision,
      paidOn: "2026-09-20",
      paidNote: "UNC 123",
    });
    expect(paid).toMatchObject({
      status: "paid",
      paidBy: factoryAccountantId,
      paidNote: "UNC 123",
    });
    expect(paid.paidOn?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(harness.audit.events.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        "facilityPayment.proposed",
        "facilityPayment.checked",
        "facilityPayment.accountantApproved",
        "facilityPayment.paid",
      ]),
    );
  });

  it("lets the accountant ask the Director again after a rejection", async () => {
    const harness = buildFacilityContractService();
    const payment = harness.payments.seed({
      status: "checked",
      checkedBy: factoryAccountantId,
    });
    const approved = await harness.service.approvePayment(companyAccountant, {
      paymentId: payment.id,
      expectedRevision: payment.revision,
    });

    await expect(
      harness.service.requestPaymentDecisionAgain(companyAccountant, {
        paymentId: approved.id,
        expectedRevision: approved.revision,
      }),
    ).rejects.toMatchObject({ code: "ALREADY_PENDING" });

    await decideLatest(harness, "rejected", "Chờ nghiệm thu");
    expect(await harness.service.paymentDecision(approved)).toMatchObject({
      kind: "rejected",
      reason: "Chờ nghiệm thu",
    });

    await harness.service.requestPaymentDecisionAgain(companyAccountant, {
      paymentId: approved.id,
      expectedRevision: approved.revision,
    });
    expect((await harness.service.paymentDecision(approved)).kind).toBe(
      "pending",
    );

    await decideLatest(harness, "approved");
    await expect(
      harness.service.requestPaymentDecisionAgain(companyAccountant, {
        paymentId: approved.id,
        expectedRevision: approved.revision,
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_ALREADY_VALID" });
  });

  it("rejects by stage with the matching permission and a reason", async () => {
    const harness = buildFacilityContractService();
    const proposed = harness.payments.seed({ status: "proposed" });
    await expect(
      harness.service.rejectPayment(companyAccountant, {
        paymentId: proposed.id,
        expectedRevision: 0,
        reason: "Sai số tiền",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      harness.service.rejectPayment(factoryAccountant, {
        paymentId: proposed.id,
        expectedRevision: 0,
        reason: " ",
      }),
    ).rejects.toThrow();
    const rejected = await harness.service.rejectPayment(factoryAccountant, {
      paymentId: proposed.id,
      expectedRevision: 0,
      reason: "Sai số tiền",
    });
    expect(rejected).toMatchObject({
      status: "rejected",
      rejectReason: "Sai số tiền",
      rejectedAtStage: "proposed",
      rejectedBy: factoryAccountantId,
    });
    await expect(
      harness.service.rejectPayment(factoryAccountant, {
        paymentId: proposed.id,
        expectedRevision: rejected.revision,
        reason: "lại",
      }),
    ).rejects.toMatchObject({ code: "STATUS_MISMATCH" });

    const checked = harness.payments.seed({ status: "checked" });
    await expect(
      harness.service.rejectPayment(factoryAccountant, {
        paymentId: checked.id,
        expectedRevision: 0,
        reason: "x",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    const byAccountant = await harness.service.rejectPayment(
      companyAccountant,
      {
        paymentId: checked.id,
        expectedRevision: 0,
        reason: "Chưa đủ hồ sơ",
      },
    );
    expect(byAccountant.rejectedAtStage).toBe("checked");
  });

  it("computes site balances behind the read permission", async () => {
    const harness = buildFacilityContractService();
    const contract = harness.contracts.seed({ status: "active" });
    harness.payments.seed({
      contractId: contract.id,
      status: "paid",
      amount: "1000000",
    });

    const [row] = await harness.service.balances(factoryAccountant);
    expect(row).toMatchObject({
      facilityName: "Anh Thái",
      knownValue: { amount: "5000000" },
      paid: { amount: "1000000" },
      remaining: { amount: "4000000" },
    });

    await expect(
      harness.service.balances(accessContext(["orders.read"], "all")),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});
