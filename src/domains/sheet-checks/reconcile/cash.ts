import { Decimal } from "decimal.js";

import type {
  FinanceEntryRecordDto,
  FinancePaymentMethod,
  InvoiceRecordDto,
} from "@/domains/finance/contracts";
import { customerKeyOf } from "@/domains/finance/receivables";
import type { OrderRecordDto } from "@/domains/orders/contracts";
import {
  SheetCheckError,
  type CandidateReason,
  type MatchStrength,
  type ParsedRow,
  type ReceiptCandidateView,
  type RowSystemView,
  type SystemCustomerView,
  type SystemOnlyItem,
} from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import {
  looseKey,
  normalizeName,
  stripDiacritics,
} from "@/domains/sheet-checks/parsing/code";
import {
  moneyText,
  withinFeeTolerance,
} from "@/domains/sheet-checks/parsing/money";
import {
  keysIntersect,
  receiptCustomerKeys,
  resolveCustomer,
  rowCustomerKeys,
  type CustomerFallback,
  type CustomerResolution,
} from "@/domains/sheet-checks/reconcile/customers";
import {
  orderIssues,
  resolveOrder,
  type OrderIndex,
} from "@/domains/sheet-checks/reconcile/orders";
import {
  absDiff,
  addDays,
  dayDistance,
  diffText,
  isDayWithin,
  moneyOf,
  orderView,
  paymentMethodLabelsVi,
  receiptDay,
  receiptRef,
  receiptView,
  sameAmount,
  type ReconcileInput,
} from "@/domains/sheet-checks/reconcile/shared";
import {
  add,
  compare,
  multiply,
  subtract,
  zero,
  type Currency,
  type Money,
} from "@/lib/money";

/**
 * The "báo cáo tiền về" engine: every sheet row that says money arrived
 * is paired with one customer receipt (category orderPayment) the system
 * holds, each receipt consumed at most once, strongest evidence first —
 * a bank reference, then customer + amount + date, then the allocation
 * target, then amount + date alone, then a bank-fee-sized difference,
 * then split and merged transfers. What stays unpaired on either side is
 * reported with the nearest candidates, and the period total is
 * decomposed into exactly those two remainders.
 *
 * This is not a bank reconciliation: the sheet is compared with the
 * portal's own receipts, never with a bank statement.
 */

export type IncomingCashOutput = {
  rowIssues: Map<number, Issue[]>;
  rowSystem: Map<number, RowSystemView>;
  sheetIssues: Issue[];
  systemOnly: SystemOnlyItem[];
  /** Per currency: the sheet's and the system's period sums as decimal strings. */
  periodTotals: Map<Currency, { sheet: string; system: string }>;
};

type Candidate = {
  receipt: FinanceEntryRecordDto;
  day: string;
  amount: Money;
  keys: ReadonlySet<string>;
  /** Upper-cased order codes and invoice numbers (plus loose keys) the receipt was applied to. */
  targets: ReadonlySet<string>;
  note: string;
  /** Rows that consumed this receipt (several for a split transfer). */
  usedBy: number[];
};

type Work = {
  rowIndex: number;
  sheetRowNumber: number;
  parsed: ParsedRow;
  amount: Money;
  day: string;
  keys: ReadonlySet<string>;
  /** A customer was identified (directory, order, invoice or legacy name). */
  hasIdentity: boolean;
  /** The sheet named a customer, whether or not it could be resolved. */
  namedCustomer: boolean;
  targets: ReadonlySet<string>;
  /** What the sheet says the money was for, for RECEIPT_ALLOCATION_DIFFERS. */
  sheetTarget: string | null;
  customerLabel: string;
  issues: Issue[];
  matched: Candidate[];
  strength: MatchStrength | null;
  candidates: ReceiptCandidateView[];
  settled: boolean;
  order: OrderRecordDto | null;
  customer: SystemCustomerView | null;
};

const WINDOW = sheetCheckLimits.matchWindowDays;
const NOT_FOUND_WINDOW = 2 * WINDOW;
const MIN_BANK_REF_CHARS = 6;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function unconsumed(candidate: Candidate): boolean {
  return candidate.usedBy.length === 0;
}

function isActive(candidate: Candidate): boolean {
  return candidate.receipt.status === "active";
}

function within(
  row: Work,
  candidate: Candidate,
  days: number = WINDOW,
): boolean {
  return dayDistance(row.day, candidate.day) <= days;
}

function sameCurrency(row: Work, candidate: Candidate): boolean {
  return row.amount.currency === candidate.amount.currency;
}

function equalAmount(row: Work, candidate: Candidate): boolean {
  return sameAmount(row.amount, candidate.amount);
}

function sameCustomer(row: Work, candidate: Candidate): boolean {
  return keysIntersect(row.keys, candidate.keys);
}

function sameTarget(row: Work, candidate: Candidate): boolean {
  return keysIntersect(row.targets, candidate.targets);
}

/** Numerically equal amounts regardless of currency (for CURRENCY_MISMATCH). */
function sameFigure(left: Money, right: Money): boolean {
  return new Decimal(left.amount).equals(new Decimal(right.amount));
}

function isPositive(value: Money): boolean {
  return compare(value, zero(value.currency)) > 0;
}

function byDistance(row: Work) {
  return (left: Candidate, right: Candidate): number =>
    dayDistance(row.day, left.day) - dayDistance(row.day, right.day) ||
    left.day.localeCompare(right.day) ||
    left.receipt.id.localeCompare(right.receipt.id);
}

/**
 * Active receipts win over voided ones; among equals the nearest date is
 * chosen. `tie` is the size of the set the choice was made from, so a
 * warning can say how many receipts looked alike.
 */
function pickNearest(
  row: Work,
  pool: readonly Candidate[],
): { chosen: Candidate; tie: number } | null {
  const active = pool.filter(isActive);
  const set = active.length > 0 ? active : pool;
  const [chosen] = [...set].sort(byDistance(row));
  return chosen ? { chosen, tie: set.length } : null;
}

function candidateView(
  candidate: Candidate,
  why: CandidateReason,
): ReceiptCandidateView {
  return {
    id: candidate.receipt.id,
    occurredDay: candidate.day,
    amount: candidate.amount,
    why,
    usedByRowIndex: candidate.usedBy[0] ?? null,
  };
}

function whyOf(row: Work, candidate: Candidate): CandidateReason {
  if (!unconsumed(candidate)) return "ALREADY_USED_BY_ROW";
  if (!isActive(candidate)) return "VOIDED";
  if (!sameCurrency(row, candidate)) return "CURRENCY_DIFF";
  if (!equalAmount(row, candidate)) return "AMOUNT_DIFF";
  return "DATE_DIFF";
}

/** CK / chuyển khoản / bank → bankTransfer; TM / tiền mặt / cash → cash; null when unrecognised. */
export function methodFromText(text: string): FinancePaymentMethod | null {
  const key = ` ${stripDiacritics(text)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
  if (
    /\s(ck|chuyen khoan|bank|bank transfer|transfer|wire|unc|tgnh)\s/.test(key)
  ) {
    return "bankTransfer";
  }
  if (/\s(tm|tien mat|cash)\s/.test(key)) return "cash";
  if (/\s(khac|other)\s/.test(key)) return "other";
  return null;
}

/**
 * The first combination of `min`..`max` items whose amounts add up to
 * `target`, smallest combinations first. Pools are capped by the callers,
 * so the enumeration stays tiny.
 */
function findSubset<T>(
  items: readonly T[],
  target: Money,
  min: number,
  max: number,
  amountOf: (item: T) => Money,
  accept: (subset: readonly T[]) => boolean = () => true,
): T[] | null {
  const currency = target.currency;
  const search = (
    size: number,
    start: number,
    chosen: T[],
    total: Money,
  ): T[] | null => {
    if (chosen.length === size) {
      return compare(total, target) === 0 && accept(chosen)
        ? [...chosen]
        : null;
    }
    for (let index = start; index < items.length; index += 1) {
      const item = items[index];
      if (!item) continue;
      const amount = amountOf(item);
      if (amount.currency !== currency) continue;
      const next = add(total, amount);
      if (compare(next, target) > 0) continue;
      chosen.push(item);
      const found = search(size, index + 1, chosen, next);
      chosen.pop();
      if (found) return found;
    }
    return null;
  };
  for (let size = min; size <= Math.min(max, items.length); size += 1) {
    const found = search(size, 0, [], zero(currency));
    if (found) return found;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Preparation                                                         */
/* ------------------------------------------------------------------ */

function candidateTargets(receipt: FinanceEntryRecordDto): Set<string> {
  const targets = new Set<string>();
  const addCode = (code: string | null) => {
    if (code) targets.add(code.trim().toUpperCase());
  };
  addCode(receipt.orderCode);
  for (const allocation of receipt.allocations) {
    addCode(allocation.orderCode);
    if (allocation.target === "invoice") {
      addCode(allocation.invoiceNumber);
      targets.add(looseKey(allocation.invoiceNumber));
    }
  }
  return targets;
}

function rowTargets(parsed: ParsedRow): Set<string> {
  const targets = new Set<string>();
  if (parsed.orderCode) targets.add(parsed.orderCode.trim().toUpperCase());
  if (parsed.invoiceNumber) {
    targets.add(parsed.invoiceNumber.trim().toUpperCase());
    targets.add(looseKey(parsed.invoiceNumber));
  }
  return targets;
}

function findInvoice(
  number: string,
  invoices: readonly InvoiceRecordDto[],
): InvoiceRecordDto | null {
  const wanted = number.trim().toUpperCase();
  const exact = invoices.find(
    (invoice) => invoice.invoiceNumber.trim().toUpperCase() === wanted,
  );
  if (exact) return exact;
  const loose = looseKey(number);
  return (
    invoices.find((invoice) => looseKey(invoice.invoiceNumber) === loose) ??
    null
  );
}

/** The sheet's customer against the order's, when the directory could not judge. */
function namesDisagree(sheet: string, system: string): boolean {
  const left = normalizeName(sheet);
  const right = normalizeName(system);
  if (left.length === 0 || right.length === 0) return false;
  return left !== right && !left.includes(right) && !right.includes(left);
}

function identify(
  parsed: ParsedRow,
  input: ReconcileInput & { orderIndex: OrderIndex },
): {
  issues: Issue[];
  order: OrderRecordDto | null;
  identity: CustomerResolution;
  customer: SystemCustomerView | null;
} {
  const issues: Issue[] = [];
  let order: OrderRecordDto | null = null;
  if (parsed.orderCode) {
    const resolution = resolveOrder(parsed.orderCode, input.orderIndex);
    issues.push(...resolution.issues);
    order = resolution.order;
    if (order) issues.push(...orderIssues(order));
  }
  let invoice: InvoiceRecordDto | null = null;
  if (parsed.invoiceNumber && input.system.invoices) {
    invoice = findInvoice(parsed.invoiceNumber, input.system.invoices);
  }
  const fallback: CustomerFallback | null = order
    ? { customerId: order.customerId, customerName: order.customerName }
    : invoice
      ? { customerId: invoice.customerId, customerName: invoice.customerName }
      : null;

  const identity = resolveCustomer({
    name: parsed.customerName,
    code: parsed.customerCode,
    directory: input.system.customers,
    fallback,
  });
  issues.push(...identity.issues);

  if (parsed.customerName && fallback) {
    const disagree =
      input.system.customers === null
        ? namesDisagree(parsed.customerName, fallback.customerName)
        : identity.customerId !== null &&
          fallback.customerId !== null &&
          identity.customerId !== fallback.customerId;
    if (disagree) {
      issues.push(
        issue("ORDER_CUSTOMER_MISMATCH", {
          sheet: parsed.customerName,
          system: fallback.customerName,
        }),
      );
    }
  }

  const customer: SystemCustomerView | null =
    identity.customerId !== null && identity.customerName !== null
      ? {
          id: identity.customerId,
          name: identity.customerName,
          code:
            input.system.customers?.find(
              (entry) => entry.id === identity.customerId,
            )?.code ?? null,
        }
      : null;
  return { issues, order, identity, customer };
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

function matchIssue(row: Work, candidate: Candidate): Issue {
  const delta = dayDistance(row.day, candidate.day);
  return delta === 0
    ? issue("RECEIPT_MATCHED", {
        d: candidate.day,
        amount: moneyText(candidate.amount),
      })
    : issue("RECEIPT_DATE_MISMATCH", { n: delta, d: candidate.day });
}

function feeIssue(row: Work, candidate: Candidate): Issue {
  return issue("RECEIPT_SHORT_BANK_FEE_LIKELY", {
    side: compare(row.amount, candidate.amount) < 0 ? "Bảng" : "Hệ thống",
    diff: moneyText(absDiff(row.amount, candidate.amount)),
  });
}

/** What a matched receipt says beyond its amount: void, allocation and method. */
function afterMatch(row: Work, candidate: Candidate): void {
  const receipt = candidate.receipt;
  if (receipt.status === "voided") {
    row.issues.push(
      issue("RECEIPT_VOIDED", { reason: receipt.voidReason ?? "" }),
    );
    return;
  }
  if (receipt.allocations.length === 0) {
    row.issues.push(issue("RECEIPT_UNALLOCATED"));
  } else if (row.sheetTarget && !sameTarget(row, candidate)) {
    row.issues.push(
      issue("RECEIPT_ALLOCATION_DIFFERS", {
        sheetTarget: row.sheetTarget,
        systemTarget: receipt.allocations
          .map((allocation) =>
            allocation.target === "invoice"
              ? allocation.invoiceNumber
              : allocation.orderCode,
          )
          .join(", "),
      }),
    );
  }
  if (row.parsed.method) {
    const method = methodFromText(row.parsed.method);
    if (method !== null && method !== receipt.method) {
      row.issues.push(
        issue("RECEIPT_METHOD_DIFFERS", {
          sheet: row.parsed.method,
          system: paymentMethodLabelsVi[receipt.method],
        }),
      );
    }
  }
}

function assign(
  row: Work,
  chosen: Candidate,
  strength: MatchStrength,
  tie: number,
  issues: readonly Issue[],
): void {
  chosen.usedBy.push(row.rowIndex);
  row.matched.push(chosen);
  row.strength = strength;
  row.settled = true;
  row.issues.push(...issues);
  if (tie > 1) row.issues.push(issue("RECEIPT_MATCH_TIE", { n: tie }));
  afterMatch(row, chosen);
}

/** S1: a bank reference of the sheet found inside the receipt's note identifies it outright. */
function passBankRef(rows: Work[], candidates: Candidate[]): void {
  for (const row of rows) {
    if (row.settled) continue;
    const ref = row.parsed.bankRef?.trim().toLowerCase() ?? "";
    if (ref.length < MIN_BANK_REF_CHARS) continue;
    const pool = candidates.filter(
      (candidate) => unconsumed(candidate) && candidate.note.includes(ref),
    );
    const exact = pool.filter((candidate) => equalAmount(row, candidate));
    const pick = pickNearest(row, exact.length > 0 ? exact : pool);
    if (!pick) continue;
    const { chosen, tie } = pick;
    if (!sameCurrency(row, chosen)) {
      row.issues.push(
        issue("CURRENCY_MISMATCH", {
          sheet: row.amount.currency,
          system: chosen.amount.currency,
        }),
      );
      row.candidates.push(candidateView(chosen, "CURRENCY_DIFF"));
      row.settled = true;
      continue;
    }
    if (equalAmount(row, chosen)) {
      assign(row, chosen, "S1_BANK_REF", tie, [
        issue("RECEIPT_MATCHED", {
          d: chosen.day,
          amount: moneyText(chosen.amount),
        }),
      ]);
    } else if (withinFeeTolerance(row.amount, chosen.amount)) {
      assign(row, chosen, "S1_BANK_REF", tie, [feeIssue(row, chosen)]);
    } else {
      assign(row, chosen, "S1_BANK_REF", tie, [
        issue("RECEIPT_AMOUNT_MISMATCH", {
          system: moneyText(chosen.amount),
          sheet: moneyText(row.amount),
          diff: diffText(row.amount, chosen.amount),
        }),
      ]);
    }
  }
}

/** S2–S4: an equal amount within the window, by customer, by allocation target, or alone. */
function passEqualAmount(
  rows: Work[],
  candidates: Candidate[],
  strength:
    "S2_CUSTOMER_AMOUNT_DATE" | "S3_ALLOCATION_TARGET" | "S4_AMOUNT_DATE",
): void {
  for (const row of rows) {
    if (row.settled) continue;
    if (strength === "S2_CUSTOMER_AMOUNT_DATE" && row.keys.size === 0) continue;
    if (strength === "S3_ALLOCATION_TARGET" && row.targets.size === 0) continue;
    // S4 pairs a row with any receipt of the same amount, so it may only
    // run for a row that names nobody. A row whose customer could not be
    // resolved keeps its finding instead of borrowing someone else's money.
    if (
      strength === "S4_AMOUNT_DATE" &&
      (row.hasIdentity || row.namedCustomer)
    ) {
      continue;
    }
    const pool = candidates.filter(
      (candidate) =>
        unconsumed(candidate) &&
        sameCurrency(row, candidate) &&
        equalAmount(row, candidate) &&
        within(row, candidate) &&
        (strength === "S2_CUSTOMER_AMOUNT_DATE"
          ? sameCustomer(row, candidate)
          : strength === "S3_ALLOCATION_TARGET"
            ? sameTarget(row, candidate)
            : true),
    );
    const pick = pickNearest(row, pool);
    if (!pick) continue;
    const issues: Issue[] = [];
    if (strength === "S4_AMOUNT_DATE") {
      issues.push(
        issue("CUSTOMER_INFERRED", {
          customer: pick.chosen.receipt.counterparty,
        }),
      );
    }
    issues.push(matchIssue(row, pick.chosen));
    assign(row, pick.chosen, strength, pick.tie, issues);
  }
}

/**
 * A bank fee is a small bite out of a real transfer. The absolute floor of
 * the tolerance (30.000 ₫ / 5 USD) must therefore never be as large as the
 * amounts it compares, or a 25.000 ₫ row would "match" an unrelated
 * 40.000 ₫ receipt; zero and negative rows are never fee matches.
 */
function feePlausible(sheet: Money, system: Money): boolean {
  if (!isPositive(sheet) || !isPositive(system)) return false;
  if (!withinFeeTolerance(sheet, system)) return false;
  const smaller = compare(sheet, system) <= 0 ? sheet : system;
  return compare(multiply(absDiff(sheet, system), "2"), smaller) < 0;
}

/** S5: the same customer within the window, off by a bank-fee-sized amount. */
function passFeeTolerance(rows: Work[], candidates: Candidate[]): void {
  for (const row of rows) {
    if (row.settled || row.keys.size === 0) continue;
    const pool = candidates
      .filter(
        (candidate) =>
          unconsumed(candidate) &&
          sameCurrency(row, candidate) &&
          sameCustomer(row, candidate) &&
          within(row, candidate) &&
          !equalAmount(row, candidate) &&
          feePlausible(row.amount, candidate.amount),
      )
      .sort(
        (left, right) =>
          compare(
            absDiff(row.amount, left.amount),
            absDiff(row.amount, right.amount),
          ) || byDistance(row)(left, right),
      );
    const active = pool.filter(isActive);
    const [chosen] = active.length > 0 ? active : pool;
    if (!chosen) continue;
    assign(row, chosen, "S5_FEE_TOLERANCE", 1, [feeIssue(row, chosen)]);
  }
}

/** S6: several sheet rows of one customer add up to one receipt (a combined transfer). */
function passSplit(rows: Work[], candidates: Candidate[]): void {
  const poolCap = 12;
  for (const candidate of candidates) {
    if (!unconsumed(candidate) || !isActive(candidate)) continue;
    const pool = rows
      .filter(
        (row) =>
          !row.settled &&
          isPositive(row.amount) &&
          sameCurrency(row, candidate) &&
          sameCustomer(row, candidate) &&
          within(row, candidate),
      )
      .sort(
        (left, right) =>
          dayDistance(left.day, candidate.day) -
            dayDistance(right.day, candidate.day) ||
          left.rowIndex - right.rowIndex,
      )
      .slice(0, poolCap);
    if (pool.length < 2) continue;
    const subset = findSubset(
      pool,
      candidate.amount,
      2,
      sheetCheckLimits.splitMaxParts,
      (row) => row.amount,
      (chosen) => {
        const days = chosen.map((row) => row.day).sort();
        const first = days[0];
        const last = days[days.length - 1];
        return first !== undefined && last !== undefined
          ? dayDistance(first, last) <= WINDOW
          : false;
      },
    );
    if (!subset) continue;
    const ordered = [...subset].sort(
      (left, right) => left.rowIndex - right.rowIndex,
    );
    const label = ordered.map((row) => row.sheetRowNumber).join(", ");
    for (const row of ordered) {
      candidate.usedBy.push(row.rowIndex);
      row.matched.push(candidate);
      row.strength = "S6_SPLIT";
      row.settled = true;
      row.issues.push(
        issue("RECEIPT_SPLIT_MATCH", {
          rows: label,
          amount: moneyText(candidate.amount),
          d: candidate.day,
        }),
      );
      afterMatch(row, candidate);
    }
  }
}

/** S7: one sheet row equals the sum of a few receipts of the same customer. */
function passMerged(
  rows: Work[],
  candidates: Candidate[],
  timeZone: string,
): void {
  for (const row of rows) {
    if (row.settled || row.keys.size === 0 || !isPositive(row.amount)) continue;
    const pool = candidates
      .filter(
        (candidate) =>
          unconsumed(candidate) &&
          isActive(candidate) &&
          sameCurrency(row, candidate) &&
          sameCustomer(row, candidate) &&
          within(row, candidate),
      )
      .sort(byDistance(row));
    if (pool.length < 2 || pool.length > sheetCheckLimits.mergedMaxCandidates) {
      continue;
    }
    const subset = findSubset(
      pool,
      row.amount,
      2,
      sheetCheckLimits.splitMaxParts,
      (candidate) => candidate.amount,
    );
    if (!subset) continue;
    for (const candidate of subset) candidate.usedBy.push(row.rowIndex);
    row.matched.push(...subset);
    row.strength = "S7_MERGED";
    row.settled = true;
    row.issues.push(
      issue("RECEIPT_MERGED_MATCH", {
        n: subset.length,
        refs: subset
          .map((candidate) => receiptRef(candidate.receipt, timeZone))
          .join("; "),
      }),
    );
    for (const candidate of subset) afterMatch(row, candidate);
  }
}

/** Rows left over: a currency clash, an amount clash on the same day, or nothing at all. */
function settleUnmatched(rows: Work[], candidates: Candidate[]): void {
  for (const row of rows) {
    if (row.settled) continue;

    const foreign = candidates
      .filter(
        (candidate) =>
          unconsumed(candidate) &&
          isActive(candidate) &&
          !sameCurrency(row, candidate) &&
          sameCustomer(row, candidate) &&
          within(row, candidate) &&
          sameFigure(row.amount, candidate.amount),
      )
      .sort(byDistance(row));
    const [clash] = foreign;
    if (clash) {
      row.issues.push(
        issue("CURRENCY_MISMATCH", {
          sheet: row.amount.currency,
          system: clash.amount.currency,
        }),
      );
      row.candidates.push(candidateView(clash, "CURRENCY_DIFF"));
      row.settled = true;
      continue;
    }

    const near = candidates
      .filter(
        (candidate) =>
          unconsumed(candidate) &&
          isActive(candidate) &&
          sameCurrency(row, candidate) &&
          sameCustomer(row, candidate) &&
          within(row, candidate, 1),
      )
      .sort(
        (left, right) =>
          byDistance(row)(left, right) ||
          compare(
            absDiff(row.amount, left.amount),
            absDiff(row.amount, right.amount),
          ),
      );
    const [nearest] = near;
    if (nearest) {
      row.issues.push(
        issue("RECEIPT_AMOUNT_MISMATCH", {
          system: moneyText(nearest.amount),
          sheet: moneyText(row.amount),
          diff: diffText(row.amount, nearest.amount),
        }),
      );
      row.candidates.push(candidateView(nearest, "AMOUNT_DIFF"));
      row.settled = true;
      continue;
    }

    const pool = candidates
      .filter(
        (candidate) =>
          (sameCustomer(row, candidate) &&
            within(row, candidate, NOT_FOUND_WINDOW)) ||
          (sameCurrency(row, candidate) &&
            equalAmount(row, candidate) &&
            within(row, candidate)),
      )
      .sort((left, right) => {
        const leftStrong =
          sameCustomer(row, left) && equalAmount(row, left) ? 0 : 1;
        const rightStrong =
          sameCustomer(row, right) && equalAmount(row, right) ? 0 : 1;
        return leftStrong - rightStrong || byDistance(row)(left, right);
      });
    row.candidates = pool
      .slice(0, sheetCheckLimits.candidatesShown)
      .map((candidate) => candidateView(candidate, whyOf(row, candidate)));
    row.issues.push(
      issue("RECEIPT_NOT_FOUND", {
        customer: row.customerLabel,
        d: row.day,
        amount: moneyText(row.amount),
      }),
    );
    row.settled = true;
  }
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export function reconcileIncomingCash(
  input: ReconcileInput & { orderIndex: OrderIndex },
): IncomingCashOutput {
  const receipts = input.system.receipts;
  if (receipts === null) {
    throw new SheetCheckError(
      "PERMISSION_DENIED",
      "The incoming-cash check needs payments.read.",
    );
  }
  const { timeZone } = input;
  const period = input.mapping.period;
  const hasOrderColumn = input.mapping.columns.some(
    (column) => column.field === "orderCode",
  );
  const hasCustomerColumn = input.mapping.columns.some(
    (column) =>
      column.field === "customerName" || column.field === "customerCode",
  );

  // 1. Candidate receipts: customer payments inside the period ± window.
  const matchFrom = period ? addDays(period.from, -WINDOW) : null;
  const matchTo = period ? addDays(period.to, WINDOW) : null;
  const candidates: Candidate[] = receipts
    .filter(
      (receipt) =>
        receipt.kind === "receipt" && receipt.category === "orderPayment",
    )
    .map((receipt) => ({
      receipt,
      day: receiptDay(receipt, timeZone),
      amount: moneyOf(receipt.amount),
      keys: receiptCustomerKeys(receipt),
      targets: candidateTargets(receipt),
      note: (receipt.note ?? "").toLowerCase(),
      usedBy: [],
    }))
    .filter(
      (candidate) =>
        matchFrom === null ||
        matchTo === null ||
        isDayWithin(candidate.day, matchFrom, matchTo),
    )
    .sort(
      (left, right) =>
        left.day.localeCompare(right.day) ||
        left.receipt.id.localeCompare(right.receipt.id),
    );

  // 2. Rows with an amount and a date; who each one is about.
  const sheetRowNumbers = new Map(
    input.rows.map((row) => [row.index, row.sheetRowNumber]),
  );
  const rows: Work[] = [];
  const amountsWithoutDate: { amount: Money; rowIndex: number }[] = [];
  for (const entry of input.parsed.rows) {
    if (entry.skipped) continue;
    const { parsed } = entry;
    if (!parsed.amount) continue;
    if (!parsed.date) {
      amountsWithoutDate.push({
        amount: parsed.amount,
        rowIndex: entry.rowIndex,
      });
      continue;
    }
    const { issues, order, identity, customer } = identify(parsed, input);
    rows.push({
      rowIndex: entry.rowIndex,
      sheetRowNumber: sheetRowNumbers.get(entry.rowIndex) ?? entry.rowIndex + 1,
      parsed,
      amount: parsed.amount,
      day: parsed.date,
      keys: rowCustomerKeys(identity, parsed.customerName),
      hasIdentity: identity.customerKey !== null,
      namedCustomer: Boolean(parsed.customerName ?? parsed.customerCode),
      targets: rowTargets(parsed),
      sheetTarget: parsed.orderCode ?? parsed.invoiceNumber,
      customerLabel:
        identity.customerName ??
        parsed.customerName ??
        parsed.customerCode ??
        parsed.orderCode ??
        parsed.invoiceNumber ??
        "—",
      issues,
      matched: [],
      strength: null,
      candidates: [],
      settled: false,
      order,
      customer,
    });
  }

  // 3. Matching, strongest evidence first, each receipt consumed once.
  passBankRef(rows, candidates);
  passEqualAmount(rows, candidates, "S2_CUSTOMER_AMOUNT_DATE");
  passEqualAmount(rows, candidates, "S3_ALLOCATION_TARGET");
  passEqualAmount(rows, candidates, "S4_AMOUNT_DATE");
  passFeeTolerance(rows, candidates);
  passSplit(rows, candidates);
  passMerged(rows, candidates, timeZone);
  settleUnmatched(rows, candidates);

  // 4. Row outputs.
  const rowIssues = new Map<number, Issue[]>();
  const rowSystem = new Map<number, RowSystemView>();
  for (const row of rows) {
    rowIssues.set(row.rowIndex, row.issues);
    rowSystem.set(row.rowIndex, {
      ...(hasOrderColumn
        ? { order: row.order ? orderView(row.order) : null }
        : {}),
      ...(hasCustomerColumn ? { customer: row.customer } : {}),
      receipts: row.matched.map((candidate) =>
        receiptView(candidate.receipt, timeZone),
      ),
      candidates: row.candidates,
      matchStrength: row.strength,
    });
  }

  // 5. Receipts the sheet should have shown: active, unpaired, inside the
  //    period (or, without one, around the sheet's own dates).
  const sheetDays = rows.map((row) => row.day).sort();
  const firstDay = sheetDays[0];
  const lastDay = sheetDays[sheetDays.length - 1];
  const reportWindow: { from: string; to: string } | null = period
    ? { from: period.from, to: period.to }
    : firstDay !== undefined && lastDay !== undefined
      ? { from: addDays(firstDay, -WINDOW), to: addDays(lastDay, WINDOW) }
      : null;
  const inReportWindow = (day: string): boolean =>
    reportWindow === null ||
    isDayWithin(day, reportWindow.from, reportWindow.to);

  const systemOnly: SystemOnlyItem[] = [];
  const sheetIssues: Issue[] = [];
  const missing: Candidate[] = [];
  for (const candidate of candidates) {
    if (!isActive(candidate) || !unconsumed(candidate)) continue;
    if (reportWindow === null || !inReportWindow(candidate.day)) continue;
    missing.push(candidate);
    systemOnly.push({
      kind: "receipt",
      label: candidate.receipt.counterparty,
      day: candidate.day,
      amount: candidate.amount,
      issue: issue("RECEIPT_NOT_IN_SHEET", {
        d: candidate.day,
        amount: moneyText(candidate.amount),
        customer: candidate.receipt.counterparty,
      }),
    });
  }

  // Two active receipts of one customer, same day, same amount, look like a
  // double entry on the system side.
  const alike = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    if (!isActive(candidate)) continue;
    const receipt = candidate.receipt;
    const key = [
      customerKeyOf(receipt.customerId, receipt.counterparty),
      candidate.day,
      moneyText(candidate.amount),
    ].join("|");
    const group = alike.get(key) ?? [];
    group.push(candidate);
    alike.set(key, group);
  }
  for (const group of alike.values()) {
    const [first] = group;
    if (group.length < 2 || !first) continue;
    sheetIssues.push(
      issue("SYSTEM_DUPLICATE_SUSPECT", {
        d: first.day,
        refs: `${group.length} × ${moneyText(first.amount)} (${first.receipt.counterparty})`,
      }),
    );
  }

  // 6. Period totals per currency and their decomposition into the two
  //    remainders: sheet rows without a receipt minus receipts not on the sheet.
  const periodTotals = new Map<Currency, { sheet: string; system: string }>();
  const currencies = new Set<Currency>();
  const inPeriod = (day: string | null): boolean =>
    period === null || day === null || isDayWithin(day, period.from, period.to);
  const sheetRows = [
    ...rows
      .filter((row) => inPeriod(row.day))
      .map((row) => ({
        amount: row.amount,
        unmatched: row.matched.length === 0,
      })),
    ...amountsWithoutDate.map((entry) => ({
      amount: entry.amount,
      unmatched: true,
    })),
  ];
  for (const entry of sheetRows) currencies.add(entry.amount.currency);
  const systemReceipts = candidates.filter(
    (candidate) =>
      isActive(candidate) &&
      reportWindow !== null &&
      inReportWindow(candidate.day),
  );
  for (const candidate of systemReceipts)
    currencies.add(candidate.amount.currency);

  for (const currency of [...currencies].sort()) {
    let sheet = zero(currency);
    let unmatchedSum = zero(currency);
    let unmatchedCount = 0;
    for (const entry of sheetRows) {
      if (entry.amount.currency !== currency) continue;
      sheet = add(sheet, entry.amount);
      if (entry.unmatched) {
        unmatchedSum = add(unmatchedSum, entry.amount);
        unmatchedCount += 1;
      }
    }
    let system = zero(currency);
    for (const candidate of systemReceipts) {
      if (candidate.amount.currency === currency) {
        system = add(system, candidate.amount);
      }
    }
    let missingSum = zero(currency);
    let missingCount = 0;
    for (const candidate of missing) {
      if (candidate.amount.currency !== currency) continue;
      missingSum = add(missingSum, candidate.amount);
      missingCount += 1;
    }
    periodTotals.set(currency, { sheet: sheet.amount, system: system.amount });
    if (compare(sheet, system) !== 0) {
      sheetIssues.push(
        issue("PERIOD_TOTAL_MISMATCH", {
          sheet: moneyText(sheet),
          system: moneyText(system),
          diff: diffText(sheet, system),
          x: unmatchedCount,
          a: moneyText(unmatchedSum),
          y: missingCount,
          b: moneyText(missingSum),
          // Rows matched with a small difference (a bank fee) or across the
          // period edge belong to neither remainder; naming the rest keeps
          // the sentence from claiming an identity that need not hold.
          residual: moneyText(
            subtract(
              subtract(sheet, system),
              subtract(unmatchedSum, missingSum),
            ),
          ),
        }),
      );
    }
  }

  return { rowIssues, rowSystem, sheetIssues, systemOnly, periodTotals };
}
