import type { CustomerRecordDto } from "@/domains/customers/contracts";
import type {
  FinanceEntryRecordDto,
  FinancePaymentMethod,
  ReceiptAllocation,
} from "@/domains/finance/contracts";
import { customerKeyOf } from "@/domains/finance/receivables";
import type { Permission } from "@/domains/identity/permissions";
import type { OrderRecordDto } from "@/domains/orders/contracts";
import {
  orderStageDefinitions,
  type OrderStage,
} from "@/domains/orders/workflow";
import type {
  CheckSummary,
  ParsedRow,
  RowOutcome,
  RowResult,
  RowSystemView,
  SheetCheckTemplate,
  SheetMapping,
  SheetRow,
  SystemCustomerView,
  SystemOnlyItem,
  SystemOrderView,
  SystemReceiptView,
  SystemSnapshot,
} from "@/domains/sheet-checks/contracts";
import type { Issue, IssueCode } from "@/domains/sheet-checks/issues";
import { moneyText } from "@/domains/sheet-checks/parsing/money";
import type { ParsedRows } from "@/domains/sheet-checks/parsing/rows";
import {
  addBusinessDays,
  daysBetween,
  formatBusinessDay,
} from "@/domains/tasks/policy";
import {
  compare,
  money,
  negate,
  subtract,
  type Currency,
  type Money,
} from "@/lib/money";

/**
 * Building blocks every reconciliation engine shares: the common input
 * shape, day arithmetic in the business zone, money differences, the
 * system-view renderers and the per-row accumulator that turns findings
 * into an outcome. Pure on purpose — no store, no session, no clock.
 */

export { customerKeyOf };

export type ReconcileInput = {
  template: SheetCheckTemplate;
  mapping: SheetMapping;
  /** Stored rows, all kinds. */
  rows: readonly SheetRow[];
  parsed: ParsedRows;
  headerTexts: readonly string[];
  system: SystemSnapshot;
  now: Date;
  timeZone: string;
};

export type ReconcileOutput = {
  rowResults: { rowIndex: number; result: RowResult }[];
  sheetIssues: Issue[];
  summary: CheckSummary;
  systemOnly: SystemOnlyItem[];
  exercised: Permission[];
};

/* ------------------------------------------------------------------ */
/* Days                                                                */
/* ------------------------------------------------------------------ */

/** `YYYY-MM-DD` of an instant in the business zone. */
export function dayOf(instant: Date, timeZone: string): string {
  return formatBusinessDay(instant, timeZone);
}

/** Calendar-day arithmetic on `YYYY-MM-DD` values. */
export function addDays(day: string, days: number): string {
  return addBusinessDays(day, days);
}

/** Whole days between two business days, as a distance (never negative). */
export function dayDistance(left: string, right: string): number {
  return Math.abs(daysBetween(left, right));
}

export function isDayWithin(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

/** Money from a stored `{amount, currency}` pair (orders, invoices, entries). */
export function moneyOf(value: { amount: string; currency: Currency }): Money {
  return money(value.amount, value.currency);
}

/** `left − right`, both in the same currency. */
export function diff(left: Money, right: Money): Money {
  return subtract(left, right);
}

export function absDiff(left: Money, right: Money): Money {
  const value = subtract(left, right);
  return compare(value, money("0", value.currency)) < 0 ? negate(value) : value;
}

/** Signed difference as an issue param, e.g. "-1000000 VND". */
export function diffText(left: Money, right: Money): string {
  return moneyText(diff(left, right));
}

export function sameAmount(left: Money, right: Money): boolean {
  return left.currency === right.currency && compare(left, right) === 0;
}

/* ------------------------------------------------------------------ */
/* System views                                                        */
/* ------------------------------------------------------------------ */

export function receiptDay(
  receipt: Pick<FinanceEntryRecordDto, "occurredAt">,
  timeZone: string,
): string {
  return dayOf(receipt.occurredAt, timeZone);
}

/** "2026-08-15 25000000 VND" — how a receipt is named inside an issue. */
export function receiptRef(
  receipt: Pick<FinanceEntryRecordDto, "occurredAt" | "amount">,
  timeZone: string,
): string {
  return `${receiptDay(receipt, timeZone)} ${moneyText(moneyOf(receipt.amount))}`;
}

/** "invoice:INV-1=25000000" / "order:RD-…=5000000" — one allocation, for the row view. */
export function allocationSummary(allocation: ReceiptAllocation): string {
  return allocation.target === "invoice"
    ? `invoice:${allocation.invoiceNumber}=${allocation.amount}`
    : `order:${allocation.orderCode}=${allocation.amount}`;
}

export const paymentMethodLabelsVi: Record<FinancePaymentMethod, string> = {
  bankTransfer: "chuyển khoản",
  cash: "tiền mặt",
  other: "khác",
};

export function receiptView(
  receipt: FinanceEntryRecordDto,
  timeZone: string,
): SystemReceiptView {
  return {
    id: receipt.id,
    occurredDay: receiptDay(receipt, timeZone),
    amount: moneyOf(receipt.amount),
    counterparty: receipt.counterparty,
    method: receipt.method,
    allocations: receipt.allocations.map(allocationSummary),
    status: receipt.status,
    voidReason: receipt.voidReason,
  };
}

export function stageLabelVi(stage: OrderStage): string {
  return orderStageDefinitions[stage].labels.vi;
}

/** The selling price is included only when the run may compare it. */
export function orderView(
  order: OrderRecordDto,
  sellingPrice: Money | null = null,
): SystemOrderView {
  return {
    id: order.id,
    orderCode: order.orderCode,
    stage: order.stage,
    customerName: order.customerName,
    sellingPrice,
  };
}

export function customerView(customer: CustomerRecordDto): SystemCustomerView {
  return { id: customer.id, name: customer.name, code: customer.code };
}

/* ------------------------------------------------------------------ */
/* Row accumulator                                                     */
/* ------------------------------------------------------------------ */

/**
 * Codes that prove the template's principal record was located, so an
 * error on the same row reads as a mismatch rather than "not found". An
 * engine may also say so explicitly with `markFound()`.
 */
const foundCodes: Record<SheetCheckTemplate, readonly IssueCode[]> = {
  incomingCash: [
    "RECEIPT_MATCHED",
    "RECEIPT_DATE_MISMATCH",
    "RECEIPT_SHORT_BANK_FEE_LIKELY",
    "RECEIPT_SPLIT_MATCH",
    "RECEIPT_MERGED_MATCH",
    "RECEIPT_VOIDED",
  ],
  receivables: [
    "BALANCE_MATCH",
    "BALANCE_MATCH_IGNORING_CREDIT",
    "BALANCE_MISMATCH",
    "INVOICE_MATCHED",
    "INVOICE_MATCH_LOOSE",
    "INVOICE_VOIDED",
    "ORDER_REMAINING_MISMATCH",
    "ORDER_MATCHED",
  ],
  generic: ["ORDER_MATCHED"],
};

function isNotFoundCode(code: IssueCode): boolean {
  return code.endsWith("_NOT_FOUND");
}

export type RowAccumulatorInput = {
  rowIndex: number;
  template: SheetCheckTemplate;
  parsed: ParsedRow;
  /** True for non-data rows (totals, subtotals, groups, blanks). */
  skipped: boolean;
  parsingIssues: readonly Issue[];
};

/**
 * Collects a row's findings in a fixed order — parsing, duplicates,
 * comparison — and derives the outcome:
 *
 * - `skipped` for non-data rows;
 * - an error among the comparison/duplicate findings → `mismatch` when the
 *   principal record was found, `notFound` when a *_NOT_FOUND finding
 *   explains it, otherwise `mismatch`;
 * - a parse error that left nothing to compare → `invalid`;
 * - nothing compared (restricted column, unusable code) → `notCompared`;
 * - a match with no error → `matched`.
 */
export class RowAccumulator {
  readonly rowIndex: number;
  private readonly template: SheetCheckTemplate;
  private readonly parsed: ParsedRow;
  private readonly skipped: boolean;
  private readonly parsingIssues: Issue[];
  private readonly duplicateIssues: Issue[] = [];
  private readonly comparisonIssues: Issue[] = [];
  private system: RowSystemView | null = null;
  private found = false;
  private notCompared = false;

  constructor(input: RowAccumulatorInput) {
    this.rowIndex = input.rowIndex;
    this.template = input.template;
    this.parsed = input.parsed;
    this.skipped = input.skipped;
    this.parsingIssues = [...input.parsingIssues];
  }

  addDuplicateIssues(issues: readonly Issue[]): void {
    this.duplicateIssues.push(...issues);
  }

  addComparisonIssues(issues: readonly Issue[]): void {
    this.comparisonIssues.push(...issues);
  }

  /** Replaces the system view; `null` means the row carries none. */
  setSystem(view: RowSystemView | null): void {
    this.system = view;
  }

  /** The template's principal record (receipt, balance, order) was located. */
  markFound(): void {
    this.found = true;
  }

  /** The row's money column could not be compared for permission reasons. */
  markNotCompared(): void {
    this.notCompared = true;
  }

  get issues(): Issue[] {
    return [
      ...this.parsingIssues,
      ...this.duplicateIssues,
      ...this.comparisonIssues,
    ];
  }

  private principalFound(): boolean {
    if (this.found) return true;
    const codes = foundCodes[this.template];
    return this.comparisonIssues.some((entry) => codes.includes(entry.code));
  }

  outcome(): RowOutcome {
    if (this.skipped) return "skipped";
    const judged = [...this.duplicateIssues, ...this.comparisonIssues];
    if (judged.some((entry) => entry.severity === "error")) {
      if (this.principalFound()) return "mismatch";
      return judged.some((entry) => isNotFoundCode(entry.code))
        ? "notFound"
        : "mismatch";
    }
    if (this.principalFound()) return "matched";
    if (this.notCompared && this.comparisonIssues.length === 0) {
      return "notCompared";
    }
    if (this.parsingIssues.some((entry) => entry.severity === "error")) {
      return "invalid";
    }
    return "notCompared";
  }

  toResult(): RowResult {
    return {
      parsed: this.parsed,
      issues: this.issues,
      system: this.system,
      outcome: this.outcome(),
    };
  }
}
