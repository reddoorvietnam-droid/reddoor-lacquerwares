import { z } from "zod";

import type { ApprovalRequest } from "@/domains/approvals/contracts";
import {
  compare,
  money,
  multiply,
  subtract,
  sum,
  type Money,
} from "@/lib/money";

/**
 * Purchase contracts with production sites ("hợp đồng mua hàng cơ sở") and
 * the payments made against them ("thanh toán cơ sở"), as the Director
 * described them on 2026-09-14:
 *
 * - The Factory Manager signs the contract with the site: kind of goods,
 *   purchase price, start date and delivery date. A price above the one paid
 *   before for the same item needs the Director's approval.
 * - A payment is proposed by the Factory Manager, checked by the Factory
 *   Accountant, approved by the Company Accountant and then the Director, and
 *   marked paid by the Factory Accountant.
 *
 * Production sites are the materials module's facility master; the record
 * keeps the site's code and name as snapshots so lists render without a join.
 * Purchase price is operational data every staff role may read; nothing here
 * is customer money and nothing here computes profit.
 */

export const FACILITY_CONTRACT_RESOURCE_TYPE = "facilityContract";
export const FACILITY_PAYMENT_RESOURCE_TYPE = "facilityPayment";

export const facilityContractStatuses = [
  "draft",
  "active",
  "cancelled",
] as const;
export type FacilityContractStatus = (typeof facilityContractStatuses)[number];

export const facilityContractDocumentKinds = [
  "signedContract",
  "other",
] as const;
export type FacilityContractDocumentKind =
  (typeof facilityContractDocumentKinds)[number];

export const facilityPaymentStatuses = [
  "proposed",
  "checked",
  "accountantApproved",
  "paid",
  "rejected",
] as const;
export type FacilityPaymentStatus = (typeof facilityPaymentStatuses)[number];

export type FacilityContractLine = {
  id: string;
  productCode: string;
  /** Kind of goods ("chủng loại hàng hóa"). */
  description: string;
  /** Null when the quantity is not fixed by the contract. */
  quantity: string | null;
  unit: string;
  /** VND integer string. */
  unitPrice: string;
  /** Unit price of the same item on the most recently activated other contract. */
  previousUnitPrice: string | null;
  previousContractCode: string | null;
};

export type FacilityContractDocument = {
  id: string;
  kind: FacilityContractDocumentKind;
  publicId: string;
  assetVersion: number;
  format: string;
  bytes: number;
  label: string;
  uploadedBy: string;
  uploadedAt: Date;
};

export type FacilityContractRecordDto = {
  id: string;
  code: string;
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  orderId: string | null;
  orderCode: string | null;
  lines: readonly FacilityContractLine[];
  /** When the site starts making the goods. */
  startDate: Date;
  /** When the site delivers the goods. */
  deliveryDate: Date;
  note: string | null;
  documents: readonly FacilityContractDocument[];
  status: FacilityContractStatus;
  cancelReason: string | null;
  activatedAt: Date | null;
  activatedBy: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type FacilityPaymentRecordDto = {
  id: string;
  code: string;
  contractId: string;
  contractCode: string;
  facilityId: string;
  facilityName: string;
  orderCode: string | null;
  /** VND integer string, greater than zero. */
  amount: string;
  note: string | null;
  status: FacilityPaymentStatus;
  proposedBy: string;
  proposedAt: Date;
  checkedBy: string | null;
  checkedAt: Date | null;
  accountantApprovedBy: string | null;
  accountantApprovedAt: Date | null;
  paidBy: string | null;
  paidAt: Date | null;
  /** The day the money left. */
  paidOn: Date | null;
  paidNote: string | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectReason: string | null;
  rejectedAtStage: FacilityPaymentStatus | null;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type NewFacilityContractLine = Omit<FacilityContractLine, "id">;

export type FacilityContractFields = {
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  orderId: string | null;
  orderCode: string | null;
  lines: readonly NewFacilityContractLine[];
  startDate: Date;
  deliveryDate: Date;
  note: string | null;
};

export type NewFacilityContractRecord = FacilityContractFields & {
  code: string;
  createdBy: string;
};

export type NewFacilityContractDocument = Omit<FacilityContractDocument, "id">;

export type FacilityContractListFilter = {
  status?: FacilityContractStatus | undefined;
};

export interface FacilityContractStore {
  /** Throws DUPLICATE_CODE when the code is taken. */
  insert(record: NewFacilityContractRecord): Promise<FacilityContractRecordDto>;
  findById(contractId: string): Promise<FacilityContractRecordDto | null>;
  list(
    filter: FacilityContractListFilter,
  ): Promise<FacilityContractRecordDto[]>;
  /** Conditional on the revision and the draft status. */
  updateDraft(input: {
    contractId: string;
    expectedRevision: number;
    fields: FacilityContractFields;
    updatedBy: string;
  }): Promise<FacilityContractRecordDto | null>;
  /** Conditional on the revision and the draft status. */
  activate(input: {
    contractId: string;
    expectedRevision: number;
    lines: readonly NewFacilityContractLine[];
    activatedAt: Date;
    activatedBy: string;
  }): Promise<FacilityContractRecordDto | null>;
  /** Conditional on the revision and a draft or active status. */
  cancel(input: {
    contractId: string;
    expectedRevision: number;
    reason: string;
    updatedBy: string;
  }): Promise<FacilityContractRecordDto | null>;
  /** Conditional on the revision. */
  addDocument(input: {
    contractId: string;
    expectedRevision: number;
    document: NewFacilityContractDocument;
    updatedBy: string;
  }): Promise<FacilityContractRecordDto | null>;
  /** Conditional on the revision. */
  removeDocument(input: {
    contractId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<FacilityContractRecordDto | null>;
}

export type NewFacilityPaymentRecord = {
  code: string;
  contractId: string;
  contractCode: string;
  facilityId: string;
  facilityName: string;
  orderCode: string | null;
  amount: string;
  note: string | null;
  proposedBy: string;
  proposedAt: Date;
};

export type FacilityPaymentListFilter = {
  status?: FacilityPaymentStatus | undefined;
  contractId?: string | undefined;
};

/** Fields a step of the payment flow sets alongside the new status. */
export type FacilityPaymentStepFields = Partial<
  Pick<
    FacilityPaymentRecordDto,
    | "checkedBy"
    | "checkedAt"
    | "accountantApprovedBy"
    | "accountantApprovedAt"
    | "paidBy"
    | "paidAt"
    | "paidOn"
    | "paidNote"
    | "rejectedBy"
    | "rejectedAt"
    | "rejectReason"
    | "rejectedAtStage"
  >
>;

export interface FacilityPaymentStore {
  /** Throws DUPLICATE_CODE when the code is taken. */
  insert(record: NewFacilityPaymentRecord): Promise<FacilityPaymentRecordDto>;
  findById(paymentId: string): Promise<FacilityPaymentRecordDto | null>;
  list(filter: FacilityPaymentListFilter): Promise<FacilityPaymentRecordDto[]>;
  /** Conditional on the revision and the current status. */
  step(input: {
    paymentId: string;
    expectedRevision: number;
    from: FacilityPaymentStatus;
    to: FacilityPaymentStatus;
    fields: FacilityPaymentStepFields;
  }): Promise<FacilityPaymentRecordDto | null>;
}

/** The facility master as this module needs it. */
export type FacilityLookupEntry = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export interface FacilityLookup {
  findById(facilityId: string): Promise<FacilityLookupEntry | null>;
}

/** Latest decided Director decision, for showing a rejection and its reason. */
export interface ApprovalHistoryReader {
  findLatestDecided(
    resourceType: string,
    resourceId: string,
    subject: ApprovalRequest["subject"],
  ): Promise<ApprovalRequest | null>;
}

export const facilityContractErrorCodes = [
  "NOT_FOUND",
  "FACILITY_NOT_FOUND",
  "FACILITY_INACTIVE",
  "ORDER_NOT_FOUND",
  "ORDER_CLOSED",
  "DUPLICATE_CODE",
  "REVISION_CONFLICT",
  "STATUS_MISMATCH",
  "INVALID_INPUT",
  "NO_PRICE_INCREASE",
  "HAS_OPEN_PAYMENTS",
  "AMOUNT_EXCEEDS_CONTRACT",
  "SELF_CHECK",
  "SELF_APPROVAL",
  "APPROVAL_ALREADY_VALID",
] as const;

export type FacilityContractErrorCode =
  (typeof facilityContractErrorCodes)[number];

export class FacilityContractError extends Error {
  readonly code: FacilityContractErrorCode;

  constructor(code: FacilityContractErrorCode, message: string) {
    super(message);
    this.name = "FacilityContractError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
const revisionSchema = z.coerce.number().int().min(0);

/** A blank text field means "not set". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null));

/** VND integers typed with thousands separators ("1.200.000") are accepted. */
const vndAmountSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.replace(/[\s.,_]/g, "") : value,
  z.string().regex(/^[1-9]\d{0,14}$/, "A VND amount must be a whole number."),
);

/** Blank means the contract does not fix a quantity. */
const quantitySchema = z
  .string()
  .nullable()
  .default(null)
  .transform((value) => value?.trim() || null)
  .refine(
    (value) =>
      value === null || /^(?:0|[1-9]\d{0,9})(?:\.\d{1,3})?$/.test(value),
    "Quantity must be a number.",
  );

const requiredDate = z.coerce.date();

export const facilityContractLineInputSchema = z.object({
  productCode: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(300),
  quantity: quantitySchema,
  unit: z
    .string()
    .trim()
    .max(20)
    .default("cái")
    .transform((value) => value || "cái"),
  unitPrice: vndAmountSchema,
});

export type FacilityContractLineInput = z.infer<
  typeof facilityContractLineInputSchema
>;

const contractFieldsSchema = z.object({
  facilityId: z.string().trim().min(1).max(80),
  orderId: z
    .union([z.literal(""), objectIdSchema])
    .nullable()
    .default(null)
    .transform((value) => (value ? value : null)),
  lines: z.array(facilityContractLineInputSchema).min(1).max(100),
  startDate: requiredDate,
  deliveryDate: requiredDate,
  note: optionalText(2_000),
});

const datesInOrder = (value: { startDate: Date; deliveryDate: Date }) =>
  value.deliveryDate.getTime() >= value.startDate.getTime();

export const createFacilityContractInputSchema = contractFieldsSchema
  .extend({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .max(40)
      .nullable()
      .default(null)
      .transform((value) => (value ? value : null))
      .pipe(
        z
          .string()
          .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
          .nullable(),
      ),
  })
  .refine(datesInOrder, {
    message: "The delivery date cannot precede the start date.",
    path: ["deliveryDate"],
  });

export const updateFacilityContractInputSchema = contractFieldsSchema
  .extend({ contractId: objectIdSchema, expectedRevision: revisionSchema })
  .refine(datesInOrder, {
    message: "The delivery date cannot precede the start date.",
    path: ["deliveryDate"],
  });

export const contractRevisionInputSchema = z.object({
  contractId: objectIdSchema,
  expectedRevision: revisionSchema,
});

export const cancelFacilityContractInputSchema =
  contractRevisionInputSchema.extend({
    reason: z.string().trim().min(1).max(2_000),
  });

export const facilityContractDocumentInputSchema =
  contractRevisionInputSchema.extend({
    kind: z.enum(facilityContractDocumentKinds),
    publicId: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .regex(/^[A-Za-z0-9._\-/]+$/),
    assetVersion: z.coerce.number().int().min(1),
    format: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]{1,10}$/),
    bytes: z.coerce.number().int().min(1),
    label: z.string().trim().min(1).max(200),
  });

export const removeFacilityContractDocumentInputSchema =
  contractRevisionInputSchema.extend({ documentId: objectIdSchema });

export const proposeFacilityPaymentInputSchema = z.object({
  contractId: objectIdSchema,
  amount: vndAmountSchema,
  note: optionalText(2_000),
});

export const paymentRevisionInputSchema = z.object({
  paymentId: objectIdSchema,
  expectedRevision: revisionSchema,
});

export const rejectFacilityPaymentInputSchema =
  paymentRevisionInputSchema.extend({
    reason: z.string().trim().min(1).max(2_000),
  });

export const markFacilityPaymentPaidInputSchema =
  paymentRevisionInputSchema.extend({
    paidOn: requiredDate,
    paidNote: optionalText(2_000),
  });

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

function codeTail(random: () => number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 4 },
    () => alphabet[Math.floor(random() * alphabet.length)] ?? "X",
  ).join("");
}

function datePart(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** HDCS-YYYYMMDD-XXXX; the unique index arbitrates a collision. */
export function generateFacilityContractCode(
  now: Date,
  random: () => number = Math.random,
): string {
  return `HDCS-${datePart(now)}-${codeTail(random)}`;
}

/** DNTT-YYYYMMDD-XXXX; the unique index arbitrates a collision. */
export function generateFacilityPaymentCode(
  now: Date,
  random: () => number = Math.random,
): string {
  return `DNTT-${datePart(now)}-${codeTail(random)}`;
}

export function normalizeProductCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Stamps each line with the unit price of the same item (normalized code) on
 * the most recently activated OTHER active contract, from any site. Lines of
 * an item never bought before carry nulls.
 */
export function withPreviousPrices(
  lines: readonly Omit<
    NewFacilityContractLine,
    "previousUnitPrice" | "previousContractCode"
  >[],
  activeContracts: readonly Pick<
    FacilityContractRecordDto,
    "id" | "code" | "status" | "activatedAt" | "lines"
  >[],
  excludeContractId: string | null,
): NewFacilityContractLine[] {
  const latest = new Map<string, { price: string; code: string; at: number }>();
  for (const contract of activeContracts) {
    if (contract.status !== "active" || contract.id === excludeContractId) {
      continue;
    }
    const at = contract.activatedAt?.getTime() ?? 0;
    const seen = new Set<string>();
    for (const line of contract.lines) {
      const key = normalizeProductCode(line.productCode);
      if (seen.has(key)) continue;
      seen.add(key);
      const current = latest.get(key);
      if (!current || at > current.at) {
        latest.set(key, { price: line.unitPrice, code: contract.code, at });
      }
    }
  }

  return lines.map((line) => {
    const previous = latest.get(normalizeProductCode(line.productCode));
    return {
      ...line,
      previousUnitPrice: previous?.price ?? null,
      previousContractCode: previous?.code ?? null,
    };
  });
}

/** A line whose price is above the price paid before for the same item. */
export function lineExceedsPrevious(
  line: Pick<FacilityContractLine, "unitPrice" | "previousUnitPrice">,
): boolean {
  if (line.previousUnitPrice === null) return false;
  return (
    compare(
      money(line.unitPrice, "VND"),
      money(line.previousUnitPrice, "VND"),
    ) > 0
  );
}

export function exceedingLineCount(
  lines: readonly Pick<
    FacilityContractLine,
    "unitPrice" | "previousUnitPrice"
  >[],
): number {
  return lines.filter(lineExceedsPrevious).length;
}

/**
 * Σ quantity × unit price, in VND. Null when any line has no quantity: the
 * value cannot be known yet.
 */
export function contractValue(
  lines: readonly Pick<FacilityContractLine, "quantity" | "unitPrice">[],
): Money | null {
  if (lines.length === 0) return null;
  const amounts: Money[] = [];
  for (const line of lines) {
    if (line.quantity === null) return null;
    amounts.push(multiply(money(line.unitPrice, "VND"), line.quantity));
  }
  return sum(amounts, "VND");
}

/** The contract promises delivery after the linked order's delivery date. */
export function deliversAfterOrderDue(
  contract: Pick<FacilityContractRecordDto, "deliveryDate">,
  orderDeliveryDueAt: Date | null,
): boolean {
  return (
    orderDeliveryDueAt !== null &&
    contract.deliveryDate.getTime() > orderDeliveryDueAt.getTime()
  );
}

export function approvalSummaryForContract(
  contract: Pick<FacilityContractRecordDto, "code" | "facilityName">,
  exceedingLines: number,
): string {
  return `${contract.code} · ${contract.facilityName} · ${exceedingLines} dòng cao hơn giá cũ`;
}

export function approvalSummaryForPayment(
  payment: Pick<
    FacilityPaymentRecordDto,
    "code" | "contractCode" | "facilityName"
  >,
): string {
  return `${payment.code} · ${payment.contractCode} · ${payment.facilityName}`;
}

/** Payments that still count against a contract's value. */
export function countsAgainstContract(
  payment: Pick<FacilityPaymentRecordDto, "status">,
): boolean {
  return payment.status !== "rejected";
}

export type DirectorDecisionState =
  | { kind: "none" }
  | { kind: "pending" }
  /** Pending, but raised against an older revision: it can no longer release. */
  | { kind: "pendingStale" }
  | { kind: "approved"; decidedAt: Date | null }
  /** Approved for an older revision. */
  | { kind: "stale" }
  | { kind: "rejected"; reason: string | null; decidedAt: Date | null };

/**
 * Where the Director's decision stands for a record at `revision`. A pending
 * request wins; then a valid approval; then the most recent decision.
 */
export function directorDecisionState(
  input: {
    pending: ApprovalRequest | null;
    approved: ApprovalRequest | null;
    latestDecided: ApprovalRequest | null;
  },
  revision: number,
): DirectorDecisionState {
  if (input.pending) {
    return input.pending.expectedRevision === revision
      ? { kind: "pending" }
      : { kind: "pendingStale" };
  }
  if (input.approved && input.approved.expectedRevision === revision) {
    return { kind: "approved", decidedAt: input.approved.decidedAt };
  }
  const latest = input.latestDecided;
  if (latest && latest.status === "rejected") {
    return {
      kind: "rejected",
      reason: latest.decisionReason,
      decidedAt: latest.decidedAt,
    };
  }
  if (input.approved) return { kind: "stale" };
  return { kind: "none" };
}

/** Who acts next on a payment request. */
export type PaymentNextActor =
  | "factoryAccountantCheck"
  | "companyAccountantApprove"
  | "directorThenPay"
  | null;

export function paymentNextActor(
  status: FacilityPaymentStatus,
): PaymentNextActor {
  switch (status) {
    case "proposed":
      return "factoryAccountantCheck";
    case "checked":
      return "companyAccountantApprove";
    case "accountantApproved":
      return "directorThenPay";
    default:
      return null;
  }
}

export type SiteBalance = {
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  activeContracts: number;
  /** Total value of active contracts whose value is known. */
  knownValue: Money;
  /** Active contracts whose value cannot be computed (a line has no quantity). */
  unknownValueContracts: number;
  paid: Money;
  /** Approved by the Company Accountant, not yet paid. */
  approvedUnpaid: Money;
  /** Known value minus paid. */
  remaining: Money;
};

/**
 * What each production site is owed ("Công nợ cơ sở"). Only active contracts
 * count towards the value; payments count by status wherever they sit.
 */
export function siteBalances(
  contracts: readonly Pick<
    FacilityContractRecordDto,
    "facilityId" | "facilityCode" | "facilityName" | "status" | "lines"
  >[],
  payments: readonly Pick<
    FacilityPaymentRecordDto,
    "facilityId" | "facilityName" | "status" | "amount"
  >[],
): SiteBalance[] {
  type Totals = {
    facilityId: string;
    facilityCode: string;
    facilityName: string;
    activeContracts: number;
    unknownValueContracts: number;
    known: Money[];
    paid: Money[];
    approvedUnpaid: Money[];
  };
  const rows = new Map<string, Totals>();
  const rowFor = (facilityId: string, code: string, name: string): Totals => {
    let row = rows.get(facilityId);
    if (!row) {
      row = {
        facilityId,
        facilityCode: code,
        facilityName: name,
        activeContracts: 0,
        unknownValueContracts: 0,
        known: [],
        paid: [],
        approvedUnpaid: [],
      };
      rows.set(facilityId, row);
    }
    return row;
  };

  for (const contract of contracts) {
    if (contract.status !== "active") continue;
    const row = rowFor(
      contract.facilityId,
      contract.facilityCode,
      contract.facilityName,
    );
    row.activeContracts += 1;
    const value = contractValue(contract.lines);
    if (value) row.known.push(value);
    else row.unknownValueContracts += 1;
  }

  for (const payment of payments) {
    if (payment.status !== "paid" && payment.status !== "accountantApproved") {
      continue;
    }
    const row = rowFor(payment.facilityId, "", payment.facilityName);
    const amount = money(payment.amount, "VND");
    if (payment.status === "paid") row.paid.push(amount);
    else row.approvedUnpaid.push(amount);
  }

  return [...rows.values()]
    .map((row) => {
      const knownValue = sum(row.known, "VND");
      const paid = sum(row.paid, "VND");
      return {
        facilityId: row.facilityId,
        facilityCode: row.facilityCode,
        facilityName: row.facilityName,
        activeContracts: row.activeContracts,
        knownValue,
        unknownValueContracts: row.unknownValueContracts,
        paid,
        approvedUnpaid: sum(row.approvedUnpaid, "VND"),
        remaining: subtract(knownValue, paid),
      };
    })
    .sort((left, right) =>
      left.facilityName.localeCompare(right.facilityName, "vi"),
    );
}
