import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import type { ApprovalRepository } from "@/domains/approvals/contracts";
import { assertApproved } from "@/domains/approvals/policy";
import type { ApprovalService } from "@/domains/approvals/service";
import {
  approvalSummaryForContract,
  approvalSummaryForPayment,
  cancelFacilityContractInputSchema,
  contractRevisionInputSchema,
  contractValue,
  countsAgainstContract,
  createFacilityContractInputSchema,
  directorDecisionState,
  exceedingLineCount,
  FACILITY_CONTRACT_RESOURCE_TYPE,
  FACILITY_PAYMENT_RESOURCE_TYPE,
  FacilityContractError,
  facilityContractDocumentInputSchema,
  generateFacilityContractCode,
  generateFacilityPaymentCode,
  markFacilityPaymentPaidInputSchema,
  paymentRevisionInputSchema,
  proposeFacilityPaymentInputSchema,
  rejectFacilityPaymentInputSchema,
  removeFacilityContractDocumentInputSchema,
  siteBalances,
  updateFacilityContractInputSchema,
  withPreviousPrices,
  type ApprovalHistoryReader,
  type DirectorDecisionState,
  type FacilityContractFields,
  type FacilityContractLineInput,
  type FacilityContractListFilter,
  type FacilityContractRecordDto,
  type FacilityContractStore,
  type FacilityLookup,
  type FacilityPaymentListFilter,
  type FacilityPaymentRecordDto,
  type FacilityPaymentStore,
  type SiteBalance,
} from "@/domains/facility-contracts/contracts";
import type { Permission } from "@/domains/identity/permissions";
import type { OrderStore } from "@/domains/orders/contracts";
import { isTerminalStage } from "@/domains/orders/workflow";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";
import { add, compare, money, sum } from "@/lib/money";

export type FacilityContractServiceDependencies = {
  contractStore: FacilityContractStore;
  paymentStore: FacilityPaymentStore;
  facilityLookup: FacilityLookup;
  orderStore: Pick<OrderStore, "findById">;
  approvalRepository: ApprovalRepository;
  approvalService: ApprovalService;
  approvalHistory: ApprovalHistoryReader;
  auditRepository: AuditRepository;
  now?: () => Date;
};

const PRICE_SUBJECT = "facilityContract.priceIncrease" as const;
const PAYMENT_SUBJECT = "facilityPayment.approval" as const;

/**
 * Contracts with production sites and the payments against them.
 *
 * Each command re-asserts its permission against the access context the
 * caller guarded with, re-judges the record's status, and writes
 * conditionally on the revision the caller saw. A price increase and every
 * payment additionally wait for the Director's decision pinned to the
 * record's revision.
 */
export class FacilityContractService {
  private readonly dependencies: FacilityContractServiceDependencies;

  constructor(dependencies: FacilityContractServiceDependencies) {
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

  private conflict(): FacilityContractError {
    return new FacilityContractError(
      "REVISION_CONFLICT",
      "The record changed while this action was on screen.",
    );
  }

  private async loadContract(
    contractId: string,
  ): Promise<FacilityContractRecordDto> {
    const contract = await this.dependencies.contractStore.findById(contractId);
    if (!contract) {
      throw new FacilityContractError("NOT_FOUND", "Contract not found.");
    }
    return contract;
  }

  private async loadPayment(
    paymentId: string,
  ): Promise<FacilityPaymentRecordDto> {
    const payment = await this.dependencies.paymentStore.findById(paymentId);
    if (!payment) {
      throw new FacilityContractError(
        "NOT_FOUND",
        "Payment request not found.",
      );
    }
    return payment;
  }

  private async audit(
    context: AccessContext,
    resource: { type: string; id: string },
    action: string,
    extra: { metadata?: Record<string, unknown>; reason?: string } = {},
  ): Promise<void> {
    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action,
      resourceType: resource.type,
      resourceId: resource.id,
      businessUnitIds: [],
      requestId: context.requestId,
      ...(extra.metadata ? { metadata: extra.metadata } : {}),
      ...(extra.reason ? { reason: extra.reason } : {}),
      occurredAt: this.now(),
    });
  }

  /** Other active contracts, the source of every line's previous price. */
  private async linesWithPreviousPrices(
    lines: readonly FacilityContractLineInput[],
    contractId: string | null,
  ) {
    const active = await this.dependencies.contractStore.list({
      status: "active",
    });
    return withPreviousPrices(lines, active, contractId);
  }

  /** Resolves the site and the optional order into the stored snapshots. */
  private async resolveFields(
    input: {
      facilityId: string;
      orderId: string | null;
      lines: readonly FacilityContractLineInput[];
      startDate: Date;
      deliveryDate: Date;
      note: string | null;
    },
    existing: FacilityContractRecordDto | null,
  ): Promise<FacilityContractFields> {
    let facility = {
      facilityId: existing?.facilityId ?? "",
      facilityCode: existing?.facilityCode ?? "",
      facilityName: existing?.facilityName ?? "",
    };
    if (!existing || existing.facilityId !== input.facilityId) {
      const found = await this.dependencies.facilityLookup.findById(
        input.facilityId,
      );
      if (!found) {
        throw new FacilityContractError(
          "FACILITY_NOT_FOUND",
          "Production site not found.",
        );
      }
      if (!found.active) {
        throw new FacilityContractError(
          "FACILITY_INACTIVE",
          "The production site is no longer active.",
        );
      }
      facility = {
        facilityId: found.id,
        facilityCode: found.code,
        facilityName: found.name,
      };
    }

    let order = {
      orderId: existing?.orderId ?? null,
      orderCode: existing?.orderCode ?? null,
    };
    if (input.orderId === null) {
      order = { orderId: null, orderCode: null };
    } else if (!existing || existing.orderId !== input.orderId) {
      const found = await this.dependencies.orderStore.findById(input.orderId);
      if (!found) {
        throw new FacilityContractError("ORDER_NOT_FOUND", "Order not found.");
      }
      if (isTerminalStage(found.stage)) {
        throw new FacilityContractError(
          "ORDER_CLOSED",
          "A closed or cancelled order cannot be linked.",
        );
      }
      order = { orderId: found.id, orderCode: found.orderCode };
    }

    return {
      ...facility,
      ...order,
      lines: await this.linesWithPreviousPrices(
        input.lines,
        existing?.id ?? null,
      ),
      startDate: input.startDate,
      deliveryDate: input.deliveryDate,
      note: input.note,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Reads                                                             */
  /* ---------------------------------------------------------------- */

  async listContracts(
    context: AccessContext,
    filter: FacilityContractListFilter = {},
  ): Promise<FacilityContractRecordDto[]> {
    this.assertHolds(context, "facilityContracts.read");
    return this.dependencies.contractStore.list(filter);
  }

  async findContract(
    context: AccessContext,
    contractId: string,
  ): Promise<FacilityContractRecordDto | null> {
    this.assertHolds(context, "facilityContracts.read");
    return this.dependencies.contractStore.findById(contractId);
  }

  async listPayments(
    context: AccessContext,
    filter: FacilityPaymentListFilter = {},
  ): Promise<FacilityPaymentRecordDto[]> {
    this.assertHolds(context, "facilityContracts.read");
    return this.dependencies.paymentStore.list(filter);
  }

  async balances(context: AccessContext): Promise<SiteBalance[]> {
    this.assertHolds(context, "facilityContracts.read");
    const [contracts, payments] = await Promise.all([
      this.dependencies.contractStore.list({ status: "active" }),
      this.dependencies.paymentStore.list({}),
    ]);
    return siteBalances(contracts, payments);
  }

  /**
   * The contract's lines with previous prices as activation would judge them
   * now. A draft's saved snapshot may be stale; an active or cancelled
   * contract keeps the prices it was activated with.
   */
  async currentLines(
    context: AccessContext,
    contract: FacilityContractRecordDto,
  ): Promise<FacilityContractRecordDto["lines"]> {
    this.assertHolds(context, "facilityContracts.read");
    if (contract.status !== "draft") return contract.lines;
    const fresh = await this.linesWithPreviousPrices(
      contract.lines,
      contract.id,
    );
    return fresh.map((line, index) => ({
      ...line,
      id: contract.lines[index]?.id ?? String(index),
    }));
  }

  /** Where the Director's price-increase decision stands for the contract. */
  async contractDecision(
    contract: Pick<FacilityContractRecordDto, "id" | "revision">,
  ): Promise<DirectorDecisionState> {
    return this.decision(
      FACILITY_CONTRACT_RESOURCE_TYPE,
      contract,
      PRICE_SUBJECT,
    );
  }

  /** Where the Director's payment decision stands for the request. */
  async paymentDecision(
    payment: Pick<FacilityPaymentRecordDto, "id" | "revision">,
  ): Promise<DirectorDecisionState> {
    return this.decision(
      FACILITY_PAYMENT_RESOURCE_TYPE,
      payment,
      PAYMENT_SUBJECT,
    );
  }

  private async decision(
    resourceType: string,
    record: { id: string; revision: number },
    subject: typeof PRICE_SUBJECT | typeof PAYMENT_SUBJECT,
  ): Promise<DirectorDecisionState> {
    const [{ pending, approved }, latestDecided] = await Promise.all([
      this.dependencies.approvalService.findForResource(
        resourceType,
        record.id,
        subject,
      ),
      this.dependencies.approvalHistory.findLatestDecided(
        resourceType,
        record.id,
        subject,
      ),
    ]);
    return directorDecisionState(
      { pending, approved, latestDecided },
      record.revision,
    );
  }

  /* ---------------------------------------------------------------- */
  /* Contracts                                                         */
  /* ---------------------------------------------------------------- */

  async createContract(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityContractRecordDto> {
    this.assertHolds(context, "facilityContracts.manage");
    const input = createFacilityContractInputSchema.parse(rawInput);
    const fields = await this.resolveFields(input, null);

    const manualCode = input.code;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = manualCode ?? generateFacilityContractCode(this.now());
      try {
        const record = await this.dependencies.contractStore.insert({
          ...fields,
          code,
          createdBy: context.userId,
        });
        await this.audit(
          context,
          { type: FACILITY_CONTRACT_RESOURCE_TYPE, id: record.id },
          "facilityContract.created",
          {
            metadata: {
              code: record.code,
              facilityId: record.facilityId,
              lineCount: record.lines.length,
            },
          },
        );
        return record;
      } catch (error) {
        lastError = error;
        const retryable =
          manualCode === null &&
          error instanceof FacilityContractError &&
          error.code === "DUPLICATE_CODE";
        if (!retryable) throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new FacilityContractError(
          "DUPLICATE_CODE",
          "Could not allocate a unique contract code.",
        );
  }

  async updateContract(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityContractRecordDto> {
    this.assertHolds(context, "facilityContracts.manage");
    const input = updateFacilityContractInputSchema.parse(rawInput);
    const contract = await this.loadContract(input.contractId);
    if (contract.status !== "draft") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "Only a draft contract can be edited.",
      );
    }
    if (contract.revision !== input.expectedRevision) throw this.conflict();

    const fields = await this.resolveFields(input, contract);
    const updated = await this.dependencies.contractStore.updateDraft({
      contractId: contract.id,
      expectedRevision: input.expectedRevision,
      fields,
      updatedBy: context.userId,
    });
    if (!updated) throw this.conflict();

    await this.audit(
      context,
      { type: FACILITY_CONTRACT_RESOURCE_TYPE, id: contract.id },
      "facilityContract.updated",
      { metadata: { lineCount: updated.lines.length } },
    );
    return updated;
  }

  /** Asks the Director to accept the prices above the ones paid before. */
  async requestPriceApproval(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<void> {
    this.assertHolds(context, "facilityContracts.manage");
    const input = contractRevisionInputSchema.parse(rawInput);
    const contract = await this.loadContract(input.contractId);
    if (contract.status !== "draft") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "Only a draft contract waits for a price decision.",
      );
    }
    if (contract.revision !== input.expectedRevision) throw this.conflict();

    const fresh = await this.linesWithPreviousPrices(
      contract.lines,
      contract.id,
    );
    const exceeding = exceedingLineCount(fresh);
    if (exceeding === 0) {
      throw new FacilityContractError(
        "NO_PRICE_INCREASE",
        "No line is priced above the price paid before.",
      );
    }

    await this.dependencies.approvalService.request(context, {
      subject: PRICE_SUBJECT,
      resourceType: FACILITY_CONTRACT_RESOURCE_TYPE,
      resourceId: contract.id,
      businessUnitIds: [],
      summary: approvalSummaryForContract(contract, exceeding),
      expectedRevision: contract.revision,
    });
  }

  async activateContract(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityContractRecordDto> {
    this.assertHolds(context, "facilityContracts.manage");
    const input = contractRevisionInputSchema.parse(rawInput);
    const contract = await this.loadContract(input.contractId);
    if (contract.status !== "draft") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "Only a draft contract can be activated.",
      );
    }
    if (contract.revision !== input.expectedRevision) throw this.conflict();

    // Never trust the snapshot saved with the draft: another contract may
    // have been activated since.
    const lines = await this.linesWithPreviousPrices(
      contract.lines,
      contract.id,
    );
    const exceeding = exceedingLineCount(lines);
    if (exceeding > 0) {
      const approved =
        await this.dependencies.approvalRepository.findApprovedForResource(
          FACILITY_CONTRACT_RESOURCE_TYPE,
          contract.id,
          PRICE_SUBJECT,
        );
      assertApproved(approved, contract.revision);
    }

    const updated = await this.dependencies.contractStore.activate({
      contractId: contract.id,
      expectedRevision: contract.revision,
      lines,
      activatedAt: this.now(),
      activatedBy: context.userId,
    });
    if (!updated) throw this.conflict();

    await this.audit(
      context,
      { type: FACILITY_CONTRACT_RESOURCE_TYPE, id: contract.id },
      "facilityContract.activated",
      { metadata: { exceedingLines: exceeding } },
    );
    return updated;
  }

  async cancelContract(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityContractRecordDto> {
    this.assertHolds(context, "facilityContracts.manage");
    const input = cancelFacilityContractInputSchema.parse(rawInput);
    const contract = await this.loadContract(input.contractId);
    if (contract.status === "cancelled") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "The contract is already cancelled.",
      );
    }
    if (contract.revision !== input.expectedRevision) throw this.conflict();

    const payments = await this.dependencies.paymentStore.list({
      contractId: contract.id,
    });
    if (payments.some(countsAgainstContract)) {
      throw new FacilityContractError(
        "HAS_OPEN_PAYMENTS",
        "A payment request on this contract has not been rejected.",
      );
    }

    const updated = await this.dependencies.contractStore.cancel({
      contractId: contract.id,
      expectedRevision: contract.revision,
      reason: input.reason,
      updatedBy: context.userId,
    });
    if (!updated) throw this.conflict();

    await this.audit(
      context,
      { type: FACILITY_CONTRACT_RESOURCE_TYPE, id: contract.id },
      "facilityContract.cancelled",
      { reason: input.reason, metadata: { from: contract.status } },
    );
    return updated;
  }

  async attachDocument(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityContractRecordDto> {
    this.assertHolds(context, "facilityContracts.manage");
    const input = facilityContractDocumentInputSchema.parse(rawInput);
    const contract = await this.loadContract(input.contractId);
    if (contract.status === "cancelled") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "A cancelled contract no longer changes.",
      );
    }

    const updated = await this.dependencies.contractStore.addDocument({
      contractId: contract.id,
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
    });
    if (!updated) throw this.conflict();

    await this.audit(
      context,
      { type: FACILITY_CONTRACT_RESOURCE_TYPE, id: contract.id },
      "facilityContract.documentAttached",
      { metadata: { kind: input.kind, label: input.label } },
    );
    return updated;
  }

  async removeDocument(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityContractRecordDto> {
    this.assertHolds(context, "facilityContracts.manage");
    const input = removeFacilityContractDocumentInputSchema.parse(rawInput);
    const contract = await this.loadContract(input.contractId);
    if (contract.status === "cancelled") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "A cancelled contract no longer changes.",
      );
    }
    const existing = contract.documents.find(
      (document) => document.id === input.documentId,
    );
    if (!existing) {
      throw new FacilityContractError("NOT_FOUND", "Document not found.");
    }

    const updated = await this.dependencies.contractStore.removeDocument({
      contractId: contract.id,
      expectedRevision: input.expectedRevision,
      documentId: input.documentId,
      updatedBy: context.userId,
    });
    if (!updated) throw this.conflict();

    await this.audit(
      context,
      { type: FACILITY_CONTRACT_RESOURCE_TYPE, id: contract.id },
      "facilityContract.documentRemoved",
      {
        metadata: {
          kind: existing.kind,
          label: existing.label,
          publicId: existing.publicId,
        },
      },
    );
    return updated;
  }

  /* ---------------------------------------------------------------- */
  /* Payment requests                                                  */
  /* ---------------------------------------------------------------- */

  async proposePayment(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityPaymentRecordDto> {
    this.assertHolds(context, "facilityPayments.propose");
    const input = proposeFacilityPaymentInputSchema.parse(rawInput);
    const contract = await this.loadContract(input.contractId);
    if (contract.status !== "active") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "Payments are proposed only on an active contract.",
      );
    }

    const value = contractValue(contract.lines);
    if (value) {
      const existing = await this.dependencies.paymentStore.list({
        contractId: contract.id,
      });
      const committed = sum(
        existing
          .filter(countsAgainstContract)
          .map((payment) => money(payment.amount, "VND")),
        "VND",
      );
      if (compare(add(committed, money(input.amount, "VND")), value) > 0) {
        throw new FacilityContractError(
          "AMOUNT_EXCEEDS_CONTRACT",
          "The payments would exceed the contract value.",
        );
      }
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const record = await this.dependencies.paymentStore.insert({
          code: generateFacilityPaymentCode(this.now()),
          contractId: contract.id,
          contractCode: contract.code,
          facilityId: contract.facilityId,
          facilityName: contract.facilityName,
          orderCode: contract.orderCode,
          amount: input.amount,
          note: input.note,
          proposedBy: context.userId,
          proposedAt: this.now(),
        });
        await this.audit(
          context,
          { type: FACILITY_PAYMENT_RESOURCE_TYPE, id: record.id },
          "facilityPayment.proposed",
          {
            metadata: {
              code: record.code,
              contractId: contract.id,
              amount: record.amount,
            },
          },
        );
        return record;
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof FacilityContractError &&
          error.code === "DUPLICATE_CODE";
        if (!retryable) throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new FacilityContractError(
          "DUPLICATE_CODE",
          "Could not allocate a unique payment code.",
        );
  }

  async checkPayment(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityPaymentRecordDto> {
    this.assertHolds(context, "facilityPayments.check");
    const input = paymentRevisionInputSchema.parse(rawInput);
    const payment = await this.loadPayment(input.paymentId);
    if (payment.status !== "proposed") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "Only a proposed payment can be checked.",
      );
    }
    if (payment.proposedBy === context.userId) {
      throw new FacilityContractError(
        "SELF_CHECK",
        "The person who proposed a payment cannot check it.",
      );
    }
    if (payment.revision !== input.expectedRevision) throw this.conflict();

    const updated = await this.dependencies.paymentStore.step({
      paymentId: payment.id,
      expectedRevision: payment.revision,
      from: "proposed",
      to: "checked",
      fields: { checkedBy: context.userId, checkedAt: this.now() },
    });
    if (!updated) throw this.conflict();

    await this.audit(
      context,
      { type: FACILITY_PAYMENT_RESOURCE_TYPE, id: payment.id },
      "facilityPayment.checked",
    );
    return updated;
  }

  private assertIndependentApprover(
    context: AccessContext,
    payment: FacilityPaymentRecordDto,
  ): void {
    if (
      payment.proposedBy === context.userId ||
      payment.checkedBy === context.userId
    ) {
      throw new FacilityContractError(
        "SELF_APPROVAL",
        "The person who proposed or checked a payment cannot approve it.",
      );
    }
  }

  /**
   * The Company Accountant's approval, then the request to the Director,
   * pinned to the revision the approval produced.
   */
  async approvePayment(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityPaymentRecordDto> {
    this.assertHolds(context, "facilityPayments.approve");
    const input = paymentRevisionInputSchema.parse(rawInput);
    const payment = await this.loadPayment(input.paymentId);
    if (payment.status !== "checked") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "Only a checked payment can be approved.",
      );
    }
    this.assertIndependentApprover(context, payment);
    if (payment.revision !== input.expectedRevision) throw this.conflict();

    const updated = await this.dependencies.paymentStore.step({
      paymentId: payment.id,
      expectedRevision: payment.revision,
      from: "checked",
      to: "accountantApproved",
      fields: {
        accountantApprovedBy: context.userId,
        accountantApprovedAt: this.now(),
      },
    });
    if (!updated) throw this.conflict();

    await this.audit(
      context,
      { type: FACILITY_PAYMENT_RESOURCE_TYPE, id: payment.id },
      "facilityPayment.accountantApproved",
    );

    await this.dependencies.approvalService.request(context, {
      subject: PAYMENT_SUBJECT,
      resourceType: FACILITY_PAYMENT_RESOURCE_TYPE,
      resourceId: updated.id,
      businessUnitIds: [],
      summary: approvalSummaryForPayment(updated),
      expectedRevision: updated.revision,
    });

    return updated;
  }

  /** Raises the Director request again after a rejection or a lost request. */
  async requestPaymentDecisionAgain(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<void> {
    this.assertHolds(context, "facilityPayments.approve");
    const input = paymentRevisionInputSchema.parse(rawInput);
    const payment = await this.loadPayment(input.paymentId);
    if (payment.status !== "accountantApproved") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "Only an approved, unpaid payment goes to the Director.",
      );
    }
    this.assertIndependentApprover(context, payment);
    if (payment.revision !== input.expectedRevision) throw this.conflict();

    const state = await this.paymentDecision(payment);
    if (state.kind === "approved") {
      throw new FacilityContractError(
        "APPROVAL_ALREADY_VALID",
        "The Director has already approved this payment.",
      );
    }

    await this.dependencies.approvalService.request(context, {
      subject: PAYMENT_SUBJECT,
      resourceType: FACILITY_PAYMENT_RESOURCE_TYPE,
      resourceId: payment.id,
      businessUnitIds: [],
      summary: approvalSummaryForPayment(payment),
      expectedRevision: payment.revision,
    });
  }

  async rejectPayment(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityPaymentRecordDto> {
    const input = rejectFacilityPaymentInputSchema.parse(rawInput);
    const payment = await this.loadPayment(input.paymentId);
    if (payment.status === "proposed") {
      this.assertHolds(context, "facilityPayments.check");
    } else if (
      payment.status === "checked" ||
      payment.status === "accountantApproved"
    ) {
      this.assertHolds(context, "facilityPayments.approve");
    } else {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "A paid or rejected payment can no longer be rejected.",
      );
    }
    if (payment.revision !== input.expectedRevision) throw this.conflict();

    const updated = await this.dependencies.paymentStore.step({
      paymentId: payment.id,
      expectedRevision: payment.revision,
      from: payment.status,
      to: "rejected",
      fields: {
        rejectedBy: context.userId,
        rejectedAt: this.now(),
        rejectReason: input.reason,
        rejectedAtStage: payment.status,
      },
    });
    if (!updated) throw this.conflict();

    await this.audit(
      context,
      { type: FACILITY_PAYMENT_RESOURCE_TYPE, id: payment.id },
      "facilityPayment.rejected",
      { reason: input.reason, metadata: { stage: payment.status } },
    );
    return updated;
  }

  async markPaymentPaid(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FacilityPaymentRecordDto> {
    this.assertHolds(context, "facilityPayments.markPaid");
    const input = markFacilityPaymentPaidInputSchema.parse(rawInput);
    const payment = await this.loadPayment(input.paymentId);
    if (payment.status !== "accountantApproved") {
      throw new FacilityContractError(
        "STATUS_MISMATCH",
        "Only an approved payment can be marked paid.",
      );
    }
    if (payment.revision !== input.expectedRevision) throw this.conflict();

    const approved =
      await this.dependencies.approvalRepository.findApprovedForResource(
        FACILITY_PAYMENT_RESOURCE_TYPE,
        payment.id,
        PAYMENT_SUBJECT,
      );
    assertApproved(approved, payment.revision);

    const updated = await this.dependencies.paymentStore.step({
      paymentId: payment.id,
      expectedRevision: payment.revision,
      from: "accountantApproved",
      to: "paid",
      fields: {
        paidBy: context.userId,
        paidAt: this.now(),
        paidOn: input.paidOn,
        paidNote: input.paidNote,
      },
    });
    if (!updated) throw this.conflict();

    await this.audit(
      context,
      { type: FACILITY_PAYMENT_RESOURCE_TYPE, id: payment.id },
      "facilityPayment.paid",
      {
        metadata: {
          amount: payment.amount,
          paidOn: input.paidOn.toISOString(),
        },
      },
    );
    return updated;
  }
}
