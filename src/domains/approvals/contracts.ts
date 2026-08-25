import type { Permission } from "@/domains/identity/permissions";

/**
 * Director approval gate.
 *
 * Confirmed company rule: asked which operations must be approved by the
 * Director in the system — orders, selling price, price changes, material
 * purchases, incurred expenses, dispatch — the answer was "tất cả" (all of
 * them). Every gated action below therefore parks in a pending approval request
 * instead of taking effect, and only the Director (or Super Admin) can release
 * it.
 *
 * Holding the permission to perform an action is not the same as being allowed
 * to complete it: the state machine still refuses to advance until an approval
 * decision exists.
 */

export const approvalSubjects = [
  "order.confirm",
  "order.sellingPrice",
  "order.priceAdjustment",
  "order.cancel",
  "order.dispatch",
  "quote.send",
  "quote.priceAdjustment",
  "procurement.purchase",
  "procurement.priceChange",
  "procurement.advance",
  "expense.incurred",
  "inventory.adjustment",
  "production.plan",
  "sample.approval",
  "content.publication",
  "collection.publication",
  "payroll.confirmation",
] as const;

export type ApprovalSubject = (typeof approvalSubjects)[number];

export const approvalStatuses = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
] as const;

export type ApprovalStatus = (typeof approvalStatuses)[number];

/** The permission a decider must hold to release a given subject. */
export const approvalDecisionPermission: Record<ApprovalSubject, Permission> = {
  "order.confirm": "orders.approve",
  "order.sellingPrice": "orders.approvePriceAdjustment",
  "order.priceAdjustment": "orders.approvePriceAdjustment",
  "order.cancel": "orders.cancel",
  "order.dispatch": "approvals.decide",
  "quote.send": "quotes.approve",
  "quote.priceAdjustment": "quotes.approvePriceAdjustment",
  "procurement.purchase": "procurement.approve",
  "procurement.priceChange": "procurement.approvePriceChange",
  "procurement.advance": "procurement.approveAdvance",
  "expense.incurred": "expenses.approve",
  "inventory.adjustment": "inventory.approveAdjustment",
  "production.plan": "approvals.decide",
  "sample.approval": "samples.approve",
  "content.publication": "content.publish",
  "collection.publication": "collections.approve",
  "payroll.confirmation": "labor.confirmPayroll",
};

export type ApprovalRequest = {
  id: string;
  subject: ApprovalSubject;
  /** The business record awaiting release, for example an order id. */
  resourceType: string;
  resourceId: string;
  businessUnitIds: readonly string[];
  status: ApprovalStatus;
  requestedByUserId: string;
  requestedAt: Date;
  /** Short, already-redacted description of what is being asked for. */
  summary: string;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  /** Required when a request is rejected, so the reason is never implicit. */
  decisionReason: string | null;
  /** Guards against deciding a request whose underlying record has moved on. */
  expectedRevision: number;
};

export type CreateApprovalRequestInput = {
  subject: ApprovalSubject;
  resourceType: string;
  resourceId: string;
  businessUnitIds: readonly string[];
  requestedByUserId: string;
  summary: string;
  expectedRevision: number;
  requestedAt: Date;
};

export type DecideApprovalInput = {
  requestId: string;
  decision: "approved" | "rejected";
  decidedByUserId: string;
  decisionReason: string | null;
  decidedAt: Date;
  expectedRevision: number;
};

export interface ApprovalRepository {
  create(input: CreateApprovalRequestInput): Promise<ApprovalRequest>;
  findById(requestId: string): Promise<ApprovalRequest | null>;
  findPendingForResource(
    resourceType: string,
    resourceId: string,
    subject: ApprovalSubject,
  ): Promise<ApprovalRequest | null>;
  listPending(
    businessUnitIds: readonly string[] | null,
  ): Promise<ApprovalRequest[]>;
  decide(input: DecideApprovalInput): Promise<ApprovalRequest>;
}

export const approvalErrorCodes = [
  "ALREADY_PENDING",
  "NOT_FOUND",
  "ALREADY_DECIDED",
  "SELF_APPROVAL",
  "REASON_REQUIRED",
  "REVISION_CONFLICT",
  "APPROVAL_MISSING",
] as const;

export type ApprovalErrorCode = (typeof approvalErrorCodes)[number];

export class ApprovalError extends Error {
  readonly code: ApprovalErrorCode;

  constructor(code: ApprovalErrorCode, message: string) {
    super(message);
    this.name = "ApprovalError";
    this.code = code;
  }
}
